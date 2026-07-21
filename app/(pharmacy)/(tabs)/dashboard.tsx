import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, useWindowDimensions, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

import Skeleton from '@/components/ui/Skeleton';

export default function Dashboard() {
  const router = useRouter();
  const { theme, primaryColor, primaryDarkColor } = useThemeContext();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();

  const [pharmacyName, setPharmacyName] = useState('My Pharmacy');
  const [hours, setHours] = useState('8:00 AM – 10:00 PM');
  const [stats, setStats] = useState({ medicines: 0, active: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch pharmacy info
      const { data: pharm, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (pharmErr) throw pharmErr;

      setPharmacyName(pharm.name);
      if (pharm.opening_time && pharm.closing_time) {
        const formatTime = (tStr: string) => {
          const [h, m] = tStr.split(':');
          const hr = parseInt(h, 10);
          const ampm = hr >= 12 ? 'PM' : 'AM';
          const displayHr = hr % 12 || 12;
          return `${displayHr}:${m} ${ampm}`;
        };
        setHours(`Open ${formatTime(pharm.opening_time)} – ${formatTime(pharm.closing_time)}`);
      }

      // 2. Fetch inventory count
      const { count: medCount, error: medErr } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacy_id', pharm.id);

      if (medErr) throw medErr;

      // 3. Fetch active reservations count (status = 'accepted')
      const { count: activeCount, error: activeErr } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacy_id', pharm.id)
        .eq('status', 'accepted');

      if (activeErr) throw activeErr;

      // 4. Fetch pending reservations count (status = 'pending')
      const { count: pendingCount, error: pendingErr } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacy_id', pharm.id)
        .eq('status', 'pending');

      if (pendingErr) throw pendingErr;

      setStats({
        medicines: medCount ?? 0,
        active: activeCount ?? 0,
        pending: pendingCount ?? 0,
      });
    } catch (e: any) {
      console.warn('Error fetching dashboard stats:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
      >
          {/* Green Hero Header */}
          <View style={[styles.hero, { backgroundColor: primaryColor }]}>
            <View style={styles.heroContent}>
              <View style={styles.heroLeft}>
                <Text style={styles.welcomeBack}>Welcome back</Text>
                <Text style={styles.pharmName}>{pharmacyName}</Text>
              </View>
              <Pressable
                style={styles.profileBtn}
                onPress={() => router.push('/(pharmacy)/(tabs)/profile')}
              >
                <Ionicons name="person-outline" size={20} color={primaryColor} />
              </Pressable>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.medicines}</Text>
                <Text style={styles.statLabel}>Medicines</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.active}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* SVG Wave Curve */}
          <View style={{ backgroundColor: primaryColor }}>
            <Svg
              width={width}
              height={20}
              viewBox={`0 0 ${width} 20`}
              style={{ display: 'flex' }}
            >
              <Path
                d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`}
                fill={theme.background}
              />
            </Svg>
          </View>

          <View style={{ padding: 24 }}>
            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: primaryColor }]}
                onPress={() => router.push('/(pharmacy)/(tabs)/inventory')}
              >
                <Ionicons name="add-outline" size={20} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Add Medicine</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, { backgroundColor: primaryDarkColor }]}
                onPress={() => router.push('/(pharmacy)/upload-inventory')}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Upload CSV</Text>
              </Pressable>
            </View>

            {/* Navigation Cards */}
            <NavCard
              icon="cube-outline"
              iconBg={theme.pharmacySecondary}
              iconColor={primaryColor}
              title="Inventory"
              subtitle={`${stats.medicines} medicines`}
              cardBg={theme.card}
              cardBorder={theme.border}
              titleColor={theme.text.primary}
              subtitleColor={theme.textMuted}
              chevronColor={theme.textDim}
              onPress={() => router.push('/(pharmacy)/(tabs)/inventory')}
            />

            <NavCard
              icon="calendar-outline"
              iconBg={theme.pendingBg}
              iconColor={theme.warning}
              title="Reservations"
              subtitle={`${stats.pending} pending reservations`}
              cardBg={theme.card}
              cardBorder={theme.border}
              titleColor={theme.text.primary}
              subtitleColor={theme.textMuted}
              chevronColor={theme.textDim}
              onPress={() => router.push('/(pharmacy)/(tabs)/reservations')}
            />

            <NavCard
              icon="settings-outline"
              iconBg={theme.successBg}
              iconColor={primaryColor}
              title="Pharmacy Profile"
              subtitle={hours}
              cardBg={theme.card}
              cardBorder={theme.border}
              titleColor={theme.text.primary}
              subtitleColor={theme.textMuted}
              chevronColor={theme.textDim}
              onPress={() => router.push('/(pharmacy)/(tabs)/profile')}
            />
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

// ─── NavCard ─────────────────────────────────────────────────────────────────

interface NavCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  subtitleColor: string;
  chevronColor: string;
  onPress: () => void;
}

function NavCard({ icon, iconBg, iconColor, title, subtitle, cardBg, cardBorder, titleColor, subtitleColor, chevronColor, onPress }: NavCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.navCard,
        { backgroundColor: cardBg, borderColor: cardBorder },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.navIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={styles.navCardText}>
        <Text style={[styles.navCardTitle, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.navCardSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={chevronColor} />
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: {},

  // Hero
  hero: { padding: SPACING.xl, overflow: 'hidden' },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl },
  heroLeft: { flex: 1 },
  welcomeBack: { fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  pharmName: { fontSize: FONT_SIZE.title + 2, fontWeight: '700', color: '#ffffff' },
  profileBtn: { width: 40, height: 40, borderRadius: RADIUS.lg, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.lg, paddingVertical: SPACING.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: SPACING.xs },
  statNum: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  statLabel: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2, textTransform: 'capitalize' },

  // Actions
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '600' },

  // Nav Cards
  navCard: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACING.lg },
  navIconCircle: { width: 44, height: 44, borderRadius: RADIUS.pill, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.lg - 2 },
  navCardText: { flex: 1 },
  navCardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', marginBottom: 2 },
  navCardSubtitle: { fontSize: FONT_SIZE.md },
});