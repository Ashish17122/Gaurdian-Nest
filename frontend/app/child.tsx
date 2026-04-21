import { useEffect } from "react";
import { View, Text, NativeModules } from "react-native";
import { api } from "../src/api";

export default function Child() {

  // Start native tracking service
  useEffect(() => {
    try {
      NativeModules?.UsageModule?.startService?.();
    } catch {}
  }, []);

  // Send location heartbeat
  useEffect(() => {
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
    <View style={{ padding: 20 }}>
      <Text>Child device tracking active</Text>
    </View>
  );
}