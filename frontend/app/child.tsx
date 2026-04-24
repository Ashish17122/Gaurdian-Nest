import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { api } from "../src/api";

const { UsageModule } = NativeModules;

export default function Child() {
  const [code, setCode] = useState<string>("");
  const [childId, setChildId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      let c = await AsyncStorage.getItem("child_code");
      let id = await AsyncStorage.getItem("child_id");

      // 🔥 CREATE CHILD IF NOT EXISTS
      if (!c || !id) {
        const res = await api("/children/create", {
          method: "POST",
        });

        c = res.child_public_id;
        id = res.child_id;

        // ✅ FIXED (no null passed)
        if (c) await AsyncStorage.setItem("child_code", c);
        if (id) await AsyncStorage.setItem("child_id", id);
      }

      // ✅ SAFE STATE SET
      setCode(c || "");
      setChildId(id || "");

      // 🚀 START REAL TRACKING SERVICE
      UsageModule?.startService?.();

    } catch (e) {
      console.log("Child init error:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 LOADING UI
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={styles.loadingText}>Setting up device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Text style={styles.title}>Child Device</Text>

      {/* CODE BOX */}
      <View style={styles.codeBox}>
        <Text style={styles.code}>{code}</Text>
      </View>

      {/* INFO */}
      <Text style={styles.desc}>
        Enter this code on the parent device to connect
      </Text>

      {/* STATUS CARD */}
      <View style={styles.status}>
        <Text style={styles.statusText}>✔ Tracking Active</Text>
        <Text style={styles.sub}>
          App usage & device activity are being monitored
        </Text>
      </View>

      {/* DEBUG INFO (optional but useful for production debugging) */}
      <View style={styles.meta}>
        <Text style={styles.metaText}>Device ID: {childId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
  },

  codeBox: {
    backgroundColor: "#132F3D",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
  },

  code: {
    fontSize: 36,
    color: "#00C9A7",
    fontWeight: "bold",
    letterSpacing: 3,
  },

  desc: {
    color: "#aaa",
    textAlign: "center",
    marginBottom: 30,
    fontSize: 14,
  },

  status: {
    backgroundColor: "#132F3D",
    padding: 18,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },

  statusText: {
    color: "#00C9A7",
    fontWeight: "bold",
    fontSize: 16,
  },

  sub: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },

  meta: {
    marginTop: 20,
  },

  metaText: {
    color: "#555",
    fontSize: 10,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1F2A",
  },

  loadingText: {
    marginTop: 10,
    color: "#aaa",
  },
});