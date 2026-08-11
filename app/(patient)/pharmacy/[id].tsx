import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FullMapComponent from '@/components/FullMapComponent';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { formatTimeHHMM } from '@/lib/osm';

export default function PharmacyDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    address?: string;
    phone?: string;
    hours?: string;
    lat?: string;
    lon?: string;
    distanceKm?: string;
    walkMinutes?: string;
  }>();
  const { theme, primaryColor } = useThemeContext();

  // Wire hardware back button
  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/pharmacies');
    }
    return true;
  });

  const id = params.id ?? '';

  const [details, setDetails] = useState({
    name: params.name ?? 'Pharmacy',
    address: params.address || 'Address unavailable',
    phone: params.phone || 'N/A',
    hours: params.hours || 'N/A',
    lat: parseFloat(params.lat ?? '5.6037'),
    lon: parseFloat(params.lon ?? '-0.187'),
  });

  const [weeklySchedule, setWeeklySchedule] = useState<
    Array<{ day: string; isOpen: boolean; opens: string; closes: string }>
  >([]);
  const [isOpenNow, setIsOpenNow] = useState<boolean | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isClosingSoon, setIsClosingSoon] = useState(false);

  useEffect(() => {
    const rawId = decodeURIComponent(id);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
      supabase
        .from('pharmacies')
        .select(`
          *,
          pharmacy_operating_hours (
            day_of_week,
            is_open,
            opening_time,
            closing_time
          )
        `)
        .eq('id', rawId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const now = new Date();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDayName = dayNames[now.getDay()];

            let scheduleList: Array<{ day: string; isOpen: boolean; opens: string; closes: string }> = [];
            if (data.pharmacy_operating_hours && data.pharmacy_operating_hours.length > 0) {
              scheduleList = DAYS_ORDER.map((d) => {
                const row = data.pharmacy_operating_hours.find((h: any) => h.day_of_week === d);
                return {
                  day: d,
                  isOpen: row ? row.is_open : d !== 'Sunday',
                  opens: formatTimeHHMM(row ? (row.opening_time || '08:00') : '08:00'),
                  closes: formatTimeHHMM(row ? (row.closing_time || '20:00') : '20:00'),
                };
              });
            } else if (Array.isArray(data.operating_hours) && data.operating_hours.length > 0) {
              scheduleList = DAYS_ORDER.map((d) => {
                const row = data.operating_hours.find(
                  (h: any) => (h.day || h.day_of_week)?.toLowerCase() === d.toLowerCase()
                );
                return {
                  day: d,
                  isOpen: row ? (row.isOpen !== undefined ? row.isOpen : row.is_open) : d !== 'Sunday',
                  opens: formatTimeHHMM(row ? (row.opens || row.opening_time || '08:00') : '08:00'),
                  closes: formatTimeHHMM(row ? (row.closes || row.closing_time || '20:00') : '20:00'),
                };
              });
            }

            setWeeklySchedule(scheduleList);

            // Compute current open status
            const oTime = formatTimeHHMM(data.opening_time);
            const cTime = formatTimeHHMM(data.closing_time);
            let todayHoursStr = oTime && cTime ? `${oTime} - ${cTime}` : undefined;
            if (scheduleList.length > 0) {
              const todayRow = scheduleList.find((s) => s.day.toLowerCase() === currentDayName.toLowerCase());
              if (todayRow) {
                todayHoursStr = todayRow.isOpen ? `${todayRow.opens} - ${todayRow.closes}` : 'Closed today';
                const curMin = now.getHours() * 60 + now.getMinutes();
                const [oh, om] = (todayRow.opens || '08:00').split(':').map(Number);
                const [ch, cm] = (todayRow.closes || '20:00').split(':').map(Number);
                const oMin = (!isNaN(oh) ? oh * 60 + (om || 0) : 480);
                const cMin = (!isNaN(ch) ? ch * 60 + (cm || 0) : 1200);
                setIsOpenNow(todayRow.isOpen && (cMin > oMin ? (curMin >= oMin && curMin <= cMin) : (curMin >= oMin || curMin <= cMin)));
              }
            } else if (data.opening_time && data.closing_time) {
              const curMin = now.getHours() * 60 + now.getMinutes();
              const [oh, om] = data.opening_time.split(':').map(Number);
              const [ch, cm] = data.closing_time.split(':').map(Number);
              const oMin = (!isNaN(oh) ? oh * 60 + (om || 0) : 480);
              const cMin = (!isNaN(ch) ? ch * 60 + (cm || 0) : 1200);
              setIsOpenNow(cMin > oMin ? (curMin >= oMin && curMin <= cMin) : (curMin >= oMin || curMin <= cMin));
            }

            setDetails((prev) => ({
              ...prev,
              name: data.name || prev.name,
              address: data.address || prev.address,
              phone: data.phone || prev.phone,
              hours: todayHoursStr || (oTime && cTime ? `${oTime} - ${cTime}` : prev.hours),
              lat: data.latitude || prev.lat,
              lon: data.longitude || prev.lon,
            }));
          }
        });
    } else {
      // It's a public map pharmacy: query Google Places API (New) for live operating hours & schedule
      const cleanName = (params.name || details.name || 'Pharmacy').replace(/^Public Pharmacy$/i, 'Pharmacy');
      const targetCoords = {
        latitude: parseFloat(params.lat ?? String(details.lat ?? 5.6037)),
        longitude: parseFloat(params.lon ?? String(details.lon ?? -0.187)),
      };

      import('@/lib/googlePlaces').then(({ fetchPlaceDetailsByNameAndCoords }) => {
        fetchPlaceDetailsByNameAndCoords(cleanName, targetCoords).then((gDetails) => {
          if (gDetails) {
            if (gDetails.weeklySchedule && gDetails.weeklySchedule.length > 0) {
              setWeeklySchedule(gDetails.weeklySchedule);
            }
            if (gDetails.isOpen !== undefined) {
              setIsOpenNow(gDetails.isOpen);
            }
            if (gDetails.statusText) {
              setStatusText(gDetails.statusText);
            }
            if (gDetails.isClosingSoon !== undefined) {
              setIsClosingSoon(gDetails.isClosingSoon);
            }
            setDetails((prev) => ({
              ...prev,
              name: (prev.name && prev.name !== 'Public Pharmacy') ? prev.name : (gDetails.name || prev.name),
              address: gDetails.address || prev.address,
              phone: (prev.phone && prev.phone !== 'N/A') ? prev.phone : (gDetails.phone || prev.phone),
              hours: gDetails.hours || prev.hours,
            }));
          }
        });
      });
    }
  }, [id, params]);

  const name = details.name;
  const address = details.address;
  const phone = details.phone;
  const hours = details.hours;
  const lat = details.lat;
  const lon = details.lon;
  const distanceKm = params.distanceKm ?? 'N/A';
  const walkMinutes = params.walkMinutes ?? 'N/A';

  const hasValidCoords = !isNaN(lat) && !isNaN(lon);
  const isOpen = isOpenNow !== null ? isOpenNow : (!!hours && hours !== 'N/A' && hours !== 'Closed today');

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.mapSection}>
        <FullMapComponent
          initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          userCoords={null}
          markers={[{ id, name, address, latitude: lat, longitude: lon }]}
          onSelectMarker={() => {}}
        />
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.card }]}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/pharmacies'))}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.infoTitleRow}>
            <Text style={[styles.pharmName, { color: theme.text.primary }]} numberOfLines={2}>{name}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isClosingSoon
                    ? '#FEF3C7'
                    : isOpen
                    ? theme.successBg
                    : theme.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isClosingSoon
                      ? '#B45309'
                      : isOpen
                      ? theme.successText
                      : theme.textMuted,
                  },
                ]}
              >
                {isOpen ? (statusText || 'Open') : 'Closed'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textMuted }]}>{address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textMuted }]}>Today: {formatTimeHHMM(hours)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.detailRow, pressed && { opacity: 0.6 }]}
            onPress={() => phone !== 'N/A' && Linking.openURL('tel:' + phone)}
            hitSlop={8}
          >
            <Ionicons name="call-outline" size={14} color={primaryColor} />
            <Text style={[styles.detailText, { color: primaryColor, textDecorationLine: 'underline' }]}>{phone}</Text>
          </Pressable>
          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textMuted }]}>{distanceKm} km · {walkMinutes} min walk</Text>
          </View>
        </View>

        {/* Weekly Operating Hours Schedule */}
        {weeklySchedule.length > 0 && (
          <View style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.scheduleHeader}>
              <Ionicons name="calendar-outline" size={16} color={primaryColor} />
              <Text style={[styles.scheduleTitle, { color: theme.text.primary }]}>Weekly Operating Hours</Text>
            </View>
            <View style={styles.scheduleList}>
              {weeklySchedule.map((s) => {
                const isToday = s.day.toLowerCase() === currentDayName.toLowerCase();
                return (
                  <View
                    key={s.day}
                    style={[
                      styles.scheduleRow,
                      isToday && { backgroundColor: theme.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: 8 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: isToday ? primaryColor : theme.text.primary },
                        isToday && { fontFamily: 'Inter-Bold' },
                      ]}
                    >
                      {s.day} {isToday && '(Today)'}
                    </Text>
                    <Text
                      style={[
                        styles.timeText,
                        { color: !s.isOpen ? theme.textMuted : isToday ? primaryColor : theme.textMuted },
                        isToday && { fontFamily: 'Inter-Bold' },
                      ]}
                    >
                      {s.isOpen ? `${formatTimeHHMM(s.opens)} - ${formatTimeHHMM(s.closes)}` : 'Closed'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
          onPress={() =>
            router.push({
              pathname: '/(patient)/reservation/[id]',
              params: { id: encodeURIComponent(id), name, medName: '', price: '' },
            })
          }
        >
          <Text style={styles.primaryBtnText}>Reserve Medicines</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }, { borderColor: primaryColor, backgroundColor: theme.card }]}
            onPress={() => {
              if (!hasValidCoords) return;
              router.push({
                pathname: '/(patient)/pharmacy/[id]/navigate',
                params: { id: encodeURIComponent(id), name, lat: String(lat), lon: String(lon), distanceKm, walkMinutes },
              });
            }}
          >
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>Navigate</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }, { borderColor: primaryColor, backgroundColor: theme.card }]}
            onPress={() => phone !== 'N/A' && Linking.openURL('tel:' + phone)}
          >
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>Call Pharmacy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapSection: {
    height: 200,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  infoCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: 8,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pharmName: {
    fontSize: FONT_SIZE.title,
    fontFamily: 'Inter-Bold',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    flexShrink: 0,
  },
  statusText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailText: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.lg,
    flex: 1,
  },
  scheduleCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: 12,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  scheduleList: {
    gap: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dayText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },
  timeText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
  },
  primaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-SemiBold',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-SemiBold',
  },
});