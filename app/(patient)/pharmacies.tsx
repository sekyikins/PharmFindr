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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { cleanDistanceString, cleanDurationString } from '@/lib/ors';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { hasMeaningfulRegionChange } from '@/lib/pharmacyDiscovery';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';
import { supabase } from '@/lib/supabase';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import type { DiscoveredPharmacy, MapRegion } from '@/types/map';

export default function Pharmacies() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ query?: string; selectedId?: string }>();
  const routeQuery = params.query ? String(params.query) : '';
  const routeSelectedId = params.selectedId ? String(params.selectedId) : '';

  const { theme, primaryColor } = useThemeContext();

  const {
    pharmacies: rawPharmacies,
    userCoords,
    loading,
    maxDistanceKm,
    onlyOpen,
    onlyVerified,
    searchQuery,
    discoverInRegion,
    stopDiscovery,
    setUserCoords,
    setMaxDistanceKm,
    setOnlyOpen,
    setOnlyVerified,
    setSearchQuery,
    getFilteredPharmacies,
  } = usePharmacyStore();

  const [selectedPharmacy, setSelectedPharmacy] = useState<DiscoveredPharmacy | null>(null);
  const [currentRegion, setCurrentRegion] = useState<MapRegion | null>(null);
  const lastQueriedRegionRef = useRef<MapRegion | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLoadingSheetRef = useRef<any>(null);
  const filterSheetRef = useRef<any>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Draft filter state for the filter sheet
  const [draftDistance, setDraftDistance] = useState<number | null>(maxDistanceKm);
  const [draftOnlyOpen, setDraftOnlyOpen] = useState(onlyOpen);
  const [draftOnlyVerified, setDraftOnlyVerified] = useState(onlyVerified);

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

  // 1. Initial Mount: Request GPS and discover pharmacies in user's initial region
  useEffect(() => {
    let isMounted = true;

    async function initLocation() {
      try {
        const coords = await getCurrentLocation();
        if (!isMounted) return;

        if (coords) {
          setUserCoords(coords);
          const initialRegion: MapRegion = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          };
          setCurrentRegion(initialRegion);
          lastQueriedRegionRef.current = initialRegion;
          discoverInRegion(initialRegion);
        } else if (rawPharmacies.length === 0) {
          // If no GPS is available, default to global view without fake assumptions
          const neutralRegion: MapRegion = {
            latitude: 0,
            longitude: 0,
            latitudeDelta: 60,
            longitudeDelta: 60,
          };
          setCurrentRegion(neutralRegion);
        }
      } catch (err) {
        console.warn('Initial map location error:', err);
      }
    }

    initLocation();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      stopDiscovery();
    };
  }, []);

  // 2. Viewport-driven Discovery: Triggered on user panning/zooming
  const handleRegionChangeComplete = useCallback(
    (newRegion: MapRegion) => {
      setCurrentRegion(newRegion);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (hasMeaningfulRegionChange(lastQueriedRegionRef.current, newRegion)) {
          lastQueriedRegionRef.current = newRegion;
          discoverInRegion(newRegion);
        }
      }, 450);
    },
    [discoverInRegion]
  );

  // 3. User taps "Locate Me" button
  const handleLocateMe = useCallback(async () => {
    try {
      const fresh = await getCurrentLocation(0); // force fresh GPS
      if (fresh) {
        setUserCoords(fresh);
        const userRegion: MapRegion = {
          latitude: fresh.latitude,
          longitude: fresh.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setCurrentRegion(userRegion);
        lastQueriedRegionRef.current = userRegion;
        discoverInRegion(userRegion);
      }
    } catch (err) {
      console.warn('Could not retrieve current GPS position:', err);
    }
  }, [setUserCoords, discoverInRegion]);

  // 4. Local Filtering (Decoupled from network discovery)
  const filteredPharmacies = useMemo(() => {
    return getFilteredPharmacies();
  }, [rawPharmacies, maxDistanceKm, onlyOpen, onlyVerified, searchQuery, userCoords]);

  // Open & apply filter sheet
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

  // Drag down to dismiss gesture
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

  // Spinning refresh indicator
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

  const handleRefreshPress = () => {
    if (loading) {
      if (stopLoadingSheetRef.current?.present) {
        stopLoadingSheetRef.current.present();
      } else {
        stopLoadingSheetRef.current?.expand?.();
      }
    } else if (currentRegion) {
      discoverInRegion(currentRegion);
    }
  };

  // Auto-select pharmacy if selectedId param was passed
  useEffect(() => {
    if (!routeSelectedId) return;
    const targetId = decodeURIComponent(routeSelectedId);
    const found = rawPharmacies.find(
      (p) => p.id === targetId || p.id === routeSelectedId || encodeURIComponent(p.id) === routeSelectedId
    );
    if (found) {
      setSelectedPharmacy(found);
    } else if (targetId && targetId !== 'undefined') {
      supabase
        .from('pharmacies')
        .select('*')
        .eq('id', targetId)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.latitude != null && data.longitude != null) {
            setSelectedPharmacy({
              id: data.id,
              name: data.name,
              address: data.address || 'Address registered on map',
              phone: data.phone || undefined,
              latitude: data.latitude,
              longitude: data.longitude,
              isVerified: true,
              source: 'supabase',
            });
          }
        });
    }
  }, [routeSelectedId, rawPharmacies]);

  // Navigate to in-app direction/route screen
  const handleInAppNavigate = (pharmacy: DiscoveredPharmacy) => {
    router.push({
      pathname: '/(patient)/pharmacy/[id]/navigate',
      params: {
        id: encodeURIComponent(pharmacy.id),
        name: pharmacy.name,
        lat: String(pharmacy.latitude),
        lon: String(pharmacy.longitude),
        userLat: userCoords ? String(userCoords.latitude) : undefined,
        userLon: userCoords ? String(userCoords.longitude) : undefined,
        distanceKm: pharmacy.distanceKm != null ? String(pharmacy.distanceKm) : undefined,
        walkMinutes: pharmacy.walkMinutes != null ? String(pharmacy.walkMinutes) : undefined,
      },
    });
  };

  // Navigate to pharmacy profile screen
  const handleViewDetails = (pharmacy: DiscoveredPharmacy) => {
    const medQuery = routeQuery.trim() || searchQuery.trim() || undefined;
    router.push({
      pathname: '/(patient)/pharmacy/[id]',
      params: {
        id: encodeURIComponent(pharmacy.id),
        name: pharmacy.name,
        address: pharmacy.address,
        phone: pharmacy.phone || 'N/A',
        hours: pharmacy.hours || 'N/A',
        lat: String(pharmacy.latitude),
        lon: String(pharmacy.longitude),
        userLat: userCoords ? String(userCoords.latitude) : undefined,
        userLon: userCoords ? String(userCoords.longitude) : undefined,
        distanceKm: pharmacy.distanceKm != null ? String(pharmacy.distanceKm) : undefined,
        walkMinutes: pharmacy.walkMinutes != null ? String(pharmacy.walkMinutes) : undefined,
        medName: medQuery,
      },
    });
  };

  const handleCallPharmacy = (phone?: string) => {
    if (phone && phone !== 'N/A') {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleReservePharmacy = (pharmacy: DiscoveredPharmacy) => {
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Full-screen Viewport Map ── */}
      <FullMapComponent
        initialRegion={currentRegion || undefined}
        userCoords={userCoords}
        markers={filteredPharmacies}
        selectedId={selectedPharmacy?.id}
        onPressLocate={handleLocateMe}
        onRegionChangeComplete={handleRegionChangeComplete}
        onSelectMarker={(id) => {
          const found = rawPharmacies.find((p) => p.id === id);
          if (found) setSelectedPharmacy(found);
        }}
        mapPadding={{ top: 100 + insets.top, right: 10, bottom: 20, left: 10 }}
      />

      {/* ── Top overlay: Header + search bar + filter button ── */}
      <View style={[styles.overlayTop, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Header
          title="Pharmacies"
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
            </View>
          </View>
        ) : null}

        {/* Search Bar & Filter Button */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={16} color={theme.text.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder="Search pharmacies in this area..."
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
            <Text style={[styles.filterRadiusText, { color: primaryColor }]}>
              {maxDistanceKm !== null ? `${maxDistanceKm} km` : 'Filter'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Selected Pharmacy Details Card ── */}
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
            {/* Header Row */}
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1, gap: SPACING.xs }}>
                <Text style={[styles.pharmTitle, { color: theme.text.primary }]} numberOfLines={1}>
                  {selectedPharmacy.name}
                </Text>
                <View style={styles.badgeRow}>
                  {selectedPharmacy.isVerified ? (
                    <View style={[styles.registeredBadge, { backgroundColor: theme.patientSecondary }]}>
                      <Ionicons name="shield-checkmark" size={12} color={primaryColor} />
                      <Text style={[styles.registeredText, { color: primaryColor }]}>Verified Partner</Text>
                    </View>
                  ) : (
                    <View style={[styles.registeredBadge, { backgroundColor: theme.surfaceSecondary }]}>
                      <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                      <Text style={[styles.registeredText, { color: theme.textMuted }]}>Public Map Location</Text>
                    </View>
                  )}

                  {(selectedPharmacy.statusText || selectedPharmacy.hours) && (
                    <View
                      style={[
                        styles.hoursBadge,
                        {
                          backgroundColor: selectedPharmacy.isClosingSoon
                            ? COLORS.pendingBg
                            : selectedPharmacy.isOpen === false
                            ? theme.surfaceSecondary
                            : theme.successBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedPharmacy.isClosingSoon
                            ? 'alert-circle-outline'
                            : selectedPharmacy.isOpen === false
                            ? 'time-outline'
                            : 'checkmark-circle'
                        }
                        size={12}
                        color={
                          selectedPharmacy.isClosingSoon
                            ? COLORS.warningDark
                            : selectedPharmacy.isOpen === false
                            ? theme.textMuted
                            : theme.success
                        }
                      />
                      <Text
                        style={[
                          styles.hoursText,
                          {
                            color: selectedPharmacy.isClosingSoon
                              ? COLORS.pendingText
                              : selectedPharmacy.isOpen === false
                              ? theme.textMuted
                              : theme.successText,
                          },
                        ]}
                      >
                        {selectedPharmacy.isOpen === false
                          ? 'Closed'
                          : selectedPharmacy.statusText ||
                            (selectedPharmacy.hours ? `Open (${selectedPharmacy.hours})` : 'Open')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Distance & Time (if GPS available) */}
            {selectedPharmacy.distanceKm !== undefined && (
              <View style={styles.metaRow}>
                <Ionicons name="navigate-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {cleanDistanceString(selectedPharmacy.distanceKm)} away
                </Text>
                {selectedPharmacy.walkMinutes !== undefined && (
                  <>
                    <Text style={[styles.metaDot, { color: theme.textDim }]}>·</Text>
                    <Ionicons name="walk-outline" size={14} color={theme.textMuted} />
                    <Text style={[styles.metaText, { color: theme.textMuted }]}>
                      {cleanDurationString(selectedPharmacy.walkMinutes)}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Address */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={theme.textMuted} />
              <Text style={[styles.infoText, { color: theme.textMuted }]} numberOfLines={2}>
                {selectedPharmacy.address || 'Address registered on map'}
              </Text>
            </View>

            {/* Phone */}
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

            {/* Drug Stock Banner */}
            {hasDrugQuery ? (
              selectedPharmacy.isVerified ? (
                <View style={[styles.stockCheckBanner, { backgroundColor: theme.successBg }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.stockCheckText, { color: theme.successText }]}>
                    Carries "{routeQuery}" or equivalent dosage
                  </Text>
                </View>
              ) : (
                <View style={[styles.stockCheckBanner, { backgroundColor: COLORS.pendingBg, borderColor: COLORS.pendingBorder, borderWidth: 1 }]}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.pendingText} />
                  <Text style={[styles.stockCheckText, { color: COLORS.pendingText }]}>
                    Availability unknown — pharmacy not verified on PharmFindr
                  </Text>
                </View>
              )
            ) : null}

            {/* Action Buttons Row */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.secondaryActionBtn,
                  pressed && { opacity: 0.7 },
                  { borderColor: theme.border, backgroundColor: theme.card },
                ]}
                onPress={() => handleViewDetails(selectedPharmacy)}
              >
                <Ionicons name="information-circle-outline" size={18} color={theme.text.primary} />
                <Text style={[styles.actionBtnText, { color: theme.text.primary }]}>Details</Text>
              </Pressable>

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="refresh-circle" size={24} color={primaryColor} />
            </Animated.View>
            <Text style={[styles.sheetSub, { color: theme.textMuted }]}>
              Pharmacies are being discovered in the current map region.
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
              stopDiscovery();
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
              if (currentRegion) discoverInRegion(currentRegion, { force: true });
            }}
          >
            <Ionicons name="reload-outline" size={20} color={primaryColor} />
            <Text style={[styles.sheetOptionText, { color: primaryColor, fontFamily: 'Inter-Bold' }]}>Restart discovery</Text>
          </Pressable>
        </View>
      </AppBottomSheet>

      {/* ── Distance Radius & Filter Bottom Sheet ── */}
      <AppBottomSheet
        ref={filterSheetRef}
        title="Distance & Map Filters"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetSubTitle, { color: theme.textMuted }]}>
            MAXIMUM SEARCH RADIUS ({draftDistance !== null ? `${draftDistance} KM` : 'ANY DISTANCE'})
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
            {/* No distance chip */}
            <Pressable
              style={({ pressed }) => [
                styles.radiusChip,
                draftDistance === null ? { backgroundColor: primaryColor, borderColor: primaryColor } : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setDraftDistance(null)}
            >
              <Text style={[styles.radiusChipText, { color: draftDistance === null ? COLORS.white : theme.text.primary }]}>
                No distance
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.sheetSubTitle, { color: theme.textMuted, marginTop: SPACING.lg }]}>
            TOGGLE FILTERS
          </Text>
          <View style={{ gap: SPACING.md }}>
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
              { backgroundColor: primaryColor, marginTop: SPACING.xl },
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
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  contextTitle: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },
  filterRadiusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  filterRadiusText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
  bottomDetailsCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    zIndex: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: RADIUS.pill,
  },
  sheetContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pharmTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    paddingVertical: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill
  },
  registeredText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-SemiBold',
  },
  hoursBadge: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    gap: SPACING.xs,
  },
  hoursText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },
  metaDot: {
    fontSize: FONT_SIZE.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  stockCheckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
  },
  stockCheckText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  secondaryActionBtn: {
    borderWidth: 1.5,
  },
  primaryActionBtn: {},
  actionBtnText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
  sheetBody: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  sheetSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  sheetSubTitle: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  radiusChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-SemiBold',
  },
  toggleFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  toggleFilterText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
  },
  applyFilterBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtnText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  sheetOptionText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
  },
});
