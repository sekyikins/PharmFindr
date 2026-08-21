import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { getPharmacyForUser } from '@/lib/pharmacyService';
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
  authenticateBiometrics,
} from '@/lib/biometrics';
import { hasAppPin, setAppPin, removeAppPin } from '@/lib/appPin';

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

  // 4-Digit App Security PIN State
  const [hasPin, setHasPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const avatarSheetRef = useRef<BottomSheetModal>(null);
  const editSheetRef = useRef<BottomSheetModal>(null);
  const pinSheetRef = useRef<BottomSheetModal>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let pharm = await getPharmacyForUser(user);

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
            is_verified: false,
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
        setIsVerified(pharm.is_verified ?? pharm.isVerified ?? false);

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
    const initSecurity = async () => {
      const [pref, pinExists, label, icon] = await Promise.all([
        getBiometricsPreference(),
        hasAppPin(),
        getBiometricType(),
        getBiometricIcon(),
      ]);
      setBiometricsEnabled(pref);
      setHasPin(pinExists);
      setBiometricType(label);
      setBiometricIcon(icon);
    };
    initSecurity();
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
      hasAppPin().then(setHasPin),
      user?.id ? useNotificationStore.getState().fetchNotifications(user.id) : Promise.resolve(),
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
        .update({ is_verified: true })
        .eq('id', pharmId);

      if (error) throw error;
      setIsVerified(true);
      toast.success('Verification Completed!', 'Your pharmacy has been fully registered on PharmFindr.');
    } catch (e: any) {
      toast.error('Verification Failed', getFriendlyErrorMessage(e, 'Failed to complete verification. Please try again.'));
    }
  };

  const handleSaveInfo = async () => {
    if (!editName.trim()) {
      toast.error('Required', 'Pharmacy name cannot be empty.');
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

      toast.success('Saved', 'Pharmacy details updated successfully!');
      editSheetRef.current?.dismiss();
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to save pharmacy info. Please try again.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSavePin = async () => {
    const cleanPin = pinInput.trim();
    const cleanConfirm = confirmPinInput.trim();

    if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      toast.error('Invalid PIN', 'Please enter a 4-digit numeric PIN.');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      toast.error('Mismatch', 'PIN entries do not match.');
      return;
    }

    setSavingPin(true);
    try {
      const saved = await setAppPin(cleanPin);
      if (!saved) throw new Error('Could not save PIN.');
      setHasPin(true);
      toast.success('PIN Configured', '4-digit app security PIN saved successfully!');
      setPinInput('');
      setConfirmPinInput('');
      pinSheetRef.current?.dismiss();
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to save PIN. Please try again.'));
    } finally {
      setSavingPin(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your pharmacy account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace({ pathname: '/(auth)/login', params: { initialRole: 'pharmacy' } });
          },
        },
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
          <Skeleton width="100%" height={220} borderRadius={16} style={{ marginTop: SPACING.lg }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.pharmacyPrimary}
              colors={[COLORS.pharmacyPrimary]}
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
                  <Ionicons name="storefront" size={32} color={COLORS.pharmacyPrimary} />
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
                    ? { backgroundColor: COLORS.pharmacySecondary, borderColor: COLORS.successBorder }
                    : { backgroundColor: COLORS.pendingBg, borderColor: COLORS.pendingBg },
                ]}
                onPress={!isVerified ? handleVerifyPharmacy : undefined}
              >
                <Ionicons
                  name={isVerified ? 'shield-checkmark' : 'time-outline'}
                  size={13}
                  color={isVerified ? COLORS.pharmacyTextDark : COLORS.pendingText}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isVerified ? COLORS.pharmacyTextDark : COLORS.pendingText },
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
              <View style={[styles.iconWrap, { backgroundColor: COLORS.pharmacySecondary }]}>
                <Ionicons name="time-outline" size={18} color={COLORS.pharmacyPrimary} />
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
              <View style={[styles.iconWrap, { backgroundColor: COLORS.surfaceSecondary }]}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Reservation Alerts</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Push notifications for new orders</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: COLORS.borderSlate, true: COLORS.successBorder }}
                thumbColor={notificationsEnabled ? COLORS.pharmacyPrimary : COLORS.surfaceSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.rowItem}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.pharmacySecondary }]}>
                <Ionicons name={biometricIcon as any} size={18} color={COLORS.pharmacyPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>Use {biometricType}</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>Require {biometricType} on app launch</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: COLORS.borderSlate, true: COLORS.successBorder }}
                thumbColor={biometricsEnabled ? COLORS.pharmacyPrimary : COLORS.surfaceSecondary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setPinInput('');
                setConfirmPinInput('');
                pinSheetRef.current?.present();
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.pendingBg }]}>
                <Ionicons name="keypad-outline" size={18} color={COLORS.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text.primary }]}>App Security PIN</Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                  {hasPin ? '4-Digit PIN configured' : 'Set 4-digit PIN to lock app'}
                </Text>
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
                <Ionicons name="help-circle-outline" size={18} color={COLORS.textSecondary} />
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
              { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder },
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
                { backgroundColor: COLORS.pharmacyPrimary },
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

      {/* ── 4-Digit Security PIN BottomSheet ── */}
      <AppBottomSheet ref={pinSheetRef} title={hasPin ? 'Change Security PIN' : 'Set 4-Digit Security PIN'}>
        <View style={styles.sheetContent}>
          <Text style={[styles.modalSub, { color: theme.textMuted }]}>
            This 4-digit PIN is used to lock and unlock your pharmacy dashboard whenever you exit or leave the app.
          </Text>

          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>4-DIGIT PIN</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border, letterSpacing: 8, textAlign: 'center', fontSize: FONT_SIZE.xxl, fontWeight: '700' }]}
              value={pinInput}
              onChangeText={(text) => setPinInput(text.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>CONFIRM 4-DIGIT PIN</Text>
            <BottomSheetTextInput
              style={[styles.modalInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border, letterSpacing: 8, textAlign: 'center', fontSize: FONT_SIZE.xxl, fontWeight: '700' }]}
              value={confirmPinInput}
              onChangeText={(text) => setConfirmPinInput(text.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: COLORS.pharmacyPrimary },
              ]}
              onPress={handleSavePin}
              disabled={savingPin}
            >
              {savingPin ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>{hasPin ? 'Update PIN' : 'Set PIN'}</Text>
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
            toast.error('Permission Denied', 'Camera permission is required.');
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
            toast.error('Permission Denied', 'Media library permission is required.');
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
    padding: SPACING.xl, gap: SPACING.md
  },

  heroCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    gap: SPACING.xs
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: SPACING.xs
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.pharmacySecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.pill
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.pharmacyPrimary,
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
    marginTop: SPACING.xs
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },

  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    marginTop: SPACING.md,
    marginLeft: SPACING.xs
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
    gap: SPACING.md
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  rowSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.xs
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
    gap: SPACING.xs,
    borderWidth: 1,
    marginTop: SPACING.lg
  },
  signOutText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },

  sheetContent: {
    paddingHorizontal: SPACING.lg,
    gap: 14
  },
  modalSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  modalField: {
    gap: SPACING.xs
  },
  modalLabel: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },
  modalInput: {
    fontFamily: 'Inter-Regular',
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.lg
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md
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
