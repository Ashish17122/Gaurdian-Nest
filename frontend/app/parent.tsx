import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
} from "react-native";
import { api } from "../src/api";

export default function Parent() {
  const [code, setCode] = useState("");
  const [data, setData] = useState<any[]>([]);

  const linkChild = async () => {
    try {
      await api("/children/link", {
        method: "POST",
        body: JSON.stringify({ child_public_id: code }),
      });

      alert("Child linked successfully");
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const load = async () => {
    try {
      const res = await api("/activity/daily");
      setData(res || []);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      
      {/* LINK CHILD */}
      <TextInput
        placeholder="Enter child code"
        value={code}
        onChangeText={setCode}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />

      <Button title="Link Child" onPress={linkChild} />

      {/* DASHBOARD */}
      <FlatList
        style={{ marginTop: 20 }}
        data={data}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 15,
              marginVertical: 5,
              borderRadius: 10,
              backgroundColor: "#f2f2f2",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {item.app}
            </Text>

            <Text style={{ color: "#666" }}>{item.category}</Text>

            <View
              style={{
                height: 6,
                backgroundColor: "#ddd",
                marginVertical: 5,
                borderRadius: 3,
              }}
            >
              <View
                style={{
                  width: `${Math.min(item.minutes * 2, 100)}%`,
                  backgroundColor: "#4CAF50",
                  height: 6,
                  borderRadius: 3,
                }}
              />
            </View>

            <Text>{item.minutes} min</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: 20 }}>
            No activity yet
          </Text>
        }
      />
    </View>
  );
}