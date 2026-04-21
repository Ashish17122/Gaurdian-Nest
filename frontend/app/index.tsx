import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../src/api";
import { colors } from "../src/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Handle oauth session_id fragment if present (web)
      if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
        // Route to auth-callback to exchange
        router.replace("/auth-callback");
        return;
      }
      try {
        const me = await api<any>("/auth/me");
        if (me?.is_admin) router.replace("/admin");
        else if (me?.role === "child") router.replace("/child");
        else router.replace("/parent");
      } catch {
        router.replace("/role");
      }
    })();
  }, [router]);

  return (
    <View style={styles.c} testID="splash-screen">
      <Text style={styles.brand}>GuardianNest</Text>
      <Text style={styles.tagline}>Modern parental oversight.</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  brand: { fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  tagline: { marginTop: 6, color: colors.textSoft, fontSize: 15 },
});
