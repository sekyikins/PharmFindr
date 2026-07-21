import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Skeleton from '@/components/ui/Skeleton';

export default function PatientReservationsHistory() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'accepted' | 'collected'>('all');

  const fetchReservations = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, pharmacies(name, phone, address)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations(data ?? []);
    } catch (e: any) {
      console.warn('Error fetching reservations history:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const filtered = reservations.filter((r) => {
    if (activeFilter === 'all') return true;
    return r.status === activeFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return { label: 'Accepted', bg: theme.successBg, text: theme.successText, icon: 'checkmark-circle' as const };
      case 'declined':
        return { label: 'Declined', bg: theme.surfaceSecondary, text: theme.errorText, icon: 'close-circle' as const };
      case 'collected':
        return { label: 'Collected', bg: theme.patientSecondary, text: primaryColor, icon: 'bag-check' as const };
      default:
        return { label: 'Pending', bg: theme.warning + '20', text: theme.warning, icon: 'time' as const };
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReservations();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => {
    const badge = getStatusBadge(item.status);
    const dateStr = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const pharmName = item.pharmacy_name || item.pharmacies?.name || 'Pharmacy';

    let medsSummary = item.medicine_name || 'Reservation Request';
    if (Array.isArray(item.medicines) && item.medicines.length > 0) {
      medsSummary = item.medicines
        .map((m: any) => (typeof m === 'object' ? `${m.name} ${m.strength || ''}`.trim() : String(m)))
        .join(', ');
    }

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push(`/(patient)/reservation/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pharmacyName, { color: theme.text.primary }]}>{pharmName}</Text>
            <Text style={[styles.dateText, { color: theme.textDim }]}>{dateStr}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={13} color={badge.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={[styles.medsText, { color: theme.textMuted }]} numberOfLines={2}>
          {medsSummary}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.priceText, { color: primaryColor }]}>
            {item.total_cost > 0 ? `$${Number(item.total_cost).toFixed(2)}` : 'Est. Price Available'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: FONT_SIZE.sm, color: primaryColor, fontWeight: '600' }}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color={primaryColor} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={14} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={16} style={{ marginBottom: 12 }} />
          <Skeleton width="30%" height={16} />
        </View>
      ))}
    </View>
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
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>My Reservations</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter Chips */}
      <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {(['all', 'pending', 'accepted', 'collected'] as const).map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterChip,
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              activeFilter === filter && { backgroundColor: theme.patientSecondary, borderColor: primaryColor },
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === filter ? primaryColor : theme.textMuted },
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List / Skeleton */}
      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No reservations found</Text>
              <Text style={[styles.emptySub, { color: theme.textDim }]}>
                {activeFilter === 'all'
                  ? 'Your reservation history will appear here once you reserve medicines.'
                  : `No ${activeFilter} reservations.`}
              </Text>
            </View>
          }
        />
      )}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  filterText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  list: { padding: SPACING.lg, gap: 12 },
  skeletonContainer: { padding: SPACING.lg, gap: 12 },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  pharmacyName: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  dateText: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  badgeText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  medsText: { fontSize: FONT_SIZE.body, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  priceText: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  emptySub: { fontSize: FONT_SIZE.body, textAlign: 'center', paddingHorizontal: 32 },
});
