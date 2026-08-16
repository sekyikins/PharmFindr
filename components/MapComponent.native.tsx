import { COLORS, FONT_SIZE, MAP_PIN_COLORS, RADIUS, SPACING } from '@/styles/theme';
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { KnownPharmacy, RegisteredPharmacy } from '@/types/map';
export type { KnownPharmacy, RegisteredPharmacy };

interface MapComponentProps {
  pin: { latitude: number; longitude: number } | null;
  onPressMap: (coordinate: { latitude: number; longitude: number }) => void;
  onSelectKnownPharmacy?: (pharmacy: KnownPharmacy) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
  setScrollEnabled?: (enabled: boolean) => void;
  knownPharmacies?: KnownPharmacy[];
  registeredPharmacies?: RegisteredPharmacy[];
  onRegionChangeComplete?: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => void;
  onExpand?: () => void;
}

export default function MapComponent({
  pin,
  onPressMap,
  onSelectKnownPharmacy,
  initialCoords,
  setScrollEnabled,
  knownPharmacies = [],
  registeredPharmacies = [],
  onRegionChangeComplete,
}: MapComponentProps) {
  const mapRef = React.useRef<MapView>(null);
  const hasFocusedRef = React.useRef(false);
  const lat = pin?.latitude ?? initialCoords?.latitude ?? 5.6037;
  const lon = pin?.longitude ?? initialCoords?.longitude ?? -0.187;

  // Auto-focus strictly ONCE when the map is opened
  React.useEffect(() => {
    if (!hasFocusedRef.current && (initialCoords || pin)) {
      hasFocusedRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }
  }, [initialCoords, pin, lat, lon]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={{
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => onPressMap(e.nativeEvent.coordinate)}
        onTouchStart={() => setScrollEnabled?.(false)}
        onTouchEnd={() => setScrollEnabled?.(true)}
        onTouchCancel={() => setScrollEnabled?.(true)}
      >
        {/* Public Maps Pharmacies (Blue — Selectable) */}
        {knownPharmacies.map((pharm) => (
          <Marker
            key={`known-${pharm.id}`}
            coordinate={{ latitude: pharm.latitude, longitude: pharm.longitude }}
            pinColor={MAP_PIN_COLORS.public}
            title={pharm.name}
            description="Public Map Location · Tap to select this location"
            onPress={(e) => {
              e.stopPropagation();
              onSelectKnownPharmacy?.(pharm);
            }}
          />
        ))}

        {/* Verified Pharmacies on PharmFindr (Green — Info Only, Not Selectable) */}
        {registeredPharmacies.map((pharm) => (
          <Marker
            key={`reg-${pharm.id}`}
            coordinate={{ latitude: pharm.latitude, longitude: pharm.longitude }}
            pinColor={MAP_PIN_COLORS.verified}
            title={`${pharm.name} (Verified)`}
            description="Verified on PharmFindr (Not selectable)"
            onPress={(e) => e.stopPropagation()}
          />
        ))}

        {/* Selected / Custom Pin (Yellow/Gold) */}
        {pin && (
          <Marker
            coordinate={pin}
            pinColor={MAP_PIN_COLORS.selected}
            title="Selected Location"
            description="Your selected pharmacy location"
          />
        )}
      </MapView>

      {/* Floating Legend for clear distinction */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.verified }]} />
          <Text style={styles.legendText}>Verified</Text>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.public }]} />
          <Text style={styles.legendText}>Public Pharmacy</Text>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MAP_PIN_COLORS.selected }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  legendContainer: {
    position: 'absolute',
    bottom: SPACING.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    gap: SPACING.xs,
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
    fontFamily: 'Inter-SemiBold',
    color: COLORS.textSecondary,
  },
  legendDivider: {
    width: 1,
    height: 10,
    backgroundColor: COLORS.borderSlate,
  },
});