import { useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  useEffect(() => {
    check();
  }, []);

  const check = async () => {
    const token = await AsyncStorage.getItem("gn_token");

    if (token) router.replace("/parent");
    else router.replace("/role");
  };

  return null;
}