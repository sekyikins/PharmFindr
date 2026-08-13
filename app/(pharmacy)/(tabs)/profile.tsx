import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import AvatarPickerSheet from '@/components/ui/AvatarPickerSheet';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';
import {
  getBiometricsPreference,
  setBiometricsPreference,
  getBiometricType,
  getBiometricIcon,
  isBiometricsSupported,
  isBiometricsEnrolled,
  authenticateBiometrics,
} from '@/lib/biometrics';

const PHARMACY_GREEN = '#10b981';

export default function PharmacyProfile() {
  const router = useRouter();
  const { user, profile, signOut, updateProfile, uploadAvatar, refreshProfile } = useAuthStore();
  const { theme } = useThemeContext();

  const [pharmId, setPharmId] = useState<string | null>(null);
  const [pharmacyName, setPharmacyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [isVerified, setIsVerified] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricIcon, setBiometricIcon] = useState('scan-outline');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit BottomSheet State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Change Password BottomSheet State
  const [newPassword, setNewPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const avatarSheetRef = useRef<BottomSheetModal>(null);
  const editSheetRef = useRef<BottomSheetModal>(null);
  const pwdSheetRef = useRef<BottomSheetModal>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let { data: pharm } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!pharm) {
        let query = supabase.from('pharmacies').select('*');
        if (user.phone) {
          query = query.eq('phone', user.phone);
        } else if (user.email) {
          query = query.eq('email', user.email);
        }

        const { data: fallbackPharm } = await query.maybeSingle();
        if (fallbackPharm) {
          pharm = fallbackPharm;
          await supabase.from('pharmacies').update({ owner_id: user.id }).eq('id', pharm.id);
        }
      }

      if (!pharm) {
        const defaultName = profile?.full_name || 'My Pharmacy';
        const { data: newPharm } = await supabase
          .from('pharmacies')
          .insert({
            owner_id: user.id,
            name: defaultName,
            phone: user.phone || profile?.phone || '',
            email: user.email || null,
            address: 'Main Street',
            verified: false,
          })
          .select('*')
          .single();

        if (newPharm) pharm = newPharm;
      }

      if (pharm) {
        setPharmId(pharm.id);
        setPharmacyName(pharm.name || 'My Pharmacy');
        setAddress(pharm.address || 'Main Street');
        setPhone(pharm.phone || user.phone || '');
        setOpeningTime(pharm.opening_time || '08:00');
        setClosingTime(pharm.closing_time || '20:00');
        setIsVerified(pharm.verified ?? false);

        setEditName(pharm.name || '');
        setEditPhone(pharm.phone || '');
        setEditAddress(pharm.address || '');
      }
    } catch (e: any) {
      console.warn('Error fetching pharmacy profile:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchProfile();
    const initBio = async () => {
      const pref = await getBiometricsPreference();
      setBiometricsEnabled(pref);
      const label = await getBiometricType();
      const icon = await getBiometricIcon();
      setBiometricType(label);
      setBiometricIcon(icon);
    };
    initBio();
  }, [fetchProfile]);

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      const confirmed = await authenticateBiometrics('Confirm your biometrics to enable biometric lock');
      if (!confirmed) {
        setBiometricsEnabled(false);
        await setBiometricsPreference(false);
        return;
      }
    }

    setBiometricsEnabled(val);
    await setBiometricsPreference(val);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProfile(),
      refreshProfile(),
    ]);
    setRefreshing(false);
  };

  const handlePickAvatar = () => {
    avatarSheetRef.current?.present();
  };

  const handleVerifyPharmacy = async () => {
    if (!pharmId) return;
    try {
      const { error } = await supabase
        .from('pharmacies')
        .update({ verified: true })
        .eq('id', pharmId);

      if (error) throw error;
      setIsVerified(true);
      Alert.alert('Verification Completed!', 'Your pharmacy account has been verified and fully registered on PharmFindr.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to complete verification.');
    }
  };

  const handleSaveInfo = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Pharmacy name cannot be empty.');
      return;
    }
    setSavingEdit(true);
    try {
      if (pharmId) {
        const { error } = await supabase
          .from('pharmacies')
          .update({
            name: editName.trim(),
            phone: editPhone.trim(),
            address: editAddress.trim(),
          })
          .eq('id', pharmId);

        if (error) throw error;
      }

      setPharmacyName(editName.trim());
      setPhone(editPhone.trim());
      setAddress(editAddress.trim());

      await updateProfile({
        full_name: editName.trim(),
        phone: editPhone.trim(),
      });

      Alert.alert('Saved', 'Pharmacy details updated successfully!');
      editSheetRef.current?.dismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save pharmacy info.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Invalid', 'Password must be at least 6 characters.');
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;
      Alert.alert('Success', 'Password changed successfully!');
      setNewPassword('');
      pwdSheetRef.current?.dismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your pharmacy account?',
      [
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace({ pathname: '/(auth)/login', params: { initialRole: 'pharmacy' } });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Pharmacy Profile" />

      {loading ? (
        <View style={styles.scrollContent}>
          <Skeleton width="100%" height={160} borderRadius={16} />
          <Skeleton width="100%" height={220} borderRadius={16} style={{ marginTop: 16 }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PHARMACY_GREEN}
              colors={[PHARMACY_GREEN]}
            />
          }
        >
          {/* ── 1. Hero Summary Card ── */}
          <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
              <View style={styles.avatarCircle}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="storefront" size={32} color={PHARMACY_GREEN} />
                )}
              </View>
              <View style={styles.cameraBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="camera" size={12} color={COLORS.white} />
                )}
              </View>
            </Pressable>

            <Text style={[styles.pharmacyTitle, { color: theme.text.primary }]}>{pharmacyName}</Text>
            <Text style={[styles.pharmacySub, { color: theme.textMuted }]}>{address}</Text>

            <View style={styles.statusRow}>
              <Pressable
                style={[
                  styles.statusBadge,
                  isVerified
                    ? { backgroundColor: '#ecfdf5', borderColor: COLORS.successBorder }
                    : { backgroundColor: '#fffbeb', borderColor: COLORS.pendingBg },
                ]}
                onPress={!isVerified ? handleVerifyPharmacy : undefined}
              >
                <Ionicons
                  name={isVerified ? 'shield-checkmark' : 'time-outline'}
                  size={13}
                  color={isVerified ? COLORS.pharmacyTextDark : '#b45309'}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isVerified ? COLORS.pharmacyTextDark : '#b45309' },
                  ]}
                >
                  {isVerified ? 'VERIFIED LICENSE' : 'REGISTRATION PENDING — TAP TO VERIFY'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── 2. Pharmacy Settings Group ── */}
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PHARMACY INFORMATION</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
              onPress={() => editSheetRef.current?.present()}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.patientSecondary }]}>
                <Ionicons name="create-outline" size={18} color={COLORS.patientPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Pharmacy Details</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Name, phone, and address</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(pharmacy)/operating-hours')}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="time-outline" size={18} color={PHARMACY_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Operating Hours</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                  {openingTime && closingTime ? `${openingTime} – ${closingTime}` : 'Set daily schedule'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* ── 3. Preferences & Security Group ── */}
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PREFERENCES & SECURITY</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowItem}>
              <View style={[styles.iconWrap, { backgroundColor: '#f5f3ff' }]}>
                <Ionicons name="notifications-outline" size={18} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Reservation Alerts</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Push notifications for new orders</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: COLORS.borderSlate, true: COLORS.successBorder }}
                thumbColor={notificationsEnabled ? PHARMACY_GREEN : COLORS.surfaceSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.rowItem}>
              <View style={[styles.iconWrap, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name={biometricIcon as any} size={18} color={PHARMACY_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Use {biometricType}</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Require {biometricType} on app launch</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: COLORS.borderSlate, true: COLORS.successBorder }}
                thumbColor={biometricsEnabled ? PHARMACY_GREEN : COLORS.surfaceSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
              onPress={() => pwdSheetRef.current?.present()}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Account Security</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Change password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* ── 4. Support & Sign Out ── */}
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SUPPORT & ACCOUNT</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(patient)/help-feedback')}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.surfaceSecondary }]}>
                <Ionicons name="help-circle-outline" size={18} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Help & Feedback</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Contact support or give feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: COLORS.errorBg, borderColor: '#fecaca' },
            ]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Edit Info BottomSheet ── */}
      <AppBottomSheet ref={editSheetRef} title="Edit Pharmacy Details">
        <View style={styles.sheetContent}>
          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>PHARMACY NAME</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="City Care Pharmacy"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>PHONE NUMBER</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="+233 20 000 0000"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>ADDRESS / LOCATION</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Main Street, Accra"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: PHARMACY_GREEN },
              ]}
              onPress={handleSaveInfo}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save Details</Text>
              )}
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* ── Change Password BottomSheet ── */}
      <AppBottomSheet ref={pwdSheetRef} title="Change Password">
        <View style={styles.sheetContent}>
          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>NEW PASSWORD</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: PHARMACY_GREEN },
              ]}
              onPress={handleChangePassword}
              disabled={savingPwd}
            >
              {savingPwd ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* Avatar Bottom Sheet Picker */}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: SPACING.xl, gap: 12
  },

  heroCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    gap: 6
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 6
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PHARMACY_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white
  },

  pharmacyTitle: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold'
  },
  pharmacySub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md
  },
  statusRow: {
    marginTop: 4
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },

  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    marginTop: 10,
    marginLeft: 4
  },
  cardGroup: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    overflow: 'hidden'
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: 12
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  rowSub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: 12,
    marginTop: 2
  },
  divider: {
    height: 1,
    width: '100%'
  },

  signOutBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    marginTop: 16
  },
  signOutText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },

  sheetContent: {
    padding: SPACING.lg,
    gap: 14
  },
  modalField: {
    gap: 4
  },
  modalLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },
  modalInput: {
    fontFamily: 'Inter-Regular',
    
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    fontSize: FONT_SIZE.lg
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },
  saveBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },

});
