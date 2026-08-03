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
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';

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

  const id = params.id ?? '';

  const [details, setDetails] = useState({
    name: params.name ?? 'Pharmacy',
    address: params.address || 'Address unavailable',
    phone: params.phone || 'N/A',
    hours: params.hours || 'N/A',
    lat: parseFloat(params.lat ?? '5.6037'),
    lon: parseFloat(params.lon ?? '-0.187'),
  });

  useEffect(() => {
    const rawId = decodeURIComponent(id);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
      supabase
        .from('pharmacies')
        .select('*')
        .eq('id', rawId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setDetails((prev) => ({
              ...prev,
              name: data.name || prev.name,
              address: data.address || prev.address,
              phone: data.phone || prev.phone,
              hours: data.opening_time ? `${data.opening_time} - ${data.closing_time}` : prev.hours,
              lat: data.latitude || prev.lat,
              lon: data.longitude || prev.lon,
            }));
          }
        });
    }
  }, [id]);

  const name = details.name;
  const address = details.address;
  const phone = details.phone;
  const hours = details.hours;
  const lat = details.lat;
  const lon = details.lon;
  const distanceKm = params.distanceKm ?? 'N/A';
  const walkMinutes = params.walkMinutes ?? 'N/A';

  const hasValidCoords = !isNaN(lat) && !isNaN(lon);
  const isOpen = !!hours && hours !== 'N/A';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.mapSection}>
        <FullMapComponent
          initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          userCoords={null}
          markers={[{ id, name, address, latitude: lat, longitude: lon }]}
          onSelectMarker={() => {}}
        />
        <Pressable style={({pressed})=>[styles.backBtn, pressed && {opacity: 0.5}, { backgroundColor: theme.card }]} onPress={() => router.back()}>
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
            <View style={[styles.statusBadge, { backgroundColor: isOpen ? theme.successBg : theme.surfaceSecondary }]}>
              <Text style={[styles.statusText, { color: isOpen ? theme.successText : theme.textMuted }]}>
                {isOpen ? 'Open' : 'Unknown'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textMuted }]}>{address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textMuted }]}>{hours}</Text>
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

        <Pressable
          style={({pressed})=>[styles.primaryBtn, pressed && {opacity: 0.5}, { backgroundColor: primaryColor }]}
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
            style={({pressed})=>[styles.secondaryBtn, pressed && {opacity: 0.5}, { borderColor: primaryColor, backgroundColor: theme.card }]}
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
            style={({pressed})=>[styles.secondaryBtn, pressed && {opacity: 0.5}, { borderColor: primaryColor, backgroundColor: theme.card }]}
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
  container: { flex: 1 },
  mapSection: { height: 200, position: 'relative' },
  backBtn: {
    position: 'absolute', top: 12, left: 16, width: 36, height: 36,
    borderRadius: RADIUS.pill, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  scroll: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.lg },
  infoCard: { borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, gap: 8 },
  infoTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  pharmName: { fontSize: FONT_SIZE.title, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, flexShrink: 0 },
  statusText: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailText: { fontSize: FONT_SIZE.lg, flex: 1 },
  primaryBtn: { height: 52, borderRadius: RADIUS.pill, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: FONT_SIZE.xl, fontWeight: '600' },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, height: 48, borderRadius: RADIUS.pill, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: FONT_SIZE.xl, fontWeight: '600' },
});