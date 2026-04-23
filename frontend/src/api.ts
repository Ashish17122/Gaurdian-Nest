import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://gaurdian-nest.onrender.com";

const TOKEN_KEY = "gn_token";

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function api(path: string, options: any = {}) {
  const token = await getToken();

  let res;

  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body,
    });
  } catch (e) {
    console.log("NETWORK ERROR:", e);
    throw new Error("Network error. Check internet or backend.");
  }

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    // backend might return plain text
    try {
      const text = await res.text();
      data = { message: text };
    } catch {
      data = { message: "Unknown server response" };
    }
  }

  // 🔥 IMPORTANT FIX — DO NOT HARD FAIL ON BACKEND TEXT ERRORS
  if (!res.ok) {
    console.log("API ERROR RESPONSE:", data);

    // ❌ NEVER crash app because backend sent string like "Email not found"
    return {
      error: true,
      ...data,
    };
  }

  return data;
}