import { useEffect } from "react";
import { router } from "expo-router";
import { api } from "../src/api";

export default function Index() {
  useEffect(() => {
    (async () => {
      try {
        const user = await api("/auth/me");

        if (user.role === "parent") router.replace("/parent");
        else router.replace("/child");
      } catch {
        router.replace("/login");
      }
    })();
  }, []);

  return null;
}