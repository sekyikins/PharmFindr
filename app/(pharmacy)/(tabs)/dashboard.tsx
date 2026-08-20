import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPharmacyForUser } from '@/lib/pharmacyService';
import { useNotificationStore } from '@/store/notificationStore';

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();

  const [pharmacyName, setPharmacyName] = useState('My Pharmacy');
  const [isVerified, setIsVerified] = useState(false);

  const [stats, setStats] = useState({
    medicines: 0,
    active: 0,
    pending: 0,
    totalReservations: 0,
    acceptanceRate: 100,
    totalRevenue: 0,
  });

  const [recentReservations, setRecentReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { unreadCount, fetchNotifications, subscribe, unsubscribe } = useNotificationStore();

  useEffect(() => {
    if (!user) return;
    fetchNotifications(user.id);
    subscribe(user.id);
    return () => unsubscribe();
  }, [user?.id]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch pharmacy info
      const pharm = await getPharmacyForUser(user);

      if (!pharm) {
        setPharmacyName('My Pharmacy');
        setLoading(false);
        return;
      }

      setPharmacyName(pharm.name);
      setIsVerified(pharm.isVerified ?? false);

      // 2. Fetch inventory count & reservations concurrently in parallel
      const [{ count: medCount }, resResult] = await Promise.all([
        supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('pharmacy_id', pharm.id),
        supabase
          .from('reservations')
          .select('*, app_users(full_name, phone)')
          .eq('pharmacy_id', pharm.id)
          .order('created_at', { ascending: false }),
      ]);

      let allRes = resResult.data || [];
      if (resResult.error || !resResult.data) {
        const { data: rawRes } = await supabase
          .from('reservations')
          .select('*')
          .eq('pharmacy_id', pharm.id)
          .order('created_at', { ascending: false });
        allRes = rawRes || [];
      }

      // Check if any reservation is missing app_users data and populate it
      const missingUserIds = Array.from(
        new Set(
          allRes
            .filter((r) => !r.app_users?.full_name && r.user_id)
            .map((r) => r.user_id)
        )
      );

      if (missingUserIds.length > 0) {
        const { data: userData } = await supabase
          .from('app_users')
          .select('id, full_name, phone')
          .in('id', missingUserIds);

        const userMap = new Map((userData || []).map((u) => [u.id, u]));
        allRes = allRes.map((r) => ({
          ...r,
          app_users: r.app_users || userMap.get(r.user_id) || null,
        }));
      }

      const totalCount = allRes.length;
      const pendingCount = allRes.filter((r) => r.status === 'pending').length;
      const acceptedCount = allRes.filter((r) => r.status === 'accepted' || r.status === 'collected').length;
      const rate = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 100;
      const revenue = allRes
        .filter((r) => r.status === 'accepted' || r.status === 'collected')
        .reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

      setStats({
        medicines: medCount ?? 0,
        active: acceptedCount,
        pending: pendingCount,
        totalReservations: totalCount,
        acceptanceRate: rate,
        totalRevenue: revenue,
      });

      setRecentReservations(allRes.slice(0, 3));
    } catch (e: any) {
      console.warn('Error fetching dashboard stats:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime subscription: update stats and recent list when reservations or inventory change
  useEffect(() => {
    if (!user) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const pharm = await getPharmacyForUser(user);
      if (!pharm?.id) return;

      channel = supabase
        .channel(`dashboard-realtime:${pharm.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter: `pharmacy_id=eq.${pharm.id}`,
          },
          () => {
            fetchDashboardData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory',
            filter: `pharmacy_id=eq.${pharm.id}`,
          },
          () => {
            fetchDashboardData();
          }
        )
        .subscribe();
    };

    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, fetchDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Brand Header */}
      <View style={[styles.heroHeader, { backgroundColor: COLORS.pharmacyPrimary }]}>
        <View style={styles.heroRow}>
          <View style={styles.brandLeft}>
            <Image source={require('@/assets/images/icon.png')} style={styles.brandIcon} />
            <View>
              <Text style={styles.welcomeText}>DASHBOARD</Text>
              <Text style={styles.pharmacyTitle} numberOfLines={1}>
                {pharmacyName}
              </Text>
            </View>
          </View>

          {/* Right: Notification Bell + Verified Badge */}
          <View style={{ flexDirection: 'column', alignItems: 'center', gap: SPACING.sm }}>
            {/* Bell Icon */}
            <Pressable
              style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(pharmacy)/notifications' as any)}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>

            {/* NotVerified Badge */}
            {!isVerified && (
              <Pressable
                style={({ pressed }) => [
                  styles.verifiedBadge,
                  pressed && { opacity: 0.8 }, 
                  { backgroundColor: COLORS.pendingBg, borderColor: COLORS.pendingBg },
                ]}
                onPress={() => router.push('/(pharmacy)/(tabs)/profile')}
              >
                <Ionicons
                  name='alert-circle-outline'
                  size={12}
                  color={COLORS.pendingText}
                />
                <Text
                  style={[
                    styles.verifiedText,
                    { color: COLORS.pendingText },
                  ]}
                >
                  NOT VERIFIED
                </Text>
              </Pressable>
            )}
          </View>
        </View>


        {/* Arch Curve Accent */}
        <Svg
          width={width}
          height={20}
          viewBox={`0 0 ${width} 20`}
          style={{ position: 'absolute', bottom: 0, left: 0 }}
        >
          <Path
            d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`}
            fill={theme.background}
          />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.pharmacyPrimary}
            colors={[COLORS.pharmacyPrimary]}
          />
        }
      >
        {/* 2x2 Stat Cards Grid (from Figma design) */}
        <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Overview & Metrics</Text>
        <View style={styles.grid}>
          {/* Card 1: Total Reservations */}
          <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.gridCardHeader}>
              <Text style={[styles.gridLabel, { color: theme.textMuted }]}>RESERVATIONS</Text>
              <View style={[styles.gridIconWrap, { backgroundColor: COLORS.patientSecondary }]}>
                <Ionicons name="calendar" size={16} color={COLORS.patientPrimary} />
              </View>
            </View>
            <Text style={[styles.gridValue, { color: COLORS.patientPrimary }]}>{stats.totalReservations}</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>
              {stats.pending > 0 ? `${stats.pending} pending action` : 'Up to date'}
            </Text>
          </View>

          {/* Card 2: Acceptance Rate */}
          <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.gridCardHeader}>
              <Text style={[styles.gridLabel, { color: theme.textMuted }]}>ACCEPTANCE</Text>
              <View style={[styles.gridIconWrap, { backgroundColor: COLORS.pharmacySecondary }]}>
                <Ionicons name="checkmark-done-circle" size={16} color={COLORS.pharmacyPrimary} />
              </View>
            </View>
            <Text style={[styles.gridValue, { color: COLORS.pharmacyPrimary }]}>{stats.acceptanceRate}%</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Request approval rate</Text>
          </View>

          {/* Card 3: Est Revenue */}
          <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.gridCardHeader}>
              <Text style={[styles.gridLabel, { color: theme.textMuted }]}>EST. REVENUE</Text>
              <View style={[styles.gridIconWrap, { backgroundColor: COLORS.surfaceSecondary }]}>
                <Ionicons name="cash-outline" size={16} color={COLORS.purple} />
              </View>
            </View>
            <Text style={[styles.gridValue, { color: COLORS.purple }]}>
              GHS {stats.totalRevenue.toFixed(0)}
            </Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Accepted reservations</Text>
          </View>

          {/* Card 4: Total Medicines */}
          <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.gridCardHeader}>
              <Text style={[styles.gridLabel, { color: theme.textMuted }]}>TOTAL STOCK</Text>
              <View style={[styles.gridIconWrap, { backgroundColor: COLORS.pendingBg }]}>
                <Ionicons name="cube" size={16} color={COLORS.warning} />
              </View>
            </View>
            <Text style={[styles.gridValue, { color: COLORS.warning }]}>{stats.medicines}</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Items in inventory</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionHeading, { color: theme.text.primary, marginTop: SPACING.sm }]}>
          Quick Actions
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && { opacity: 0.88 },
              { backgroundColor: COLORS.pharmacyPrimary },
            ]}
            onPress={() => router.push('/(pharmacy)/add-medicine')}
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionCardText}>Add Medicine</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && { opacity: 0.88 },
              { backgroundColor: COLORS.surfaceDark },
            ]}
            onPress={() => router.push('/(pharmacy)/upload-inventory')}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionCardText}>Upload CSV</Text>
          </Pressable>

        </View>

        {/* Recent Requests Preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Recent Reservations</Text>
          <Pressable onPress={() => router.push('/(pharmacy)/(tabs)/reservations')}>
            <Text style={{ color: COLORS.pharmacyPrimary, fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold' }}>View All →</Text>
          </Pressable>
        </View>

        {recentReservations.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyBoxText, { color: theme.textMuted }]}>
              No reservation requests yet.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentReservations.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.recentCard,
                  pressed && { opacity: 0.88 },
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(pharmacy)/pharmacy-reservation/[id]',
                    params: { id: item.id },
                  })
                }
              >
                <View style={styles.recentHeader}>
                  <View>
                    <Text style={[styles.patientName, { color: theme.text.primary }]}>
                      {item.app_users?.full_name || 'Patient'}
                    </Text>
                    <Text style={[styles.recentTime, { color: theme.textMuted }]}>
                      REF-{item.id.substring(0, 5).toUpperCase()}
                    </Text>
                  </View>

                  {(() => {
                    const status = item.status || 'pending';
                    let bg: string = COLORS.pendingBg;
                    let border: string = COLORS.pendingBorder;
                    let color: string = COLORS.pendingText;

                    if (status === 'accepted') {
                      bg = COLORS.successBg;
                      border = COLORS.successBorder;
                      color = COLORS.pharmacyTextDark;
                    } else if (status === 'declined') {
                      bg = COLORS.errorBg;
                      border = COLORS.errorBorder;
                      color = COLORS.errorText;
                    } else if (status === 'collected') {
                      bg = COLORS.patientSecondary;
                      border = COLORS.patientBorder;
                      color = COLORS.patientPrimaryDark;
                    } else if (status === 'cancelled') {
                      bg = theme.surfaceSecondary;
                      border = theme.border;
                      color = theme.textMuted;
                    }

                    return (
                      <View style={[styles.recentStatus, { backgroundColor: bg, borderColor: border, borderWidth: 1 }]}>
                        <Text style={[styles.recentStatusText, { color }]}>
                          {status.toUpperCase()}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  heroHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 28,
    position: 'relative'
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8
  },
  welcomeText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1
  },
  pharmacyTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    color: COLORS.white
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill
  },
  verifiedText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
    letterSpacing: 0.5
  },

  scroll: {
    padding: SPACING.xl,
    gap: SPACING.md
  },
  sectionHeading: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md
  },
  gridCard: {
    width: '48%',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1.5,
    gap: 6
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  gridLabel: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },
  gridIconWrap: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridValue: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold'
  },
  gridSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold'
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  actionCard: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  actionCardText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },

  emptyBox: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: SPACING.sm
  },
  emptyBoxText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },

  recentCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1.5
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  patientName: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  recentTime: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs
  },
  recentStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  recentStatusText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold'
  },

  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  bellBadgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
  },

});