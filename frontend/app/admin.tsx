import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Dimensions, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { colors, spacing, radius } from "../src/theme";
import { Card, Stat, Pill } from "../src/ui";
import { api, setToken } from "../src/api";

const screenW = Dimensions.get("window").width;

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<{ total: number; rows: any[] }>({ total: 0, rows: [] });
  const [premiumCfg, setPremiumCfg] = useState<any>({});
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api<any>("/auth/me");
      if (!me.is_admin) { router.replace("/parent"); return; }
      setUser(me);
      const [s, l, p] = await Promise.all([
        api<any>(`/admin/stats?days=${days}`),
        api<any>(`/admin/leads?limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}${source ? `&source=${source}` : ""}${fromDate ? `&from_date=${fromDate}` : ""}${toDate ? `&to_date=${toDate}` : ""}`),
        api<any>("/admin/premium/config"),
      ]);
      setStats(s); setLeads(l); setPremiumCfg(p);
    } catch (e: any) {
      if (String(e.message).includes("401") || String(e.message).includes("403")) router.replace("/role");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [router, days, q, source, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const togglePremium = async (val: boolean) => {
    try {
      await api("/admin/premium/toggle", {
        method: "POST", body: JSON.stringify({ enabled: val }),
      });
      Alert.alert("Updated", `Premium ${val ? "ENABLED" : "DISABLED"} globally.`);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const doLogout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    await setToken(null);
    router.replace("/role");
  };

  const chartWidth = Math.min(screenW, 900) - spacing.lg * 2 - 2;

  const trend = useMemo(() => {
    const d = stats?.signup_trend || [];
    const step = Math.max(1, Math.floor(d.length / 7));
    const labels = d.map((x: any, i: number) => (i % step === 0 ? x.date : ""));
    return {
      labels,
      datasets: [{ data: d.map((x: any) => x.signups), color: () => colors.admin, strokeWidth: 2 }],
    };
  }, [stats]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.admin} /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topLabel}>🔒 ADMIN PANEL</Text>
          <Text style={styles.topName}>GuardianNest Control Room</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/parent")} testID="go-parent-btn">
            <Ionicons name="home-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={doLogout} testID="admin-logout-btn">
            <Ionicons name="log-out-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        testID="admin-dashboard"
      >
        {/* Premium config – HIGHLIGHTED */}
        <View style={styles.ownerBox} testID="owner-premium-config">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="key" size={16} color={colors.admin} />
            <Text style={styles.ownerTag}>OWNER CONFIG · PREMIUM GATEWAY</Text>
          </View>
          <Text style={styles.ownerTitle}>Razorpay Payment Gateway</Text>
          <Text style={styles.ownerSub}>
            Link your Razorpay account by pasting keys in <Text style={styles.mono}>backend/.env</Text>, then flip the switch below to activate premium features app-wide.
          </Text>
          <View style={styles.ownerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerLabel}>Razorpay Linked</Text>
              <Text style={styles.ownerVal}>
                {premiumCfg.razorpay_linked
                  ? `✓ ${premiumCfg.razorpay_key_id_preview}`
                  : "✗ Not linked — paste keys in backend/.env"}
              </Text>
            </View>
            <View>
              <Text style={styles.ownerLabel}>Webhook</Text>
              <Text style={styles.ownerVal}>{premiumCfg.webhook_configured ? "✓ Ready" : "✗ Not set"}</Text>
            </View>
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>PREMIUM_ENABLED flag</Text>
              <Text style={styles.toggleSub}>
                Controls whether Razorpay endpoints + premium UI are active.
              </Text>
            </View>
            <Switch
              testID="premium-toggle"
              value={!!premiumCfg.premium_enabled}
              onValueChange={togglePremium}
              trackColor={{ false: "#E5E7EB", true: colors.admin }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* KPIs */}
        <Text style={styles.sectionLabel}>KPIS · LAST {days} DAYS</Text>
        <View style={styles.kpiGrid}>
          <Card style={styles.kpi}><Stat label="Total Users" value={stats?.total_users || 0} testID="kpi-total-users" /></Card>
          <Card style={styles.kpi}><Stat label="Active 7d" value={stats?.active_users_7d || 0} accent={colors.success} /></Card>
          <Card style={styles.kpi}><Stat label="New Users" value={stats?.new_users_in_window || 0} accent={colors.admin} /></Card>
          <Card style={styles.kpi}><Stat label="Total Leads" value={stats?.total_leads || 0} /></Card>
          <Card style={styles.kpi}><Stat label="Converted" value={stats?.converted_leads || 0} accent={colors.success} /></Card>
          <Card style={styles.kpi}><Stat label="Drop-offs" value={stats?.dropped_leads || 0} accent={colors.danger} /></Card>
          <Card style={styles.kpi}><Stat label="Conv. Rate" value={`${stats?.conversion_rate || 0}%`} accent={colors.admin} /></Card>
          <Card style={styles.kpi}><Stat label="Premium" value={stats?.premium_enabled ? "ON" : "OFF"}
            accent={stats?.premium_enabled ? colors.success : colors.textMuted} /></Card>
        </View>

        {/* Day filter */}
        <Text style={styles.sectionLabel}>SIGNUP TREND</Text>
        <View style={styles.daysRow}>
          {[7, 14, 30, 60].map(n => (
            <TouchableOpacity key={n} onPress={() => setDays(n)}
              style={[styles.dayChip, days === n && styles.dayChipActive]}
              testID={`days-${n}`}
            >
              <Text style={[styles.dayChipText, days === n && { color: "#fff" }]}>{n}d</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card style={{ padding: spacing.md }}>
          {stats?.signup_trend?.length > 0 && (
            <LineChart
              data={trend}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundGradientFrom: "#FFFFFF", backgroundGradientTo: "#FFFFFF",
                decimalPlaces: 0,
                color: (o = 1) => `rgba(99,102,241,${o})`,
                labelColor: () => "#4B5563",
                propsForBackgroundLines: { stroke: "#F1F5F9" },
                propsForDots: { r: "3" },
              }}
              bezier fromZero
              style={{ borderRadius: radius.md }}
            />
          )}
        </Card>

        {/* Role breakdown */}
        <Text style={styles.sectionLabel}>USERS BY ROLE</Text>
        <Card>
          {Object.entries(stats?.by_role || {}).map(([role, count]) => (
            <View key={role} style={styles.roleRow}>
              <Text style={styles.roleName}>{role}</Text>
              <Text style={styles.roleCount}>{String(count)}</Text>
            </View>
          ))}
        </Card>

        {/* Leads table */}
        <Text style={styles.sectionLabel}>LEADS · {leads.total} TOTAL</Text>
        <Card style={{ padding: spacing.md }}>
          <View style={styles.filterRow}>
            <TextInput
              testID="leads-search"
              style={styles.filterInput} placeholder="Search email/name…"
              placeholderTextColor={colors.textMuted}
              value={q} onChangeText={setQ} onSubmitEditing={load}
            />
          </View>
          <View style={styles.filterRow}>
            <TextInput
              testID="leads-from-date"
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="From YYYY-MM-DD" placeholderTextColor={colors.textMuted}
              value={fromDate} onChangeText={setFromDate}
            />
            <TextInput
              testID="leads-to-date"
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="To YYYY-MM-DD" placeholderTextColor={colors.textMuted}
              value={toDate} onChangeText={setToDate}
            />
          </View>
          <View style={styles.filterRow}>
            {["", "google_signup", "role_select", "signup_dropoff", "mock_signup"].map(s => (
              <TouchableOpacity key={s || "all"} onPress={() => setSource(s)}
                style={[styles.srcChip, source === s && styles.srcChipActive]}
                testID={`source-${s || "all"}`}
              >
                <Text style={[styles.srcChipText, source === s && { color: "#fff" }]}>
                  {s || "all"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={load} testID="apply-filters-btn">
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>APPLY FILTERS</Text>
          </TouchableOpacity>

          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 2 }]}>EMAIL</Text>
            <Text style={[styles.th, { flex: 1 }]}>ROLE</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>SOURCE</Text>
            <Text style={[styles.th, { width: 70, textAlign: "right" }]}>STATUS</Text>
          </View>
          {leads.rows.map((r: any) => (
            <View key={r.lead_id} style={styles.tr}>
              <View style={{ flex: 2 }}>
                <Text style={styles.td}>{r.email}</Text>
                <Text style={styles.tdSub}>
                  {new Date(r.created_at).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.td, { flex: 1 }]}>{r.role_selected || "—"}</Text>
              <Text style={[styles.td, { flex: 1.2 }]}>{r.source}</Text>
              <View style={{ width: 70, alignItems: "flex-end" }}>
                {r.completed_onboarding
                  ? <Pill text="Conv" color={colors.success} bg={colors.successBg} />
                  : <Pill text="Drop" color={colors.danger} bg={colors.dangerBg} />}
              </View>
            </View>
          ))}
          {leads.rows.length === 0 && (
            <Text style={styles.empty}>No leads match filters.</Text>
          )}
        </Card>

        <Text style={styles.footnote}>
          {`GuardianNest Admin · ${user?.email} · Read ROADMAP.md for APK build + Razorpay setup.`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  topbar: {
    padding: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topLabel: { fontSize: 10, letterSpacing: 1.8, fontWeight: "800", color: colors.admin },
  topName: { fontSize: 17, fontWeight: "800", color: colors.text },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bg,
  },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },

  ownerBox: {
    backgroundColor: "#FFFBEB", borderWidth: 2, borderColor: "#F59E0B",
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  ownerTag: { fontSize: 10, letterSpacing: 1.5, fontWeight: "800", color: colors.admin },
  ownerTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 6 },
  ownerSub: { fontSize: 12, color: colors.textSoft, marginTop: 4, lineHeight: 17 },
  mono: { fontFamily: "monospace", backgroundColor: "#F3F4F6", paddingHorizontal: 4 },
  ownerRow: { flexDirection: "row", marginTop: spacing.md, gap: 12 },
  ownerLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  ownerVal: { fontSize: 13, color: colors.text, fontWeight: "700", marginTop: 2 },
  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: "#fff", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  toggleLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
  toggleSub: { fontSize: 11, color: colors.textSoft, marginTop: 2 },

  sectionLabel: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700", color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { width: "48%", padding: 0 },

  daysRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  dayChipActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  dayChipText: { fontSize: 12, fontWeight: "700", color: colors.text },

  roleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  roleName: { textTransform: "capitalize", color: colors.text, fontWeight: "600" },
  roleCount: { color: colors.text, fontWeight: "800" },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  filterInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 10, fontSize: 13, color: colors.text, backgroundColor: colors.bg, minWidth: 140,
  },
  srcChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  srcChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  srcChipText: { fontSize: 11, fontWeight: "700", color: colors.text },

  applyBtn: {
    backgroundColor: colors.admin, padding: 10, borderRadius: radius.sm,
    alignItems: "center", marginTop: 4, marginBottom: spacing.md,
  },

  tableHead: {
    flexDirection: "row", paddingVertical: 8, borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  th: { fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 1 },
  tr: {
    flexDirection: "row", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: "center",
  },
  td: { fontSize: 13, color: colors.text, fontWeight: "500" },
  tdSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", padding: spacing.lg, color: colors.textMuted },

  footnote: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl, fontSize: 11 },
});
