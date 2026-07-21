import React from 'react';
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';

interface MapComponentProps {
  pin: { latitude: number; longitude: number } | null;
  onPressMap: (coordinate: { latitude: number; longitude: number }) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
  setScrollEnabled?: (enabled: boolean) => void;
}

export default function MapComponent({ pin, onPressMap, initialCoords, setScrollEnabled }: MapComponentProps) {
  const lat = initialCoords?.latitude ?? 5.6037;
  const lon = initialCoords?.longitude ?? -0.187;

  return (
    <MapView
      style={{ flex: 1 }}
      provider={PROVIDER_DEFAULT}
      mapType="none"
      initialRegion={{
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      onPress={(e) => onPressMap(e.nativeEvent.coordinate)}
      onTouchStart={() => setScrollEnabled?.(false)}
      onTouchEnd={() => setScrollEnabled?.(true)}
      onTouchCancel={() => setScrollEnabled?.(true)}
    >
      {/* CARTO tiles - built on OSM, free for apps, no API key needed */}
      <UrlTile
        urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
        tileSize={256}
      />

      {pin && (
        <Marker coordinate={pin} pinColor="#2563eb" title="Pharmacy Location" />
      )}
    </MapView>
  );
}