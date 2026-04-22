import { useEffect } from "react";
import { View, Text, NativeModules } from "react-native";
import { api } from "../src/api";

export default function Child() {

  useEffect(() => {
    // ✅ start native tracking service
    NativeModules.UsageModule?.startService?.();

    // ✅ send heartbeat/location (optional)
    const i = setInterval(async () => {
      try {
        await api("/monitoring/heartbeat", {
          method: "POST",
          body: JSON.stringify({
            lat: 28.6,
            lng: 77.2,
          }),
        });
      } catch {}
    }, 5000);

    return () => clearInterval(i);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Child tracking active</Text>
    </View>
  );
}