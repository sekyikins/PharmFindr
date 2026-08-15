import React, { useEffect, useCallback } from 'react';
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
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore, type Notification } from '@/store/notificationStore';
import Skeleton from '@/components/ui/Skeleton';
import { Header, HeaderIconBtn } from '@/components/ui/Header';

const PHARMACY_GREEN = '#10b981';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function iconForType(type: Notification['type'], meta?: Record<string, any> | null) {
  const status = meta?.status as string | undefined;
  if (type === 'reservation') {
    if (status === 'pending')   return 'calendar-outline';
    if (status === 'cancelled') return 'close-circle-outline';
    return 'calendar-outline';
  }
  switch (type) {
    case 'prescription':    return 'document-text-outline';
    case 'pharmacy_action': return 'cube-outline';
    case 'system':          return 'information-circle-outline';
    default:                return 'notifications-outline';
  }
}

function colorForType(type: Notification['type'], meta?: Record<string, any> | null) {
  const status = meta?.status as string | undefined;
  if (type === 'reservation') {
    if (status === 'cancelled') return '#ef4444';
    return PHARMACY_GREEN;
  }
  return PHARMACY_GREEN;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PharmacyNotifications() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const { user } = useAuthStore();
  const {
    notifications,
    loading,
    refreshing,
    fetchNotifications,
    refreshNotifications,
    markRead,
    markAllRead,
    subscribe,
    unsubscribe,
    unreadCount,
  } = useNotificationStore();

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId);
    subscribe(userId);
    return () => unsubscribe();
  }, [userId]);

  const handleRefresh = useCallback(() => {
    if (userId) refreshNotifications(userId);
  }, [userId]);

  const handleMarkAllRead = useCallback(() => {
    if (userId) markAllRead(userId);
  }, [userId]);

  const handlePress = useCallback(async (item: Notification) => {
    if (!item.is_read) await markRead(item.id);

    const meta = item.metadata;
    if (item.type === 'reservation') {
      if (meta?.reservation_id) {
        router.push({
          pathname: '/(pharmacy)/pharmacy-reservation/[id]',
          params: { id: meta.reservation_id },
        });
      } else {
        router.push('/(pharmacy)/(tabs)/reservations');
      }
    } else if (item.type === 'pharmacy_action') {
      router.push('/(pharmacy)/(tabs)/inventory');
    }
  }, [markRead]);

  // ── Skeleton ───────────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={{ gap: 10, padding: SPACING.lg }}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={72} borderRadius={14} />
      ))}
    </View>
  );

  // ── Item ───────────────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: Notification }) => {
    const iconName = iconForType(item.type, item.metadata);
    const iconColor = colorForType(item.type, item.metadata);
    const iconBg = item.is_read ? theme.surfaceSecondary : `${iconColor}22`;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: item.is_read ? theme.card : `${iconColor}0d`,
            borderColor: theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={styles.itemBody}>
          <Text style={[styles.itemTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.itemMsg, { color: theme.textMuted }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.itemTime, { color: theme.textDim }]}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
        {!item.is_read && (
          <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />
        )}
      </Pressable>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasUnread = unreadCount > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Notifications"
        showBack
        onBack={() => router.back()}
        right={
          hasUnread ? (
            <HeaderIconBtn
              name="checkmark-done-outline"
              onPress={handleMarkAllRead}
              color={PHARMACY_GREEN}
            />
          ) : undefined
        }
      />

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PHARMACY_GREEN}
              colors={[PHARMACY_GREEN]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No notifications yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                New reservations and system alerts will appear here.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  itemMsg: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
  },
  emptySub: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
