import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../src/api";
import { colors } from "../src/theme";

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

// Global font fix
// @ts-ignore
Text.defaultProps = Text.defaultProps || {};
// @ts-ignore
Text.defaultProps.style = [{ fontFamily: "System" }, Text.defaultProps.style];

export default function RootLayout() {
  useEffect(() => {
    registerPush();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="role" />
        <Stack.Screen name="login" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="child" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}