import { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { api, setToken } from "../src/api";

export default function Child() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

const init = async () => {
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

    existing = newCode; // ✅ now guaranteed string
  }

  setCode(existing); // ✅ safe

  NativeModules.UsageModule?.startService?.();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20 }}>
      <Text style={{ fontSize: 18 }}>Child Mode</Text>

      <Text style={{ fontSize: 24, fontWeight: "bold" }}>
        Code: {code}
      </Text>

      <Text>Give this code to parent</Text>
    </View>
  );
}