import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapComponentProps {
  pin: { latitude: number; longitude: number } | null;
  onPressMap: (coordinate: { latitude: number; longitude: number }) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
  setScrollEnabled?: (enabled: boolean) => void;
}

export default function MapComponent({ pin, onPressMap, initialCoords, setScrollEnabled }: MapComponentProps) {
  const containerRef = useRef<View>(null);

  const handlePress = (event: any) => {
    // Generate mock coordinates based on tap location relative to container
    const { locationX, locationY } = event.nativeEvent;
    
    // Base region around Accra (5.6037, -0.187)
    // Scale standard offset based on container size
    const lat = 5.6037 - (locationY - 120) * 0.0002;
    const lng = -0.187 + (locationX - 150) * 0.0002;
    
    onPressMap({ latitude: lat, longitude: lng });
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Simulated Map Grid Background */}
      <View style={styles.mapGrid}>
        {/* River/Water body */}
        <View style={styles.river} />
        {/* Streets */}
        <View style={[styles.street, { top: '30%', height: 16 }]} />
        <View style={[styles.street, { top: '70%', height: 12 }]} />
        <View style={[styles.street, { left: '25%', width: 14, height: '100%' }]} />
        <View style={[styles.street, { left: '70%', width: 18, height: '100%' }]} />

        {/* Existing Pharmacies Mock Pins */}
        <View style={[styles.mockPin, { top: '40%', left: '35%' }]}>
          <Ionicons name="location" size={24} color="#10b981" />
          <Text style={styles.mockPinLabel}>MediPlus</Text>
        </View>
        
        <View style={[styles.mockPin, { top: '60%', left: '75%' }]}>
          <Ionicons name="location" size={24} color="#10b981" />
          <Text style={styles.mockPinLabel}>City Pharmacy</Text>
        </View>

        {/* Dropped Pin */}
        {pin && (
          <View 
            style={[
              styles.droppedPinContainer, 
              {
                // Reverse coordinates calculation to position the absolute pin element
                top: `${Math.min(Math.max((5.6037 - pin.latitude) / 0.0002 + 120, 10), 220)}px` as any,
                left: `${Math.min(Math.max((pin.longitude - -0.187) / 0.0002 + 150, 10), 330)}px` as any,
              }
            ]}
          >
            <Ionicons name="location" size={32} color="#2563eb" />
            <Text style={styles.droppedPinLabel}>Your Pharmacy</Text>
          </View>
        )}
      </View>

      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.footerNoteText}>Click anywhere on the grid to drop your pharmacy pin</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e2e8f0',
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
    height: 40,
    backgroundColor: '#bfdbfe',
  },
  street: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  mockPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  mockPinLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: -2,
  },
  droppedPinContainer: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -16,
    marginTop: -32,
    zIndex: 10,
  },
  droppedPinLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e3a8a',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: -4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  footerNote: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
});
