import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { api, setToken } from "../src/api";

export default function Login() {
  const { role = "parent" } = useLocalSearchParams();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "786843635437-k0qqfgirae0jvgqfpss59jam2rmj7bs3.apps.googleusercontent.com",
    });
  }, []);

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      const email =
        (userInfo as any)?.user?.email || "fallback@user.dev";

      const res = await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      const token = res?.session_token;
      if (!token) throw new Error("Login failed");

      await setToken(token);

      // 🔥 FORCE ROLE SAVE
      let finalRole = role;

      if (email === "ashishworksat@gmail.com") {
        finalRole = "admin";
      }

      await AsyncStorage.setItem("gn_role", finalRole as string);

      // 🔥 ROUTING
      if (finalRole === "child") {
        router.replace("/child");
      } else if (finalRole === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/parent");
      }

    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>GuardianNest</Text>

      <Text style={styles.subtitle}>
        {role === "child"
          ? "Child Device Setup"
          : role === "admin"
          ? "Admin Access"
          : "Parent Login"}
      </Text>

      <TouchableOpacity style={styles.btn} onPress={signIn}>
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    color: "#aaa",
    marginBottom: 30,
  },
  btn: {
    backgroundColor: "#00C9A7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    fontWeight: "bold",
    fontSize: 16,
  },
});
