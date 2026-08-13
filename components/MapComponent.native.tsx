import { COLORS } from '@/styles/theme';
import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

export interface KnownPharmacy {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface RegisteredPharmacy {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface MapComponentProps {
  pin: { latitude: number; longitude: number } | null;
  onPressMap: (coordinate: { latitude: number; longitude: number }) => void;
  onSelectKnownPharmacy?: (pharmacy: KnownPharmacy) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
  setScrollEnabled?: (enabled: boolean) => void;
  knownPharmacies?: KnownPharmacy[];
  registeredPharmacies?: RegisteredPharmacy[];
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
  onExpand,
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
        onPress={(e) => onPressMap(e.nativeEvent.coordinate)}
        onTouchStart={() => setScrollEnabled?.(false)}
        onTouchEnd={() => setScrollEnabled?.(true)}
        onTouchCancel={() => setScrollEnabled?.(true)}
      >
        {/* Unregistered OSM Pharmacies (Green — Selectable) */}
        {knownPharmacies.map((pharm) => (
          <Marker
            key={`known-${pharm.id}`}
            coordinate={{ latitude: pharm.latitude, longitude: pharm.longitude }}
            pinColor={COLORS.pharmacyPrimary}
            title={pharm.name}
            description="Tap to select location"
            onPress={(e) => {
              e.stopPropagation();
              onSelectKnownPharmacy?.(pharm);
            }}
          />
        ))}

        {/* Registered Pharmacies (Brown — Info Only, Not Selectable) */}
        {registeredPharmacies.map((pharm) => (
          <Marker
            key={`reg-${pharm.id}`}
            coordinate={{ latitude: pharm.latitude, longitude: pharm.longitude }}
            pinColor="#78350f"
            title={`${pharm.name} (Registered)`}
            description="Already registered on PharmFindr (Not selectable)"
            onPress={(e) => e.stopPropagation()}
          />
        ))}

        {/* Selected / Custom Pin (Blue) */}
        {pin && (
          <Marker
            coordinate={pin}
            pinColor={COLORS.patientPrimary}
            title="Selected Location"
            description="Your pharmacy position"
          />
        )}
      </MapView>
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
  expandBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSlate,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expandText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: COLORS.surfaceDark,
  },
});