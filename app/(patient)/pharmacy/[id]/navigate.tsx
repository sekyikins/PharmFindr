import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { getRoute, formatDistance, formatDuration, type RouteResult } from '@/lib/ors';

export default function Navigate() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    lat?: string;
    lon?: string;
    distanceKm?: string;
    walkMinutes?: string;
  }>();
  const { theme, primaryColor } = useThemeContext();

  const pharmName = params.name ?? 'Pharmacy';
  const pharmLat = parseFloat(params.lat ?? '5.6037');
  const pharmLon = parseFloat(params.lon ?? '-0.187');
  const pharmCoords: Coords = { latitude: pharmLat, longitude: pharmLon };

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRoute() {
      setLoading(true);
      setError(null);
      try {
        const user = await getCurrentLocation();
        if (cancelled) return;
        setUserCoords(user);
        const result = await getRoute(user, pharmCoords);
        if (cancelled) return;
        setRoute(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Could not load route.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRoute();
    return () => { cancelled = true; };
  }, []);

  const centerLat = userCoords
    ? (userCoords.latitude + pharmLat) / 2
    : pharmLat;
  const centerLon = userCoords
    ? (userCoords.longitude + pharmLon) / 2
    : pharmLon;

  const distanceLabel = route
    ? formatDistance(route.distanceMeters)
    : (params.distanceKm ? params.distanceKm + ' km' : '—');
  const durationLabel = route
    ? formatDuration(route.durationSeconds)
    : (params.walkMinutes ? params.walkMinutes + ' min walk' : '—');

  function openExternalNav() {
    const url = `https://www.openstreetmap.org/directions?from=${userCoords?.latitude},${userCoords?.longitude}&to=${pharmLat},${pharmLon}`;
    Linking.openURL(url);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFillObject}>
        <FullMapComponent
          initialRegion={{
            latitude: centerLat,
            longitude: centerLon,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          userCoords={userCoords}
          markers={[{ id: params.id ?? '', name: pharmName, address: '', latitude: pharmLat, longitude: pharmLon }]}
          onSelectMarker={() => {}}
          routeCoords={route?.coordinates}
        />
      </View>

      {/* Floating header */}
      <SafeAreaView style={styles.floatingHeader} edges={['top']}>
        <Pressable style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>

        <View style={[styles.directionsCard, { backgroundColor: theme.card }]}>
          {loading ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : error ? (
            <Ionicons name="warning-outline" size={20} color={theme.warning} />
          ) : (
            <View style={[styles.directionsIconCircle, { backgroundColor: primaryColor }]}>
              <Ionicons name="navigate" size={16} color="#ffffff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.directionsTitle, { color: theme.text.primary }]}>
              {loading ? 'Calculating route…' : error ? 'Route unavailable' : `${distanceLabel} · ${durationLabel}`}
            </Text>
            <Text style={[styles.directionsSub, { color: theme.textMuted }]} numberOfLines={1}>
              {pharmName}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { backgroundColor: theme.card }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pharmName, { color: theme.text.primary }]} numberOfLines={1}>
              {pharmName}
            </Text>
            <Text style={[styles.pharmMeta, { color: theme.textMuted }]}>
              {distanceLabel} · {durationLabel}
            </Text>
          </View>
          {route && (
            <View style={[styles.badge, { backgroundColor: theme.successBg }]}>
              <Text style={[styles.badgeText, { color: theme.successText }]}>Route Ready</Text>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.startBtn, { backgroundColor: primaryColor }]}
          onPress={openExternalNav}
        >
          <Ionicons name="navigate" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.startBtnText}>Open in Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  directionsCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.xl, paddingVertical: 10, paddingHorizontal: 14, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  directionsIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  directionsTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  directionsSub: { fontSize: FONT_SIZE.sm },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pharmName: { fontSize: FONT_SIZE.title, fontWeight: '700', marginBottom: 4 },
  pharmMeta: { fontSize: FONT_SIZE.body },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  startBtn: {
    height: 52, borderRadius: RADIUS.pill,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  startBtnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontWeight: '600' },
});