import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ActivityIndicator, Alert, ScrollView, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../src/theme";
import { api, setToken, BACKEND_URL } from "../src/api";

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; admin_code?: string }>();
  const role = params.role || "parent";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const doGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS !== "web") {
      Alert.alert(
        "Google Sign-in",
        "Google OAuth runs in the web preview only. For the native APK, configure expo-auth-session (see ROADMAP.md). Use Demo Login for now.",
      );
      return;
    }
    const redirectUrl = window.location.origin + "/auth-callback";
    window.location.href =
      `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}` +
      `&role=${encodeURIComponent(role)}${params.admin_code ? `&admin_code=${encodeURIComponent(params.admin_code as string)}` : ""}`;
  };

  const doMockLogin = async () => {
    if (!email.includes("@")) return Alert.alert("Enter a valid email");
    setLoading(true);
    try {
      const res = await api<any>("/auth/mock-login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(), name: name.trim() || email.split("@")[0],
          role, admin_code: params.admin_code,
        }),
      });
      await setToken(res.session_token);
      if (res.user.is_admin) router.replace("/admin");
      else if (res.user.role === "child") router.replace("/child");
      else router.replace("/parent");
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.label}>SIGN IN AS {String(role).toUpperCase()}</Text>
        <Text style={styles.title}>Welcome{"\n"}to GuardianNest.</Text>
        <Text style={styles.sub}>Secure your family's digital life in seconds.</Text>

        <TouchableOpacity style={styles.google} onPress={doGoogle} testID="google-signin-btn">
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>OR DEMO LOGIN</Text>
          <View style={styles.line} />
        </View>

        <TextInput
          testID="login-email-input"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address"
        />
        <TextInput
          testID="login-name-input"
          style={styles.input}
          placeholder="Your name (optional)"
          placeholderTextColor={colors.textMuted}
          value={name} onChangeText={setName}
        />
        <TouchableOpacity style={styles.primary} onPress={doMockLogin} disabled={loading} testID="login-submit-btn">
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryText}>Enter {role === "admin" ? "Admin Panel" : role === "child" ? "Child Mode" : "Parent Mode"}</Text>}
        </TouchableOpacity>

        <Text style={styles.small}>Backend: {BACKEND_URL ? "connected" : "unset"}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  back: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  backText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: colors.textMuted, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "800", color: colors.text, lineHeight: 38, letterSpacing: -1, marginBottom: 10 },
  sub: { fontSize: 14, color: colors.textSoft, marginBottom: spacing.xl },
  google: {
    flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center",
    padding: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  googleText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 10, color: colors.textMuted, letterSpacing: 1.5, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 14, fontSize: 15, color: colors.text, marginBottom: 10,
    backgroundColor: colors.bgSoft,
  },
  primary: {
    padding: 14, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: "center", marginTop: 6,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  small: { marginTop: spacing.xl, textAlign: "center", color: colors.textMuted, fontSize: 11 },
});
