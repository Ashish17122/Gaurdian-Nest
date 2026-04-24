import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { api } from "../src/api";

const width = Dimensions.get("window").width;

export default function Parent() {
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selected) loadData();
  }, [selected]);

  const loadChildren = async () => {
    try {
      const res = await api("/children/list");
      setChildren(res);
      if (res.length > 0) setSelected(res[0].child_id);
    } catch (e) {
      console.log(e);
    }
  };

  const loadData = async () => {
    try {
      const res = await api(`/activity/daily?child_id=${selected}`);
      setApps(res || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: apps.map((a) => a.app?.slice(0, 6) || "App"),
    datasets: [{ data: apps.map((a) => a.minutes || 0) }],
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <Text style={styles.header}>GuardianNest</Text>

      {/* CHILD SELECTOR */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Devices</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.child_id}
              onPress={() => setSelected(c.child_id)}
              style={[
                styles.childCard,
                selected === c.child_id && styles.activeChild,
              ]}
            >
              <Text style={styles.childCode}>{c.code}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LOADING */}
      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" />
      ) : (
        <>
          {/* CHART */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 App Usage</Text>

            {apps.length > 0 ? (
              <BarChart
                data={chartData}
                width={width - 40}
                height={220}
                yAxisLabel=""
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
                style={{ borderRadius: 12 }}
              />
            ) : (
              <Text style={styles.empty}>No usage data yet</Text>
            )}
          </View>

          {/* LIST */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📱 Detailed Usage</Text>

            {apps.length === 0 ? (
              <Text style={styles.empty}>No data</Text>
            ) : (
              apps.map((a, i) => (
                <View key={i} style={styles.rowItem}>
                  <Text style={styles.appName}>{a.app}</Text>
                  <Text style={styles.appTime}>{a.minutes} min</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#aaa",
    marginBottom: 10,
  },
  childCard: {
    backgroundColor: "#132F3D",
    padding: 14,
    borderRadius: 12,
    marginRight: 10,
  },
  activeChild: {
    backgroundColor: "#00C9A7",
  },
  childCode: {
    color: "#fff",
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 10,
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  appName: {
    color: "#ddd",
  },
  appTime: {
    color: "#00C9A7",
    fontWeight: "bold",
  },
  empty: {
    color: "#888",
  },
});