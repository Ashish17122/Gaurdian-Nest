import { View, Button } from "react-native";
import { router } from "expo-router";

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", gap: 20, padding: 20 }}>
      
      {/* 👨‍👩‍👧 Parent */}
      <Button
        title="I am Parent"
        onPress={() => router.push("/login")}
      />

      {/* 📱 Child */}
      <Button
        title="I am Child"
        onPress={() => router.push("/child")}
      />

    </View>
  );
}