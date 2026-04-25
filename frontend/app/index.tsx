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

      // 🔥 STEP 1: choose role FIRST
      if (!role) {
        router.replace("/role");
        return;
      }

      // 🔥 STEP 2: login required
      if (!token) {
        router.replace("/login");
        return;
      }

      // 🔥 STEP 3: name AFTER login
      if (!name) {
        router.replace("/register" as any);
        return;
      }

      // 🔥 STEP 4: route
      if (role === "child") {
        router.replace("/child");
      } else if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/parent");
      }

    } catch (e) {
      console.log(e);
      router.replace("/role");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color="#00C9A7" />
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