import { COLORS, FONT_SIZE, MAP_PIN_COLORS, RADIUS, SPACING, getPharmacyPinColor } from '@/styles/theme';
import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
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
  mapPadding?: { top: number; right: number; bottom: number; left: number };
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
  userCoords,
  markers,
  selectedId,
  onSelectMarker,
  showLegend = true,
  refreshKey,
  onPressLocate,
}: FullMapComponentProps) {
  // Translate latitude/longitude offsets into CSS percentage positions relative to Accra area
  const getPositionStyles = (lat: number, lng: number) => {
    const centerLat = 5.6037;
    const centerLng = -0.1870;
    
    const latDiff = lat - centerLat;
    const lngDiff = lng - centerLng;
    
    const topPercent = 50 - (latDiff / 0.05) * 50;
    const leftPercent = 50 + (lngDiff / 0.05) * 50;
    
    return {
      top: `${Math.min(Math.max(topPercent, 10), 85)}%` as any,
      left: `${Math.min(Math.max(leftPercent, 10), 85)}%` as any,
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapGrid}>
        {/* River/Water body */}
        <View style={styles.river} />
        {/* Streets */}
        <View style={[styles.street, { top: '25%', height: 16 }]} />
        <View style={[styles.street, { top: '65%', height: 12 }]} />
        <View style={[styles.street, { left: '30%', width: 14, height: '100%' }]} />
        <View style={[styles.street, { left: '75%', width: 18, height: '100%' }]} />

        {/* User Location Marker */}
        {userCoords && (
          <View style={[styles.markerContainer, getPositionStyles(userCoords.latitude, userCoords.longitude)]}>
            <View style={styles.userPulse} />
            <View style={styles.userPin}>
              <Ionicons name="navigate" size={14} color={COLORS.white} />
            </View>
            <Text style={styles.userLabel}>You</Text>
          </View>
        )}

        {/* Pharmacy Markers */}
        {markers.map((m) => {
          const isSelected = m.id === selectedId;
          const pinColor = getPinColor(m, isSelected);
          return (
            <Pressable
              key={m.id}
              style={[
                styles.markerContainer,
                getPositionStyles(m.latitude, m.longitude),
                isSelected && { zIndex: 10 },
              ]}
              onPress={() => onSelectMarker(m.id)}
            >
              <View
                style={[
                  styles.pharmacyPin,
                  { backgroundColor: pinColor },
                  isSelected && styles.pharmacyPinSelected,
                ]}
              >
                <Ionicons
                  name={m.isVerified ? 'medkit' : 'location'}
                  size={isSelected ? 16 : 13}
                  color={COLORS.white}
                />
              </View>
              <Text
                style={[
                  styles.pharmacyLabel,
                  isSelected && styles.pharmacyLabelSelected,
                  { color: isSelected ? COLORS.pendingText : COLORS.textPrimary },
                ]}
                numberOfLines={1}
              >
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Floating GPS My Location FAB Button */}
      {onPressLocate && (
        <Pressable
          style={({ pressed }) => [
            styles.locateFab,
            pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
            { bottom: showLegend ? 64 : 20 },
          ]}
          onPress={onPressLocate}
          accessibilityLabel="Center map on my location"
        >
          <Ionicons name="locate" size={22} color={COLORS.patientPrimary} />
        </Pressable>
      )}

      {/* Map Legend */}
      {showLegend && (
        <View style={styles.legendContainer}>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceSecondary,
    overflow: 'hidden',
  },
  locateFab: {
    position: 'absolute',
    right: SPACING.lg,
    top: 150,
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    zIndex: 15,
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceSecondary,
  },
  river: {
    position: 'absolute',
    left: '45%',
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: COLORS.infoBg,
    transform: [{ rotate: '-25deg' }],
  },
  street: {
    position: 'absolute',
    backgroundColor: COLORS.white,
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  userPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  userPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.infoText,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  userLabel: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    color: COLORS.infoText,
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  pharmacyPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  pharmacyPinSelected: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.xl,
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  pharmacyLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-SemiBold',
    marginTop: 2,
    maxWidth: 90,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
    textAlign: 'center',
  },
  pharmacyLabelSelected: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    backgroundColor: COLORS.pendingBg,
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  legendContainer: {
    position: 'absolute',
    bottom: SPACING.xxl,
    left: SPACING.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.sm,
  },
  legendText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
    color: COLORS.textSecondary,
  },
});
