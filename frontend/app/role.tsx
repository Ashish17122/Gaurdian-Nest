import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function Role() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20, backgroundColor: "#0B1F2A" }}>
      <Text style={{ color: "#fff", fontSize: 24 }}>Select Role</Text>

      <TouchableOpacity onPress={() => router.push("/login?role=parent")}>
        <Text style={{ color: "#00C9A7", fontSize: 18 }}>Parent</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login?role=child")}>
        <Text style={{ color: "#00C9A7", fontSize: 18 }}>Child</Text>
      </TouchableOpacity>
    </View>
  );
}