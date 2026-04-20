import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, TextInput, Alert, Platform, AppState,
  RefreshControl, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../src/theme";
import { Card } from "../src/ui";
import { api, setToken } from "../src/api";

type AppKey = "YouTube" | "Instagram" | "Chrome";

const APP_META: Record<AppKey, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  YouTube:   { color: colors.youtube,   icon: "logo-youtube" },
  Instagram: { color: colors.instagram, icon: "logo-instagram" },
  Chrome:    { color: colors.chrome,    icon: "logo-chrome" },
};

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function ChildScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [activeChild, setActiveChild] = useState<any>(null);
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [monitoringOn, setMonitoringOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [pin, setPin] = useState("");
  const heartbeatRef = useRef<any>(null);
  const refreshRef = useRef<any>(null);

  const fetchSummary = useCallback(async (childId: string) => {
    const s = await api<any>(`/activity/summary/${childId}?days=1`);
    setSummary(s);
    setMonitoringOn(!!s?.monitoring_active);
    return s;
  }, []);

  // Initial boot: who am I, load claimed child device
  const boot = useCallback(async () => {
    try {
      const me = await api<any>("/auth/me");
      if (me?.role !== "child") {
        router.replace(me?.is_admin ? "/admin" : "/parent");
        return;
      }
      setUser(me);
      const myDevice = await api<any>("/children/my-device").catch(() => null);
      const list = myDevice ? [myDevice] : [];
      setChildren(list);
      setActiveChild(myDevice);
      if (myDevice) await fetchSummary(myDevice.child_id);
    } catch {
      router.replace("/role");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchSummary, router]);

  useEffect(() => { boot(); }, [boot]);

  // Heartbeat every 15s so the parent sees this device as ACTIVE
  useEffect(() => {
    const child = activeChild;
    if (!child) return;
    const sendBeat = () => {
      api("/monitoring/heartbeat", {
        method: "POST",
        body: JSON.stringify({ child_id: child.child_id, monitoring_active: monitoringOn }),
      }).catch(() => {});
    };
    sendBeat();
    heartbeatRef.current = setInterval(sendBeat, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, [activeChild, monitoringOn]);

  // Auto-refresh the usage summary every 5s so kid sees live today's time
  useEffect(() => {
    const child = activeChild;
    if (!child) return;
    refreshRef.current = setInterval(async () => {
      try {
        await fetchSummary(child.child_id);
      } catch {}
    }, 5000);
    return () => clearInterval(refreshRef.current);
  }, [activeChild, fetchSummary]);

  // Native: sticky notification "Monitoring is active"
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.requestPermissionsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "GuardianNest is watching",
            body: "Your parent has enabled monitoring on this device.",
            sticky: true,
          },
          trigger: null,
        });
      } catch {}
    })();
  }, []);

  // Android real usage ingestion (requires dev build + usage permission)
  useEffect(() => {
    if (Platform.OS !== "android" || !activeChild || !monitoringOn) return;
    let timer: any;
    const pollUsage = async () => {
      try {
        const mod: any = await (new Function("m", "return import(m)"))("react-native-usage-stats-manager");
        const UsageStatsManager = mod?.default || mod?.UsageStatsManager || mod;
        if (!UsageStatsManager?.queryUsageStats) return;
        const end = Date.now();
        const start = end - 5 * 60 * 1000; // last 5 minutes
        const rows = await UsageStatsManager.queryUsageStats(start, end);
        if (!Array.isArray(rows)) return;
        const buckets: Record<string, number> = { YouTube: 0, Instagram: 0, Chrome: 0 };
        for (const row of rows) {
          const pkg = row?.packageName || row?.package_name;
          const ms = Number(row?.totalTimeInForeground ?? row?.total_time_in_foreground ?? 0);
          if (pkg === "com.google.android.youtube") buckets.YouTube += ms;
          if (pkg === "com.instagram.android") buckets.Instagram += ms;
          if (pkg === "com.android.chrome") buckets.Chrome += ms;
        }
        for (const [app, ms] of Object.entries(buckets)) {
          const seconds = Math.floor(ms / 1000);
          if (seconds > 0) {
            await api("/activity/log", {
              method: "POST",
              body: JSON.stringify({
                child_id: activeChild.child_id,
                app_name: app,
                duration_seconds: seconds,
              }),
            });
          }
        }
      } catch {
        // library/permission missing in Expo Go; keep app stable
      }
    };
    pollUsage();
    timer = setInterval(pollUsage, 60000);
    return () => clearInterval(timer);
  }, [activeChild, monitoringOn]);

  // Foreground/background heartbeat so parent knows when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener("change", () => {
      if (activeChild) {
        api("/monitoring/heartbeat", {
          method: "POST",
          body: JSON.stringify({ child_id: activeChild.child_id, monitoring_active: monitoringOn }),
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [activeChild, monitoringOn]);

  const toggleMonitoring = async (value: boolean) => {
    if (!activeChild) return;
    setMonitoringOn(value);
    await api("/monitoring/heartbeat", {
      method: "POST",
      body: JSON.stringify({ child_id: activeChild.child_id, monitoring_active: value }),
    });
  };

  const claimDevice = async () => {
    if (!pairCode.trim()) return Alert.alert("Enter pairing code");
    setPairing(true);
    try {
      const claimed = await api<any>("/children/claim", {
        method: "POST",
        body: JSON.stringify({
          pairing_code: pairCode.trim(),
          device_name: `${user?.name || "Child"}'s Device`,
        }),
      });
      setPairCode("");
      setActiveChild(claimed);
      setChildren([claimed]);
      await fetchSummary(claimed.child_id);
    } catch (e: any) {
      Alert.alert("Pairing failed", e.message || "Invalid code");
    } finally {
      setPairing(false);
    }
  };

  const tryExit = async () => {
    try {
      await api("/parent/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      setExitModal(false);
      setPin("");
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      await setToken(null);
      router.replace("/role");
    } catch (e: any) {
      Alert.alert("Access denied", e.message || "Wrong PIN");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    boot();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const perApp = summary?.per_app_minutes || {};
  const totalMins = summary?.total_minutes || 0;

  if (!activeChild) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark" size={16} color="#065F46" />
          <Text style={styles.bannerText}>Child mode active</Text>
        </View>
        <View style={[styles.container, { justifyContent: "center", flex: 1 }]}>
          <Card>
            <Text style={styles.modalTitle}>Pair this device</Text>
            <Text style={styles.modalSub}>
              Ask your parent to create a child device from Parent Dashboard and share the 6-digit code.
            </Text>
            <TextInput
              testID="pairing-code-input"
              style={styles.input}
              value={pairCode}
              onChangeText={setPairCode}
              keyboardType="number-pad"
              placeholder="Enter pairing code"
              placeholderTextColor={colors.textMuted}
              maxLength={6}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={claimDevice} disabled={pairing} testID="pairing-submit-btn">
              {pairing ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: "700", color: "#fff" }}>Connect device</Text>}
            </TouchableOpacity>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Persistent banner */}
      <View style={styles.banner} testID="child-status-banner">
        <Ionicons name="shield-checkmark" size={16} color="#065F46" />
        <Text style={styles.bannerText}>Parental watch is ACTIVE</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        testID="child-dashboard"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero: who's watching */}
        <Text style={styles.label}>TODAY</Text>
        <Text style={styles.title}>Hi, {user?.name?.split(" ")[0] || "friend"} 👋</Text>
        <Text style={styles.sub}>Your parent can see your screen time. Live updates every 5 seconds.</Text>

        {/* Big total */}
        <View style={styles.totalCard} testID="child-total-time">
          <Text style={styles.totalLabel}>TOTAL SCREEN TIME TODAY</Text>
          <Text style={styles.totalValue}>{fmt(totalMins)}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={styles.settingTitle}>Monitoring status</Text>
              <Text style={styles.settingSub}>
                Turning this OFF immediately sends an alert to your parent.
              </Text>
            </View>
            <Switch
              testID="monitoring-toggle"
              value={monitoringOn}
              onValueChange={toggleMonitoring}
            />
          </View>
        </Card>

        {/* Apps */}
        <Text style={styles.sectionLabel}>APPS</Text>
        {(Object.keys(APP_META) as AppKey[]).map((name) => {
          const mins = perApp[name] || 0;
          const meta = APP_META[name];
          const pct = totalMins > 0 ? Math.min(100, Math.round((mins / totalMins) * 100)) : 0;
          return (
            <View
              key={name}
              style={styles.appRow}
              testID={`child-app-${name}`}
            >
              <View style={[styles.appIcon, { backgroundColor: meta.color }]}>
                <Ionicons name={meta.icon} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appName}>{name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                </View>
              </View>
              <Text style={styles.appMins}>{fmt(mins)}</Text>
            </View>
          );
        })}

        <Text style={styles.reminder}>
          Take breaks. Be kind online. Your parent is watching because they care.
        </Text>

        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => setExitModal(true)}
          testID="exit-child-mode-btn"
        >
          <Ionicons name="lock-closed" size={14} color={colors.textSoft} />
          <Text style={styles.exitText}>Exit child mode · PIN required</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={exitModal} transparent animationType="fade" onRequestClose={() => setExitModal(false)}>
        <View style={styles.modalBg}>
          <Card style={{ backgroundColor: "#fff" }}>
            <Text style={styles.modalTitle}>Parent PIN required</Text>
            <Text style={styles.modalSub}>Only the parent can disable child mode.</Text>
            <TextInput
              testID="exit-pin-input"
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
              maxLength={8}
            />
            <View style={styles.mRow}>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => { setExitModal(false); setPin(""); }}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={tryExit} testID="verify-pin-btn">
                <Text style={{ fontWeight: "700", color: "#fff" }}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, backgroundColor: colors.successBg,
    borderBottomWidth: 1, borderBottomColor: colors.successBorder,
  },
  bannerText: { color: "#065F46", fontWeight: "700", fontSize: 13 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: {
    fontSize: 10, letterSpacing: 1.8, fontWeight: "700",
    color: colors.textMuted, marginBottom: 6,
  },
  title: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  sub: { color: colors.textSoft, marginTop: 6, fontSize: 14, lineHeight: 20 },
  totalCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandDeep,
    alignItems: "flex-start",
  },
  totalLabel: {
    fontSize: 10, letterSpacing: 1.8, fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  totalValue: {
    marginTop: 8,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
  },
  liveRow: {
    marginTop: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399" },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 1.8, fontWeight: "700",
    color: colors.textMuted,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  appRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: spacing.md,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  appIcon: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 16, fontWeight: "700", color: colors.text },
  barTrack: {
    marginTop: 8, height: 6, borderRadius: 3,
    backgroundColor: colors.bgSoft, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  appMins: {
    fontSize: 17, fontWeight: "800", color: colors.text,
    minWidth: 60, textAlign: "right",
  },
  reminder: {
    marginTop: spacing.xl,
    color: colors.textSoft,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    fontStyle: "italic",
  },
  exitBtn: {
    marginTop: spacing.xl, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  exitText: { color: colors.textSoft, fontSize: 12, fontWeight: "600" },
  settingTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  settingSub: { fontSize: 12, color: colors.textSoft, marginTop: 2, lineHeight: 16 },

  modalBg: {
    flex: 1, backgroundColor: "rgba(10,10,10,0.55)",
    padding: spacing.lg, justifyContent: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textSoft, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 12, fontSize: 16, color: colors.text,
    marginBottom: spacing.md, backgroundColor: colors.bgSoft,
  },
  mRow: { flexDirection: "row", gap: 10 },
  btnGhost: {
    flex: 1, padding: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  btnPrimary: {
    flex: 1, padding: 12, borderRadius: radius.sm,
    backgroundColor: colors.primary, alignItems: "center",
  },
});
