import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { api } from "../src/api";
import * as Notifications from "expo-notifications";

export default function Parent() {
  const [apps, setApps] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // 🔔 register push
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;

      await api("/notifications/register", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    })();
  }, []);

  // 🔄 live refresh every 5 sec
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const data = await api("/activity/daily");
        const a = await api("/limits/check");

        setApps(data);
        setAlerts(a);
      } catch (e) {}
    }, 5000);

    return () => clearInterval(i);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Live Usage</Text>

      {apps.map((a, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.app}>{a.app}</Text>
          <Text>{a.category}</Text>
          <Text>{a.minutes} min</Text>
        </View>
      ))}

      {alerts.length > 0 && (
        <>
          <Text style={styles.alertTitle}>Alerts</Text>
          {alerts.map((a, i) => (
            <Text key={i}>
              {a.app} exceeded ({a.used}/{a.limit})
            </Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold" },
  alertTitle: { marginTop: 20, fontSize: 18, color: "red" },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
  },
  app: { fontSize: 18, fontWeight: "600" },
});