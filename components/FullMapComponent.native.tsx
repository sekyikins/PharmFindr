import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';

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
  onSelectMarker: (id: string) => void;
  routeCoords?: { latitude: number; longitude: number }[];
}

export default function FullMapComponent({
  initialRegion,
  userCoords,
  markers,
  onSelectMarker,
  routeCoords,
}: FullMapComponentProps) {
  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation={false}
      mapType="none"
    >
      {/* CARTO tiles – built on OSM data, free for app use, no API key needed */}
      <UrlTile
        urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
        tileSize={256}
      />

      {/* User position */}
      {userCoords && (
        <Marker
          coordinate={userCoords}
          title="You are here"
          pinColor="#2563eb"
          zIndex={10}
        />
      )}

      {/* Pharmacy markers */}
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={m.name}
          description={m.address}
          pinColor="#10b981"
          onCalloutPress={() => onSelectMarker(m.id)}
        />
      ))}

      {/* ORS navigation route */}
      {routeCoords && routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor="#2563eb"
          strokeWidth={4}
          lineDashPattern={[0]}
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