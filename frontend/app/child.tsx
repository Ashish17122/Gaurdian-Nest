import { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { api, setToken } from "../src/api";

const { UsageModule } = NativeModules;

export default function Child() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      let existing = await AsyncStorage.getItem("child_code");

      if (!existing) {
        const res = await api("/auth/mock-login", {
          method: "POST",
          body: JSON.stringify({
            email: "child_" + Date.now() + "@device",
            role: "child",
          }),
        });

        await setToken(res.session_token);

        const newCode = res.user.child_public_id;

        await AsyncStorage.setItem("child_code", newCode);

        existing = newCode;
      }

      setCode(existing);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Init failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔐 STEP 1 — Enable permissions
  const openUsageSettings = () => {
    Linking.openSettings();

    Alert.alert(
      "Enable Permissions",
      "Enable:\n• Usage Access\n• Location Permission\n\nThen press Start Monitoring"
    );
  };

  // 🚀 STEP 2 — Start usage tracking
  const startUsage = () => {
    try {
      UsageModule?.startService?.();
      Alert.alert("Usage tracking started");
    } catch {
      Alert.alert("Error starting usage tracking");
    }
  };

  // 📍 STEP 3 — Start live location
  const startLocation = () => {
    try {
      UsageModule?.startLocation?.();
      Alert.alert("Live location started");
    } catch {
      Alert.alert("Error starting location tracking");
    }
  };

  // 🔁 RESET (debug)
  const reset = async () => {
    await AsyncStorage.removeItem("child_code");
    await setToken(null);
    init();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        gap: 20,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>
        Child Mode
      </Text>

      <Text style={{ fontSize: 28, fontWeight: "bold", color: "#00C9A7" }}>
        {code}
      </Text>

      <Text style={{ textAlign: "center", color: "#aaa" }}>
        Give this code to parent device
      </Text>

      {/* STEP 1 */}
      <Button title="Enable Permissions" onPress={openUsageSettings} />

      {/* STEP 2 */}
      <Button title="Start Usage Tracking" onPress={startUsage} />

      {/* STEP 3 */}
      <Button title="Start Live Location" onPress={startLocation} />

      {/* DEBUG */}
      <Button title="Reset Device" onPress={reset} color="red" />
    </View>
  );
}