import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, TextInput, Alert, Platform, AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../src/theme";
import { Card, Pill } from "../src/ui";
import { api, setToken } from "../src/api";

export default function ChildScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exitModal, setExitModal] = useState(false);
  const [pin, setPin] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const heartbeatRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<any>("/auth/me");
        setUser(me);
        // Use parent-owned devices if parent; child users with no device get a default
        let list = await api<any[]>("/children").catch(() => []);
        if (!list.length) {
          const c = await api<any>("/children/pair", {
            method: "POST",
            body: JSON.stringify({ device_name: (me?.name || "Child") + "'s Device" }),
          });
          list = [c];
        }
        setChildren(list);
      } catch {
        router.replace("/role");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Heartbeat every 15s + tick elapsed
  useEffect(() => {
    const child = children[0];
    if (!child) return;
    const sendBeat = () => {
      api("/monitoring/heartbeat", {
        method: "POST",
        body: JSON.stringify({ child_id: child.child_id, monitoring_active: monitoring }),
      }).catch(() => {});
    };
    sendBeat();
    heartbeatRef.current = setInterval(() => {
      sendBeat();
      setElapsed(e => e + 15);
    }, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, [children, monitoring]);

  // Register Expo push token (native only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        await Notifications.requestPermissionsAsync();
        // Show a persistent local notification indicating monitoring is active
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

  // App state alert: if child backgrounds the app
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" && children[0]) {
        api("/monitoring/heartbeat", {
          method: "POST",
          body: JSON.stringify({ child_id: children[0].child_id, monitoring_active: true }),
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [children]);

  const logApp = async (app: string) => {
    if (!children[0]) return;
    await api("/activity/log", {
      method: "POST",
      body: JSON.stringify({
        child_id: children[0].child_id, app_name: app,
        duration_seconds: Math.floor(Math.random() * 15 + 5) * 60,
      }),
    });
    Alert.alert("Logged", `${app} usage sent to parent.`);
  };

  const toggleMonitoring = () => {
    const next = !monitoring;
    setMonitoring(next);
    if (!next && children[0]) {
      api("/monitoring/heartbeat", {
        method: "POST",
        body: JSON.stringify({ child_id: children[0].child_id, monitoring_active: false }),
      }).catch(() => {});
      Alert.alert("Alert sent", "Parent has been notified that monitoring was disabled.");
    }
  };

  const tryExit = async () => {
    try {
      await api("/parent/verify-pin", {
        method: "POST", body: JSON.stringify({ pin }),
      });
      setExitModal(false); setPin("");
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      await setToken(null);
      router.replace("/role");
    } catch (e: any) {
      Alert.alert("Access denied", e.message || "Wrong PIN");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Persistent banner */}
      <View style={[styles.banner, !monitoring && styles.bannerOff]} testID="child-status-banner">
        <Ionicons
          name={monitoring ? "shield-checkmark" : "warning"}
          size={16}
          color={monitoring ? "#065F46" : "#7F1D1D"}
        />
        <Text style={[styles.bannerText, !monitoring && styles.bannerTextOff]}>
          {monitoring ? "Parental watch is ACTIVE" : "Monitoring is OFF — parent notified"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} testID="child-dashboard">
        <Text style={styles.label}>CHILD MODE</Text>
        <Text style={styles.title}>Hi, {user?.name?.split(" ")[0] || "friend"} 👋</Text>
        <Text style={styles.sub}>Your parent can see your app usage. Be mindful!</Text>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Monitoring status</Text>
              <Text style={styles.cardSub}>
                Heartbeat every 15s · Session: {Math.floor(elapsed / 60)}m {elapsed % 60}s
              </Text>
            </View>
            <Pill
              text={monitoring ? "ACTIVE" : "DISABLED"}
              color={monitoring ? colors.success : colors.danger}
              bg={monitoring ? colors.successBg : colors.dangerBg}
            />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>LOG AN APP SESSION</Text>
        <View style={styles.appRow}>
          <AppButton name="YouTube" color={colors.youtube} onPress={() => logApp("YouTube")} />
          <AppButton name="Instagram" color={colors.instagram} onPress={() => logApp("Instagram")} />
          <AppButton name="Chrome" color={colors.chrome} onPress={() => logApp("Chrome")} />
        </View>

        <Text style={styles.sectionLabel}>ADVANCED</Text>
        <Card>
          <Text style={styles.cardTitle}>Disable monitoring (for testing)</Text>
          <Text style={styles.cardSub}>
            If you turn this off, your parent will get an immediate alert.
          </Text>
          <TouchableOpacity
            style={[styles.danger, !monitoring && { backgroundColor: colors.success }]}
            onPress={toggleMonitoring}
            testID="toggle-monitoring-btn"
          >
            <Text style={styles.dangerText}>
              {monitoring ? "Turn OFF monitoring" : "Turn ON monitoring"}
            </Text>
          </TouchableOpacity>
        </Card>

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
              style={styles.input} value={pin} onChangeText={setPin}
              keyboardType="number-pad" secureTextEntry
              placeholder="••••" placeholderTextColor={colors.textMuted}
              maxLength={8}
            />
            <View style={styles.mRow}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => { setExitModal(false); setPin(""); }}>
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

function AppButton({ name, color, onPress }: { name: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.appBtn} onPress={onPress} testID={`child-log-${name}-btn`}>
      <View style={[styles.appIcon, { backgroundColor: color }]}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>{name[0]}</Text>
      </View>
      <Text style={styles.appName}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, backgroundColor: colors.successBg,
    borderBottomWidth: 1, borderBottomColor: colors.successBorder,
  },
  bannerOff: { backgroundColor: colors.dangerBg, borderBottomColor: "#FECACA" },
  bannerText: { color: "#065F46", fontWeight: "700", fontSize: 13 },
  bannerTextOff: { color: "#7F1D1D" },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700", color: colors.textMuted, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  sub: { color: colors.textSoft, marginTop: 6, fontSize: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSoft, marginTop: 3 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700", color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  appRow: { flexDirection: "row", gap: 10 },
  appBtn: {
    flex: 1, alignItems: "center", padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg,
  },
  appIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  appName: { marginTop: 8, fontWeight: "700", color: colors.text, fontSize: 13 },
  danger: {
    marginTop: spacing.md, padding: 12, borderRadius: radius.sm,
    backgroundColor: colors.danger, alignItems: "center",
  },
  dangerText: { color: "#fff", fontWeight: "700" },
  exitBtn: {
    marginTop: spacing.xl, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  exitText: { color: colors.textSoft, fontSize: 12, fontWeight: "600" },

  modalBg: { flex: 1, backgroundColor: "rgba(10,10,10,0.55)", padding: spacing.lg, justifyContent: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textSoft, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 12, fontSize: 16, color: colors.text, marginBottom: spacing.md, backgroundColor: colors.bgSoft,
  },
  mRow: { flexDirection: "row", gap: 10 },
  btnGhost: { flex: 1, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  btnPrimary: { flex: 1, padding: 12, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: "center" },
});
