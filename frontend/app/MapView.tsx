// @ts-nocheck
import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export default function Map({ location }: any) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (location?.lat && location?.lng && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: Number(location.lat),
          longitude: Number(location.lng),
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
      provider={PROVIDER_GOOGLE} // ✅ IMPORTANT
      ref={mapRef}
      style={{ height: 200, borderRadius: 10 }}
      initialRegion={{
        latitude: Number(location.lat),
        longitude: Number(location.lng),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker
        coordinate={{
          latitude: Number(location.lat),
          longitude: Number(location.lng),
        }}
        title="Child Device"
      />
    </MapView>
  );
}