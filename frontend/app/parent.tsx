import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { api } from "../src/api";
import Map from "./MapView";

const width = Dimensions.get("window").width;

export default function Parent() {
  const [apps, setApps] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();

    const interval = setInterval(load, 5000); // auto refresh
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      const [activity, alertData, ai, loc] = await Promise.all([
        api("/activity/daily"),
        api("/limits/check"),
        api("/ai/insights"),
        api("/location/latest"),
      ]);

      setApps(activity || []);
      setAlerts(alertData || []);
      setInsights(ai || null);
      setLocation(loc || null);
    } catch (e) {
      console.log("Load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: apps.map((a) => a.app?.slice(0, 5) || "App"),
    datasets: [
      {
        data: apps.map((a) => a.minutes || 0),
      },
    ],
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>GuardianNest</Text>

      {/* 📊 USAGE CHART */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Usage Today</Text>

        {apps.length > 0 ? (
          <BarChart
            data={chartData}
            width={width - 40}
            height={220}
            yAxisLabel=""            // ✅ FIX (required by TS)
            yAxisSuffix="m"
            fromZero
            showValuesOnTopOfBars
            chartConfig={{
              backgroundColor: "#132F3D",
              backgroundGradientFrom: "#132F3D",
              backgroundGradientTo: "#132F3D",
              decimalPlaces: 0,
              color: (opacity = 1) =>
                `rgba(0, 201, 167, ${opacity})`,
              labelColor: () => "#ffffff",
            }}
            style={{ borderRadius: 10 }}
          />
        ) : (
          <Text style={styles.empty}>No usage data yet</Text>
        )}
      </View>

      {/* 📍 LIVE LOCATION */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Live Location</Text>
        <Map location={location} />
      </View>

      {/* 🧠 AI INSIGHTS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧠 AI Insights</Text>

        {!insights ? (
          <Text style={styles.empty}>No data yet</Text>
        ) : insights.message ? (
          <Text style={styles.item}>{insights.message}</Text>
        ) : (
          insights.insights?.map((i: string, idx: number) => (
            <Text key={idx} style={styles.item}>
              • {i}
            </Text>
          ))
        )}
      </View>

      {/* 🔔 ALERTS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔔 Alerts</Text>

        {alerts.length === 0 ? (
          <Text style={styles.empty}>No alerts</Text>
        ) : (
          alerts.map((a, i) => (
            <Text key={i} style={styles.alert}>
              {a.app} exceeded limit 🚨
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    padding: 16,
  },
  header: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 10,
  },
  item: {
    color: "#ddd",
    marginBottom: 4,
  },
  alert: {
    color: "#FF6B6B",
    fontWeight: "bold",
    marginBottom: 4,
  },
  empty: {
    color: "#aaa",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1F2A",
  },
});