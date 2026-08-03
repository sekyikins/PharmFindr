import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, EdgePadding } from 'react-native-maps';
import type { MapMarker } from 'react-native-maps';

export interface MarkerData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isRegistered?: boolean;
  isOpen?: boolean;
  hours?: string;
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

export function getPinColor(m: MarkerData, isSelected: boolean): string {
  if (isSelected) return '#f59e0b'; // Amber / Gold for active selected pin
  if (m.isOpen === false) return '#64748b'; // Slate Gray for ALL closed pharmacies (registered & public)
  if (m.isRegistered) return '#10b981'; // Emerald Green for open registered database pharmacies
  return '#0284c7'; // Royal Blue for open public map pharmacies
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
  const markerRefs = useRef<Record<string, MapMarker | null>>({});
  const mapReadyRef = useRef(false);
  const hasCenteredRef = useRef(false);
  const userMovedMapRef = useRef(false);

  // Central camera function — called from both onMapReady and useEffects
  const applyCamera = useCallback((
    coords: { latitude: number; longitude: number } | null,
    selId: string | null | undefined,
    mkrs: MarkerData[],
    force = false,
  ) => {
    if (!mapRef.current || !mapReadyRef.current) return;
    if (userMovedMapRef.current && !force) return;

    const selected = selId ? mkrs.find((m) => m.id === selId) : null;

    if (selected) {
      hasCenteredRef.current = true;
      if (coords) {
        // Frame both user + pharmacy
        mapRef.current.fitToCoordinates(
          [
            { latitude: coords.latitude, longitude: coords.longitude },
            { latitude: selected.latitude, longitude: selected.longitude },
          ],
          { edgePadding: { top: 100, right: 60, bottom: 260, left: 60 }, animated: true }
        );
      } else {
        mapRef.current.animateToRegion(
          { latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
          500
        );
      }
      setTimeout(() => markerRefs.current[selId!]?.showCallout?.(), 700);
    } else if (coords && !hasCenteredRef.current) {
      // No selection — center on user
      hasCenteredRef.current = true;
      mapRef.current.animateToRegion(
        { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        400
      );
    }
  }, []);

  // Detect user-initiated pan/zoom — suppress further auto-centering until next selection
  const handleRegionChangeComplete = useCallback((_region: any, details?: { isGesture?: boolean }) => {
    if (details?.isGesture) {
      userMovedMapRef.current = true;
    }
  }, []);

  // Fire camera as soon as the map is ready (handles pre-loaded coords/selection)
  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    applyCamera(userCoords, selectedId, markers);
  }, [userCoords, selectedId, markers, applyCamera]);

  // Re-apply when userCoords arrives after map is already ready (slow GPS)
  useEffect(() => {
    applyCamera(userCoords, selectedId, markers);
  }, [userCoords]);

  // Re-apply when selectedId changes — reset user-moved flag so the map re-centers
  useEffect(() => {
    if (selectedId) {
      userMovedMapRef.current = false;
      applyCamera(userCoords, selectedId, markers, true);
    }
  }, [selectedId, markers]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChangeComplete}
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
            zIndex={100}
          />
        )}

        {/* Pharmacy markers */}
        {markers.map((m) => {
          const isSelected = m.id === selectedId;
          const color = getPinColor(m, isSelected);
          const descriptionText = `${m.isRegistered ? 'Verified Partner' : 'Public Directory'}${m.isOpen === false ? ' · Closed Now' : ' · Open'}`;

          return (
            <Marker
              key={`${m.id}-${isSelected ? 'sel' : 'nor'}`}
              ref={(ref) => { markerRefs.current[m.id] = ref; }}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.name}
              description={descriptionText}
              pinColor={color}
              zIndex={isSelected ? 50 : m.isRegistered ? 20 : 10}
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

      {/* Floating Map Legend Bar */}
      <View style={styles.legendBar} pointerEvents="box-none">
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Verified</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
          <Text style={styles.legendText}>Public</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#64748b' }]} />
          <Text style={styles.legendText}>Closed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  legendBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
});