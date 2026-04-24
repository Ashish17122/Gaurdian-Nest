import { useEffect } from "react";
import { View, ActivityIndicator, StatusBar, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export default function Index() {
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const token = await AsyncStorage.getItem("gn_token");
      const role = await AsyncStorage.getItem("gn_role");
      const name = await AsyncStorage.getItem("user_name");

      // 🔥 STEP 1: ensure name exists
      if (!name) {
        router.replace("/register" as any);
        return;
      }

      // 🔥 STEP 2: not logged in
      if (!token) {
        router.replace("/role");
        return;
      }

      // 🔥 STEP 3: route based on role
      if (role === "child") {
        router.replace("/child");
      } else if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/parent");
      }

    } catch (e) {
      console.log("Init error:", e);
      router.replace("/role");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator color="#00C9A7" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F2A",
    justifyContent: "center",
    alignItems: "center",
  },
});