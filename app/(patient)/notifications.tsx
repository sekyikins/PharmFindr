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
import { useHardwareBack } from '@/hooks/useHardwareBack';

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

function iconForType(type: Notification['type'], metadata?: Record<string, any> | null) {
  const status = metadata?.status as string | undefined;

  if (type === 'reservation') {
    switch (status) {
      case 'accepted':  return 'checkmark-circle-outline';
      case 'declined':  return 'close-circle-outline';
      case 'collected': return 'bag-check-outline';
      case 'expired':   return 'time-outline';
      default:          return 'time-outline';
    }
  }
  switch (type) {
    case 'availability':    return 'storefront-outline';
    case 'medication':      return 'medkit-outline';
    case 'prescription':    return 'document-text-outline';
    case 'collection':      return 'bag-check-outline';
    case 'pharmacy_action': return 'cube-outline';
    case 'system':          return 'information-circle-outline';
    default:                return 'notifications-outline';
  }
}

function colorKeyForType(type: Notification['type'], metadata?: Record<string, any> | null) {
  const status = metadata?.status as string | undefined;

  if (type === 'reservation') {
    if (status === 'accepted')  return 'confirmed';
    if (status === 'declined')  return 'declined';
    if (status === 'collected') return 'confirmed';
    if (status === 'expired')   return 'pending';
    return 'pending';
  }
  return 'info';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
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
  } = useNotificationStore();

  const userId = user?.id;

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/home');
    }
    return true;
  });

  // Fetch + subscribe on mount
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

  const handlePressNotification = useCallback(
    async (item: Notification) => {
      if (!item.is_read) await markRead(item.id);

      const meta = item.metadata;
      switch (item.type) {
        case 'reservation':
        case 'collection':
          router.push('/(patient)/reservations-history');
          break;
        case 'prescription':
          router.push('/(patient)/prescription-history');
          break;
        case 'availability':
          router.push('/(patient)/(tabs)/search');
          break;
        case 'medication':
          router.push('/(patient)/(tabs)/home');
          break;
        default:
          break; // system/info — no navigation
      }
    },
    [markRead]
  );

  // ── Theme maps ─────────────────────────────────────────────────────────────

  const getColors = (colorKey: string) => {
    switch (colorKey) {
      case 'confirmed': return { bg: theme.successBg,        color: theme.success };
      case 'declined':  return { bg: theme.errorBg,          color: theme.error };
      case 'pending':   return { bg: theme.pendingBg,        color: theme.warning };
      case 'info':
      default:          return { bg: theme.patientSecondary, color: primaryColor };
    }
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Skeleton width={44} height={44} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header
        title="Notifications"
        showBack
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.navigate('/(patient)/(tabs)/home');
          }
        }}
        right={
          hasUnread ? (
            <HeaderIconBtn
              name="checkmark-done-outline"
              onPress={handleMarkAllRead}
              color={primaryColor}
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Reservation updates and other alerts will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const colorKey = colorKeyForType(item.type, item.metadata);
            const colors   = getColors(colorKey);
            const icon     = iconForType(item.type, item.metadata);
            const isUnread = !item.is_read;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.5 },
                  { backgroundColor: theme.card, borderColor: isUnread ? primaryColor : theme.border },
                  isUnread && styles.unreadCard,
                ]}
                onPress={() => handlePressNotification(item)}
              >
                {/* Unread dot */}
                {isUnread && (
                  <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} />
                )}

                <View style={[styles.iconCircle, { backgroundColor: colors.bg }]}>
                  <Ionicons name={icon as any} size={22} color={colors.color} />
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{item.title}</Text>
                  <Text style={[styles.cardMessage, { color: theme.textMuted }]}>{item.message}</Text>
                  <Text style={[styles.cardTime, { color: theme.textDim }]}>{timeAgo(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  listContent: {
    padding: SPACING.lg, gap: 12
  },

  emptyContainer: {
    alignItems: 'center', marginTop: 80, gap: 10
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl, fontFamily: 'Inter-Bold'
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.lg, textAlign: 'center'
  },

  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 14,
    borderWidth: 1,
    position: 'relative'
  },
  unreadCard: {
    borderWidth: 1.5
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0
  },
  cardBody: {
    flex: 1
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold', marginBottom: 4
  },
  cardMessage: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, lineHeight:20, marginBottom: 6
  },
  cardTime: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm
  },

});
