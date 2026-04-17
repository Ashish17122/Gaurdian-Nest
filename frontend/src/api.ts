// GuardianNest - shared API client and session storage
// Works on web (expo-router web) + native (Expo Go / APK).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "";

const TOKEN_KEY = "gn_session_token";

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}/api${path}`, {
    ...opts,
    headers,
    credentials: Platform.OS === "web" ? "include" : "omit",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const BACKEND_URL = BACKEND;
