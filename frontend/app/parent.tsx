import { useEffect, useState, useRef } from "react";
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
  StatusBar,
  Image,
  NativeModules,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { api } from "../src/api";

const { AppListModule } = NativeModules;
const width = Dimensions.get("window").width;

export default function Parent() {
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<any>(null);

  const [apps, setApps] = useState<any[]>([]);

  // 🔥 EXISTING (parent apps fallback)
  const [installedApps, setInstalledApps] = useState<any[]>([]);

  // 🔥 NEW (child apps real source)
  const [childApps, setChildApps] = useState<any[]>([]);

  const [total, setTotal] = useState(0);
  const [topApp, setTopApp] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [code, setCode] = useState("");

  const intervalRef = useRef<any>(null);

  // ================= LOAD =================
  useEffect(() => {
    loadChildren();
    loadInstalledApps(); // keep existing behavior
  }, []);

  useEffect(() => {
    if (selected) {
      loadData();

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        loadData();
      }, 5000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selected]);

  // ================= INSTALLED APPS (PARENT FALLBACK) =================
  const loadInstalledApps = async () => {
    try {
      const list = await AppListModule.getInstalledApps();
      setInstalledApps(list);
    } catch (e) {
      console.log("App list error:", e);
    }
  };

  const getAppMeta = (pkg: string) => {
    return installedApps.find((a: any) => a.package === pkg);
  };

  // ================= CHILD APPS (REAL SOURCE) =================
  const loadChildApps = async () => {
    try {
      const res = await api(`/apps/list?child_id=${selected}`);
      setChildApps(res || []);
    } catch (e) {
      console.log("Child apps error:", e);
    }
  };

  const getChildMeta = (pkg: string) => {
    return childApps.find((a: any) => a.package === pkg);
  };

  const cleanName = (pkg: string) => {
    return pkg?.split(".").pop()?.replace("_", " ") || pkg;
  };

  // ================= LOAD CHILDREN =================
  const loadChildren = async () => {
    try {
      const res = await api("/children/list");

      const now = Date.now();

      const enhanced = (res || []).map((c: any) => {
        const lastSeen = c.last_seen
          ? new Date(c.last_seen).getTime()
          : 0;

        const online = now - lastSeen < 60000;

        return { ...c, online };
      });

      setChildren(enhanced);

      if (enhanced.length > 0) {
        setSelected(enhanced[0].child_id);
        setSelectedChild(enhanced[0]);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  // ================= LOAD DATA =================
  const loadData = async () => {
    try {
      setDataLoading(true);

      const res = await api(`/activity/daily?child_id=${selected}`);

      const appsData = res?.apps || res || [];

      const sorted = appsData.sort(
        (a: any, b: any) => (b.minutes || 0) - (a.minutes || 0)
      );

      setApps(sorted);

      const totalMinutes = sorted.reduce(
        (sum: number, a: any) => sum + (a.minutes || 0),
        0
      );

      setTotal(totalMinutes);
      setTopApp(sorted[0]?.app || null);

      // 🔥 NEW ADDITION (no removal)
      await loadChildApps();

      // keep existing
      loadChildren();

    } catch (e) {
      console.log(e);
    } finally {
      setDataLoading(false);
    }
  };

  // ================= LINK =================
  const linkChild = async () => {
    try {
      const res = await api("/children/link", {
        method: "POST",
        body: JSON.stringify({ child_public_id: code }),
      });

      if (res?.error) throw new Error(res.message);

      Alert.alert("Device linked");
      setCode("");
      loadChildren();

    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  // ================= CHART =================
  const chartData = {
    labels: apps.slice(0, 5).map((a) =>
      cleanName(a.app).slice(0, 6)
    ),
    datasets: [
      {
        data: apps.slice(0, 5).map((a) => a.minutes || 0),
      },
    ],
  };

  // ================= LOADING =================
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={styles.loadingText}>Loading devices...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>GuardianNest</Text>

      {/* ADD DEVICE */}
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
          <Text style={styles.buttonText}>Link</Text>
        </TouchableOpacity>
      </View>

      {children.length > 0 && (
        <>
          {/* CHILD SWITCH */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {children.map((c) => (
              <TouchableOpacity
                key={c.child_id}
                onPress={() => setSelected(c.child_id)}
                style={[
                  styles.child,
                  selected === c.child_id && styles.active,
                ]}
              >
                <Text style={styles.childText}>
                  {c.name || "Child"}
                </Text>
                <Text style={{
                  fontSize: 10,
                  color: c.online ? "#00C9A7" : "#888"
                }}>
                  {c.online ? "● Online" : "● Offline"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* INFO */}
          {selectedChild && (
            <View style={styles.infoCard}>
              <Text style={styles.childName}>
                {selectedChild.name || "Child"}
              </Text>
              <Text style={styles.childId}>
                Device ID: {selectedChild.child_id}
              </Text>
            </View>
          )}

          {/* TOTAL */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Screen Time</Text>
            <Text style={styles.statValue}>
              {(total / 60).toFixed(1)} hrs
            </Text>
          </View>

          {/* TOP APP */}
          {topApp && (
            <View style={styles.card}>
              <Text style={styles.title}>Most Used App</Text>
              <Text style={styles.highlight}>
                {cleanName(topApp)}
              </Text>
            </View>
          )}

          {/* CHART */}
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
                style={{ borderRadius: 12 }}
              />
            ) : dataLoading ? (
              <ActivityIndicator color="#00C9A7" />
            ) : (
              <Text style={styles.emptySub}>No usage yet</Text>
            )}
          </View>

          {/* LIST WITH ICONS */}
          <View style={styles.card}>
            <Text style={styles.title}>App Usage</Text>

            {apps.map((a, i) => {
              const childMeta = getChildMeta(a.app);
              const fallbackMeta = getAppMeta(a.app);

              return (
                <View key={i} style={styles.appRow}>
                  {childMeta ? (
                    <Image
                      source={{
                        uri: `data:image/png;base64,${childMeta.icon}`,
                      }}
                      style={styles.icon}
                    />
                  ) : fallbackMeta ? (
                    <Image
                      source={{
                        uri: `data:image/png;base64,${fallbackMeta.icon}`,
                      }}
                      style={styles.icon}
                    />
                  ) : (
                    <View style={styles.placeholder} />
                  )}

                  <Text style={styles.appName}>
                    {childMeta?.name ||
                      fallbackMeta?.name ||
                      cleanName(a.app)}
                  </Text>

                  <Text style={styles.appTime}>
                    {a.minutes} min
                  </Text>
                </View>
              );
            })}
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
    paddingTop: StatusBar.currentHeight || 40,
    padding: 16,
  },
  header: {
    fontSize: 28,
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
  loadingText: { color: "#aaa", marginTop: 10 },
  card: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#132F3D",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  childName: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  childId: { color: "#aaa", fontSize: 12 },
  statCard: {
    backgroundColor: "#00C9A7",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  statLabel: { color: "#000" },
  statValue: {
    color: "#000",
    fontSize: 30,
    fontWeight: "bold",
  },
  title: { color: "#fff", marginBottom: 10, fontWeight: "600" },
  highlight: {
    color: "#00C9A7",
    fontSize: 20,
    fontWeight: "bold",
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
  buttonText: { color: "#000", fontWeight: "bold" },
  child: {
    padding: 10,
    backgroundColor: "#132F3D",
    marginRight: 10,
    borderRadius: 10,
  },
  active: {
    backgroundColor: "#00C9A7",
  },
  childText: { color: "#fff" },
  emptySub: { color: "#aaa" },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f3f4a",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    marginRight: 10,
  },
  placeholder: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#333",
    marginRight: 10,
  },
  appName: {
    flex: 1,
    color: "#fff",
  },
  appTime: {
    color: "#00C9A7",
    fontWeight: "bold",
  },
});