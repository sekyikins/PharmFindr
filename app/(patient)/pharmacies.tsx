import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  RADIUS, SPACING  } from '@/styles/theme';
import { getCurrentLocation, DEFAULT_COORDS, type Coords } from '@/lib/location';
import { searchNearbyPharmacies, type OsmPharmacy } from '@/lib/osm';
import { usePharmacyStore } from '@/store/pharmacyStore';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';
import { supabase } from '@/lib/supabase';
import { useHardwareBack } from '@/hooks/useHardwareBack';

export default function Pharmacies() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ query?: string; selectedId?: string }>();
  const routeQuery = params.query ? String(params.query) : '';
  const routeSelectedId = params.selectedId ? String(params.selectedId) : '';

  const { theme, primaryColor } = useThemeContext();
  const [searchQuery, setSearchQuery] = useState('');

  useHardwareBack(() => {
    if (selectedPharmacy) {
      dismissCard();
      return true;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/home');
    }
    return true;
  });

  // Seed from shared store (must come before userCoords state so we can use it as initial value)
  const {
    pharmacies: storePharmacies,
    userCoords: storeCoords,
    setPharmacies: storeSetPharmacies,
    setUserCoords: storeSetCoords,
    maxDistanceKm,
    onlyOpen,
    onlyVerified,
    setMaxDistanceKm,
    setOnlyOpen,
    setOnlyVerified,
  } = usePharmacyStore();

  const [userCoords, setUserCoords] = useState<Coords>(storeCoords || DEFAULT_COORDS);

  const [pharmacies, setPharmacies] = useState<OsmPharmacy[]>(storePharmacies);
  const [selectedPharmacy, setSelectedPharmacy] = useState<OsmPharmacy | null>(null);

  const [loading, setLoading] = useState(storePharmacies.length === 0);
  const [refreshKey, setRefreshKey] = useState(0);

  const stopLoadingSheetRef = useRef<any>(null);
  const filterSheetRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Draft filter state (only committed when user taps "Apply Filter")
  const [draftDistance, setDraftDistance] = useState(maxDistanceKm);
  const [draftOnlyOpen, setDraftOnlyOpen] = useState(onlyOpen);
  const [draftOnlyVerified, setDraftOnlyVerified] = useState(onlyVerified);

  const openFilterSheet = () => {
    setDraftDistance(maxDistanceKm);
    setDraftOnlyOpen(onlyOpen);
    setDraftOnlyVerified(onlyVerified);
    if (filterSheetRef.current?.present) {
      filterSheetRef.current.present();
    } else {
      filterSheetRef.current?.expand?.();
    }
  };

  const handleApplyFilter = () => {
    setMaxDistanceKm(draftDistance);
    setOnlyOpen(draftOnlyOpen);
    setOnlyVerified(draftOnlyVerified);
    if (filterSheetRef.current?.dismiss) {
      filterSheetRef.current.dismiss();
    } else {
      filterSheetRef.current?.close?.();
    }
  };

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

    try {
      const coords = await getCurrentLocation();
      if (controller.signal.aborted) return;
      setUserCoords(coords);
      storeSetCoords(coords);

      const accumulated: OsmPharmacy[] = [];
      await searchNearbyPharmacies(
        coords,
        8000,
        (foundPharmacy) => {
          if (accumulated.some((p) => p.id === foundPharmacy.id)) return;
          accumulated.push(foundPharmacy);
          storeSetPharmacies([...accumulated]);
          setPharmacies([...accumulated]);
        },
        controller.signal
      );
    } catch {
      // errors are silent — loading spinner stops and user can retry via refresh
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

  // Auto-select pharmacy if selectedId param was passed (e.g. from Home or Search screen)
  useEffect(() => {
    if (!routeSelectedId) return;
    const targetId = decodeURIComponent(routeSelectedId);
    const found = pharmacies.find(
      (p) => p.id === targetId || p.id === routeSelectedId || encodeURIComponent(p.id) === routeSelectedId
    );
    if (found) {
      setSelectedPharmacy(found);
    } else if (targetId && targetId !== 'undefined') {
      // Fallback: Fetch directly from Supabase if it's a registered pharmacy
      supabase
        .from('pharmacies')
        .select('*')
        .eq('id', targetId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSelectedPharmacy({
              id: data.id,
              name: data.name,
              address: data.address || 'Address registered on map',
              phone: data.phone || 'N/A',
              latitude: data.latitude || (userCoords?.latitude ?? 5.6037),
              longitude: data.longitude || (userCoords?.longitude ?? -0.187),
              distanceKm: 0.5,
              walkMinutes: 6,
            });
          }
        });
    }
  }, [routeSelectedId, pharmacies, userCoords]);

  const handleRefreshPress = () => {
    if (loading) {
      if (stopLoadingSheetRef.current?.present) {
        stopLoadingSheetRef.current.present();
      } else {
        stopLoadingSheetRef.current?.expand?.();
      }
    } else {
      setRefreshKey((prev) => prev + 1);
      loadPharmacies();
    }
  };

  const filtered = useMemo(() => {
    return pharmacies.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDistance = p.distanceKm <= maxDistanceKm;
      const matchesOpen = !onlyOpen || p.isOpen !== false;
      const matchesVerified = !onlyVerified || p.isRegistered === true;
      return matchesSearch && matchesDistance && matchesOpen && matchesVerified;
    });
  }, [pharmacies, searchQuery, maxDistanceKm, onlyOpen, onlyVerified]);

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

  const handleLocateMe = useCallback(async () => {
    try {
      const fresh = await getCurrentLocation();
      setUserCoords(fresh);
      storeSetCoords(fresh);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.warn('Could not retrieve current location:', err);
    }
  }, [storeSetCoords]);

  const hasPhone = !!selectedPharmacy?.phone && selectedPharmacy.phone !== 'N/A';
  const hasDrugQuery = !!routeQuery.trim();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── Full-screen map — rendered first so it sits behind all overlays ── */}
      <FullMapComponent
        initialRegion={mapRegion}
        userCoords={userCoords}
        markers={filtered}
        selectedId={selectedPharmacy?.id}
        refreshKey={refreshKey}
        onPressLocate={handleLocateMe}
        onSelectMarker={(id) => {
          const found = filtered.find((p) => p.id === id);
          if (found) setSelectedPharmacy(found);
        }}
        mapPadding={{ top: 100 + insets.top, right: 10, bottom: 20, left: 10 }}
      />

      {/* ── Top overlay: Header + optional banner + search bar ── */}
      <View style={[styles.overlayTop, { paddingTop: insets.top }]} pointerEvents="box-none">
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
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name="refresh-outline" size={18} color={theme.text.primary} />
              )}
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

        {/* ── Search Bar & Filter Radius Button ── */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={16} color={theme.text.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder="Search pharmacies..."
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

          {/* Filter Radius Control Button */}
          <Pressable
            style={({ pressed }) => [
              styles.filterRadiusBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: theme.card, borderColor: primaryColor },
            ]}
            onPress={openFilterSheet}
          >
            <Ionicons name="options-outline" size={18} color={primaryColor} />
            <Text style={[styles.filterRadiusText, { color: primaryColor }]}>{maxDistanceKm} km</Text>
          </Pressable>
        </View>
      </View>

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
                    <View style={[
                      styles.hoursBadge,
                      { backgroundColor: selectedPharmacy.isOpen === false ? theme.surfaceSecondary : theme.successBg }
                    ]}>
                      <Ionicons
                        name={selectedPharmacy.isOpen === false ? "time-outline" : "checkmark-circle"}
                        size={12}
                        color={selectedPharmacy.isOpen === false ? theme.textMuted : theme.success}
                      />
                      <Text style={[
                        styles.hoursText,
                        { color: selectedPharmacy.isOpen === false ? theme.textMuted : theme.successText }
                      ]}>
                        {selectedPharmacy.isOpen === false ? 'Closed Now' : 'Open Now'} ({selectedPharmacy.hours})
                      </Text>
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
              <Pressable
                style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.6 }]}
                onPress={() => handleCallPharmacy(selectedPharmacy.phone)}
                hitSlop={8}
              >
                <Ionicons name="call-outline" size={16} color={primaryColor} />
                <Text style={[styles.infoText, { color: primaryColor, textDecorationLine: 'underline' }]}>
                  {selectedPharmacy.phone}
                </Text>
              </Pressable>
            ) : null}

            {/* Drug Stock status check */}
            {hasDrugQuery ? (
              selectedPharmacy.isRegistered ? (
                <View style={[styles.stockCheckBanner, { backgroundColor: theme.successBg }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.stockCheckText, { color: theme.successText }]}>
                    Carries "{routeQuery}" or equivalent dosage
                  </Text>
                </View>
              ) : (
                <View style={[styles.stockCheckBanner, { backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1 }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#b45309" />
                  <Text style={[styles.stockCheckText, { color: '#92400e' }]}>
                    Availability unknown — pharmacy not registered on PharmFindr
                  </Text>
                </View>
              )
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

              {/* Reserve Button — Only rendered if there is an active medicine query */}
              {hasDrugQuery && (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.primaryActionBtn,
                    pressed && { opacity: 0.7 },
                    { backgroundColor: primaryColor },
                  ]}
                  onPress={() => handleReservePharmacy(selectedPharmacy)}
                >
                  <Ionicons name="cart-outline" size={18} color={COLORS.white} />
                  <Text style={[styles.actionBtnText, { color: COLORS.white }]}>Reserve</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      )}

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
            <Ionicons name="stop-circle-outline" size={20} color={theme.error ?? COLORS.error} />
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
            <Text style={[styles.sheetOptionText, { color: primaryColor, fontFamily: 'Inter-Bold' }]}>Restart loading pharmacies</Text>
          </Pressable>
        </View>
      </AppBottomSheet>

      {/* ── Distance Radius & Filter Bottom Sheet ── */}
      <AppBottomSheet
        ref={filterSheetRef}
        snapPoints={['55%']}
        title="Distance & Map Filters"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetSubTitle, { color: theme.textMuted }]}>
            MAXIMUM SEARCH RADIUS ({draftDistance} KM)
          </Text>
          <View style={styles.chipRow}>
            {[1, 3, 5, 10, 15, 25, 50].map((dist) => {
              const isSelected = draftDistance === dist;
              return (
                <Pressable
                  key={dist}
                  style={({ pressed }) => [
                    styles.radiusChip,
                    isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setDraftDistance(dist)}
                >
                  <Text style={[styles.radiusChipText, { color: isSelected ? COLORS.white : theme.text.primary }]}>
                    {dist} km
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sheetSubTitle, { color: theme.textMuted, marginTop: 16 }]}>
            TOGGLE FILTERS
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.toggleFilterRow,
                { backgroundColor: theme.surfaceSecondary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setDraftOnlyOpen(!draftOnlyOpen)}
            >
              <Ionicons name={draftOnlyOpen ? "checkbox" : "square-outline"} size={20} color={draftOnlyOpen ? primaryColor : theme.textMuted} />
              <Text style={[styles.toggleFilterText, { color: theme.text.primary }]}>Show Open Pharmacies Only</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.toggleFilterRow,
                { backgroundColor: theme.surfaceSecondary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setDraftOnlyVerified(!draftOnlyVerified)}
            >
              <Ionicons name={draftOnlyVerified ? "checkbox" : "square-outline"} size={20} color={draftOnlyVerified ? primaryColor : theme.textMuted} />
              <Text style={[styles.toggleFilterText, { color: theme.text.primary }]}>Show Verified Partners Only</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.applyFilterBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: primaryColor, marginTop: 18 },
            ]}
            onPress={handleApplyFilter}
          >
            <Text style={styles.applyFilterBtnText}>Apply Filter</Text>
          </Pressable>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  contextTitle: {
    fontSize: 13, fontFamily: 'Inter-Bold'
  },
  contextSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 11, marginTop: 2
  },

  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  searchInput: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: 14, paddingVertical: 0
  },
  pinCountBadge: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    overflow: 'hidden'
  },

  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
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
    zIndex: 999
  },
  handleContainer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  handleIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 10
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  pharmTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold'
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm
  },
  registeredText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  hoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm
  },
  hoursText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium'
  },
  metaDot: {
    fontFamily: 'Inter-Regular',
    
    fontSize: 13
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    
    fontSize: 13,
    flex: 1
  },
  stockCheckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md
  },
  stockCheckText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold'
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  secondaryActionBtn: {
    borderWidth: 1.5
  },
  primaryActionBtn: {
    
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold'
  },

  sheetBody: {
    padding: 16
  },
  sheetSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, flex: 1
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12
  },
  sheetOptionText: {
    fontSize: 14, fontFamily: 'Inter-SemiBold'
  },

  filterRadiusBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center'
  },
  filterRadiusText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  radiusChipText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold'
  },
  sheetSubTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  toggleFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.md
  },
  toggleFilterText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold'
  },
  applyFilterBtn: {
    height: 46,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  applyFilterBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: 'Inter-Bold'
  },

});
