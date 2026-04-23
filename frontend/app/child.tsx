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
      let savedCode = await AsyncStorage.getItem("child_code");
      let savedId = await AsyncStorage.getItem("child_id");

      // 🔥 create child if not exists
      if (!savedCode || !savedId) {
        const res = await api("/children/create", {
          method: "POST",
        });

        savedCode = res.child_public_id;
        savedId = res.child_id;

        if (savedCode) {
          await AsyncStorage.setItem("child_code", savedCode);
        }
        if (savedId) {
          await AsyncStorage.setItem("child_id", savedId);
        }
      }

      setCode(savedCode || "");
      setChildId(savedId || "");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Init failed");
    } finally {
      setLoading(false);
    }
  };

  const openUsageSettings = () => {
    Linking.openSettings();
    Alert.alert(
      "Enable Permissions",
      "Enable:\n• Usage Access\n• Location Permission"
    );
  };

  const startUsage = () => {
    try {
      UsageModule?.startService?.();
      Alert.alert("Usage tracking started");
    } catch {
      Alert.alert("Error starting usage tracking");
    }
  };

  const startLocation = () => {
    try {
      UsageModule?.startLocation?.();
      Alert.alert("Location tracking started");
    } catch {
      Alert.alert("Error starting location tracking");
    }
  };

  // 🔥 send test data (simulate real tracking)
  const sendTestData = async () => {
    try {
      await api("/activity/log", {
        method: "POST",
        body: JSON.stringify({
          app: "youtube",
          duration: 180,
          child_id: childId,
        }),
      });

      await api("/location/update", {
        method: "POST",
        body: JSON.stringify({
          lat: 28.61,
          lng: 77.23,
        }),
      });

      Alert.alert("Data sent to parent");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Child Mode</Text>

      <Text style={{ fontSize: 28, color: "#00C9A7" }}>{code}</Text>
      <Text>Give this code to parent</Text>

      <Button title="Enable Permissions" onPress={openUsageSettings} />
      <Button title="Start Usage Tracking" onPress={startUsage} />
      <Button title="Start Location Tracking" onPress={startLocation} />

      {/* DEBUG / TEST */}
      <Button title="Send Test Data" onPress={sendTestData} color="orange" />
    </View>
  );
}