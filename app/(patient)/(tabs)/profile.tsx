import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Svg, { Path } from 'react-native-svg';

const MENU_ITEMS = [
  { id: 'health', icon: 'fitness-outline', label: 'Personal Health Profile', route: '/(patient)/edit-profile' },
  { id: 'reservations', icon: 'receipt-outline', label: 'My Reservations', route: '/(patient)/reservations-history' },
  { id: 'history', icon: 'time-outline', label: 'Prescription History', route: '/(patient)/prescription-history' },
  { id: 'saved', icon: 'heart-outline', label: 'Saved Medicines', route: '/(patient)/medicines' },
  { id: 'notifs', icon: 'notifications-outline', label: 'Notifications', route: '/(patient)/notifications' },
];

export default function Profile() {
  const router = useRouter();
  const { profile, user, signOut } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const { width } = useWindowDimensions();

  const [stats, setStats] = useState({ prescriptions: 0, reservations: 0 });

  const displayName = profile?.full_name ?? 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ count: rxCount }, { count: resCount }] = await Promise.all([
        supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      setStats({ prescriptions: rxCount ?? 0, reservations: resCount ?? 0 });
    } catch (e: any) {
      console.warn('Error fetching profile stats:', e.message);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
      >
        {/* ── Blue Hero ── */}
        <View style={[styles.hero, { backgroundColor: primaryColor }]}>
          <View style={styles.avatarCircle}>
            <Text style={[styles.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSub}>
            {profile?.phone ?? 'N/A'}
          </Text>
        </View>

        

          {/* ── SVG Wave Curve (exact Figma shape) ── */}
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

        <View style={{padding:SPACING.lg}}>
          {/* ── Stats Row ── */}
          <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <StatItem value={stats.prescriptions} label="Prescriptions" theme={theme} valueColor={primaryColor} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatItem value={stats.reservations} label="Reservations" theme={theme} valueColor={primaryColor} />
          </View>

          {/* ── Menu ── */}
          <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.menuRow, { borderBottomColor: theme.background }]}
                onPress={() => item.route && router.push(item.route as any)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
                  <Ionicons name={item.icon as any} size={18} color={theme.textMuted} />
                </View>
                <Text style={[styles.menuLabel, { color: theme.text.primary }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
              </Pressable>
            ))}

            {/* Logout */}
            <Pressable style={[styles.menuRow, { borderWidth: 1, backgroundColor: theme.errorBg, borderColor: theme.error, borderRadius: RADIUS.xl }]} onPress={handleSignOut}>
              <View style={[styles.menuIconCircle, { backgroundColor: theme.errorBg }]}>
                <Ionicons name="log-out-outline" size={18} color={theme.error} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.error }]}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label, theme, valueColor }: { value: number; label: string; theme: any; valueColor: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 0,
    paddingHorizontal: SPACING.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700' },
  heroName: { fontSize: FONT_SIZE.hero, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  heroSub: { fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', marginBottom: SPACING.md },

  // ── Stats ──
  statsCard: {
    marginBottom: SPACING.md,
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FONT_SIZE.hero, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: FONT_SIZE.sm },
  statDivider: { width: 1, marginVertical: 4 },

  // ── Menu ──
  menuCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '500' },
});
