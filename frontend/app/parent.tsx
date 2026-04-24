import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { api } from "../src/api";

const width = Dimensions.get("window").width;

export default function Parent() {
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selected) loadData();
  }, [selected]);

  const loadChildren = async () => {
    try {
      const res = await api("/children/list");

      if (!res?.error) {
        setChildren(res || []);
        if (res.length > 0) setSelected(res[0].child_id);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const res = await api(`/activity/daily?child_id=${selected}`);
      if (!res?.error) setApps(res || []);
    } catch (e) {
      console.log(e);
    }
  };

  const linkChild = async () => {
    try {
      const res = await api("/children/link", {
        method: "POST",
        body: JSON.stringify({ child_public_id: code }),
      });

      if (res?.error) throw new Error(res.message);

      Alert.alert("Child linked!");
      setCode("");
      loadChildren();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  // 🔥 CALCULATED ANALYTICS
  const totalMinutes = apps.reduce((sum, a) => sum + (a.minutes || 0), 0);

  const chartData = {
    labels: apps.slice(0, 5).map((a) => a.app?.slice(0, 6)),
    datasets: [
      {
        data: apps.slice(0, 5).map((a) => a.minutes || 0),
      },
    ],
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>GuardianNest</Text>

      {/* 🔗 ADD CHILD */}
      <View style={styles.card}>
        <Text style={styles.title}>Add Device</Text>
        <TextInput
          placeholder="Enter child code"
          placeholderTextColor="#888"
          value={code}
          onChangeText={setCode}
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={linkChild}>
          <Text style={styles.buttonText}>Link Device</Text>
        </TouchableOpacity>
      </View>

      {/* ❌ NO CHILD */}
      {children.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No devices connected</Text>
          <Text style={styles.emptySub}>
            Add a child device to start monitoring
          </Text>
        </View>
      )}

      {/* ✅ CHILD DASHBOARD */}
      {children.length > 0 && (
        <>
          {/* CHILD SWITCH */}
          <ScrollView horizontal style={styles.row}>
            {children.map((c) => (
              <TouchableOpacity
                key={c.child_id}
                onPress={() => setSelected(c.child_id)}
                style={[
                  styles.child,
                  selected === c.child_id && styles.active,
                ]}
              >
                <Text style={styles.childText}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 🔥 TOTAL USAGE */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Screen Time</Text>
            <Text style={styles.statValue}>
              {(totalMinutes / 60).toFixed(1)} hrs
            </Text>
          </View>

          {/* 📊 CHART */}
          <View style={styles.card}>
            <Text style={styles.title}>Top Apps</Text>

            {apps.length > 0 ? (
              <BarChart
                data={chartData}
                width={width - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix="m"
                fromZero
                chartConfig={{
                  backgroundColor: "#132F3D",
                  backgroundGradientFrom: "#132F3D",
                  backgroundGradientTo: "#132F3D",
                  decimalPlaces: 0,
                  color: () => "#00C9A7",
                  labelColor: () => "#fff",
                }}
                style={{ borderRadius: 10 }}
              />
            ) : (
              <Text style={styles.emptySub}>No usage yet</Text>
            )}
          </View>

          {/* 📱 APP LIST */}
          <View style={styles.card}>
            <Text style={styles.title}>App Usage</Text>

            {apps.map((a, i) => (
              <View key={i} style={styles.appRow}>
                <Text style={styles.appName}>{a.app}</Text>
                <Text style={styles.appTime}>{a.minutes} min</Text>
              </View>
            ))}
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
    padding: 20,
  },

  header: {
    fontSize: 30,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1F2A",
  },

  loadingText: {
    color: "#aaa",
    marginTop: 10,
  },

  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },

  statCard: {
    backgroundColor: "#00C9A7",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },

  statLabel: {
    color: "#000",
    fontSize: 14,
  },

  statValue: {
    color: "#000",
    fontSize: 32,
    fontWeight: "bold",
  },

  title: {
    color: "#fff",
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#0B1F2A",
    padding: 12,
    borderRadius: 10,
    color: "#fff",
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#00C9A7",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonText: {
    color: "#000",
    fontWeight: "bold",
  },

  emptyBox: {
    alignItems: "center",
    marginTop: 40,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 6,
  },

  emptySub: {
    color: "#aaa",
    textAlign: "center",
  },

  row: {
    marginBottom: 16,
  },

  child: {
    padding: 10,
    backgroundColor: "#132F3D",
    marginRight: 10,
    borderRadius: 10,
  },

  active: {
    backgroundColor: "#00C9A7",
  },

  childText: {
    color: "#fff",
  },

  appRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f3f4a",
  },

  appName: {
    color: "#fff",
  },

  appTime: {
    color: "#00C9A7",
    fontWeight: "bold",
  },
});