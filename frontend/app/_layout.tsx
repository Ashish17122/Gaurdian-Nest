import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../src/api";
import { colors } from "../src/theme";

// ---------------- PUSH NOTIFICATIONS ----------------
async function registerPush() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    await api("/notifications/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch {}
}

// ---------------- FONT (WEB ONLY) ----------------
if (Platform.OS === "web" && typeof document !== "undefined") {
  try {
    const style = document.createElement("style");
    style.innerHTML = `
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-Regular.ttf') format('truetype'); font-weight: 400; }
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-Bold.ttf') format('truetype'); font-weight: 700; }
      html, body, #root { font-family: 'Metropolis', Arial, sans-serif; }
    `;
    document.head.appendChild(style);
  } catch {}
}

// ---------------- GLOBAL TEXT FONT ----------------
// @ts-ignore
Text.defaultProps = Text.defaultProps || {};
// @ts-ignore
Text.defaultProps.style = [{ fontFamily: "Metropolis" }, Text.defaultProps.style];

// ---------------- MAIN LAYOUT ----------------
export default function RootLayout() {
  useEffect(() => {
    registerPush();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="child" />
      </Stack>
    </>
  );
}