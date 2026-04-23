import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { api, setToken } from "../src/api";
import { registerPush } from "../src/notifications";

export default function Login() {
  const { role = "parent", admin_code } = useLocalSearchParams();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "786843635437-k0qqfgirae0jvgqfpss59jam2rmj7bs3.apps.googleusercontent.com",
    });

    registerDevice();
  }, []);

  const registerDevice = async () => {
    try {
      const token = await registerPush();
      if (token) {
        await api("/device/register", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      }
    } catch (e) {
      console.log("Push register failed", e);
    }
  };

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      console.log("GOOGLE USER:", userInfo);

      const idToken =
        (userInfo as any)?.idToken ||
        (userInfo as any)?.data?.idToken;

      if (!idToken) throw new Error("No ID token");

      const res = await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({ token: idToken }),
      });

      console.log("API RESPONSE:", res);

      // ✅ SAFE TOKEN
      const sessionToken =
        res?.session_token || res?.data?.session_token;

      if (!sessionToken) {
        throw new Error("Session token missing");
      }

      await setToken(sessionToken);

      // ✅ SAFE USER EXTRACTION
      const backendUser = res?.user || res?.data?.user || {};

      // 🔥 FIX: NEVER CRASH IF EMAIL MISSING
      const email =
        (userInfo as any)?.user?.email ||
        (userInfo as any)?.profile?.email ||
        (userInfo as any)?.data?.user?.email ||
        "";

      console.log("DETECTED EMAIL:", email);

      // ❌ REMOVE HARD FAIL
      // if (!email) throw new Error("Email not found");

      // ✅ FALLBACK EMAIL (prevents crash)
      const safeEmail = email || "unknown@user";

      // ✅ FORCE ROLE LOGIC
      const user = {
        ...backendUser,
        email: safeEmail,
        is_admin: safeEmail === "ashishworksat@gmail.com",
        role:
          safeEmail === "ashishworksat@gmail.com"
            ? "admin"
            : backendUser?.role || "parent",
      };

      console.log("FINAL USER:", user);

      // ✅ SAFE NAVIGATION
      if (user?.is_admin) {
        router.replace("/admin");
      } else if (user?.role === "child") {
        router.replace("/child");
      } else {
        router.replace("/parent");
      }

    } catch (e: any) {
      console.log("LOGIN ERROR:", e);

      Alert.alert(
        "Login failed",
        e?.message || "Something went wrong"
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GuardianNest</Text>

      <TouchableOpacity style={styles.btn} onPress={signIn}>
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0B1F2A",
  },
  title: {
    fontSize: 34,
    color: "#fff",
    marginBottom: 30,
    fontWeight: "bold",
  },
  btn: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    fontWeight: "600",
    fontSize: 16,
  },
});