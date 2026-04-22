import * as Notifications from "expo-notifications";

export async function registerPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}