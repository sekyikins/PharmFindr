import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Alert,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Svg, { Path } from 'react-native-svg';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import AvatarPickerSheet from '@/components/ui/AvatarPickerSheet';

const MENU_GROUPS = [
  {
    title: 'CLINICAL & HEALTH',
    items: [
      { id: 'history', icon: 'time', color: COLORS.info, label: 'Prescription History', route: '/(patient)/prescription-history' },
      { id: 'saved', icon: 'heart', color: COLORS.pink, label: 'Saved Medicines', route: '/(patient)/medicines' },
    ],
  },
  {
    title: 'ACTIVITY & ORDERS',
    items: [
      { id: 'reservations', icon: 'receipt', color: COLORS.purple, label: 'My Reservations', route: '/(patient)/reservations-history' },
      { id: 'notifs', icon: 'notifications', color: COLORS.warning, label: 'Notifications', route: '/(patient)/notifications' },
    ],
  },
  {
    title: 'SUPPORT & LEGAL',
    items: [
      { id: 'help', icon: 'help-circle', color: COLORS.cyan, label: 'Help & Feedback', route: '/(patient)/help-feedback' },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { profile, appUser, user, signOut, refreshProfile, fetchAppUser, updateProfile, uploadAvatar } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const { width } = useWindowDimensions();

  const [stats, setStats] = useState({ prescriptions: 0, reservations: 0, saved: 0 });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarSheetRef = useRef<BottomSheetModal>(null);

  const displayName = profile?.full_name || appUser?.full_name || 'Patient Profile';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ count: rxCount }, { count: resCount }] = await Promise.all([
        supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        prescriptions: rxCount ?? 0,
        reservations: resCount ?? 0,
        saved: (appUser?.allergies?.length || 0) + (appUser?.existing_conditions?.length || 0),
      });
    } catch (e: any) {
      console.warn('Error fetching profile stats:', e.message);
    }
  }, [user?.id, appUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await Promise.all([
        refreshProfile(),
        fetchAppUser(),
        fetchStats(),
      ]);
    }
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace({ pathname: '/(auth)/login', params: { initialRole: 'patient' } });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handlePickAvatar = () => {
    avatarSheetRef.current?.present();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
        }
      >
        {/* ── Premium Hero Header ── */}
        <View style={[styles.hero, { backgroundColor: primaryColor }]}>
          {/* Top Row: Verification & Edit */}
          <View style={styles.heroTopRow}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.white} />
              <Text style={styles.verifiedBadgeText}>Verified Account</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.editAccountPill, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(patient)/edit-account')}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.white} />
              <Text style={styles.editAccountPillText}>Edit Profile</Text>
            </Pressable>
          </View>

          {/* Avatar */}
          <Pressable
            style={({ pressed }) => [styles.avatarWrapper, pressed && { opacity: 0.8 }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <View style={styles.avatarCircle}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: primaryColor }]}>{initials}</Text>
              )}
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: theme.card }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name="camera" size={14} color={primaryColor} />
              )}
            </View>
          </Pressable>

          {/* User Details */}
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSub}>{profile?.phone || user?.email || 'PharmFindr Patient'}</Text>
        </View>

        {/* SVG Wave Transition */}
        <View style={{ backgroundColor: primaryColor }}>
          <Svg width={width} height={22} viewBox={`0 0 ${width} 22`} style={{ display: 'flex' }}>
            <Path d={`M0,22 Q${width / 2},0 ${width},22 L${width},22 L0,22 Z`} fill={theme.background} />
          </Svg>
        </View>

        <View style={styles.bodyContent}>
          {/* ── Stats Card ── */}
          <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <StatItem value={stats.prescriptions} label="Prescriptions" icon="receipt-outline" theme={theme} valueColor={primaryColor} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatItem value={stats.reservations} label="Reservations" icon="time-outline" theme={theme} valueColor={primaryColor} />
          </View>

          {/* ── Clinical Protection Quick Banner ── */}
          <Pressable
            style={({ pressed }) => [
              styles.healthQuickCard,
              { backgroundColor: theme.card, borderColor: primaryColor + '30' },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/(patient)/health-profile')}
          >
            <View style={[styles.healthQuickIconCircle, { backgroundColor: primaryColor + '15' }]}>
              <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.healthQuickTitleRow}>
                <Text style={[styles.healthQuickTitle, { color: theme.text.primary }]}>Health &amp; Safety Profile</Text>
              </View>
              <Text style={[styles.healthQuickSub, { color: theme.textMuted }]}>
                {appUser?.allergies?.length || 0} Allergies • {appUser?.existing_conditions?.length || 0} Conditions • {appUser?.current_medications?.length || 0} Meds
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          {/* ── Categorized Menu Groups ── */}
          {MENU_GROUPS.map((group) => (
            <View key={group.title} style={styles.menuGroup}>
              <Text style={[styles.groupTitle, { color: theme.textDim }]}>{group.title}</Text>
              <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {group.items.map((item, idx) => {
                  const isLast = idx === group.items.length - 1;
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.menuRow,
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                        pressed && { backgroundColor: theme.surfaceSecondary },
                      ]}
                      onPress={() => item.route && router.push(item.route as any)}
                    >
                      <View style={[styles.menuIconCircle, { backgroundColor: item.color + '15' }]}>
                        <Ionicons name={item.icon as any} size={18} color={item.color} />
                      </View>
                      <Text style={[styles.menuLabel, { color: theme.text.primary }]}>{item.label}</Text>

                      <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutBtn,
              { backgroundColor: theme.errorBg, borderColor: theme.error + '40' },
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
            <Text style={[styles.signOutText, { color: theme.error }]}>Log Out of Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AvatarPickerSheet
        ref={avatarSheetRef}
        hasPhoto={!!profile?.avatar_url}
        onCamera={async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Denied', 'Camera permission is required.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setUploadingAvatar(true);
            await uploadAvatar(result.assets[0].uri);
            setUploadingAvatar(false);
          }
        }}
        onGallery={async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Denied', 'Media library permission is required.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            legacy: true,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            setUploadingAvatar(true);
            await uploadAvatar(result.assets[0].uri);
            setUploadingAvatar(false);
          }
        }}
        onRemove={async () => {
          setUploadingAvatar(true);
          await updateProfile({ avatar_url: null });
          setUploadingAvatar(false);
        }}
      />
    </SafeAreaView>
  );
}

function StatItem({ value, label, icon, theme, valueColor }: { value: number; label: string; icon: string; theme: any; valueColor: string }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconRow}>
        <Ionicons name={icon as any} size={15} color={valueColor} />
        <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    paddingHorizontal: SPACING.xl
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill
  },
  verifiedBadgeText: {
    color: COLORS.white, fontSize: 11, fontFamily: 'Inter-Bold'
  },

  editAccountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill
  },
  editAccountPillText: {
    color: COLORS.white, fontSize: 12, fontFamily: 'Inter-Bold'
  },

  avatarWrapper: {
    position: 'relative',
    marginBottom: 10
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white
  },
  avatarText: {
    fontSize: 30, fontFamily: 'Inter-Bold'
  },
  heroName: {
    fontSize: 22, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 2
  },
  heroSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8
  },

  bodyContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md
  },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1.2,
    marginBottom: 16
  },
  statItem: {
    flex: 1, alignItems: 'center'
  },
  statIconRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2
  },
  statValue: {
    fontSize: 22, fontFamily: 'Inter-Bold'
  },
  statLabel: {
    fontSize: 12, fontFamily: 'Inter-SemiBold'
  },
  statDivider: {
    width: 1, marginVertical: 4
  },

  // Health Quick Banner
  healthQuickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    marginBottom: 20
  },
  healthQuickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  healthQuickTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  healthQuickTitle: {
    fontSize: 14, fontFamily: 'Inter-Bold'
  },
  healthQuickSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 11, marginTop: 2
  },

  // Menu Groups
  menuGroup: {
    marginBottom: 18
  },
  groupTitle: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4
  },
  menuCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  menuLabel: {
    flex: 1, fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold'
  },
  itemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8
  },
  itemBadgeText: {
    fontSize: 10, fontFamily: 'Inter-Bold'
  },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginVertical: 8
  },
  signOutText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },

});
