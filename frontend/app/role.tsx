import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Modal, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../src/theme";
import { Card } from "../src/ui";

export default function RoleSelect() {
  const router = useRouter();
  const [adminModal, setAdminModal] = useState(false);
  const [code, setCode] = useState("");

  const tryAdmin = () => {
    if (!code.trim()) return Alert.alert("Enter admin code");
    router.push({ pathname: "/login", params: { role: "admin", admin_code: code.trim() } });
    setAdminModal(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} testID="role-select-screen">
        <View style={styles.header}>
          <Text style={styles.brand}>GuardianNest</Text>
          <Text style={styles.label}>SELECT MODE</Text>
          <Text style={styles.title}>Who's using{"\n"}this device?</Text>
        </View>

        <TouchableOpacity
          testID="role-parent-btn"
          activeOpacity={0.85}
          style={styles.roleCard}
          onPress={() => router.push({ pathname: "/login", params: { role: "parent" } })}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleTitle}>Parent</Text>
            <Text style={styles.roleSub}>Monitor your child's device. Configure rules and view analytics.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="role-child-btn"
          activeOpacity={0.85}
          style={styles.roleCard}
          onPress={() => router.push({ pathname: "/login", params: { role: "child" } })}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.successBg }]}>
            <Ionicons name="person-circle" size={28} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleTitle}>Child</Text>
            <Text style={styles.roleSub}>This device is being watched. A parent PIN is required to exit.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: spacing.xxl }]}>OWNER ONLY</Text>
        <TouchableOpacity
          testID="role-admin-btn"
          activeOpacity={0.85}
          style={[styles.roleCard, { backgroundColor: colors.adminBg, borderColor: colors.primarySoft }]}
          onPress={() => setAdminModal(true)}
        >
          <View style={[styles.iconWrap, { backgroundColor: "#fff" }]}>
            <Ionicons name="analytics" size={24} color={colors.admin} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleTitle, { color: colors.admin }]}>Admin Panel</Text>
            <Text style={styles.roleSub}>Hidden. Requires owner access code.</Text>
          </View>
          <Ionicons name="lock-closed" size={18} color={colors.admin} />
        </TouchableOpacity>

        <Text style={styles.footer}>
          By continuing you accept our Terms. {"\n"}Premium tier coming soon.
        </Text>
      </ScrollView>

      <Modal visible={adminModal} transparent animationType="fade" onRequestClose={() => setAdminModal(false)}>
        <View style={styles.modalBg}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Admin access code</Text>
            <Text style={styles.modalSub}>Enter the owner access code to unlock the admin panel.</Text>
            <TextInput
              testID="admin-code-input"
              style={styles.input}
              placeholder="Access code"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setAdminModal(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={tryAdmin} testID="admin-code-submit">
                <Text style={styles.btnPrimaryText}>Unlock</Text>
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
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xl },
  brand: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: spacing.xl, letterSpacing: -0.3 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: colors.textMuted, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "800", color: colors.text, lineHeight: 38, letterSpacing: -1 },
  roleCard: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: spacing.md + 2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.bgElev, marginBottom: 12,
  },
  iconWrap: {
    width: 46, height: 46, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  roleTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 2 },
  roleSub: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  footer: { marginTop: spacing.xxl, textAlign: "center", color: colors.textMuted, fontSize: 12, lineHeight: 18 },

  modalBg: { flex: 1, backgroundColor: "rgba(10,10,10,0.55)", padding: spacing.lg, justifyContent: "center" },
  modalCard: { },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textSoft, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 12, fontSize: 16, color: colors.text, marginBottom: spacing.md,
    backgroundColor: colors.bgSoft,
  },
  row: { flexDirection: "row", gap: 10 },
  btnGhost: { flex: 1, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  btnGhostText: { color: colors.text, fontWeight: "600" },
  btnPrimary: { flex: 1, padding: 12, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
