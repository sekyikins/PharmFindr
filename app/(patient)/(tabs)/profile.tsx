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
  Image,
  Modal,
  TextInput,
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

const MENU_ITEMS = [
  { id: 'health', icon: 'fitness-outline', label: 'Health Parameters', route: '/(patient)/health-profile' },
  { id: 'reservations', icon: 'receipt-outline', label: 'My Reservations', route: '/(patient)/reservations-history' },
  { id: 'history', icon: 'time-outline', label: 'Prescription History', route: '/(patient)/prescription-history' },
  { id: 'saved', icon: 'heart-outline', label: 'Saved Medicines', route: '/(patient)/medicines' },
  { id: 'notifs', icon: 'notifications-outline', label: 'Notifications', route: '/(patient)/notifications' },
  { id: 'help', icon: 'help-circle-outline', label: 'Help & Feedback', route: '/(patient)/help-feedback' },
];

export default function Profile() {
  const router = useRouter();
  const { profile, user, signOut, updateProfile, uploadAvatar } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();
  const { width } = useWindowDimensions();

  const [stats, setStats] = useState({ prescriptions: 0, reservations: 0 });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit Account Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name ?? '');
  const [editPhone, setEditPhone] = useState(profile?.phone ?? '');
  const [editPassword, setEditPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name ?? '');
      setEditPhone(profile.phone ?? '');
    }
  }, [profile]);

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
            router.replace('/(auth)/login');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handlePickAvatar = async () => {
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Permission Denied', 'Camera permission is required.', [{ text: 'OK' }, { text: 'Cancel', style: 'cancel' }], { cancelable: true });
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setUploadingAvatar(true);
              await uploadAvatar(result.assets[0].uri);
              setUploadingAvatar(false);
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
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
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSaveAccount = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty.');
      return;
    }
    setSavingAccount(true);
    try {
      // 1. Update Profile table
      await updateProfile({
        full_name: editName.trim(),
        phone: editPhone.trim(),
      });

      // 2. Update Password if provided
      if (editPassword.trim()) {
        const { error } = await supabase.auth.updateUser({ password: editPassword.trim() });
        if (error) throw error;
      }

      Alert.alert('Success', 'Account information updated successfully!');
      setEditModalVisible(false);
      setEditPassword('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update account.');
    } finally {
      setSavingAccount(false);
    }
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
          <Pressable style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
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

          <Pressable style={styles.editAccountPill} onPress={() => router.push('/(patient)/edit-account')}>
            <Ionicons name="pencil" size={12} color="#fff" />
            <Text style={styles.editAccountPillText}>Edit Account Details</Text>
          </Pressable>
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

      {/* Account Details Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable style={[styles.editModalCard, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.editModalTitle, { color: theme.text.primary }]}>Edit Account Details</Text>

            <Text style={[styles.fieldLabel, { color: theme.textDim }]}>FULL NAME</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full Name"
              placeholderTextColor={theme.textDim}
            />

            <Text style={[styles.fieldLabel, { color: theme.textDim }]}>PHONE NUMBER</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+233..."
              placeholderTextColor={theme.textDim}
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { color: theme.textDim }]}>NEW PASSWORD (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editPassword}
              onChangeText={setEditPassword}
              placeholder="Leave blank to keep current"
              placeholderTextColor={theme.textDim}
              secureTextEntry
            />

            <View style={styles.modalActionRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: theme.border }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.modalBtnCancelText, { color: theme.text.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtnSave, { backgroundColor: primaryColor }]} onPress={handleSaveAccount} disabled={savingAccount}>
                {savingAccount ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  heroSub: { fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
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

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalCard: {
    width: '90%',
    borderRadius: RADIUS.xl,
    padding: 22,
    elevation: 8,
  },
  editModalTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: FONT_SIZE.body,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancelText: { fontWeight: '600', fontSize: FONT_SIZE.body },
  modalBtnSave: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSaveText: { color: '#ffffff', fontWeight: '700', fontSize: FONT_SIZE.body },
});
