import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { getCurrentLocation } from '@/lib/location';
import { searchNearbyPharmacies, type OsmPharmacy } from '@/lib/osm';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';

export default function Home() {
  const router = useRouter();
  const { profile, user } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<OsmPharmacy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHomeData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch user's prescriptions from Supabase
      const { data: rxData, error: rxError } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (rxError) throw rxError;

      setPrescriptions(
        (rxData ?? []).map((rx) => {
          const date = new Date(rx.created_at);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          let meds: string[] = [];
          try {
            // Parse medicines if it is stored as JSON or string
            if (typeof rx.ai_interpretation === 'object' && rx.ai_interpretation?.medicines) {
              meds = rx.ai_interpretation.medicines.map((m: any) => m.name || String(m));
            } else if (typeof rx.ocr_text === 'string') {
              meds = [rx.ocr_text.substring(0, 30) + '...'];
            }
          } catch (err) {
            console.warn('Error parsing medicines from prescription:', err);
          }

          if (meds.length === 0) meds = ['Prescription Scan'];

          return {
            id: rx.id,
            date: dateStr,
            medicines: meds,
          };
        })
      );

      // 2. Fetch nearby pharmacies using GPS + OSM
      const coords = await getCurrentLocation();
      const results = await searchNearbyPharmacies(coords, 5000);
      setPharmacies(results.slice(0, 2)); // show top 2 nearby
    } catch (e: any) {
      console.warn('Error loading home screen data:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning 👋';
    if (h < 18) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
      >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.card }]}>
            <View>
              <Text style={[styles.greeting, { color: theme.textMuted }]}>{getGreeting()}</Text>
              <Text style={[styles.name, { color: theme.text }]}>{firstName}</Text>
            </View>
            <Pressable
              style={[styles.notifBtn, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => router.push('/(patient)/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>QUICK ACTIONS</Text>
            <View style={styles.actionsRow}>
              <QuickAction
                icon="scan-outline"
                label="Scan Prescription"
                color={theme.patientPrimary}
                bg={theme.patientSecondary}
                cardBg={theme.card}
                labelColor={theme.text}
                onPress={() => router.push('/(patient)/scan')}
              />
              <QuickAction
                icon="chatbubble-outline"
                label="AI Chat"
                color={primaryColor}
                bg={theme.patientSecondary}
                cardBg={theme.card}
                labelColor={theme.text}
                onPress={() => router.replace('/(patient)/(tabs)/chat')}
              />
            </View>
          </View>

          {/* Recent Prescriptions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT PRESCRIPTIONS</Text>
              <Pressable onPress={() => router.push('/(patient)/prescription-history')}>
                <Text style={[styles.viewAll, { color: primaryColor }]}>View All</Text>
              </Pressable>
            </View>
            {loading ? (
              <View style={{ gap: 10 }}>
                {[1, 2].map((i) => (
                  <View key={i} style={[styles.card, { backgroundColor: theme.card }]}>
                    <Skeleton width={40} height={40} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="80%" height={14} />
                    </View>
                  </View>
                ))}
              </View>
            ) : prescriptions.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="document-text-outline" size={28} color={theme.textDim} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No prescriptions scanned yet.</Text>
                <Pressable style={[styles.scanLinkBtn, { backgroundColor: primaryColor }]} onPress={() => router.push('/(patient)/scan')}>
                  <Text style={styles.scanLinkText}>Scan Now</Text>
                </Pressable>
              </View>
            ) : (
              prescriptions.map((rx) => (
                <Pressable
                  key={rx.id}
                  style={[styles.card, { backgroundColor: theme.card }]}
                  onPress={() => router.push('/(patient)/prescription-history')}
                >
                  <View style={[styles.cardIcon, { backgroundColor: theme.patientSecondary }]}>
                    <Ionicons name="document-text-outline" size={20} color={theme.patientPrimary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{rx.date}</Text>
                    <Text style={[styles.cardSub, { color: theme.textMuted }]} numberOfLines={1}>
                      {rx.medicines[0]}{rx.medicines.length > 1 ? ` +${rx.medicines.length - 1} more` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
                </Pressable>
              ))
            )}
          </View>

          {/* Nearby Pharmacies */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textDim }]}>NEARBY PHARMACIES</Text>
              <Pressable onPress={() => router.push('/(patient)/pharmacies')}>
                <Text style={[styles.viewAll, { color: primaryColor }]}>See All</Text>
              </Pressable>
            </View>
            {loading ? (
              <View style={{ gap: 10 }}>
                {[1, 2].map((i) => (
                  <View key={i} style={[styles.pharmacyCard, { backgroundColor: theme.card }]}>
                    <Skeleton width={38} height={38} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="70%" height={16} />
                      <Skeleton width="40%" height={14} />
                    </View>
                  </View>
                ))}
              </View>
            ) : pharmacies.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textDim, paddingVertical: 10 }]}>No pharmacies found nearby.</Text>
            ) : (
              pharmacies.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.pharmacyCard, { backgroundColor: theme.card }]}
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/pharmacy/[id]',
                      params: {
                        id: encodeURIComponent(p.id),
                        name: p.name,
                        address: p.address,
                        phone: p.phone ?? '',
                        hours: p.hours ?? '',
                        lat: String(p.latitude),
                        lon: String(p.longitude),
                        distanceKm: String(p.distanceKm),
                        walkMinutes: String(p.walkMinutes),
                      },
                    })
                  }
                >
                  <View style={[styles.pharmacyIcon, { backgroundColor: theme.pharmacySecondary }]}>
                    <Ionicons name="location-outline" size={18} color={theme.pharmacyPrimary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.pharmacyName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                    <View style={styles.pharmacyMeta}>
                      <Text style={[styles.distance, { color: theme.textMuted }]}>{p.distanceKm} km</Text>
                      <Text style={[styles.distance, { color: theme.textDim }]}>·</Text>
                      <Text style={[styles.distance, { color: theme.textMuted }]}>{p.walkMinutes} min walk</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon, label, color, bg, cardBg, labelColor, onPress,
}: {
  icon: any; label: string; color: string; bg: string; cardBg: string; labelColor: string; onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionBtn, { backgroundColor: cardBg }]} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  greeting: { fontSize: FONT_SIZE.body },
  name: { fontSize: FONT_SIZE.hero, fontWeight: '700' },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  section: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  viewAll: { fontSize: FONT_SIZE.body, fontWeight: '600' },

  // Quick Actions
  actionsRow: { flexDirection: 'row', gap: SPACING.md },
  actionBtn: {
    flex: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionLabel: { fontSize: FONT_SIZE.body, fontWeight: '600' },

  // Prescription Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: FONT_SIZE.body },

  emptyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  emptyText: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  scanLinkBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    marginTop: 6,
  },
  scanLinkText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.sm },

  // Pharmacy Cards
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pharmacyIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  pharmacyName: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 4 },
  pharmacyMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  distance: { fontSize: FONT_SIZE.md },
});