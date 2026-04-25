import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Linking,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { api } from "../src/api";

const { UsageModule } = NativeModules;

export default function Child() {
  const [code, setCode] = useState("");
  const [childId, setChildId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const savedName = (await AsyncStorage.getItem("child_name")) || "";

      if (!savedName) {
        setLoading(false);
        return;
      }

      await setup(savedName);
    } catch (e) {
      console.log("INIT ERROR:", e);
      setLoading(false);
    }
  };

  const setup = async (childName: string) => {
    try {
      if (!childName || childName.trim().length === 0) {
        throw new Error("Invalid child name");
      }

      let c = (await AsyncStorage.getItem("child_code")) || "";
      let id = (await AsyncStorage.getItem("child_id")) || "";

      // 🔥 CREATE CHILD
      if (!c || !id) {
        const res = await api("/children/create", {
          method: "POST",
          body: JSON.stringify({ name: childName }),
        });

        if (!res || res.error) {
          throw new Error(res?.message || "Backend error");
        }

        if (!res.child_public_id || !res.child_id) {
          throw new Error("Invalid backend response");
        }

        c = res.child_public_id;
        id = res.child_id;

        await AsyncStorage.setItem("child_code", c);
        await AsyncStorage.setItem("child_id", id);
      }

      setCode(c);
      setChildId(id);
      setName(childName);

      // 🔥 SAFE NATIVE CALLS
      try {
        if (UsageModule?.setChildId && id) {
          UsageModule.setChildId(id);
        }
      } catch (e) {
        console.log("setChildId error:", e);
      }

      try {
        UsageModule?.startService?.();
      } catch (e) {
        console.log("startService error:", e);
      }

      try {
        UsageModule?.startLocation?.();
      } catch (e) {
        console.log("startLocation error:", e);
      }

    } catch (e: any) {
      console.log("SETUP ERROR:", e);

      Alert.alert(
        "Setup Failed",
        e?.message || "Something went wrong",
        [{ text: "Retry", onPress: () => setLoading(false) }]
      );
    } finally {
      setLoading(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    try {
      await AsyncStorage.setItem("child_name", name);
      setLoading(true);
      await setup(name);
    } catch (e) {
      Alert.alert("Error", "Failed to save name");
      setLoading(false);
    }
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  // 🔄 LOADING
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={styles.loadingText}>Setting up device...</Text>
      </View>
    );
  }

  // 🧒 FIRST TIME
  if (!code) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Setup Child Device</Text>

        <Text style={styles.subtitle}>
          Enter child name to continue
        </Text>

        <TextInput
          placeholder="Child Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <TouchableOpacity style={styles.btn} onPress={saveName}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ MAIN UI
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Child Device</Text>

      <Text style={styles.name}>{name}</Text>

      <View style={styles.codeBox}>
        <Text style={styles.code}>{code}</Text>
      </View>

      <Text style={styles.desc}>
        Enter this code on parent device
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Permissions</Text>

        <Text style={styles.item}>• Usage Access</Text>
        <Text style={styles.item}>• Location Access</Text>
        <Text style={styles.item}>• Background Activity</Text>

        <TouchableOpacity style={styles.smallBtn} onPress={openSettings}>
          <Text style={styles.smallBtnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Battery Optimization</Text>

        <Text style={styles.item}>
          Disable battery optimization to ensure tracking
        </Text>

        <TouchableOpacity style={styles.smallBtn} onPress={openSettings}>
          <Text style={styles.smallBtnText}>Disable</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>✔ Tracking Active</Text>
        <Text style={styles.sub}>
          Data is being sent to parent dashboard
        </Text>
      </View>

      <Text style={styles.meta}>Device ID: {childId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 50,
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "#aaa",
    marginBottom: 20,
  },
  name: {
    color: "#00C9A7",
    fontSize: 18,
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#132F3D",
    width: "100%",
    padding: 12,
    borderRadius: 10,
    color: "#fff",
    marginBottom: 15,
  },
  btn: {
    backgroundColor: "#00C9A7",
    padding: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    color: "#000",
    fontWeight: "bold",
  },
  codeBox: {
    backgroundColor: "#132F3D",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginVertical: 20,
  },
  code: {
    fontSize: 36,
    color: "#00C9A7",
    fontWeight: "bold",
    letterSpacing: 3,
  },
  desc: {
    color: "#aaa",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 15,
  },
  cardTitle: {
    color: "#fff",
    marginBottom: 10,
    fontWeight: "bold",
  },
  item: {
    color: "#ccc",
    marginBottom: 4,
  },
  smallBtn: {
    backgroundColor: "#00C9A7",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  smallBtnText: {
    color: "#000",
    fontWeight: "bold",
  },
  status: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  statusText: {
    color: "#00C9A7",
    fontWeight: "bold",
  },
  sub: {
    color: "#aaa",
    fontSize: 12,
  },
  meta: {
    color: "#555",
    marginTop: 10,
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