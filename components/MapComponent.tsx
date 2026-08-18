import { COLORS, FONT_SIZE, MAP_PIN_COLORS, RADIUS, SPACING } from '@/styles/theme';
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { KnownPharmacy, RegisteredPharmacy } from '@/types/map';
export type { KnownPharmacy, RegisteredPharmacy };

interface MapComponentProps {
  pin: { latitude: number; longitude: number } | null;
  onSelectPin?: (lat: number, lng: number) => void;
  onPressMap?: (coords: { latitude: number; longitude: number }) => void;
  knownPharmacies?: KnownPharmacy[];
  registeredPharmacies?: RegisteredPharmacy[];
  selectedPharmacyId?: string | null;
  onSelectPharmacy?: (pharmacy: KnownPharmacy | RegisteredPharmacy) => void;
  onSelectKnownPharmacy?: (pharmacy: KnownPharmacy) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  initialCoords?: { latitude: number; longitude: number } | null;
  onRegionChangeComplete?: (region: any) => void;
  onExpand?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;

export default function MapComponent({
  pin,
  onSelectPin,
  knownPharmacies = [],
  registeredPharmacies = [],
  selectedPharmacyId,
  onSelectPharmacy,
  userLocation,
  initialCoords,
}: MapComponentProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const displayLat = pin?.latitude ?? initialCoords?.latitude ?? userLocation?.latitude ?? 0;
  const displayLng = pin?.longitude ?? initialCoords?.longitude ?? userLocation?.longitude ?? 0;

  const handleMapPress = (e: any) => {
    if (!onSelectPin) return;
    const { locationX, locationY } = e.nativeEvent;
    const latDelta = 0.05;
    const lngDelta = 0.05;
    const lat = displayLat + (0.5 - locationY / MAP_HEIGHT) * latDelta;
    const lng = displayLng + (locationX / SCREEN_WIDTH - 0.5) * lngDelta;
    onSelectPin(lat, lng);
  };

  const renderMapContent = () => (
    <Pressable style={styles.mapCanvas} onPress={handleMapPress}>
      {/* Decorative grid representing map streets */}
      <View style={styles.river} />
      <View style={[styles.road, { top: '35%', left: 0, right: 0, height: 12 }]} />
      <View style={[styles.road, { left: '45%', top: 0, bottom: 0, width: 10 }]} />
      <View style={[styles.street, { top: '65%', left: 0, right: 0, height: 6 }]} />
      <View style={[styles.street, { left: '20%', top: 0, bottom: 0, width: 5 }]} />
      <View style={[styles.street, { left: '75%', top: 0, bottom: 0, width: 5 }]} />

      {/* Blocks */}
      <View style={[styles.block, { top: '10%', left: '10%', width: '30%', height: '20%' }]} />
      <View style={[styles.block, { top: '10%', left: '60%', width: '30%', height: '20%' }]} />
      <View style={[styles.block, { top: '45%', left: '10%', width: '30%', height: '15%' }]} />
      <View style={[styles.block, { top: '45%', left: '60%', width: '30%', height: '15%' }]} />
      <View style={[styles.block, { top: '75%', left: '30%', width: '40%', height: '18%' }]} />

      {/* User Location Marker */}
      {userLocation && (
        <View style={[styles.pinWrapper, { left: '48%', top: '48%' }]}>
          <Ionicons name="person-circle" size={24} color={COLORS.patientPrimary} />
          <Text style={styles.userLabel}>You</Text>
        </View>
      )}

      {/* Known / Public Pharmacies (Blue pins) */}
      {knownPharmacies.map((pharm, idx) => {
        const isSelected = pharm.id === selectedPharmacyId;
        const leftPct = `${25 + ((idx * 17) % 55)}%` as any;
        const topPct = `${20 + ((idx * 23) % 60)}%` as any;

        return (
          <Pressable
            key={pharm.id}
            style={[styles.pinWrapper, { left: leftPct, top: topPct, zIndex: isSelected ? 30 : 15 }]}
            onPress={(e) => {
              e.stopPropagation();
              onSelectPharmacy?.(pharm);
            }}
          >
            <Ionicons
              name={isSelected ? 'location' : 'location-outline'}
              size={isSelected ? 28 : 22}
              color={isSelected ? MAP_PIN_COLORS.selected : MAP_PIN_COLORS.public}
            />
            <View style={styles.knownLabel}>
              <Text style={styles.knownLabelText} numberOfLines={1}>
                {pharm.name}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* Registered / Partner Pharmacies (Green pins) */}
      {registeredPharmacies.map((pharm, idx) => {
        const isSelected = pharm.id === selectedPharmacyId;
        const leftPct = `${15 + ((idx * 29) % 65)}%` as any;
        const topPct = `${30 + ((idx * 19) % 50)}%` as any;

        return (
          <Pressable
            key={pharm.id}
            style={[styles.pinWrapper, { left: leftPct, top: topPct, zIndex: isSelected ? 30 : 20 }]}
            onPress={(e) => {
              e.stopPropagation();
              onSelectPharmacy?.(pharm);
            }}
          >
            <Ionicons
              name={isSelected ? 'location' : 'location-sharp'}
              size={isSelected ? 30 : 24}
              color={isSelected ? MAP_PIN_COLORS.selected : MAP_PIN_COLORS.verified}
            />
            <View style={styles.registeredLabel}>
              <Text style={styles.registeredLabelText} numberOfLines={1}>
                {pharm.name}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* User dropped pin */}
      {pin && (
        <View style={[styles.pinWrapper, { left: '50%', top: '40%', zIndex: 40 }]}>
          <Ionicons name="location" size={32} color={MAP_PIN_COLORS.selected} />
          <View style={styles.customLabel}>
            <Text style={styles.customLabelText}>Selected Location</Text>
          </View>
        </View>
      )}

      {/* Hint Bar */}
      <View style={styles.infoBar}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
        <Text style={styles.infoText} numberOfLines={1}>
          {pin
            ? `Lat: ${pin.latitude.toFixed(4)}, Lng: ${pin.longitude.toFixed(4)}`
            : onSelectPin
            ? 'Tap map to drop pin or select location'
            : 'Interactive map view'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Expand Fullscreen Button */}
      <Pressable style={styles.expandBtn} onPress={() => setFullscreen(true)}>
        <Ionicons name="expand" size={14} color={COLORS.white} />
        <Text style={styles.expandText}>Expand Map</Text>
      </Pressable>

      {/* Main Map Area */}
      {renderMapContent()}

      {/* Fullscreen Modal */}
      <Modal visible={fullscreen} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Map View</Text>
            <Pressable style={styles.closeBtn} onPress={() => setFullscreen(false)}>
              <Ionicons name="close" size={20} color={COLORS.textDark} />
            </Pressable>
          </View>

          {/* Legend */}
          <View style={styles.modalLegend}>
            <View style={styles.legendItem}>
              <Ionicons name="location-sharp" size={16} color={MAP_PIN_COLORS.verified} />
              <Text style={styles.legendText}>Partner Pharmacy</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="location-outline" size={16} color={MAP_PIN_COLORS.public} />
              <Text style={styles.legendText}>Public Directory</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="location" size={16} color={MAP_PIN_COLORS.selected} />
              <Text style={styles.legendText}>Selected Pin</Text>
            </View>
          </View>

          {/* Expanded Map */}
          <View style={styles.modalMapWrap}>{renderMapContent()}</View>

          {/* Done Button */}
          <Pressable style={styles.doneBtn} onPress={() => setFullscreen(false)}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  river: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: COLORS.borderBlue,
  },
  road: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderSubtle,
    borderWidth: 0.5,
  },
  street: {
    position: 'absolute',
    backgroundColor: COLORS.background,
  },
  block: {
    position: 'absolute',
    backgroundColor: COLORS.borderSubtle,
    borderRadius: RADIUS.sm,
  },
  pinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  userLabel: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    color: '#0369a1',
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  knownLabel: {
    backgroundColor: COLORS.infoBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: SPACING.xs,
    marginTop: -4,
    maxWidth: 90,
  },
  knownLabelText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    color: COLORS.infoText,
    textAlign: 'center',
  },
  registeredLabel: {
    backgroundColor: COLORS.pharmacyBgLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: SPACING.xs,
    marginTop: -4,
    maxWidth: 90,
  },
  registeredLabelText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.pharmacyText,
    textAlign: 'center',
  },
  customLabel: {
    backgroundColor: COLORS.pendingBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: SPACING.xs,
    marginTop: -6,
  },
  customLabelText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    color: COLORS.pendingText,
    textAlign: 'center',
  },
  infoBar: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: RADIUS.sm,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  expandBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(16,185,129,0.88)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    zIndex: 20,
  },
  expandText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    color: COLORS.textDarkAlt,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLegend: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontFamily: 'Inter-Medium',
  },
  modalMapWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  doneBtn: {
    margin: SPACING.lg,
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.pharmacyPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  doneBtnText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
  },
});
