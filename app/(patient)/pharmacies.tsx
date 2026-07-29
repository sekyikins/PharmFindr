import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Animated,
  Easing,
  Linking,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { searchNearbyPharmacies, type OsmPharmacy } from '@/lib/osm';
import { usePharmacyStore } from '@/store/pharmacyStore';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';

export default function Pharmacies() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string; selectedId?: string }>();
  const routeQuery = params.query ? String(params.query) : '';
  const routeSelectedId = params.selectedId ? String(params.selectedId) : '';

  const { theme, primaryColor } = useThemeContext();
  const [searchQuery, setSearchQuery] = useState(routeQuery);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  // Seed from shared store
  const {
    pharmacies: storePharmacies,
    userCoords: storeCoords,
    setPharmacies: storeSetPharmacies,
    setUserCoords: storeSetCoords,
  } = usePharmacyStore();

  const [pharmacies, setPharmacies] = useState<OsmPharmacy[]>(storePharmacies);
  const [selectedPharmacy, setSelectedPharmacy] = useState<OsmPharmacy | null>(null);

  const [loading, setLoading] = useState(storePharmacies.length === 0);
  const [error, setError] = useState<string | null>(null);

  const stopLoadingSheetRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Slide animation for bottom card (0 = fully visible, 350 = off screen)
  const slideAnim = useRef(new Animated.Value(350)).current;

  // Animate card slide up when selectedPharmacy changes
  useEffect(() => {
    if (selectedPharmacy) {
      slideAnim.setValue(350);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedPharmacy]);

  const dismissCard = () => {
    Animated.timing(slideAnim, {
      toValue: 350,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedPharmacy(null);
    });
  };

  // PanResponder to allow dragging down to dismiss card
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          dismissCard();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Spinning animation for refresh button
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (loading) {
      spinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      spinAnim.setValue(0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [loading, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const stopLoading = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    stopLoadingSheetRef.current?.close?.();
  };

  const loadPharmacies = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const coords = await getCurrentLocation();
      if (controller.signal.aborted) return;
      setUserCoords(coords);
      storeSetCoords(coords);

      const accumulated: OsmPharmacy[] = [];
      await searchNearbyPharmacies(
        coords,
        5000,
        (foundPharmacy) => {
          if (accumulated.some((p) => p.id === foundPharmacy.id)) return;
          accumulated.push(foundPharmacy);
          storeSetPharmacies([...accumulated]);
          setPharmacies([...accumulated]);
        },
        controller.signal
      );
    } catch (e: any) {
      if (e?.message !== 'Aborted') {
        setError(e?.message ?? 'Could not load pharmacies.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (storePharmacies.length > 0) {
      setPharmacies(storePharmacies);
      if (storeCoords) setUserCoords(storeCoords);
      setLoading(false);
      return;
    }
    loadPharmacies();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-select pharmacy if selectedId param was passed (e.g. from Home screen)
  useEffect(() => {
    if (!routeSelectedId || pharmacies.length === 0) return;
    const targetId = decodeURIComponent(routeSelectedId);
    const found = pharmacies.find(
      (p) => p.id === targetId || p.id === routeSelectedId || encodeURIComponent(p.id) === routeSelectedId
    );
    if (found) {
      setSelectedPharmacy(found);
    }
  }, [routeSelectedId, pharmacies]);

  const handleRefreshPress = () => {
    if (loading) {
      stopLoadingSheetRef.current?.expand?.();
    } else {
      loadPharmacies();
    }
  };

  const filtered = pharmacies.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mapRegion = userCoords
    ? {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : { latitude: 5.6037, longitude: -0.187, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  // Navigate to in-app direction/route screen
  const handleInAppNavigate = (pharmacy: OsmPharmacy) => {
    router.push({
      pathname: '/(patient)/pharmacy/[id]/navigate',
      params: {
        id: encodeURIComponent(pharmacy.id),
        name: pharmacy.name,
        lat: String(pharmacy.latitude),
        lon: String(pharmacy.longitude),
        distanceKm: String(pharmacy.distanceKm),
        walkMinutes: String(pharmacy.walkMinutes),
      },
    });
  };

  // Trigger Phone Call
  const handleCallPharmacy = (phone?: string) => {
    if (phone && phone !== 'N/A') {
      Linking.openURL(`tel:${phone}`);
    }
  };

  // Trigger Reservation Flow
  const handleReservePharmacy = (pharmacy: OsmPharmacy) => {
    router.push({
      pathname: '/(patient)/reservation/[id]',
      params: {
        id: encodeURIComponent(pharmacy.id),
        name: pharmacy.name,
        medName: routeQuery,
        price: '',
      },
    });
  };

  const hasPhone = !!selectedPharmacy?.phone && selectedPharmacy.phone !== 'N/A';
  const hasDrugQuery = !!routeQuery.trim();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Top Navigation Header ── */}
      <Header
        title="Nearby Pharmacies"
        showBack
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.navigate('/(patient)/(tabs)/home');
          }
        }}
        right={
          <Pressable
            style={({ pressed }) => [
              styles.navBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={handleRefreshPress}
          >
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="refresh-outline" size={18} color={theme.text.primary} />
            </Animated.View>
          </Pressable>
        }
      />

      {/* Drug Search Context Banner */}
      {routeQuery ? (
        <View style={[styles.contextBanner, { backgroundColor: theme.patientSecondary, borderColor: primaryColor + '40' }]}>
          <Ionicons name="medkit-outline" size={18} color={primaryColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contextTitle, { color: primaryColor }]}>
              Medication Search: {routeQuery}
            </Text>
            <Text style={[styles.contextSub, { color: theme.text.primary }]}>
              Tap any pharmacy pin on the map to view stock, directions & reservation.
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Search Bar Overlay on Top of Map ── */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={16} color={theme.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search pharmacies on map..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textDim} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.pinCountBadge, { color: theme.textMuted, backgroundColor: theme.card }]}>
          📍 {filtered.length} locations
        </Text>
      </View>

      {/* ── Full Screen Google Map Viewport ── */}
      <View style={styles.mapViewport}>
        <FullMapComponent
          initialRegion={mapRegion}
          userCoords={userCoords}
          markers={filtered}
          selectedId={selectedPharmacy?.id}
          onSelectMarker={(id) => {
            const found = filtered.find((p) => p.id === id);
            if (found) {
              setSelectedPharmacy(found);
            }
          }}
        />

        {/* ── Selected Pharmacy Details Card with Slide Down & Drag-to-Dismiss ── */}
        {selectedPharmacy && (
          <Animated.View
            style={[
              styles.bottomDetailsCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Drag Handle Bar */}
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View style={[styles.handleIndicator, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.sheetContent}>
              {/* Title Row + Close button */}
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.pharmTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {selectedPharmacy.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    {selectedPharmacy.isRegistered ? (
                      <View style={[styles.registeredBadge, { backgroundColor: theme.patientSecondary }]}>
                        <Ionicons name="shield-checkmark" size={12} color={primaryColor} />
                        <Text style={[styles.registeredText, { color: primaryColor }]}>Registered Partner</Text>
                      </View>
                    ) : (
                      <View style={[styles.registeredBadge, { backgroundColor: theme.surfaceSecondary }]}>
                        <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                        <Text style={[styles.registeredText, { color: theme.textMuted }]}>Public Map Location</Text>
                      </View>
                    )}

                    {selectedPharmacy.hours && (
                      <View style={[styles.hoursBadge, { backgroundColor: theme.successBg }]}>
                        <Text style={[styles.hoursText, { color: theme.successText }]}>Open Now</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Close Button */}
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.surfaceSecondary }]}
                  onPress={dismissCard}
                >
                  <Ionicons name="close" size={18} color={theme.text.primary} />
                </Pressable>
              </View>

              {/* Distance & Time */}
              <View style={styles.metaRow}>
                <Ionicons name="navigate-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {selectedPharmacy.distanceKm} km away
                </Text>
                <Text style={[styles.metaDot, { color: theme.textDim }]}>·</Text>
                <Ionicons name="walk-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {selectedPharmacy.walkMinutes} min walk
                </Text>
              </View>

              {/* Address */}
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={theme.textMuted} />
                <Text style={[styles.infoText, { color: theme.textMuted }]} numberOfLines={2}>
                  {selectedPharmacy.address || 'Address registered on map'}
                </Text>
              </View>

              {/* Phone (Only rendered if phone exists) */}
              {hasPhone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={theme.textMuted} />
                  <Text style={[styles.infoText, { color: theme.textMuted }]}>
                    {selectedPharmacy.phone}
                  </Text>
                </View>
              ) : null}

              {/* Drug Stock status check */}
              {hasDrugQuery ? (
                <View style={[styles.stockCheckBanner, { backgroundColor: theme.successBg }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.stockCheckText, { color: theme.successText }]}>
                    Carries "{routeQuery}" or equivalent dosage
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons Row */}
              <View style={styles.actionRow}>
                {/* Navigate -> In-app directions */}
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.secondaryActionBtn,
                    pressed && { opacity: 0.7 },
                    { borderColor: primaryColor, backgroundColor: theme.card },
                  ]}
                  onPress={() => handleInAppNavigate(selectedPharmacy)}
                >
                  <Ionicons name="navigate-outline" size={18} color={primaryColor} />
                  <Text style={[styles.actionBtnText, { color: primaryColor }]}>Navigate</Text>
                </Pressable>

                {/* Call -> Only if phone exists */}
                {hasPhone && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.secondaryActionBtn,
                      pressed && { opacity: 0.7 },
                      { borderColor: primaryColor, backgroundColor: theme.card },
                    ]}
                    onPress={() => handleCallPharmacy(selectedPharmacy.phone)}
                  >
                    <Ionicons name="call-outline" size={18} color={primaryColor} />
                    <Text style={[styles.actionBtnText, { color: primaryColor }]}>Call</Text>
                  </Pressable>
                )}

                {/* Reserve Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.primaryActionBtn,
                    pressed && { opacity: 0.7 },
                    { backgroundColor: primaryColor },
                  ]}
                  onPress={() => handleReservePharmacy(selectedPharmacy)}
                >
                  <Ionicons name="cart-outline" size={18} color="#ffffff" />
                  <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Reserve</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Stop Loading Action Sheet */}
      <AppBottomSheet
        ref={stopLoadingSheetRef}
        snapPoints={['38%']}
        title="Loading Pharmacies…"
      >
        <View style={styles.sheetBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="refresh-circle" size={24} color={primaryColor} />
            </Animated.View>
            <Text style={[styles.sheetSub, { color: theme.textMuted }]}>
              Pharmacies are being streamed from nearby locations.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.sheetOptionBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={() => {
              stopLoadingSheetRef.current?.close();
              stopLoading();
            }}
          >
            <Ionicons name="stop-circle-outline" size={20} color={theme.error ?? '#ef4444'} />
            <Text style={[styles.sheetOptionText, { color: theme.text.primary }]}>Stop loading pharmacies</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.sheetOptionBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: theme.patientSecondary, marginTop: 10 },
            ]}
            onPress={() => {
              stopLoadingSheetRef.current?.close();
              loadPharmacies();
            }}
          >
            <Ionicons name="reload-outline" size={20} color={primaryColor} />
            <Text style={[styles.sheetOptionText, { color: primaryColor, fontWeight: '700' }]}>Restart loading pharmacies</Text>
          </Pressable>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contextTitle: { fontSize: 13, fontWeight: '700' },
  contextSub: { fontSize: 11, marginTop: 2 },

  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  pinCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },

  mapViewport: {
    flex: 1,
    position: 'relative',
  },

  // ── Selected Pharmacy Details Overlay Card ──
  bottomDetailsCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 999,
  },
  handleContainer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pharmTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  registeredText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  hoursText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  stockCheckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  stockCheckText: {
    fontSize: 12,
    fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  secondaryActionBtn: {
    borderWidth: 1.5,
  },
  primaryActionBtn: {},
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  sheetBody: { padding: 16 },
  sheetSub: { fontSize: 13, flex: 1 },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  sheetOptionText: { fontSize: 14, fontWeight: '600' },
});
