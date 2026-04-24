import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export default function Index() {
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const token = await AsyncStorage.getItem("gn_token");
    const role = await AsyncStorage.getItem("gn_role");

    // 🔥 NO TOKEN → go role select
    if (!token) {
      router.replace("/role");
      return;
    }

    // 🔥 FORCE ROUTING BY ROLE
    if (role === "child") {
      router.replace("/child");
    } else if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/parent");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B1F2A" }}>
      <ActivityIndicator color="#00C9A7" size="large" />
    </View>
  );
}