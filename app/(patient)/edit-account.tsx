import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  PanResponder,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import AvatarPickerSheet from '@/components/ui/AvatarPickerSheet';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { Header } from '@/components/ui/Header';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import {
  getBiometricsPreference,
  setBiometricsPreference,
  getBiometricType,
  getBiometricIcon,
  authenticateBiometrics,
} from '@/lib/biometrics';

export default function EditAccount() {
  const router = useRouter();
  const { user, profile, updateProfile, uploadAvatar, updatePasswordAndRevokeOtherSessions, signOut } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [username, setUsername] = useState(profile?.full_name ? `@${profile.full_name.toLowerCase().replace(/\s+/g, '')}` : '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Avatar picker sheet ref
  const avatarSheetRef = useRef<BottomSheetModal>(null);

  // Secure Password Change Bottom Sheet State
  const passwordSheetRef = useRef<BottomSheetModal>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricIcon, setBiometricIcon] = useState('finger-print-outline');

  // Swipe-to-dismiss gesture handling for avatar image preview
  const translateY = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy);
        const newOpacity = Math.max(0.3, 1 - Math.abs(gestureState.dy) / 450);
        previewOpacity.setValue(newOpacity);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 110 || Math.abs(gestureState.vy) > 0.7) {
          Animated.timing(translateY, {
            toValue: gestureState.dy > 0 ? 600 : -600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setAvatarModalVisible(false);
            translateY.setValue(0);
            previewOpacity.setValue(1);
          });
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.timing(previewOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
    return true;
  };

  useHardwareBack(() => {
    if (avatarModalVisible) {
      setAvatarModalVisible(false);
      return true;
    }
    return handleGoBack();
  });

  useEffect(() => {
    const initBio = async () => {
      const pref = await getBiometricsPreference();
      setBiometricsEnabled(pref);
      const label = await getBiometricType();
      const icon = await getBiometricIcon();
      setBiometricType(label);
      setBiometricIcon(icon);
    };
    initBio();
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      // Prompt biometric authentication confirmation directly to verify whatever method is active
      const confirmed = await authenticateBiometrics('Confirm your biometrics to enable biometric lock');
      if (!confirmed) {
        setBiometricsEnabled(false);
        await setBiometricsPreference(false);
        return;
      }
    }

    setBiometricsEnabled(val);
    await setBiometricsPreference(val);
    if (val) {
      toast.success('Biometric Lock Enabled', 'PharmFindr is now secured with biometrics.');
    } else {
      toast.info('Biometric Lock Disabled', 'Biometric security lock has been turned off.');
    }
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      if (profile.full_name) {
        setUsername(profile.full_name.toLowerCase().replace(/\s+/g, ''));
      }
    }
  }, [profile]);

  const displayName = profile?.full_name ?? 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Pick/Take Avatar
  const handlePickAvatar = async () => {
    if (profile?.avatar_url) {
      setAvatarModalVisible(true);
      return;
    }
    avatarSheetRef.current?.present();
  };

  const showAvatarPickerOptions = () => {
    avatarSheetRef.current?.present();
  };

  const handleRemoveAvatarConfirm = () => {
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingAvatar(true);
              await updateProfile({ avatar_url: null });
              setAvatarModalVisible(false);
              toast.success('Photo Removed', 'Profile photo removed successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to remove photo.');
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleSaveAccount = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      toast.success('Account Updated', 'Account details updated successfully!');
    } catch (e: any) {
      Alert.alert('Update Failed', getFriendlyErrorMessage(e, 'Failed to update account. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutConfirm = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of PharmFindr?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ], { cancelable: true });
  };

  // Secure Password Update Handler with Global Session Revocation
  const handleChangePasswordSubmit = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Validation Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Validation Error', 'New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const userEmail = user?.email || `${profile?.phone}@PharmFindr.app`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInErr) {
        throw new Error('Current password is incorrect.');
      }

      await updatePasswordAndRevokeOtherSessions(newPassword);

      toast.success('Password Updated', 'Your password has been changed securely.');
      passwordSheetRef.current?.dismiss();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error('Password Update Failed', getFriendlyErrorMessage(e, 'Failed to change password. Please try again.'));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Account Settings" showBack onBack={handleGoBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* Hero Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable
            style={({ pressed }) => [styles.avatarWrapper, pressed && { opacity: 0.85 }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <View style={[styles.avatarRing, { borderColor: primaryColor + '40' }]}>
              <View style={[styles.avatarCircle, { backgroundColor: primaryColor }]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
            </View>

            <View style={[styles.editCameraBadge, { backgroundColor: primaryColor }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera" size={16} color="#ffffff" />
              )}
            </View>
          </Pressable>

          <Text style={[styles.profileNameText, { color: theme.text.primary }]}>{displayName}</Text>
          <Text style={[styles.profileEmailText, { color: theme.textMuted }]}>
            {user?.email || phone || 'Patient Account'}
          </Text>
        </View>

        {/* Personal Details Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>PERSONAL INFORMATION</Text>

          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>FULL NAME</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              placeholderTextColor={theme.textDim}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phoneInputRef.current?.focus()}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>PHONE NUMBER</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="call-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              ref={phoneInputRef}
              style={[styles.input, { color: theme.text.primary }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+233..."
              placeholderTextColor={theme.textDim}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => usernameInputRef.current?.focus()}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>USERNAME</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="at-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              ref={usernameInputRef}
              style={[styles.input, { color: theme.text.primary }]}
              value={username}
              onChangeText={setUsername}
              placeholder="@username"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSaveAccount}
            />
          </View>
        </View>

        {/* Security & Privacy Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>SECURITY & PRIVACY</Text>

          <Pressable
            style={({ pressed }) => [
              styles.securityRow,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={() => passwordSheetRef.current?.present()}
          >
            <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name="lock-closed-outline" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Change Password</Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>Requires current password verification</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.securityRow,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={() => router.push('/(patient)/active-devices')}
          >
            <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name="hardware-chip-outline" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Active Devices</Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>View & revoke active device logins</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.securityRow, { backgroundColor: theme.surfaceSecondary }]}>
            <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name={biometricIcon as any} size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Use {biometricType}</Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>Require {biometricType} on app launch</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: theme.border, true: primaryColor }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Account Actions Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>ACCOUNT ACTIONS</Text>

          <Pressable
            style={({ pressed }) => [
              styles.securityRow,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.errorBg, borderColor: theme.error + '40' },
            ]}
            onPress={handleSignOutConfirm}
          >
            <View style={[styles.securityIconCircle, { backgroundColor: theme.error + '20' }]}>
              <Ionicons name="log-out-outline" size={20} color={theme.error} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[styles.securityTitle, { color: theme.error }]}>Sign Out</Text>
              <Text style={[styles.securitySub, { color: theme.error + 'aa' }]}>Log out of your account on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.error} />
          </Pressable>
        </View>

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && { opacity: 0.7 },
            { backgroundColor: primaryColor },
          ]}
          onPress={handleSaveAccount}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveBtnText}>Save Account Changes</Text>}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* IMMERSIVE GESTURE DISMISSIBLE AVATAR VIEWER OVERLAY */}
      {avatarModalVisible && (
        <Animated.View style={[styles.waAvatarModalContainer, { opacity: previewOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={() => setAvatarModalVisible(false)}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.waZoomContainer,
                { transform: [{ translateY }] },
              ]}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.waAvatarImage} resizeMode="contain" />
              ) : (
                <View style={[styles.avatarCircle, { width: 220, height: 220, borderRadius: 110, backgroundColor: primaryColor }]}>
                  <Text style={[styles.avatarText, { fontSize: 72 }]}>{initials}</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          <View style={styles.avatarModalFooter}>
            <Pressable style={styles.avatarActionBtn} onPress={showAvatarPickerOptions}>
              <Ionicons name="camera-outline" size={20} color="#ffffff" />
              <Text style={styles.avatarActionLabel}>Edit Photo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Avatar Picker Sheet */}
      <AvatarPickerSheet
        ref={avatarSheetRef}
        hasPhoto={!!profile?.avatar_url}
        onRemove={handleRemoveAvatarConfirm}
        onCamera={async () => {
          try {
            setUploadingAvatar(true);
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              toast.error('Permission Needed', 'Camera permission is required.');
              setUploadingAvatar(false);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              await uploadAvatar(result.assets[0].uri);
              toast.success('Photo Updated', 'Profile photo updated!');
            }
          } catch (e: any) {
            toast.error('Upload Error', e.message || 'Failed to upload image.');
          } finally {
            setUploadingAvatar(false);
          }
        }}
        onGallery={async () => {
          try {
            setUploadingAvatar(true);
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              toast.error('Permission Needed', 'Photo library permission is required.');
              setUploadingAvatar(false);
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              await uploadAvatar(result.assets[0].uri);
              toast.success('Photo Updated', 'Profile photo updated!');
            }
          } catch (e: any) {
            toast.error('Upload Error', e.message || 'Failed to upload image.');
          } finally {
            setUploadingAvatar(false);
          }
        }}
      />

      {/* Secure Password Change Bottom Sheet */}
      <AppBottomSheet ref={passwordSheetRef} title="Change Account Password">
        <View style={styles.passwordSheetContent}>
          <Text style={[styles.passwordSub, { color: theme.textMuted }]}>
            Changing your password will immediately sign out all other active device sessions for account security.
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>CURRENT PASSWORD</Text>
          <BottomSheetTextInput
            style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={theme.textDim}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { color: theme.textDim }]}>NEW PASSWORD</Text>
          <BottomSheetTextInput
            style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password (min 6 chars)"
            placeholderTextColor={theme.textDim}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: 12 }]}>CONFIRM NEW PASSWORD</Text>
          <BottomSheetTextInput
            style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={theme.textDim}
            secureTextEntry
          />

          <View style={styles.passwordActionRow}>
            <Pressable
              style={({ pressed }) => [styles.confirmPasswordBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
              onPress={handleChangePasswordSubmit}
              disabled={changingPassword}
            >
              {changingPassword ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.confirmPasswordText}>Update</Text>}
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.xl },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 98,
    height: 98,
    borderRadius: 49,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 98,
    height: 98,
    borderRadius: 49,
  },
  avatarText: {
    fontSize: 34,
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
  },
  editCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileNameText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginTop: 10,
  },
  profileEmailText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },

  // Cards
  card: {
    padding: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
  },

  // Security Rows
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.lg,
    marginTop: 8,
  },
  securityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  securitySub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },

  // Save Button
  saveBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Inter-Bold',
  },

  // WhatsApp Full-Screen Avatar Modal
  waAvatarModalContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f0f0fff',
    zIndex: 500,
  },
  waHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0b141a',
    zIndex: 10,
  },
  waHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  waBackBtn: {
    padding: 6,
  },
  waHeaderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  waHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  waIconBtn: {
    padding: 6,
  },
  waZoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  waAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarModalFooter: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
  },
  avatarActionLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },

  // Password bottom sheet
  passwordSheetContent: {
    paddingHorizontal: SPACING.xl,
  },
  passwordSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginVertical: 8,
  },
  modalInput: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  passwordActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  cancelPasswordBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  confirmPasswordBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmPasswordText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
});
