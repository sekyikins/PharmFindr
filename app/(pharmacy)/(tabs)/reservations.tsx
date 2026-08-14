import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPharmacyForUser } from '@/lib/pharmacyService';
import Skeleton from '@/components/ui/Skeleton';
import { Header } from '@/components/ui/Header';

export default function Reservations() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReservations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      // 1. Get pharmacy owned by current user
      const pharm = await getPharmacyForUser(user);

      if (!pharm?.id) {
        setReservations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const pharmId = pharm.id;

      // 2. Get reservations with profile details
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('*, app_users(full_name, phone)')
        .eq('pharmacy_id', pharmId)
        .order('created_at', { ascending: false });

      if (resErr) throw resErr;

      setReservations(
        resData.map((item: any) => {
          // Parse medicines JSONB (it could be an array of objects or strings)
          let medicines: string[] = [];
          if (Array.isArray(item.medicines)) {
            medicines = item.medicines.map((m: any) =>
              typeof m === 'object' && m ? `${m.name} ${m.strength || ''}`.trim() : String(m)
            );
          }

          // Format date/time
          const date = new Date(item.created_at);
          const timeAgo = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return {
            id: item.id,
            ref: 'REF-' + item.id.substring(0, 5).toUpperCase(),
            patientName: item.app_users?.full_name || 'User',
            patientPhone: item.app_users?.phone || 'N/A',
            timeAgo: timeAgo,
            medicines: medicines,
            status: item.status,
            totalCost: item.total_cost || 0.0,
          };
        })
      );
    } catch (e: any) {
      console.warn('Error fetching reservations:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReservations();
  };

  const handleAccept = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'accepted' })
        .eq('id', id);

      if (error) throw error;
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r))
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept reservation.');
    }
  };

  const handleDecline = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'declined' })
        .eq('id', id);

      if (error) throw error;
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'declined' } : r))
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to decline reservation.');
    }
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');

  const filteredReservations = reservations.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const renderItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'pending';
    const isAccepted = item.status === 'accepted';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.9 },
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() =>
          router.push({
            pathname: '/(pharmacy)/pharmacy-reservation/[id]',
            params: { id: item.id },
          })
        }
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.patientId, { color: theme.text.primary }]}>{item.patientName}</Text>
            <Text style={[styles.refText, { color: theme.textMuted }]}>{item.ref} · {item.timeAgo}</Text>
            {item.patientPhone !== 'N/A' && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${item.patientPhone}`)}
                hitSlop={8}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="call-outline" size={13} color={COLORS.pharmacyPrimary} />
                <Text style={{ color: COLORS.pharmacyPrimary, fontSize: 12, fontFamily: 'Inter-Bold' }}>{item.patientPhone}</Text>
              </Pressable>
            )}
          </View>

          {isPending && (
            <View style={[styles.badge, { backgroundColor: '#fffbeb', borderColor: COLORS.pendingBg, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: '#b45309' }]}>Pending</Text>
            </View>
          )}
          {isAccepted && (
            <View style={[styles.badge, { backgroundColor: '#ecfdf5', borderColor: COLORS.successBorder, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: COLORS.pharmacyTextDark }]}>Accepted</Text>
            </View>
          )}
          {item.status === 'declined' && (
            <View style={[styles.badge, { backgroundColor: COLORS.errorBg, borderColor: '#fecaca', borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: '#b91c1c' }]}>Declined</Text>
            </View>
          )}
        </View>

        {/* Medicine chips */}
        <View style={styles.chipsRow}>
          {item.medicines.map((med: string, idx: number) => (
            <View key={idx} style={[styles.medChip, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
              <Ionicons name="medkit-outline" size={12} color={COLORS.pharmacyPrimary} />
              <Text style={[styles.medChipText, { color: theme.text.primary }]}>{med}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons (pending only) */}
        {isPending && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.acceptBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: COLORS.pharmacyPrimary },
              ]}
              onPress={() => handleAccept(item.id)}
            >
              <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
              <Text style={styles.actionBtnText}>Accept Order</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.declineBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: COLORS.errorBg, borderColor: '#fecaca', borderWidth: 1 },
              ]}
              onPress={() => handleDecline(item.id)}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Decline</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Reservations" />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'accepted', 'declined'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[
              styles.filterTab,
              statusFilter === mode
                ? { backgroundColor: COLORS.pharmacyPrimary, borderColor: COLORS.pharmacyPrimary }
                : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
            onPress={() => setStatusFilter(mode)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: statusFilter === mode ? COLORS.white : theme.text.primary },
              ]}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={110} borderRadius={16} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredReservations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textDim }]}>No reservation requests found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: 'Inter-Bold'
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 8
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold'
  },

  listContent: {
    padding: SPACING.lg, gap: 12
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
     textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.lg
  },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },

  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: 12
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'
  },
  patientId: {
    fontSize: FONT_SIZE.xl, fontFamily: 'Inter-Bold'
  },
  refText: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginTop: 2
  },
  phoneText: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginTop: 2
  },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill
  },
  badgeText: {
    fontSize: 11, fontFamily: 'Inter-Bold'
  },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1
  },
  medChipText: {
    fontSize: 12, fontFamily: 'Inter-SemiBold'
  },

  actionRow: {
    flexDirection: 'row', gap: 10, marginTop: 4
  },
  acceptBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  declineBtn: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  actionBtnText: {
    color: COLORS.white, fontSize: 13, fontFamily: 'Inter-Bold'
  },

});