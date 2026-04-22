import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { api, setToken } from "../src/api";
import { registerPush } from "../src/notifications";
import { router } from "expo-router";

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
    } catch {}
  };

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const user: any = await GoogleSignin.signIn();

      const idToken = user.data?.idToken;
      if (!idToken) throw new Error("No ID token");

      const res = await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          token: idToken,
          role,
          admin_code,
        }),
      });

      await setToken(res.session_token);

      if (res.user.is_admin) router.replace("/admin");
      else if (res.user.role === "child") router.replace("/child");
      else router.replace("/parent");
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
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
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0B1F2A" },
  title: { fontSize: 34, color: "#fff", marginBottom: 30 },
  btn: { backgroundColor: "#fff", padding: 16, borderRadius: 12, alignItems: "center" },
  btnText: { fontWeight: "600" },
});