import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Skeleton from '@/components/ui/Skeleton';

export default function Reservations() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReservations = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Get pharmacy owned by current user
      const { data: pharm, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (pharmErr) throw pharmErr;

      // 2. Get reservations with profile details
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('*, profiles(full_name, phone)')
        .eq('pharmacy_id', pharm.id)
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
            patientName: item.profiles?.full_name || 'Patient',
            patientPhone: item.profiles?.phone || 'N/A',
            timeAgo: timeAgo,
            medicines: medicines,
            status: item.status,
            totalCost: item.total_cost || 0.0,
          };
        })
      );
    } catch (e: any) {
      console.warn('Error fetching reservations:', e.message);
      Alert.alert('Error', 'Failed to load reservations.');
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

  const renderItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'pending';
    const isAccepted = item.status === 'accepted';

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.patientId, { color: theme.text.primary }]}>{item.patientName}</Text>
            <Text style={[styles.refText, { color: theme.textDim }]}>{item.ref} · {item.timeAgo}</Text>
            {item.patientPhone !== 'N/A' && (
              <Text style={[styles.phoneText, { color: theme.textMuted }]}>{item.patientPhone}</Text>
            )}
          </View>
          {isAccepted && (
            <View style={[styles.badge, { backgroundColor: theme.successBg }]}>
              <Text style={[styles.badgeText, { color: theme.successText }]}>Accepted</Text>
            </View>
          )}
          {item.status === 'declined' && (
            <View style={[styles.badge, { backgroundColor: theme.errorBg }]}>
              <Text style={[styles.badgeText, { color: theme.errorText }]}>Declined</Text>
            </View>
          )}
          {item.status === 'collected' && (
            <View style={[styles.badge, { backgroundColor: theme.patientSecondary }]}>
              <Text style={[styles.badgeText, { color: primaryColor }]}>Collected</Text>
            </View>
          )}
        </View>

        {/* Medicine chips */}
        <View style={styles.chipsRow}>
          {item.medicines.map((med: string, idx: number) => (
            <View key={idx} style={[styles.chip, { backgroundColor: theme.patientSecondary }]}>
              <Text style={[styles.chipText, { color: theme.patientPrimary }]}>{med}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons (pending only) */}
        {isPending && (
          <View style={styles.actionRow}>
            <Pressable style={[styles.acceptBtn, { backgroundColor: primaryColor }]} onPress={() => handleAccept(item.id)}>
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Accept</Text>
            </Pressable>
            <Pressable style={[styles.declineBtn, { backgroundColor: theme.errorBg, borderColor: theme.errorBorder }]} onPress={() => handleDecline(item.id)}>
              <Ionicons name="close" size={15} color={theme.error} />
              <Text style={[styles.actionBtnText, { color: theme.error }]}>Decline</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]} onPress={() => router.push('/(pharmacy)/(tabs)/dashboard')}>
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Reservations</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ gap: 4 }}>
                  <Skeleton width={120} height={16} />
                  <Skeleton width={80} height={12} />
                </View>
                <Skeleton width={70} height={22} borderRadius={RADIUS.pill} />
              </View>
              <Skeleton width="90%" height={14} style={{ marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Skeleton width={90} height={32} borderRadius={RADIUS.pill} />
                <Skeleton width={90} height={32} borderRadius={RADIUS.pill} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={reservations}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },

  listContent: { padding: SPACING.lg, gap: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.body },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  patientId: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  refText: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  phoneText: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: FONT_SIZE.sm, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  acceptBtn: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineBtn: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 6,
  },
  actionBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '600' },
});