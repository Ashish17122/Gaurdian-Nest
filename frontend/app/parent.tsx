import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { api } from "../src/api";
import { BarChart } from "react-native-chart-kit";
import * as Notifications from "expo-notifications";

export default function Parent() {
  const [apps, setApps] = useState<any[]>([]);
  const [chart, setChart] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  });
  const [alerts, setAlerts] = useState<any[]>([]);

  // 🔔 Register push notifications
  useEffect(() => {
    const register = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        const token = (await Notifications.getExpoPushTokenAsync()).data;

        await api("/notifications/register", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      } catch (e) {
        console.log("Push register error:", e);
      }
    };

    register();
  }, []);

  // 🔄 Fetch data every 5 sec
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const summary = await api("/activity/summary");
        setApps(summary);

        const daily = await api("/activity/daily");
        setChart(daily);

        const alertData = await api("/limits/check");
        setAlerts(alertData);
      } catch (e) {
        console.log("Fetch error:", e);
      }
    }, 5000);

    return () => clearInterval(i);
  }, []);

  // ⚠️ Alert popup
  useEffect(() => {
    if (alerts.length > 0) {
      alert(`${alerts[0].app} exceeded limit!`);
    }
  }, [alerts]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Usage Dashboard</Text>

      {/* 📊 Chart */}
      {chart.data.length > 0 && (
        <BarChart
          data={{
            labels: chart.labels,
            datasets: [{ data: chart.data }],
          }}
          width={Dimensions.get("window").width - 40}
          height={220}
          yAxisLabel="" // ✅ REQUIRED FIX
          chartConfig={{
            backgroundGradientFrom: "#EBF4F6",
            backgroundGradientTo: "#EBF4F6",
            decimalPlaces: 0,
            color: () => "#088395",
            labelColor: () => "#333",
          }}
          style={{
            borderRadius: 12,
            marginBottom: 20,
          }}
        />
      )}

      {/* 📱 App list */}
      {apps.map((a, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.app}>{a.app}</Text>
          <Text style={styles.category}>{a.category}</Text>
          <Text style={styles.time}>{a.minutes} min</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#EBF4F6",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  app: {
    fontSize: 18,
    fontWeight: "700",
  },
  category: {
    fontSize: 12,
    color: "#888",
  },
  time: {
    fontSize: 14,
    marginTop: 4,
  },
});