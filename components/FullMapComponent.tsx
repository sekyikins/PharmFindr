import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
}

export function getPinColor(m: MarkerData, isSelected: boolean): string {
  if (isSelected) return '#f59e0b'; // Amber / Gold for active selected pin
  if (m.isOpen === false) return '#64748b'; // Slate Gray for ALL closed pharmacies (registered & public)
  if (m.isRegistered) return '#10b981'; // Emerald Green for open registered database pharmacies
  return '#0284c7'; // Royal Blue for open public map pharmacies
}

export default function FullMapComponent({
  userCoords,
  markers,
  selectedId,
  onSelectMarker,
  showLegend = true,
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
          <View style={[styles.markerContainer, getPositionStyles(userCoords.latitude, userCoords.longitude), { zIndex: 100 }]}>
            <View style={styles.userPinBubble}>
              <Ionicons name="person" size={16} color="#ffffff" />
            </View>
            <Text style={[styles.markerLabel, styles.userLabel]}>You Are Here</Text>
          </View>
        )}

        {/* Pharmacy Markers */}
        {markers.map((m) => {
          const isSelected = m.id === selectedId;
          const pinColor = getPinColor(m, isSelected);
          return (
            <Pressable
              key={m.id}
              style={[styles.markerContainer, getPositionStyles(m.latitude, m.longitude), { zIndex: isSelected ? 50 : 10 }]}
              onPress={() => onSelectMarker(m.id)}
            >
              <Ionicons
                name={m.isOpen === false ? 'time-outline' : m.isRegistered ? 'checkmark-circle' : 'location'}
                size={isSelected ? 30 : 25}
                color={pinColor}
              />
              <View style={styles.tooltip}>
                <Text style={[styles.markerLabel, { color: pinColor, borderColor: pinColor }]}>
                  {m.name}
                </Text>

                <View style={styles.badgeRow}>
                  {m.isRegistered && (
                    <Text style={styles.verifiedTag}>Verified Partner</Text>
                  )}
                  {m.isOpen === false && (
                    <Text style={styles.closedTag}>Closed</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Interactive Map Legend Bar */}
      {showLegend && (
        <View style={styles.legendContainer}>
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
  userPinBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  tooltip: {
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedTag: {
    fontSize: 7,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  closedTag: {
    fontSize: 7,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  legendContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
});
