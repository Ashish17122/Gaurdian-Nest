import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { api } from "../src/api";

export default function Register() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Enter your name");
      return;
    }

    try {
      setLoading(true);

      // ✅ Save locally
      await AsyncStorage.setItem("user_name", name);

      // ✅ Send to backend (REAL production logic)
      await api("/user/register", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      // ✅ Move forward
      router.replace("/login");

    } catch (e: any) {
      console.log("Register error:", e);

      // ❗ Don't block user if backend fails
      router.replace("/login");

    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Text style={styles.title}>GuardianNest</Text>
      <Text style={styles.subtitle}>
        Enter your name to continue
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={save}
        disabled={loading}
      >
        <Text style={styles.btnText}>
          {loading ? "Saving..." : "Continue"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    justifyContent: "center",
    padding: 20,
  },

  title: {
    color: "#fff",
    fontSize: 30,
    marginBottom: 10,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#aaa",
    marginBottom: 20,
  },

  input: {
    backgroundColor: "#132F3D",
    padding: 14,
    borderRadius: 12,
    color: "#fff",
    marginBottom: 20,
    fontSize: 16,
  },

  btn: {
    backgroundColor: "#00C9A7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  btnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
});