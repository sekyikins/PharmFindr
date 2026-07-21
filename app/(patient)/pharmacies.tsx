import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { searchNearbyPharmacies, type OsmPharmacy } from '@/lib/osm';
import Skeleton from '@/components/ui/Skeleton';

export default function Pharmacies() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const routeQuery = params.query ? String(params.query) : '';

  const { theme, primaryColor } = useThemeContext();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState(routeQuery);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [pharmacies, setPharmacies] = useState<OsmPharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<OsmPharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spinning animation for the refresh button
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
    setModalVisible(false);
  };

  const loadPharmacies = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setPharmacies([]);
    setSelectedPharmacy(null);

    try {
      const coords = await getCurrentLocation();
      if (controller.signal.aborted) return;
      setUserCoords(coords);

      await searchNearbyPharmacies(
        coords,
        5000,
        (foundPharmacy) => {
          setPharmacies((prev) => {
            if (prev.some((p) => p.id === foundPharmacy.id)) return prev;
            const updated = [...prev, foundPharmacy];
            // Set initial selected pharmacy for map view
            if (!selectedPharmacy && updated.length === 1) {
              setSelectedPharmacy(updated[0]);
            }
            return updated;
          });
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
  }, [selectedPharmacy]);

  useEffect(() => {
    loadPharmacies();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleRefreshPress = () => {
    if (loading) {
      setModalVisible(true);
    } else {
      loadPharmacies();
    }
  };

  const filtered = pharmacies.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCardPharmacy = selectedPharmacy || filtered[0] || pharmacies[0] || null;

  const mapRegion = userCoords
    ? {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : { latitude: 5.6037, longitude: -0.187, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const renderPharmacyCard = ({ item }: { item: OsmPharmacy }) => (
    <Pressable
      style={[styles.pharmCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() =>
        router.push({
          pathname: '/(patient)/pharmacy/[id]',
          params: {
            id: encodeURIComponent(item.id),
            name: item.name,
            address: item.address,
            phone: item.phone ?? '',
            hours: item.hours ?? '',
            lat: String(item.latitude),
            lon: String(item.longitude),
            distanceKm: String(item.distanceKm),
            walkMinutes: String(item.walkMinutes),
            query: searchQuery,
          },
        })
      }
    >
      <View style={[styles.pharmIcon, { backgroundColor: theme.successBg }]}>
        <Ionicons name="location-outline" size={20} color={theme.success} />
      </View>

      <View style={styles.pharmBody}>
        <View style={styles.pharmRow}>
          <Text style={[styles.pharmName, { color: theme.text.primary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.hours && (
            <View style={[styles.statusBadge, { backgroundColor: theme.successBg }]}>
              <Text style={[styles.statusText, { color: theme.successText }]}>Open</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="navigate-outline" size={12} color={theme.textMuted} />
          <Text style={[styles.metaText, { color: theme.textMuted }]}>
            {item.distanceKm} km
          </Text>
          <Text style={[styles.metaDot, { color: theme.textDim }]}>·</Text>
          <Text style={[styles.metaText, { color: theme.textMuted }]}>
            {item.walkMinutes} min walk
          </Text>
        </View>

        <Text style={[styles.addressText, { color: theme.textDim }]} numberOfLines={1}>
          {item.address}
        </Text>

        {routeQuery ? (
          <View style={[styles.stockBadge, { backgroundColor: theme.patientSecondary }]}>
            <Ionicons name="checkmark-circle" size={12} color={primaryColor} />
            <Text style={[styles.stockBadgeText, { color: primaryColor }]}>
              Stock checked for "{routeQuery}"
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.navBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Nearby Pharmacies</Text>

        <Pressable
          style={[styles.navBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={handleRefreshPress}
        >
          <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
            <Ionicons name="refresh-outline" size={18} color={theme.text.primary} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Drug Context Banner */}
      {routeQuery ? (
        <View style={[styles.contextBanner, { backgroundColor: theme.patientSecondary, borderColor: primaryColor + '40' }]}>
          <Ionicons name="medkit-outline" size={18} color={primaryColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contextTitle, { color: primaryColor }]}>
              Medication Availability: {routeQuery}
            </Text>
            <Text style={[styles.contextSub, { color: theme.text.primary }]}>
              Showing nearby pharmacies carrying this item or equivalent.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Search + Toggle */}
      <View style={[styles.searchRow, { backgroundColor: theme.card }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={15} color={theme.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search pharmacies..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable
          style={[
            styles.toggleBtn,
            { borderColor: theme.border, backgroundColor: theme.card },
            viewMode === 'list' && [styles.toggleActive, { backgroundColor: theme.patientSecondary, borderColor: primaryColor }],
          ]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? primaryColor : theme.text.muted} />
        </Pressable>
        <Pressable
          style={[
            styles.toggleBtn,
            { borderColor: theme.border, backgroundColor: theme.card },
            viewMode === 'map' && [styles.toggleActive, { backgroundColor: theme.patientSecondary, borderColor: primaryColor }],
          ]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons name="location-outline" size={18} color={viewMode === 'map' ? primaryColor : theme.text.muted} />
        </Pressable>
      </View>

      {/* Content */}
      {viewMode === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={renderPharmacyCard}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            loading ? (
              <View style={{ gap: 12, marginTop: filtered.length > 0 ? 12 : 0 }}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.pharmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Skeleton width={44} height={44} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton width="70%" height={18} />
                      <Skeleton width="40%" height={14} />
                      <Skeleton width="90%" height={14} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.centeredState}>
                <Ionicons name="compass-outline" size={40} color={theme.textDim} />
                <Text style={[styles.emptyText, { color: theme.textDim }]}>
                  {error || 'No pharmacies found nearby.'}
                </Text>
                <Pressable style={[styles.retryBtn, { backgroundColor: primaryColor }]} onPress={loadPharmacies}>
                  <Text style={styles.retryBtnText}>Retry Search</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <FullMapComponent
            initialRegion={mapRegion}
            userCoords={userCoords}
            markers={filtered}
            onSelectMarker={(id) => {
              const pharmacy = filtered.find((p) => p.id === id);
              if (pharmacy) {
                setSelectedPharmacy(pharmacy);
              }
            }}
          />
          {activeCardPharmacy && (
            <View style={[styles.mapSheet, { backgroundColor: theme.card }]}>
              <View style={[styles.mapSheetHandle, { backgroundColor: theme.border }]} />
              <Text style={[styles.mapSheetCount, { color: theme.textMuted }]}>
                {filtered.length} pharmacies found {loading ? '(loading more…)' : ''}
              </Text>
              <Pressable
                style={styles.pharmCardSmall}
                onPress={() => {
                  router.push({
                    pathname: '/(patient)/pharmacy/[id]',
                    params: {
                      id: encodeURIComponent(activeCardPharmacy.id),
                      name: activeCardPharmacy.name,
                      address: activeCardPharmacy.address,
                      phone: activeCardPharmacy.phone ?? '',
                      hours: activeCardPharmacy.hours ?? '',
                      lat: String(activeCardPharmacy.latitude),
                      lon: String(activeCardPharmacy.longitude),
                      distanceKm: String(activeCardPharmacy.distanceKm),
                      walkMinutes: String(activeCardPharmacy.walkMinutes),
                      query: searchQuery,
                    },
                  });
                }}
              >
                <View style={[styles.pharmIcon, { backgroundColor: theme.successBg }]}>
                  <Ionicons name="location-outline" size={18} color={theme.success} />
                </View>

                <View style={styles.pharmBody}>
                  <Text style={[styles.pharmName, { color: theme.text.primary }]} numberOfLines={1}>
                    {activeCardPharmacy.name}
                  </Text>
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {activeCardPharmacy.distanceKm} km · {activeCardPharmacy.walkMinutes} min walk
                  </Text>
                  <Text style={[styles.addressText, { color: theme.textDim }]} numberOfLines={1}>
                    {activeCardPharmacy.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={primaryColor} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Interactive Modal when clicking spinning refresh button */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                <Ionicons name="refresh-circle" size={28} color={primaryColor} />
              </Animated.View>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                Loading Pharmacies…
              </Text>
            </View>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Pharmacies are currently being streamed from nearby locations. What would you like to do?
            </Text>

            <Pressable style={[styles.modalOptionBtn, { backgroundColor: theme.surfaceSecondary }]} onPress={stopLoading}>
              <Ionicons name="stop-circle-outline" size={20} color={theme.errorText || '#ef4444'} />
              <Text style={[styles.modalOptionText, { color: theme.text.primary }]}>
                1. Stop loading pharmacies
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modalOptionBtn, { backgroundColor: theme.patientSecondary, marginTop: 8 }]}
              onPress={() => {
                setModalVisible(false);
                loadPharmacies();
              }}
            >
              <Ionicons name="reload-outline" size={20} color={primaryColor} />
              <Text style={[styles.modalOptionText, { color: primaryColor, fontWeight: '700' }]}>
                2. Restart loading pharmacies
              </Text>
            </Pressable>

            <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setModalVisible(false)}>
              <Text style={{ color: theme.textDim, fontSize: FONT_SIZE.sm }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  contextTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  contextSub: { fontSize: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.body, height: '100%' },
  toggleBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleActive: { borderWidth: 1.5 },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl, gap: SPACING.md },
  pharmCard: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  pharmIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  pharmBody: { flex: 1 },
  pharmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  pharmName: { fontSize: FONT_SIZE.lg, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill },
  statusText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText: { fontSize: FONT_SIZE.sm },
  metaDot: { fontSize: FONT_SIZE.sm },
  addressText: { fontSize: FONT_SIZE.sm },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  stockBadgeText: { fontSize: 11, fontWeight: '600' },
  mapContainer: { flex: 1, position: 'relative' },
  mapSheet: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.xl,
    right: SPACING.xl,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  mapSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.xs },
  mapSheetCount: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: SPACING.sm },
  pharmCardSmall: { flexDirection: 'row', alignItems: 'center' },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl, gap: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.pill, marginTop: 8 },
  retryBtnText: { color: '#fff', fontSize: FONT_SIZE.body, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', borderRadius: RADIUS.xl, padding: 20 },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  modalSub: { fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: 16 },
  modalOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: RADIUS.lg },
  modalOptionText: { fontSize: FONT_SIZE.body, fontWeight: '600' },
});
