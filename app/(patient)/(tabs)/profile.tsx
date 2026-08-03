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
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Svg, { Path } from 'react-native-svg';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import AvatarPickerSheet from '@/components/ui/AvatarPickerSheet';

const MENU_ITEMS = [
  { id: 'health', icon: 'fitness', label: 'Health Parameters', route: '/(patient)/health-profile' },
  { id: 'reservations', icon: 'receipt', label: 'My Reservations', route: '/(patient)/reservations-history' },
  { id: 'history', icon: 'time', label: 'Prescription History', route: '/(patient)/prescription-history' },
  { id: 'saved', icon: 'heart', label: 'Saved Medicines', route: '/(patient)/medicines' },
  { id: 'notifs', icon: 'notifications', label: 'Notifications', route: '/(patient)/notifications' },
  { id: 'help', icon: 'help-circle', label: 'Help & Feedback', route: '/(patient)/help-feedback' },
];

export default function Profile() {
  const router = useRouter();
  const { profile, user, signOut, updateProfile, uploadAvatar } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const { width } = useWindowDimensions();

  const [stats, setStats] = useState({ prescriptions: 0, reservations: 0 });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarSheetRef = useRef<BottomSheetModal>(null);

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
        {/* ── Blue Hero ── */}
        <View style={[styles.hero, { backgroundColor: primaryColor }]}>
          <Pressable style={({pressed})=>[styles.editAccountPill, pressed && {opacity: 0.5}, { position: 'absolute', right: 20, top: 30 }]} onPress={() => router.push('/(patient)/edit-account')}>
            <Ionicons name="pencil" size={12} color="#fff" />
            <Text style={styles.editAccountPillText}>Edit</Text>
          </Pressable>
          <Pressable style={({pressed})=>[styles.avatarWrapper, pressed && {opacity: 0.7}]} onPress={handlePickAvatar} disabled={uploadingAvatar}>
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

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSub}>{profile?.phone ?? 'N/A'}</Text>          
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

        <View style={{paddingVertical:SPACING.lg}}>
          {/* ── Stats Row ── */}
          <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <StatItem value={stats.prescriptions} label="Prescriptions" theme={theme} valueColor={primaryColor} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatItem value={stats.reservations} label="Reservations" theme={theme} valueColor={primaryColor} />
          </View>

          {/* ── Menu ── */}
          <View>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                style={({pressed})=>[styles.menuRow, { borderBottomColor: theme.background }, pressed && { opacity: 0.5 }]}
                onPress={() => item.route && router.push(item.route as any)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
                  <Ionicons name={item.icon as any} size={18} color={theme.textMuted} />
                </View>
                <Text style={[styles.menuLabel, { color: theme.text.primary }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.text} />
              </Pressable>
            ))}
          </View>

            {/* Logout */}
            <Pressable style={({pressed})=>[styles.signOut, {backgroundColor: theme.errorBg, borderColor: theme.error }, pressed && {opacity: 0.5}]} onPress={handleSignOut}>
              <View style={[styles.menuIconCircle, { backgroundColor: theme.errorBg }]}>
                <Ionicons name="log-out-outline" size={18} color={theme.error} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.error }]}>Logout</Text>
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
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, legacy: true });
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
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  avatarText: { fontSize: 28, fontWeight: '700' },
  heroName: { fontSize: FONT_SIZE.hero, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  heroSub: { fontSize: FONT_SIZE.lg, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  editAccountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    marginBottom: 12,
  },
  editAccountPillText: { color: '#ffffff', fontSize: FONT_SIZE.sm, fontWeight: '600' },

  // ── Stats ──
  statsCard: {
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FONT_SIZE.hero, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: FONT_SIZE.md },
  statDivider: { width: 1, marginVertical: 4 },

  // ── Menu ──
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: 'center',
    width: '95%',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginTop: 20,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
