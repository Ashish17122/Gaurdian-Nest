// @ts-nocheck
import { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function Map({ location }: any) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  }, [location]);

  if (!location?.lat || !location?.lng) {
    return (
      <View
        style={{
          height: 200,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#132F3D",
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#aaa" }}>No location data</Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={{ height: 200, borderRadius: 10 }}
      initialRegion={{
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker
        coordinate={{
          latitude: location.lat,
          longitude: location.lng,
        }}
        title="Child Device"
      />
    </MapView>
  );
}