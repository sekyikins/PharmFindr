import { COLORS, MAP_PIN_COLORS, getPharmacyPinColor } from '@/styles/theme';
import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, EdgePadding } from 'react-native-maps';
import type { MapMarker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { MarkerData } from '@/types/map';
export type { MarkerData };

interface FullMapComponentProps {
  initialRegion?: {
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
  showLegend?: boolean;
  refreshKey?: number;
  onPressLocate?: () => void;
}

export function getPinColor(m: MarkerData, isSelected: boolean): string {
  return getPharmacyPinColor({
    isVerified: m.isVerified,
    isOpen: m.isOpen,
    isSelected,
    showClosed: true,
  });
}

export default function FullMapComponent({
  initialRegion,
  userCoords,
  markers,
  selectedId,
  onSelectMarker,
  routeCoords,
  mapPadding,
  showLegend = true,
  onPressLocate,
}: FullMapComponentProps) {
  const mapRef = useRef<MapView>(null);
  const markerRefs = useRef<Record<string, MapMarker | null>>({});
  const mapReadyRef = useRef(false);
  const hasFramedRouteRef = useRef(false);
  const hasFramedInitialRef = useRef(false);

  // 1. Initial Route Framing: Runs strictly once when navigation route polyline (2+ points) becomes available
  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    if (routeCoords && routeCoords.length >= 2 && !hasFramedRouteRef.current) {
      hasFramedRouteRef.current = true;
      hasFramedInitialRef.current = true;
      const defaultPadding = mapPadding || { top: 90, right: 40, bottom: 200, left: 40 };
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: defaultPadding,
        animated: true,
      });
    }
  }, [routeCoords, mapPadding]);

  // 2. Initial User Location Framing: Runs strictly once when opening browse map without directions
  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current || hasFramedInitialRef.current) return;

    // If route coordinates are expected, wait for the route polyline instead of zooming to single point
    if (routeCoords !== undefined) {
      return;
    }

    if (userCoords) {
      hasFramedInitialRef.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }
  }, [userCoords, routeCoords]);

  // 3. Map Ready Callback: Triggers initial framing once native Google Maps finishes layout
  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;

    // Check if route coordinates are already available on ready
    if (routeCoords && routeCoords.length >= 2 && !hasFramedRouteRef.current) {
      hasFramedRouteRef.current = true;
      hasFramedInitialRef.current = true;
      const defaultPadding = mapPadding || { top: 90, right: 40, bottom: 200, left: 40 };
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: defaultPadding,
          animated: true,
        });
      }, 200);
      return;
    }

    // Check if user location is available on ready
    if (routeCoords === undefined && userCoords && !hasFramedInitialRef.current) {
      hasFramedInitialRef.current = true;
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: userCoords.latitude,
            longitude: userCoords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          400
        );
      }, 200);
    }
  }, [routeCoords, userCoords, mapPadding]);

  // Center camera directly on device GPS location ONLY when user taps the Locate button
  const handleCenterOnUser = useCallback(() => {
    if (userCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }

    if (onPressLocate) {
      onPressLocate();
    }
  }, [userCoords, onPressLocate]);

  const defaultInitialRegion = initialRegion || {
    latitude: userCoords?.latitude ?? 5.6037,
    longitude: userCoords?.longitude ?? -0.187,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={defaultInitialRegion}
        onMapReady={handleMapReady}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        mapPadding={mapPadding || { top: 120, right: 16, bottom: 140, left: 16 }}
      >
        {/* Pharmacy markers */}
        {markers.map((m) => {
          const isSelected = m.id === selectedId;
          const color = getPinColor(m, isSelected);
          const descriptionText = `${m.isVerified ? 'Verified Partner' : 'Public Pharmacy'}${m.isOpen === false ? ' · Closed' : m.isOpen === true ? ' · Open' : ''}`;

          return (
            <Marker
              key={`${m.id}-${isSelected ? 'sel' : 'nor'}-${color}`}
              ref={(ref) => { markerRefs.current[m.id] = ref; }}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.name}
              description={descriptionText}
              pinColor={color}
              zIndex={isSelected ? 50 : m.isVerified ? 20 : 10}
              onPress={() => onSelectMarker(m.id)}
            />
          );
        })}

        {/* Route polyline if available */}
        {routeCoords && routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={COLORS.patientPrimary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Floating GPS My Location FAB Button */}
      <Pressable
        style={({ pressed }) => [
          styles.locateFab,
          pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
          { bottom: showLegend ? 64 : 20 },
        ]}
        onPress={handleCenterOnUser}
        accessibilityLabel="Center map on my location"
      >
        <Ionicons name="locate" size={22} color={COLORS.patientPrimary} />
      </Pressable>

      {/* Floating Map Legend Bar */}
      {showLegend && (
        <View style={styles.legendBar} pointerEvents="box-none">
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.verified }]} />
            <Text style={styles.legendText}>Verified</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.public }]} />
            <Text style={styles.legendText}>Public Pharmacy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.closed }]} />
            <Text style={styles.legendText}>Closed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.selected }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>
      )}
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
  locateFab: {
    position: 'absolute',
    right: 16,
    top: 150,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 15,
  },
  legendBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.borderSlate,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
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
    fontFamily: 'Inter-SemiBold',
    color: '#334155',
  },
});
