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

interface NotificationItem {
  id: string;
  type: 'confirmed' | 'declined' | 'pending' | 'info';
  icon: string;
  title: string;
  body: string;
  time: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

import Skeleton from '@/components/ui/Skeleton';

export default function Notifications() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status, medicine_name, pharmacy_name, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const items: NotificationItem[] = (data ?? []).map((res) => {
        const medName = res.medicine_name ?? 'Medicine';
        const pharmName = res.pharmacy_name ?? 'the pharmacy';
        const ts = res.updated_at ?? res.created_at;

        switch (res.status) {
          case 'accepted':
            return {
              id: res.id,
              type: 'confirmed',
              icon: 'checkmark-circle-outline',
              title: 'Reservation Confirmed',
              body: `${pharmName} confirmed your ${medName} reservation.`,
              time: timeAgo(ts),
            };
          case 'declined':
            return {
              id: res.id,
              type: 'declined',
              icon: 'close-circle-outline',
              title: 'Reservation Declined',
              body: `${pharmName} declined your ${medName} request. Try a nearby pharmacy.`,
              time: timeAgo(ts),
            };
          case 'pending':
          default:
            return {
              id: res.id,
              type: 'pending',
              icon: 'time-outline',
              title: 'Reservation Pending',
              body: `Your ${medName} reservation at ${pharmName} is awaiting confirmation.`,
              time: timeAgo(ts),
            };
        }
      });

      setNotifications(items);
    } catch (e: any) {
      console.warn('Error loading notifications:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getThemeMap = (type: string) => {
    switch (type) {
      case 'confirmed': return { bg: theme.successBg, color: theme.success };
      case 'declined':  return { bg: theme.errorBg, color: theme.error };
      case 'pending':   return { bg: theme.pendingBg, color: theme.warning };
      case 'info':
      default:          return { bg: theme.patientSecondary, color: primaryColor };
    }
  };

  const renderSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Skeleton width={38} height={38} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Notifications</Text>
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={fetchNotifications}
        >
          <Ionicons name="refresh-outline" size={18} color={theme.text.primary} />
        </Pressable>
      </View>

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Reservation updates will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const colors = getThemeMap(item.type);
            return (
              <Pressable
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push('/(patient)/reservations-history')}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.bg }]}>
                  <Ionicons name={item.icon as any} size={22} color={colors.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{item.title}</Text>
                  <Text style={[styles.cardBody2, { color: theme.textMuted }]}>{item.body}</Text>
                  <Text style={[styles.cardTime, { color: theme.textDim }]}>{item.time}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  emptySubtitle: { fontSize: FONT_SIZE.body, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 4 },
  cardBody2: { fontSize: FONT_SIZE.body, lineHeight: 19, marginBottom: 6 },
  cardTime: { fontSize: FONT_SIZE.sm },
});
