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
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
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
  const { user, profile, updateProfile, uploadAvatar, updatePasswordAndRevokeOtherSessions, signOut, deleteAccount } = useAuthStore();
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

  // Delete Account Password Confirmation Sheet State
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [verifyingDelete, setVerifyingDelete] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricIcon, setBiometricIcon] = useState('finger-print-outline');

  // Swipe-to-dismiss & 2D Pan + Pinch-to-zoom gesture handling for avatar image preview
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const lastPan = useRef({ x: 0, y: 0 });
  const initialDistanceRef = useRef<number | null>(null);
  const wasPinchingRef = useRef(false);

  const getDistance = (touches: any[]) => {
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        evt.nativeEvent.touches.length === 2 ||
        Math.abs(gestureState.dx) > 6 ||
        Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: (evt) => {
        wasPinchingRef.current = false;
        if (evt.nativeEvent.touches.length === 2) {
          wasPinchingRef.current = true;
          initialDistanceRef.current = getDistance(evt.nativeEvent.touches);
        } else {
          initialDistanceRef.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          wasPinchingRef.current = true;
          const currentDist = getDistance(touches);
          if (!initialDistanceRef.current) {
            initialDistanceRef.current = currentDist;
          } else if (initialDistanceRef.current > 0) {
            const factor = currentDist / initialDistanceRef.current;
            const newScale = Math.min(4, Math.max(0.8, lastScale.current * factor));
            scale.setValue(newScale);
          }
        } else if (touches.length === 1) {
          if (lastScale.current > 1.05) {
            // ── Zoomed in: 2D Panning (slide-to-close is DEACTIVATED) ──
            const newX = lastPan.current.x + gestureState.dx;
            const newY = lastPan.current.y + gestureState.dy;
            const maxPan = 200 * (lastScale.current - 1);
            const clampedX = Math.min(maxPan, Math.max(-maxPan, newX));
            const clampedY = Math.min(maxPan, Math.max(-maxPan, newY));
            translateX.setValue(clampedX);
            translateY.setValue(clampedY);
          } else if (!wasPinchingRef.current) {
            // ── Unzoomed (1x) & never pinched: Vertical Slide to Close ──
            translateX.setValue(0);
            translateY.setValue(gestureState.dy);
            const newOpacity = Math.max(0.3, 1 - Math.abs(gestureState.dy) / 450);
            previewOpacity.setValue(newOpacity);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // @ts-ignore
        const currentScaleVal = scale._value || 1;
        if (currentScaleVal < 1.05) {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(() => {
            lastScale.current = 1;
            lastPan.current = { x: 0, y: 0 };
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          });
        } else if (currentScaleVal > 4) {
          Animated.spring(scale, { toValue: 4, useNativeDriver: true }).start(() => {
            lastScale.current = 4;
          });
        } else {
          lastScale.current = currentScaleVal;
        }

        if (lastScale.current > 1.05) {
          // ── Zoomed Mode: Save pan position ──
          // @ts-ignore
          const curX = translateX._value || 0;
          // @ts-ignore
          const curY = translateY._value || 0;
          lastPan.current = { x: curX, y: curY };
        } else {
          // ── 1x Scale Mode: Slide-to-dismiss ONLY if user did NOT pinch ──
          if (!wasPinchingRef.current && (Math.abs(gestureState.dy) > 120 || Math.abs(gestureState.vy) > 0.8)) {
            Animated.timing(translateY, {
              toValue: gestureState.dy > 0 ? 600 : -600,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setAvatarModalVisible(false);
              translateY.setValue(0);
              translateX.setValue(0);
              previewOpacity.setValue(1);
              scale.setValue(1);
              lastScale.current = 1;
              lastPan.current = { x: 0, y: 0 };
            });
            wasPinchingRef.current = false;
            return;
          }

          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.timing(previewOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
        wasPinchingRef.current = false;
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
              toast.error('Remove Failed', getFriendlyErrorMessage(e, 'Failed to remove photo. Please try again.'));
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
      toast.error('Validation Error', 'Full Name cannot be empty.');
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
      toast.error('Update Failed', getFriendlyErrorMessage(e, 'Failed to update account. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutConfirm = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace({ pathname: '/(auth)/login', params: { initialRole: 'patient' } });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const showDeleteConfirmationAlert = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently erase all your PharmFindr information.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            await performDeleteAccount();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handlePressDeleteAccount = () => {
    if (hasPassword) {
      setDeletePassword('');
      deleteSheetRef.current?.present();
    } else {
      showDeleteConfirmationAlert();
    }
  };

  const handleVerifyDeletePassword = async () => {
    if (!deletePassword.trim()) {
      toast.error('Validation Error', 'Please enter your password to continue.');
      return;
    }

    setVerifyingDelete(true);
    try {
      const userEmail = user?.email || `${profile?.phone}@PharmFindr.app`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: deletePassword.trim(),
      });

      if (signInErr) {
        throw new Error('Incorrect password. Please try again.');
      }

      deleteSheetRef.current?.dismiss();
      setDeletePassword('');
      setTimeout(() => {
        showDeleteConfirmationAlert();
      }, 350);
    } catch (e: any) {
      toast.error('Verification Failed', getFriendlyErrorMessage(e, 'Incorrect password. Please try again.'));
    } finally {
      setVerifyingDelete(false);
    }
  };

  const performDeleteAccount = async () => {
    setSaving(true);
    try {
      await deleteAccount();
      toast.success('Account Deleted', 'Your account has been deleted permanently.');
      router.replace({ pathname: '/(auth)/login', params: { initialRole: 'patient' } });
    } catch (e: any) {
      toast.error('Deletion Failed', getFriendlyErrorMessage(e, 'Failed to delete account. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const providers = (user?.app_metadata?.providers as string[] | undefined) || (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  const hasPassword = providers.includes('email');

  // Secure Password Update Handler with Global Session Revocation
  const handleChangePasswordSubmit = async () => {
    if (hasPassword && !currentPassword.trim()) {
      toast.error('Validation Error', 'Please enter your current password.');
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
      if (hasPassword) {
        const userEmail = user?.email || `${profile?.phone}@PharmFindr.app`;
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });

        if (signInErr) {
          throw new Error('Current password is incorrect.');
        }
      }

      await updatePasswordAndRevokeOtherSessions(newPassword);

      toast.success(
        hasPassword ? 'Password Updated' : 'Password Configured',
        hasPassword ? 'Your password has been changed securely.' : 'Account password set successfully! You can now also log in with email and password.'
      );
      passwordSheetRef.current?.dismiss();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(hasPassword ? 'Password Update Failed' : 'Set Password Failed', getFriendlyErrorMessage(e, 'Failed to update password. Please try again.'));
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
            <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>
                {hasPassword ? 'Change Password' : 'Set Account Password'}
              </Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>
                {hasPassword
                  ? 'Requires current password verification'
                  : 'Enable email and password sign-in for your account'}
              </Text>
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
            <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Active Devices</Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>View & revoke active device logins</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.securityRow, { backgroundColor: theme.surfaceSecondary }]}>
            <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name={biometricIcon as any} size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
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

          {/* Sign Out */}
          <Pressable
            style={({ pressed }) => [
              styles.securityRow,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
            onPress={handleSignOutConfirm}
          >
            <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name="log-out-outline" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
              <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Sign Out</Text>
              <Text style={[styles.securitySub, { color: theme.textMuted }]}>Log out of your account on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          {/* Delete Account */}
          <Pressable
            style={({ pressed }) => [
              styles.securityRow,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.errorBg, borderColor: theme.error + '40', marginTop: SPACING.md },
            ]}
            onPress={handlePressDeleteAccount}
          >
            <View style={[styles.securityIconCircle, { backgroundColor: theme.error + '20' }]}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
              <Text style={[styles.securityTitle, { color: theme.error }]}>Delete Account</Text>
              <Text style={[styles.securitySub, { color: theme.error + 'aa' }]}>Permanently remove your account & all data</Text>
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
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              if (lastScale.current > 1.05) {
                Animated.parallel([
                  Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
                  Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
                  Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
                ]).start(() => {
                  lastScale.current = 1;
                  lastPan.current = { x: 0, y: 0 };
                });
              } else {
                setAvatarModalVisible(false);
                scale.setValue(1);
                translateX.setValue(0);
                translateY.setValue(0);
                lastScale.current = 1;
                lastPan.current = { x: 0, y: 0 };
              }
            }}
          >
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.waImageContainer,
                { transform: [{ translateX }, { translateY }, { scale }] },
              ]}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.waFullImage} resizeMode="contain" />
              ) : (
                <View style={[styles.avatarCircle, { width: 220, height: 220, borderRadius: 110, backgroundColor: primaryColor }]}>
                  <Text style={[styles.avatarText, { fontSize: FONT_SIZE.hero * 3.5 }]}>{initials}</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          <View style={styles.waFooter}>
            <Pressable style={styles.waFooterBtn} onPress={showAvatarPickerOptions}>
              <Ionicons name="camera-outline" size={20} color={COLORS.white} />
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
            toast.error('Upload Failed', getFriendlyErrorMessage(e, 'Failed to upload image. Please try again.'));
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
            toast.error('Upload Failed', getFriendlyErrorMessage(e, 'Failed to upload image. Please try again.'));
          } finally {
            setUploadingAvatar(false);
          }
        }}
      />

      {/* Secure Password Change / Set Password Bottom Sheet */}
      <AppBottomSheet ref={passwordSheetRef} title={hasPassword ? 'Change Account Password' : 'Set Account Password'}>
        <View style={styles.passwordSheetContent}>
          <Text style={[styles.passwordSub, { color: theme.textMuted }]}>
            {hasPassword
              ? 'Changing your password will immediately sign out all other active device sessions for account security.'
              : 'Create a password to enable logging into your account using both Google and email/password.'}
          </Text>

          {hasPassword && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.textDim }]}>CURRENT PASSWORD</Text>
              <BottomSheetTextInput
                style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={theme.textDim}
                secureTextEntry
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: hasPassword ? SPACING.md : 0 }]}>NEW PASSWORD</Text>
          <BottomSheetTextInput
            style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password (min 6 chars)"
            placeholderTextColor={theme.textDim}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: SPACING.md }]}>CONFIRM NEW PASSWORD</Text>
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
              {changingPassword ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.confirmPasswordText}>{hasPassword ? 'Update Password' : 'Set Password'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* Delete Account Password Confirmation Bottom Sheet */}
      <AppBottomSheet ref={deleteSheetRef} title="Verify Password to Delete">
        <View style={styles.passwordSheetContent}>
          <Text style={[styles.passwordSub, { color: theme.textMuted }]}>
            To protect your account security, please enter your password before permanently deleting your account and all records.
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.textDim, marginTop: SPACING.md }]}>ACCOUNT PASSWORD</Text>
          <BottomSheetTextInput
            style={[styles.modalInput, { color: theme.text.primary, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Enter your current password"
            placeholderTextColor={theme.textDim}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleVerifyDeletePassword}
          />

          <View style={styles.passwordActionRow}>
            <Pressable
              style={[styles.cancelPasswordBtn, { borderColor: theme.border }]}
              onPress={() => {
                deleteSheetRef.current?.dismiss();
                setDeletePassword('');
              }}
              disabled={verifyingDelete}
            >
              <Text style={[styles.cancelPasswordText, { color: theme.text.primary }]}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.confirmPasswordBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.error }]}
              onPress={handleVerifyDeletePassword}
              disabled={verifyingDelete}
            >
              {verifyingDelete ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.confirmPasswordText}>Verify & Continue</Text>
              )}
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
    marginBottom: SPACING.xxl,
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
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 98,
    height: 98,
    borderRadius: RADIUS.pill,
  },
  avatarText: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
  },
  editCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileNameText: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
    marginTop: 10,
  },
  profileEmailText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },

  // Cards
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
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
    paddingHorizontal: SPACING.md,
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
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  securityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
  securitySub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },

  // Save Button
  saveBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },

  // WhatsApp Full-Screen Avatar Modal
  waAvatarModalContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surfaceDark,
    zIndex: 500,
  },
  waHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceDark,
    zIndex: 10,
  },
  waHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  waBackBtn: {
    padding: 6,
  },
  waHeaderTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
  },
  waHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  waHeaderIconBtn: {
    padding: 6,
  },
  waImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waFullImage: {
    width: '100%',
    height: '100%',
  },
  waFooter: {
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
  },
  waFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  avatarActionLabel: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },

  // Password bottom sheet
  passwordSheetContent: {
    paddingHorizontal: SPACING.xl,
  },
  passwordSub: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    marginVertical: SPACING.sm,
  },
  modalInput: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    height: 46,
    borderWidth: 1,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Regular',
  },
  passwordActionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.lg,
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
    fontSize: FONT_SIZE.lg,
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
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
});
