import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation, watchLocation, type Coords } from '@/lib/location';
import {
  getRoute,
  formatDistance,
  formatDuration,
  cleanDistanceString,
  cleanDurationString,
  type RouteResult,
} from '@/lib/ors';
import { haversineKm } from '@/lib/geoUtils';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { usePharmacyStore } from '@/store/pharmacyStore';

export default function Navigate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    lat?: string;
    lon?: string;
    userLat?: string;
    userLon?: string;
    distanceMeters?: string;
    durationSeconds?: string;
    distanceKm?: string;
    walkMinutes?: string;
  }>();
  const { theme, primaryColor } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/pharmacies');
    }
    return true;
  });

  const pharmName = params.name ?? 'Pharmacy';
  const pharmLat = parseFloat(params.lat ?? '0');
  const pharmLon = parseFloat(params.lon ?? '0');
  const pharmCoords: Coords = { latitude: pharmLat, longitude: pharmLon };

  const initialUserCoords: Coords | null =
    params.userLat && params.userLon
      ? { latitude: parseFloat(params.userLat), longitude: parseFloat(params.userLon) }
      : usePharmacyStore.getState().userCoords;

  const initialRoute: RouteResult | null =
    params.distanceMeters && params.durationSeconds
      ? {
          coordinates: [],
          distanceMeters: parseFloat(params.distanceMeters),
          durationSeconds: parseFloat(params.durationSeconds),
        }
      : null;

  const [userCoords, setUserCoords] = useState<Coords | null>(initialUserCoords);
  const [route, setRoute] = useState<RouteResult | null>(initialRoute);
  const [loading, setLoading] = useState(!initialRoute || initialRoute.coordinates.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  const sheetRef = useRef<BottomSheet>(null);
  const lastRouteCalcCoordsRef = useRef<Coords | null>(null);
  const isFetchingRouteRef = useRef(false);

  // Exact fixed snap points (100px = header only, 160px = header + button)
  const snapPoints = useMemo(() => [100, 160], []);

  // Continuously track device GPS location and update route, distance, and walk time in real-time
  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    async function startLiveNavigation() {
      // 1. Initial immediate location & route calculation
      try {
        const initialLoc = initialUserCoords || (await getCurrentLocation());
        if (!isMounted) return;
        setUserCoords(initialLoc);
        lastRouteCalcCoordsRef.current = initialLoc;

        if (initialLoc) {
          isFetchingRouteRef.current = true;
          const initialResult = await getRoute(initialLoc, pharmCoords);
          if (isMounted && initialResult) {
            setRoute(initialResult);
            setError(null);
          }
        }
      } catch (e: any) {
        if (isMounted && !initialRoute) {
          setError(e?.message ?? 'Could not calculate navigation route.');
        }
      } finally {
        isFetchingRouteRef.current = false;
        if (isMounted) setLoading(false);
      }

      // 2. Real-time GPS location watcher
      const sub = await watchLocation(
        async (freshCoords: Coords) => {
          if (!isMounted) return;
          setUserCoords(freshCoords);

          // Check how far user moved since last route calculation
          const lastCalc = lastRouteCalcCoordsRef.current;
          const movedMeters = lastCalc ? haversineKm(lastCalc, freshCoords) * 1000 : 999;

          // Re-calculate full ORS walking route if moved >= 8 meters
          if (movedMeters >= 8 && !isFetchingRouteRef.current) {
            lastRouteCalcCoordsRef.current = freshCoords;
            isFetchingRouteRef.current = true;
            try {
              const updatedResult = await getRoute(freshCoords, pharmCoords);
              if (isMounted && updatedResult) {
                setRoute(updatedResult);
                setError(null);
              }
            } catch (err: any) {
              console.warn('Live navigation route update error:', err.message);
            } finally {
              isFetchingRouteRef.current = false;
            }
          }
        },
        { timeInterval: 2000, distanceInterval: 4 }
      );

      if (isMounted) {
        subscription = sub;
      } else {
        sub?.remove();
      }
    }

    startLiveNavigation();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [pharmLat, pharmLon]);

  const centerLat = userCoords ? (userCoords.latitude + pharmLat) / 2 : pharmLat;
  const centerLon = userCoords ? (userCoords.longitude + pharmLon) / 2 : pharmLon;

  const distanceLabel = route
    ? formatDistance(route.distanceMeters)
    : cleanDistanceString(params.distanceKm);

  const durationLabel = route
    ? cleanDurationString(formatDuration(route.durationSeconds))
    : cleanDurationString(params.walkMinutes);

  function openExternalNav() {
    const destination = `${pharmLat},${pharmLon}`;
    const origin = userCoords ? `${userCoords.latitude},${userCoords.longitude}` : '';
    const googleMapsUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`;

    Linking.openURL(googleMapsUrl).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${destination}`);
    });
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Full-screen map */}
        <View style={StyleSheet.absoluteFillObject}>
          <FullMapComponent
            initialRegion={{
              latitude: centerLat,
              longitude: centerLon,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            userCoords={userCoords}
            selectedId={params.id ?? ''}
            markers={[{
              id: params.id ?? '',
              name: pharmName,
              address: '',
              latitude: pharmLat,
              longitude: pharmLon,
              isVerified: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodeURIComponent(params.id ?? '')),
            }]}
            onSelectMarker={() => {}}
            routeCoords={route?.coordinates}
            mapPadding={{ top: (insets.top || 20) + 70, right: 24, bottom: 180, left: 24 }}
            showLegend={false}
          />
        </View>

        {/* Floating header */}
        <View style={[styles.floatingHeader, { paddingTop: insets.top }]}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.5 },
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/pharmacies'))}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
          </Pressable>

          <View style={[styles.directionsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {loading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : error ? (
              <Ionicons name="warning-outline" size={20} color={theme.warning} />
            ) : (
              <View style={[styles.directionsIconCircle, { backgroundColor: primaryColor }]}>
                <Ionicons name="navigate" size={16} color={COLORS.white} />
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
        </View>

        {/* ── Native Smooth Sliding Bottom Sheet ── */}
        <BottomSheet
          ref={sheetRef}
          snapPoints={snapPoints}
          index={0}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          onChange={(idx) => setSheetIndex(idx)}
          onAnimate={(_from, to) => setSheetIndex(to)}
          backgroundStyle={{ backgroundColor: theme.card }}
          handleIndicatorStyle={{ backgroundColor: theme.border, width: 40 }}
        >
          <BottomSheetView style={styles.sheetBodyContainer}>
            {/* Header Info Row (Always visible) */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, gap: SPACING.xs }}>
                <Text style={[styles.pharmName, { color: theme.text.primary }]} numberOfLines={1}>
                  {pharmName}
                </Text>
                <Text style={[styles.pharmMeta, { color: theme.textMuted }]}>
                  {distanceLabel} · {durationLabel}
                </Text>
              </View>

              {/* Expand / Collapse Chevron Toggle */}
              <Pressable
                style={({ pressed }) => [
                  styles.expandToggle,
                  pressed && { opacity: 0.5 },
                  { backgroundColor: theme.surfaceSecondary },
                ]}
                onPress={() => {
                  if (sheetIndex > 0) {
                    sheetRef.current?.snapToIndex(0);
                  } else {
                    sheetRef.current?.snapToIndex(1);
                  }
                }}
              >
                <Ionicons name={sheetIndex > 0 ? 'chevron-down' : 'chevron-up'} size={20} color={primaryColor} />
              </Pressable>
            </View>

            {/* Open in Google Maps Button */}
            <Pressable
              style={({ pressed }) => [
                styles.startBtn,
                pressed && { opacity: 0.7 },
                { backgroundColor: primaryColor },
              ]}
              onPress={openExternalNav}
            >
              <Ionicons name="navigate" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.startBtnText}>Open in Google Maps</Text>
            </Pressable>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  directionsCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: SPACING.md,
    borderWidth: 1.5,
  },
  directionsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionsTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  directionsSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm,
  },
  sheetBodyContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pharmName: {
    fontSize: FONT_SIZE.title,
    fontFamily: 'Inter-Bold',
  },
  pharmMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.lg,
  },
  expandToggle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  startBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
});