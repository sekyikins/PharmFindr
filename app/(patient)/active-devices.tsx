import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Header } from '@/components/ui/Header';
import { getDeviceId, revokeSpecificDeviceSession, revokeAllOtherSessions } from '@/lib/deviceSession';
import { logAuditEvent } from '@/lib/auditLogger';
import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING } from '@/styles/theme';
import { useHardwareBack } from '@/hooks/useHardwareBack';

interface SessionItem {
  device_id: string;
  platform: string;
  last_seen: string;
}

export default function ActiveDevicesScreen() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
    return true;
  };

  useHardwareBack(handleGoBack);

  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const devId = await getDeviceId();
      setCurrentDeviceId(devId);

      const { data: userRes } = await supabase.auth.getUser();
      const metadata = userRes?.user?.user_metadata || {};
      const activeList: SessionItem[] = metadata.active_sessions || [];
      setSessions(activeList);
    } catch (e) {
      console.warn('Error loading active devices:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSingle = (session: SessionItem) => {
    Alert.alert(
      'Revoke Device Session',
      `Are you sure you want to log out the device (${session.platform.toUpperCase()})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const updated = await revokeSpecificDeviceSession(session.device_id);
            setSessions(updated);
            await logAuditEvent({
              action: 'DEVICE_SESSION_REVOKED',
              resourceType: 'device_session',
              resourceId: session.device_id,
              metadata: { platform: session.platform },
            });
            setLoading(false);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRevokeAllOther = () => {
    Alert.alert(
      'Revoke All Other Devices',
      'This will immediately log out all active sessions on other devices except this current device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All Others',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await revokeAllOtherSessions();
            await loadSessions();
            await logAuditEvent({
              action: 'DEVICE_SESSION_REVOKED',
              resourceType: 'device_session',
              metadata: { scope: 'all_other_devices' },
            });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const otherSessionsCount = sessions.filter((s) => s.device_id !== currentDeviceId).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Active Devices"
        showBack
        onBack={handleGoBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSessions} tintColor={primaryColor} />}
      >
        {/* Banner Rationale */}
        <View style={[styles.bannerCard, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>Active Device Management</Text>
            <Text style={[styles.bannerSub, { color: theme.textMuted }]}>
              These devices are currently logged into your account. Revoke any unrecognized session immediately to safeguard your medical charts.
            </Text>
          </View>
        </View>

        {/* Global Action Header */}
        {otherSessionsCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.revokeAllBtn, pressed && { opacity: 0.7 }, { backgroundColor: theme.errorBg, borderColor: theme.error }]}
            onPress={handleRevokeAllOther}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={[styles.revokeAllText, { color: theme.error }]}>
              Revoke All {otherSessionsCount} Other Devices
            </Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>LOGGED-IN DEVICES ({sessions.length})</Text>

        {loading && sessions.length === 0 ? (
          <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 40 }} />
        ) : (
          sessions.map((item) => {
            const isCurrent = item.device_id === currentDeviceId;
            const formattedDate = new Date(item.last_seen).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View
                key={item.device_id}
                style={[
                  styles.deviceCard,
                  { backgroundColor: theme.card, borderColor: isCurrent ? primaryColor : theme.border },
                  isCurrent && { borderWidth: 1.5 },
                ]}
              >
                <View style={[styles.deviceIconCircle, { backgroundColor: isCurrent ? primaryColor + '20' : theme.surfaceSecondary }]}>
                  <Ionicons
                    name={item.platform === 'ios' || item.platform === 'android' ? 'phone-portrait-outline' : 'desktop-outline'}
                    size={22}
                    color={isCurrent ? primaryColor : theme.textMuted}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.devicePlatform, { color: theme.text.primary }]}>
                      {item.platform.toUpperCase()} DEVICE
                    </Text>
                    {isCurrent && (
                      <View style={[styles.thisDeviceBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.thisDeviceText}>THIS DEVICE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.deviceMeta, { color: theme.textDim }]} numberOfLines={1}>
                    ID: {item.device_id.slice(0, 18)}...
                  </Text>
                  <Text style={[styles.deviceTime, { color: theme.textMuted }]}>Last Active: {formattedDate}</Text>
                </View>

                {!isCurrent && (
                  <Pressable
                    style={({ pressed }) => [styles.revokeSingleBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => handleRevokeSingle(item)}
                  >
                    <Text style={[styles.revokeSingleText, { color: theme.error }]}>Revoke</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  bannerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  revokeAllBtn: {
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  revokeAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devicePlatform: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  thisDeviceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  thisDeviceText: {
    color: COLORS.white,
    fontSize: 9,
    fontFamily: 'Inter-Bold',
  },
  deviceMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  deviceTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 4,
  },
  revokeSingleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  revokeSingleText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },
});
