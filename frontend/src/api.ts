import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const TOKEN_KEY = "gn_session_token";

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function api(path: string, options: any = {}) {
  const token = await getToken();

  const res = await fetch(`${BASE}/api${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body,
  });

  if (!res.ok) throw new Error("API error");

  return res.json();
}