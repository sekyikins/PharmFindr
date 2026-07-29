import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, EdgePadding } from 'react-native-maps';

interface MarkerData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface FullMapComponentProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  userCoords: { latitude: number; longitude: number } | null;
  markers: MarkerData[];
  selectedId?: string | null;
  onSelectMarker: (id: string) => void;
  routeCoords?: { latitude: number; longitude: number }[];
  mapPadding?: EdgePadding;
}

export default function FullMapComponent({
  initialRegion,
  userCoords,
  markers,
  selectedId,
  onSelectMarker,
  routeCoords,
  mapPadding = { top: 90, right: 16, bottom: 140, left: 16 },
}: FullMapComponentProps) {
  const mapRef = useRef<MapView>(null);

  // Animate map center to selected pharmacy when selectedId changes
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const selected = markers.find((m) => m.id === selectedId);
    if (selected) {
      mapRef.current.animateToRegion(
        {
          latitude: selected.latitude,
          longitude: selected.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
    }
  }, [selectedId, markers]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton
      showsCompass
      mapPadding={mapPadding}
    >
      {/* User position fallback if showsUserLocation isn't ready */}
      {userCoords && (
        <Marker
          coordinate={userCoords}
          title="You are here"
          pinColor="#2563eb"
          zIndex={20}
        />
      )}

      {/* Pharmacy markers */}
      {markers.map((m) => {
        const isSelected = m.id === selectedId;
        return (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.name}
            description={m.address}
            pinColor={isSelected ? '#059669' : '#10b981'}
            zIndex={isSelected ? 15 : 5}
            onPress={() => onSelectMarker(m.id)}
          />
        );
      })}

      {/* Route polyline if available */}
      {routeCoords && routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor="#2563eb"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});