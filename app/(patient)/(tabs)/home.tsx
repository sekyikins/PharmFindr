import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { COLORS, SPACING } from '@/styles/theme';
import { usePharmacyStore } from '@/store/pharmacyStore';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';
import { useNotificationStore } from '@/store/notificationStore';
import { Header } from '@/components/ui/Header';

export default function Home() {
  const router = useRouter();
  const { profile, user, appUser, refreshProfile, fetchAppUser } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const { pharmacies: allPharmacies, loading: pharmLoading, loadNearby } = usePharmacyStore();
  const pharmacies = useMemo(() => allPharmacies.slice(0, 3), [allPharmacies]);

  const { unreadCount, fetchNotifications, subscribe, unsubscribe } = useNotificationStore();
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications(user.id);
    subscribe(user.id);
    return () => unsubscribe();
  }, [user?.id]);

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [rxLoading, setRxLoading] = useState(true);

  useEffect(() => {
    if (allPharmacies.length === 0) {
      loadNearby();
    }
  }, []);

  const fetchPrescriptions = useCallback(async () => {
    if (!user) {
      setRxLoading(false);
      return;
    }
    setRxLoading(true);
    try {
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
            rawMedicines: (typeof rx.ai_interpretation === 'object' && rx.ai_interpretation?.medicines) || [],
          };
        })
      );
    } catch (e: any) {
      console.warn('Error loading prescriptions:', e.message);
    } finally {
      setRxLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPrescriptions(),
      loadNearby(),
      refreshProfile(),
      fetchAppUser(),
      user?.id ? fetchNotifications(user.id) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Navigation Bar */}
      <Header
        title=""
        left={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text style={[styles.greeting, { color: theme.textMuted }]}>{getGreeting()},</Text>
            <Text style={[styles.name, { color: theme.text.primary }]}>{firstName}</Text>
          </View>
        }
        right={
          <Pressable
            style={({ pressed }) => [
              styles.notifBtn,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => router.push('/(patient)/notifications')}
          >
            <Ionicons name="notifications-outline" size={19} color={unreadCount > 0 ? primaryColor : theme.textMuted} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: primaryColor }]}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            )}
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
      >
        {/* Professional 2-Card Quick Actions */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader]}>
            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>QUICK ACTIONS</Text>
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.85 },
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.push('/(patient)/scan')}
            >
              <View style={styles.actionTopRow}>
                <View style={[styles.actionIconCircle, { backgroundColor: primaryColor + '15' }]}>
                  <Ionicons name="scan" size={22} color={primaryColor} />
                </View>
                <View style={[styles.tagBadge, { backgroundColor: primaryColor + '12' }]}>
                  <Text style={[styles.tagBadgeText, { color: primaryColor }]}>AI Extraction</Text>
                </View>
              </View>
              <Text style={[styles.actionTitle, { color: theme.text.primary }]}>Scan Prescription</Text>
              <Text style={[styles.actionDesc, { color: theme.textMuted }]}>Extract meds & check stock</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { opacity: 0.85 },
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.replace('/(patient)/(tabs)/chat')}
            >
              <View style={styles.actionTopRow}>
                <View style={[styles.actionIconCircle, { backgroundColor: primaryColor + '15' }]}>
                  <Ionicons name="sparkles" size={20} color={primaryColor} />
                </View>
                <View style={[styles.tagBadge, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.tagBadgeText, { color: primaryColor }]}>Instant AI</Text>
                </View>
              </View>
              <Text style={[styles.actionTitle, { color: theme.text.primary }]}>AI Assistant</Text>
              <Text style={[styles.actionDesc, { color: theme.textMuted }]}>Dosage, safety & side effects</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Prescriptions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT PRESCRIPTIONS</Text>
            <Pressable style={({ pressed }) => [pressed && { opacity: 0.5 }]} onPress={() => router.push('/(patient)/prescription-history')}>
              <Text style={[styles.viewAll, { color: primaryColor }]}>View All</Text>
            </Pressable>
          </View>

          {rxLoading ? (
            <View style={{ gap: 10 }}>
              {[1, 2].map((i) => (
                <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Skeleton width={44} height={44} borderRadius={12} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="50%" height={16} />
                    <Skeleton width="80%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : prescriptions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: primaryColor + '15' }]}>
                <Ionicons name="document-text-outline" size={24} color={primaryColor} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No Prescriptions Scanned</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Scan your medical prescription paper to verify drug safety & locate stock nearby.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.scanLinkBtn, pressed && { opacity: 0.8 }, { backgroundColor: primaryColor }]}
                onPress={() => router.push('/(patient)/scan')}
              >
                <Ionicons name="camera-outline" size={15} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.scanLinkText}>Scan Prescription Now</Text>
              </Pressable>
            </View>
          ) : (
            prescriptions.map((rx) => (
              <Pressable
                key={rx.id}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() => {
                  const medsToPass = rx.rawMedicines.length > 0
                    ? rx.rawMedicines
                    : rx.medicines.map((name: string) => ({ name, strength: null, dosage: null, frequency: null, duration: null, route: null, instructions: null, confidence: 0 }));
                  router.push({
                    pathname: '/(patient)/ocr-result',
                    params: {
                      medicines: JSON.stringify(medsToPass),
                      prescriptionId: rx.id,
                    },
                  });
                }}
              >
                <View style={[styles.cardIcon, { backgroundColor: primaryColor + '12' }]}>
                  <Ionicons name="document-text" size={20} color={primaryColor} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{rx.date}</Text>
                  <Text style={[styles.cardSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {rx.medicines[0]}
                    {rx.medicines.length > 1 ? ` +${rx.medicines.length - 1} more` : ''}
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
            <Pressable style={({ pressed }) => [pressed && { opacity: 0.5 }]} onPress={() => router.push('/(patient)/pharmacies')}>
              <Text style={[styles.viewAll, { color: primaryColor }]}>View Map</Text>
            </Pressable>
          </View>

          {pharmLoading ? (
            <View style={{ gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.pharmacyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Skeleton width={44} height={44} borderRadius={12} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="70%" height={16} />
                    <Skeleton width="45%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : pharmacies.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="location-outline" size={28} color={theme.textDim} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No registered pharmacies found nearby. Tap below to search across Ghana.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.scanLinkBtn, pressed && { opacity: 0.8 }, { backgroundColor: primaryColor }]}
                onPress={() => router.push('/(patient)/pharmacies')}
              >
                <Text style={styles.scanLinkText}>Explore Pharmacies</Text>
              </Pressable>
            </View>
          ) : (
            pharmacies.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.pharmacyCard,
                  pressed && { opacity: 0.85 },
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(patient)/pharmacies',
                    params: { selectedId: p.id },
                  })
                }
              >
                <View style={[styles.pharmacyIcon, { backgroundColor: primaryColor + '12' }]}>
                  <Ionicons name="business" size={20} color={primaryColor} />
                </View>
                <View style={styles.cardBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.pharmacyName, { color: theme.text.primary, flexShrink: 1 }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {(p.isRegistered || p.verified) && (
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.pharmacyPrimary} />
                    )}
                  </View>
                  <View style={styles.pharmacyMeta}>
                    <Ionicons name="navigate-outline" size={12} color={theme.textMuted} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  name: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    lineHeight: 12,
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  viewAll: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },

  // Quick Actions (2-Card Professional Grid)
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  actionDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 15,
  },

  // Prescription Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  cardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  scanLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanLinkText: {
    color: COLORS.white,
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },

  // Pharmacy Cards
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  pharmacyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pharmacyName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginBottom: 3,
  },
  pharmacyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distance: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
});