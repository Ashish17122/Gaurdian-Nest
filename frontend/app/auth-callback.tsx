import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api, setToken } from "../src/api";
import { colors } from "../src/theme";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") {
          router.replace("/role"); return;
        }
        const hash = window.location.hash || "";
        const m = hash.match(/session_id=([^&]+)/);
        if (!m) { router.replace("/role"); return; }
        const sessionId = decodeURIComponent(m[1]);
        const q = new URLSearchParams(window.location.search);
        const role = q.get("role") || "parent";
        const res = await api<any>("/auth/session", {
          method: "POST",
          body: JSON.stringify({ session_id: sessionId, role }),
        });
        await setToken(res.session_token);
        if (res.user.is_admin) router.replace("/admin");
        else if (res.user.role === "child") router.replace("/child");
        else router.replace("/parent");
      } catch (e) {
        router.replace("/role");
      }
    })();
  }, [router]);

  return (
    <View style={styles.c}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.t}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  t: { marginTop: 14, color: colors.textSoft },
});
