import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, Platform } from "react-native";
import { colors } from "../src/theme";

// Inject @font-face via CSS on web (Metro serves asset/ttf files)
if (Platform.OS === "web" && typeof document !== "undefined") {
  try {
    const style = document.createElement("style");
    style.innerHTML = `
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-Medium.ttf') format('truetype'); font-weight: 500; font-display: swap; }
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-SemiBold.ttf') format('truetype'); font-weight: 600; font-display: swap; }
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
      @font-face { font-family: 'Metropolis'; src: url('/assets/assets/fonts/Metropolis-ExtraBold.ttf') format('truetype'); font-weight: 800; font-display: swap; }
      html, body, #root { font-family: 'Metropolis', 'Helvetica Neue', Arial, sans-serif; }
    `;
    document.head.appendChild(style);
  } catch {}
}

// Default font for all <Text>
// @ts-ignore
Text.defaultProps = Text.defaultProps || {};
// @ts-ignore
Text.defaultProps.style = [{ fontFamily: "Metropolis" }, Text.defaultProps.style];

export default function RootLayout() {
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
        <Stack.Screen name="role" />
        <Stack.Screen name="login" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="child" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}
