import { COLORS } from '@/styles/theme';
/**
 * MapComponent.tsx
 *
 * A simulated map grid used during pharmacy registration (Step 4).
 *
 * Pin types:
 *  🟢 Green  — OSM-recognised pharmacies NOT yet registered in PharmFindr (selectable)
 *  🟤 Brown  — Already registered in PharmFindr (not selectable — shown for awareness)
 *  🔵 Blue   — Custom dropped pin (user tapped an empty spot)
 *
 * The component can be expanded to full-screen via the expand button.
 */
import React, { useState, useRef } from 'react';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Called when user taps an empty map area (blue custom pin) */
  onPressMap: (coordinate: { latitude: number; longitude: number }) => void;
  /** Called when user taps a known (green) pharmacy pin to claim it */
  onSelectKnownPharmacy?: (pharmacy: KnownPharmacy) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
  setScrollEnabled?: (enabled: boolean) => void;
  /** OSM pharmacies not yet in PharmFindr — green, selectable */
  knownPharmacies?: KnownPharmacy[];
  /** Already registered in PharmFindr — brown, not selectable */
  registeredPharmacies?: RegisteredPharmacy[];
  onExpand?: () => void;
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

const BASE_LAT = 5.6037;
const BASE_LON = -0.187;
const LAT_SCALE = 0.0003;
const LON_SCALE = 0.0003;

function coordToPixel(
  lat: number,
  lon: number,
  containerW: number,
  containerH: number
) {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const x = cx + (lon - BASE_LON) / LON_SCALE;
  const y = cy - (lat - BASE_LAT) / LAT_SCALE;
  return { x, y };
}

function pixelToCoord(px: number, py: number, containerW: number, containerH: number) {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const lon = BASE_LON + (px - cx) * LON_SCALE;
  const lat = BASE_LAT - (py - cy) * LAT_SCALE;
  return { latitude: lat, longitude: lon };
}

// ─── Inner map renderer (used both inline and in fullscreen modal) ────────────

function MapCanvas({
  pin,
  onPressMap,
  onSelectKnownPharmacy,
  knownPharmacies = [],
  registeredPharmacies = [],
  containerW,
  containerH,
}: {
  pin: { latitude: number; longitude: number } | null;
  onPressMap: (coord: { latitude: number; longitude: number }) => void;
  onSelectKnownPharmacy?: (p: KnownPharmacy) => void;
  knownPharmacies: KnownPharmacy[];
  registeredPharmacies: RegisteredPharmacy[];
  containerW: number;
  containerH: number;
}) {
  const handlePress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const coord = pixelToCoord(locationX, locationY, containerW, containerH);
    onPressMap(coord);
  };

  return (
    <Pressable style={[styles.canvas, { width: containerW, height: containerH }]} onPress={handlePress}>
      {/* Map background */}
      <View style={[styles.mapGrid, { width: containerW, height: containerH }]}>
        {/* Water / river area */}
        <View style={[styles.river, { bottom: 0, height: containerH * 0.15 }]} />
        {/* Main roads */}
        <View style={[styles.road, { top: '30%', height: 14, left: 0, right: 0 }]} />
        <View style={[styles.road, { top: '65%', height: 10, left: 0, right: 0 }]} />
        <View style={[styles.road, { left: '25%', width: 14, top: 0, bottom: 0 }]} />
        <View style={[styles.road, { left: '68%', width: 18, top: 0, bottom: 0 }]} />
        {/* Minor streets */}
        <View style={[styles.street, { top: '48%', height: 6, left: 0, right: 0 }]} />
        <View style={[styles.street, { left: '50%', width: 8, top: 0, bottom: 0 }]} />
        {/* Blocks */}
        {[
          { top: '10%', left: '5%', width: 80, height: 50 },
          { top: '10%', left: '35%', width: 100, height: 55 },
          { top: '38%', left: '5%', width: 70, height: 55 },
          { top: '38%', left: '35%', width: 95, height: 60 },
          { top: '72%', left: '5%', width: 85, height: 45 },
        ].map((b, i) => (
          <View key={i} style={[styles.block, b as any]} />
        ))}
      </View>

      {/* ── Already-registered pharmacies (brown — not selectable) ── */}
      {registeredPharmacies.map((pharm) => {
        const { x, y } = coordToPixel(pharm.latitude, pharm.longitude, containerW, containerH);
        if (x < 0 || x > containerW || y < 0 || y > containerH) return null;
        return (
          <View
            key={pharm.id}
            style={[styles.pinWrapper, { left: x - 12, top: y - 28 }]}
            pointerEvents="none"
          >
            <Ionicons name="location" size={26} color="#92400e" />
            <View style={styles.registeredLabel}>
              <Text style={styles.registeredLabelText} numberOfLines={1}>{pharm.name}</Text>
            </View>
          </View>
        );
      })}

      {/* ── Known (OSM) pharmacies — green, selectable ── */}
      {knownPharmacies.map((pharm) => {
        const { x, y } = coordToPixel(pharm.latitude, pharm.longitude, containerW, containerH);
        if (x < 0 || x > containerW || y < 0 || y > containerH) return null;
        return (
          <Pressable
            key={pharm.id}
            style={({pressed})=>[styles.pinWrapper, pressed && {opacity: 0.5}, { left: x - 12, top: y - 28 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onSelectKnownPharmacy?.(pharm);
            }}
            hitSlop={10}
          >
            <Ionicons name="location" size={28} color={COLORS.pharmacyPrimary} />
            <View style={styles.knownLabel}>
              <Text style={styles.knownLabelText} numberOfLines={1}>{pharm.name}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* ── Dropped / custom pin (blue) ── */}
      {pin && (() => {
        const { x, y } = coordToPixel(pin.latitude, pin.longitude, containerW, containerH);
        return (
          <View style={[styles.pinWrapper, { left: x - 16, top: y - 32 }]} pointerEvents="none">
            <Ionicons name="location" size={34} color={COLORS.patientPrimary} />
            <View style={styles.customLabel}>
              <Text style={styles.customLabelText}>Your Pharmacy</Text>
            </View>
          </View>
        );
      })()}

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
        <Text style={styles.infoText}>Tap green pin to claim · tap map for custom pin</Text>
      </View>
    </Pressable>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function MapComponent({
  pin,
  onPressMap,
  onSelectKnownPharmacy,
  initialCoords,
  setScrollEnabled,
  knownPharmacies = [],
  registeredPharmacies = [],
}: MapComponentProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const INLINE_W = SCREEN_W - 48; // 24px padding on each side
  const INLINE_H = 240;

  return (
    <>
      {/* ── Inline map ── */}
      <View style={[styles.inlineContainer, { width: INLINE_W, height: INLINE_H }]}>
        <MapCanvas
          pin={pin}
          onPressMap={onPressMap}
          onSelectKnownPharmacy={onSelectKnownPharmacy}
          knownPharmacies={knownPharmacies}
          registeredPharmacies={registeredPharmacies}
          containerW={INLINE_W}
          containerH={INLINE_H}
        />

        {/* Expand button */}
        <Pressable style={({pressed})=>[styles.expandBtn, pressed && {opacity: 0.5}]} onPress={() => setFullscreen(true)}>
          <Ionicons name="expand-outline" size={16} color={COLORS.white} />
          <Text style={styles.expandText}>Full Screen</Text>
        </Pressable>
      </View>

      {/* ── Full-screen modal ── */}
      <Modal visible={fullscreen} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.modalRoot}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Pharmacy Location</Text>
            <Pressable style={({pressed})=>[styles.closeBtn, pressed && {opacity: 0.5}]} onPress={() => setFullscreen(false)}>
              <Ionicons name="close" size={22} color="#1d293d" />
            </Pressable>
          </View>

          {/* Legend */}
          <View style={styles.modalLegend}>
            <View style={styles.legendItem}>
              <Ionicons name="location" size={16} color={COLORS.pharmacyPrimary} />
              <Text style={styles.legendText}>Available (tap to claim)</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="location" size={16} color="#92400e" />
              <Text style={styles.legendText}>Already registered</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="location" size={16} color={COLORS.patientPrimary} />
              <Text style={styles.legendText}>Custom pin</Text>
            </View>
          </View>

          {/* Full map canvas */}
          <View style={styles.modalMapWrap}>
            <MapCanvas
              pin={pin}
              onPressMap={(coord) => { onPressMap(coord); }}
              onSelectKnownPharmacy={(pharm) => {
                onSelectKnownPharmacy?.(pharm);
                setFullscreen(false);
              }}
              knownPharmacies={knownPharmacies}
              registeredPharmacies={registeredPharmacies}
              containerW={SCREEN_W}
              containerH={SCREEN_H - 160}
            />
          </View>

          {/* Done button */}
          <Pressable style={({pressed})=>[styles.doneBtn, pressed && {opacity: 0.5}]} onPress={() => setFullscreen(false)}>
            <Ionicons name="checkmark" size={18} color={COLORS.white} />
            <Text style={styles.doneBtnText}>Confirm & Close</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  inlineContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative'
  },
  canvas: {
    backgroundColor: COLORS.borderSubtle,
    position: 'relative',
    overflow: 'hidden'
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#f0f4f8'
  },
  river: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.borderBlue
  },
  road: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderSubtle,
    borderWidth: 0.5
  },
  street: {
    position: 'absolute',
    backgroundColor: COLORS.background
  },
  block: {
    position: 'absolute',
    backgroundColor: COLORS.borderSubtle,
    borderRadius: 4
  },
  pinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10
  },
  knownLabel: {
    backgroundColor: COLORS.successBg,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: -4,
    maxWidth: 90
  },
  knownLabelText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: COLORS.pharmacyText,
    textAlign: 'center'
  },
  registeredLabel: {
    backgroundColor: COLORS.pendingBg,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: -4,
    maxWidth: 90
  },
  registeredLabelText: {
    fontSize: 9,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.pendingText,
    textAlign: 'center'
  },
  customLabel: {
    backgroundColor: COLORS.infoBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -6
  },
  customLabelText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: COLORS.patientTextDark,
    textAlign: 'center'
  },
  infoBar: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  infoText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: 'Inter-Medium',
    flex: 1
  },
  expandBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(16,185,129,0.88)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 20
  },
  expandText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: COLORS.white
  },

  // Modal styles
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: COLORS.textDarkAlt
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalLegend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    flexWrap: 'wrap'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'Inter-Medium'
  },
  modalMapWrap: {
    flex: 1,
    overflow: 'hidden'
  },
  doneBtn: {
    margin: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.pharmacyPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: COLORS.white
  },

});
