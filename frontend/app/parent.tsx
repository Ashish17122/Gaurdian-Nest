import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, Dimensions, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, LineChart } from "react-native-chart-kit";
import { colors, spacing, radius } from "../src/theme";
import { Card, Stat, Pill } from "../src/ui";
import { api, setToken } from "../src/api";

const screenW = Dimensions.get("window").width;

export default function ParentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pairModal, setPairModal] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [premiumCfg, setPremiumCfg] = useState<any>({ premium_enabled: false });

  const loadAll = useCallback(async () => {
    try {
      const me = await api<any>("/auth/me");
      setUser(me);
      const [list, cfg, pinInfo, subStatus] = await Promise.all([
        api<any[]>("/children"),
        api<any>("/config/public"),
        api<any>("/parent/has-pin"),
        api<any>("/subscription/status").catch(() => ({ tier: "free" })),
      ]);
      setChildren(list);
      setPremiumCfg({ ...cfg, ...subStatus });
      setHasPin(!!pinInfo?.has_pin);
      if (list.length && (!selected || !list.find(c => c.child_id === selected.child_id))) {
        setSelected(list[0]);
      }
      if (list[0]) {
        const s = await api<any>(`/activity/summary/${list[0].child_id}?days=7`);
        setSummary(s);
      }
      const a = await api<any[]>("/alerts");
      setAlerts(a);
    } catch (e: any) {
      if (String(e.message).includes("401")) router.replace("/role");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, selected]);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const selectChild = async (c: any) => {
    setSelected(c);
    const s = await api<any>(`/activity/summary/${c.child_id}?days=7`);
    setSummary(s);
  };

  const pairChild = async () => {
    if (!deviceName.trim()) return Alert.alert("Enter a device name");
    try {
      const c = await api<any>("/children/pair", {
        method: "POST",
        body: JSON.stringify({ device_name: deviceName.trim() }),
      });
      setPairModal(false); setDeviceName("");
      Alert.alert("Child paired", `Pairing code: ${c.pairing_code}`);
      await loadAll();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const savePin = async () => {
    if (pinInput.length < 4) return Alert.alert("PIN must be at least 4 digits");
    await api("/parent/set-pin", { method: "POST", body: JSON.stringify({ pin: pinInput }) });
    setPinModal(false); setPinInput(""); setHasPin(true);
    Alert.alert("Parent PIN saved", "Child will need this PIN to exit child mode.");
  };

  const simulate = async (app: string) => {
    if (!selected) return;
    await api("/activity/log", {
      method: "POST",
      body: JSON.stringify({
        child_id: selected.child_id, app_name: app,
        duration_seconds: Math.floor(Math.random() * 40 + 10) * 60,
      }),
    });
    const s = await api<any>(`/activity/summary/${selected.child_id}?days=7`);
    setSummary(s);
  };

  const doLogout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    await setToken(null);
    router.replace("/role");
  };

  const chartWidth = Math.min(screenW, 680) - spacing.lg * 2 - 2;

  const barData = useMemo(() => ({
    labels: ["YouTube", "Instagram", "Chrome"],
    datasets: [{
      data: summary ? [
        summary.per_app_minutes?.YouTube || 0,
        summary.per_app_minutes?.Instagram || 0,
        summary.per_app_minutes?.Chrome || 0,
      ] : [0, 0, 0],
    }],
  }), [summary]);

  const lineData = useMemo(() => ({
    labels: (summary?.daily || []).map((d: any) => d.date),
    datasets: [
      { data: (summary?.daily || []).map((d: any) => d.YouTube), color: () => colors.youtube, strokeWidth: 2 },
      { data: (summary?.daily || []).map((d: any) => d.Instagram), color: () => colors.instagram, strokeWidth: 2 },
      { data: (summary?.daily || []).map((d: any) => d.Chrome), color: () => colors.chrome, strokeWidth: 2 },
    ],
    legend: ["YouTube", "Instagram", "Chrome"],
  }), [summary]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topLabel}>PARENT DASHBOARD</Text>
          <Text style={styles.topName}>{user?.name || "Parent"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/admin")} testID="go-admin-btn">
            <Ionicons name="analytics-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={doLogout} testID="logout-btn">
            <Ionicons name="log-out-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
        testID="parent-dashboard"
      >
        {/* Alerts */}
        {alerts.filter(a => !a.read).length > 0 && (
          <Card style={[styles.alertCard]} testID="alerts-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={{ fontWeight: "800", color: colors.danger }}>
                {alerts.filter(a => !a.read).length} active alert(s)
              </Text>
            </View>
            {alerts.slice(0, 3).map(a => (
              <Text key={a.alert_id} style={styles.alertText}>• {a.message}</Text>
            ))}
          </Card>
        )}

        {/* Children selector */}
        <Text style={styles.sectionLabel}>CHILDREN</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {children.map(c => (
            <TouchableOpacity key={c.child_id} onPress={() => selectChild(c)}
              testID={`child-chip-${c.device_name}`}
              style={[styles.chip, selected?.child_id === c.child_id && styles.chipActive]}>
              <Ionicons name="phone-portrait-outline" size={14}
                color={selected?.child_id === c.child_id ? "#fff" : colors.text} />
              <Text style={[styles.chipText, selected?.child_id === c.child_id && { color: "#fff" }]}>
                {c.device_name}
              </Text>
              <View style={[styles.dot, { backgroundColor: c.monitoring_active ? colors.success : colors.danger }]} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addChip} onPress={() => setPairModal(true)} testID="pair-child-btn">
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Pair Device</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Stat label="Screen Time (7d)" value={`${summary?.total_minutes || 0}m`} />
          </Card>
          <Card style={styles.statCard}>
            <Stat label="Monitoring" value={summary?.monitoring_active ? "ACTIVE" : "OFF"}
              accent={summary?.monitoring_active ? colors.success : colors.danger} />
          </Card>
        </View>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Stat label="YouTube" value={`${summary?.per_app_minutes?.YouTube || 0}m`} accent={colors.youtube} />
          </Card>
          <Card style={styles.statCard}>
            <Stat label="Instagram" value={`${summary?.per_app_minutes?.Instagram || 0}m`} accent={colors.instagram} />
          </Card>
          <Card style={styles.statCard}>
            <Stat label="Chrome" value={`${summary?.per_app_minutes?.Chrome || 0}m`} accent={colors.chrome} />
          </Card>
        </View>

        {/* Bar chart */}
        <Text style={styles.sectionLabel}>APP USAGE (7 DAYS)</Text>
        <Card style={{ padding: spacing.md }}>
          {summary && (
            <BarChart
              data={barData}
              width={chartWidth}
              height={210}
              yAxisLabel=""
              yAxisSuffix="m"
              fromZero
              showValuesOnTopOfBars
              chartConfig={chartConfig}
              style={{ borderRadius: radius.md }}
            />
          )}
        </Card>

        {/* Line chart */}
        <Text style={styles.sectionLabel}>DAILY TREND</Text>
        <Card style={{ padding: spacing.md }}>
          {summary && summary.daily?.length > 0 && (
            <LineChart
              data={lineData}
              width={chartWidth}
              height={230}
              yAxisSuffix="m"
              bezier
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: radius.md }}
            />
          )}
        </Card>

        {/* Simulator */}
        <Text style={styles.sectionLabel}>SIMULATE ACTIVITY (DEMO)</Text>
        <View style={styles.simRow}>
          {["YouTube", "Instagram", "Chrome"].map(a => (
            <TouchableOpacity key={a} style={styles.simBtn} onPress={() => simulate(a)} testID={`simulate-${a}-btn`}>
              <Text style={styles.simBtnText}>+ {a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Premium */}
        <Text style={styles.sectionLabel}>PREMIUM</Text>
        <Card style={styles.premiumCard} testID="premium-card">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>GuardianNest Plus</Text>
              <Text style={styles.premiumSub}>Geo-fencing • Content filters • Screen schedules • Advanced reports</Text>
            </View>
            {premiumCfg.premium_enabled
              ? <Pill text="Available" color={colors.success} bg={colors.successBg} />
              : <Pill text="Coming Soon" color={colors.textMuted} bg={colors.bgSoft} />}
          </View>
          <View style={styles.planRow}>
            <View style={styles.planBox}>
              <Text style={styles.planPrice}>₹199<Text style={styles.planPriceSmall}>/mo</Text></Text>
              <Text style={styles.planName}>Monthly</Text>
            </View>
            <View style={styles.planBox}>
              <Text style={styles.planPrice}>₹1,999<Text style={styles.planPriceSmall}>/yr</Text></Text>
              <Text style={styles.planName}>Yearly · Save 16%</Text>
            </View>
          </View>
          <TouchableOpacity
            disabled={!premiumCfg.premium_enabled}
            style={[styles.primary, !premiumCfg.premium_enabled && { opacity: 0.4 }]}
            testID="upgrade-btn"
            onPress={() => Alert.alert("Razorpay checkout", "Stub: will open Razorpay WebView once enabled.")}
          >
            <Text style={styles.primaryText}>
              {premiumCfg.premium_enabled ? "Upgrade · Pay via Razorpay" : "Locked — Enable from Admin Panel"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            * Razorpay infrastructure is wired. Owner must paste keys in `backend/.env`
            and flip the toggle in Admin → Premium Config.
          </Text>
        </Card>

        {/* Settings */}
        <Text style={styles.sectionLabel}>PARENT CONTROLS</Text>
        <Card>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Parent PIN Lock</Text>
              <Text style={styles.settingSub}>
                {hasPin ? "PIN is set. Child cannot exit child mode without it." : "Not set. Set one now to lock child mode."}
              </Text>
            </View>
            <TouchableOpacity style={styles.settingBtn} onPress={() => setPinModal(true)} testID="set-pin-btn">
              <Text style={styles.settingBtnText}>{hasPin ? "Change" : "Set PIN"}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Text style={styles.footnote}>
          GuardianNest • v1.0 · {Platform.OS === "web" ? "Web Preview" : Platform.OS.toUpperCase()}
        </Text>
      </ScrollView>

      {/* Pair modal */}
      <Modal visible={pairModal} transparent animationType="fade" onRequestClose={() => setPairModal(false)}>
        <View style={styles.modalBg}>
          <Card style={{ backgroundColor: "#fff" }}>
            <Text style={styles.modalTitle}>Pair child device</Text>
            <Text style={styles.modalSub}>A 6-digit pairing code will be generated.</Text>
            <TextInput
              testID="pair-device-name-input"
              style={styles.input} placeholder="e.g., Aarav's iPad"
              value={deviceName} onChangeText={setDeviceName}
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setPairModal(false)}>
                <Text style={{ fontWeight: "600", color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={pairChild} testID="pair-submit-btn">
                <Text style={{ fontWeight: "700", color: "#fff" }}>Generate Code</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* PIN modal */}
      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modalBg}>
          <Card style={{ backgroundColor: "#fff" }}>
            <Text style={styles.modalTitle}>Set Parent PIN</Text>
            <Text style={styles.modalSub}>4-8 digits. Required to exit child mode.</Text>
            <TextInput
              testID="pin-input"
              style={styles.input} value={pinInput} onChangeText={setPinInput}
              keyboardType="number-pad" secureTextEntry
              placeholder="••••" placeholderTextColor={colors.textMuted}
              maxLength={8}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setPinModal(false)}>
                <Text style={{ fontWeight: "600", color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={savePin} testID="save-pin-btn">
                <Text style={{ fontWeight: "700", color: "#fff" }}>Save PIN</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 71, 255, ${opacity})`,
  labelColor: () => "#4B5563",
  propsForBackgroundLines: { stroke: "#F1F5F9" },
  barPercentage: 0.7,
  propsForDots: { r: "3" },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  topbar: {
    padding: spacing.lg, paddingBottom: spacing.md,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topLabel: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700", color: colors.textMuted },
  topName: { fontSize: 17, fontWeight: "800", color: colors.text },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bg,
  },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: 0 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 1.8, fontWeight: "700",
    color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  alertCard: { backgroundColor: colors.dangerBg, borderColor: "#FECACA" },
  alertText: { marginTop: 6, color: "#7F1D1D", fontSize: 13 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, marginRight: 8,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  dot: { width: 7, height: 7, borderRadius: 999 },
  addChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.primary, borderStyle: "dashed",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: { flex: 1, padding: 0 },
  simRow: { flexDirection: "row", gap: 10 },
  simBtn: {
    flex: 1, padding: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: "center",
    backgroundColor: colors.bgSoft,
  },
  simBtnText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  premiumCard: {},
  premiumTitle: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  premiumSub: { marginTop: 4, color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  planRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  planBox: {
    flex: 1, padding: spacing.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  planPrice: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  planPriceSmall: { fontSize: 12, fontWeight: "600", color: colors.textSoft },
  planName: { marginTop: 2, color: colors.textSoft, fontSize: 12 },
  primary: {
    marginTop: spacing.md, padding: 14, borderRadius: radius.sm,
    backgroundColor: colors.primary, alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  note: { marginTop: 10, fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  settingSub: { fontSize: 12, color: colors.textSoft, marginTop: 2, lineHeight: 16 },
  settingBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.text,
  },
  settingBtnText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  footnote: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl, fontSize: 11 },

  modalBg: { flex: 1, backgroundColor: "rgba(10,10,10,0.55)", padding: spacing.lg, justifyContent: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textSoft, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 12, fontSize: 16, color: colors.text, marginBottom: spacing.md,
    backgroundColor: colors.bgSoft,
  },
  row: { flexDirection: "row", gap: 10 },
  btnGhost: { flex: 1, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  btnPrimary: { flex: 1, padding: 12, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: "center" },
});
