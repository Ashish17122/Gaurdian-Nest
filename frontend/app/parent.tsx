import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Button,
  Alert,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { api } from "../src/api";
import Map from "./MapView";

const width = Dimensions.get("window").width;

export default function Parent() {
  const [apps, setApps] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    try {
      const [activity, alertData, loc] = await Promise.all([
        api("/activity/daily"),
        api("/limits/check"),
        api("/location/latest"),
      ]);

      setApps(activity || []);
      setAlerts(alertData || []);
      setLocation(loc || null);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const linkChild = async () => {
    try {
      await api("/children/link", {
        method: "POST",
        body: JSON.stringify({ child_public_id: code }),
      });

      Alert.alert("Child linked!");
      setCode("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const chartData = {
    labels: apps.map((a) => a.app?.slice(0, 5) || "App"),
    datasets: [{ data: apps.map((a) => a.minutes || 0) }],
  };

  if (loading) return <ActivityIndicator />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Parent Dashboard</Text>

      {/* 🔥 LINK CHILD */}
      <View style={styles.card}>
        <Text style={styles.title}>Add Child</Text>
        <TextInput
          placeholder="Enter Child Code"
          value={code}
          onChangeText={setCode}
          style={styles.input}
        />
        <Button title="Link Child" onPress={linkChild} />
      </View>

      {/* 📊 CHART */}
      <View style={styles.card}>
        <Text style={styles.title}>Usage</Text>
        {apps.length > 0 ? (
          <BarChart
            data={chartData}
            width={width - 40}
            height={220}
            yAxisLabel=""   // ✅ FIX
            yAxisSuffix="m"
            fromZero
            chartConfig={{
              backgroundColor: "#000",
              backgroundGradientFrom: "#000",
              backgroundGradientTo: "#000",
              color: () => "#00C9A7",
            }}
          />
        ) : (
          <Text>No data</Text>
        )}
      </View>

      {/* 📍 LOCATION */}
      <View style={styles.card}>
        <Text style={styles.title}>Live Location</Text>
        <Map location={location} />
      </View>

      {/* 🔔 ALERTS */}
      <View style={styles.card}>
        <Text style={styles.title}>Alerts</Text>
        {alerts.map((a, i) => (
          <Text key={i} style={{ color: "red" }}>
            {a.app} exceeded
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#0B1F2A",
  },
  header: {
    fontSize: 26,
    color: "#fff",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    marginBottom: 16,
    borderRadius: 10,
  },
  title: {
    color: "#fff",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 10,
  },
});