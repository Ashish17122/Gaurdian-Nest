import { useEffect } from "react";
import { View, Button, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { api, setToken } from "../src/api";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId:
      "786843635437-k0qqfgirae0jvgqfpss59jam2rmj7bs3.apps.googleusercontent.com",
    androidClientId:
      "786843635437-39ajq46i3i4ds5cf9ckp99g8eikn3kc7.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      handleGoogleLogin(response.authentication?.idToken);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string | undefined) => {
    try {
      if (!idToken) throw new Error("No Google token");

      const res = await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({ token: idToken }),
      });

      await setToken(res.session_token);

      router.replace("/parent");
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Continue with Google" onPress={() => promptAsync()} />
    </View>
  );
}