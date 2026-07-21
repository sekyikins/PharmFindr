import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  /** Optional route polyline – no-op on web fallback. */
  routeCoords?: { latitude: number; longitude: number }[];
}

export default function FullMapComponent({
  initialRegion,
  userCoords,
  markers,
  onSelectMarker,
  // routeCoords is intentionally unused on the web fallback
  routeCoords: _routeCoords,
}: FullMapComponentProps) {
  // Translate latitude/longitude offsets into CSS percentage positions relative to Accra area
  const getPositionStyles = (lat: number, lng: number) => {
    // Center is Accra: 5.6037, -0.1870
    // Define an approximate bounding box for Accra
    const centerLat = 5.6037;
    const centerLng = -0.1870;
    
    // Scale factor to map lat/lng range to screen percentage
    const latDiff = lat - centerLat;
    const lngDiff = lng - centerLng;
    
    const topPercent = 50 - (latDiff / 0.05) * 50; // latitude increases going north (upwards)
    const leftPercent = 50 + (lngDiff / 0.05) * 50; // longitude increases going east (rightwards)
    
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

        {/* User Location */}
        {userCoords && (
          <View style={[styles.markerContainer, getPositionStyles(userCoords.latitude, userCoords.longitude)]}>
            <Ionicons name="person" size={24} color="#2563eb" />
            <Text style={[styles.markerLabel, styles.userLabel]}>You</Text>
          </View>
        )}

        {/* Pharmacy Markers */}
        {markers.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.markerContainer, getPositionStyles(m.latitude, m.longitude)]}
            onPress={() => onSelectMarker(m.id)}
          >
            <Ionicons name="location" size={26} color="#10b981" />
            <View style={styles.tooltip}>
              <Text style={styles.markerLabel}>{m.name}</Text>
              <Text style={styles.markerSubLabel}>Click to view</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.footerNoteText}>Interactive Web Map: Click any pharmacy pin to view details</Text>
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
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  mapGrid: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  river: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#bfdbfe',
  },
  street: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -13,
    marginTop: -26,
    zIndex: 5,
  },
  markerLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: -2,
  },
  userLabel: {
    color: '#1e3a8a',
    backgroundColor: '#dbeafe',
  },
  tooltip: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  markerSubLabel: {
    fontSize: 7,
    color: '#64748b',
    backgroundColor: '#ffffff',
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 3,
    marginTop: 1,
    textAlign: 'center',
  },
  footerNote: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
});
