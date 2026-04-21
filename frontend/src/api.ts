import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = "https://gaurdian-nest.onrender.com/api";

const TOKEN_KEY = "gn_session_token";

export async function setToken(t: string | null) {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function api(path: string, opts: any = {}) {
  const token = await getToken();

  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error("API error");

  return res.json();
}