import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';

export default function EditAccount() {
  const router = useRouter();
  const { user, profile, updateProfile, uploadAvatar } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [username, setUsername] = useState(profile?.full_name ? `@${profile.full_name.toLowerCase().replace(/\s+/g, '')}` : '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Full-screen Avatar Modal State
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Secure Password Change Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      if (profile.full_name) {
        setUsername(`@${profile.full_name.toLowerCase().replace(/\s+/g, '')}`);
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
    showAvatarPickerOptions();
  };

  const handleShareAvatar = async () => {
    if (!profile?.avatar_url) return;
    try {
      await Share.share({
        message: `PharmFindr Profile Picture - ${profile.full_name ?? 'User'}`,
        url: profile.avatar_url,
      });
    } catch (e: any) {
      console.warn('Share error:', e.message);
    }
  };

  const showAvatarPickerOptions = () => {
    const options: any[] = [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Denied', 'Camera permission is required.', [
              { text: 'OK' },
              { text: 'Cancel', style: 'cancel' },
            ]);
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
            setAvatarModalVisible(false);
          }
        },
      },
      {
        text: 'Choose from Gallery',
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
            setAvatarModalVisible(false);
          }
        },
      },
    ];

    if (profile?.avatar_url) {
      options.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: handleRemoveAvatar,
      });
    }

    // Cancel must ALWAYS be the last element
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Picture', 'Select an option', options, { cancelable: true });
  };

  const handleRemoveAvatar = async () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile picture?',
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploadingAvatar(true);
            await updateProfile({ avatar_url: null });
            setUploadingAvatar(false);
            setAvatarModalVisible(false);
          },
        },
        { text: 'Cancel', style: 'cancel' },
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
      Alert.alert('Success', 'Account details updated successfully!');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  // Secure Password Update Handler
  const handleChangePasswordSubmit = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      // 1. Verify Current Password by re-authenticating
      const userEmail = user?.email || `${profile?.phone}@pharmafindr.app`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInErr) {
        throw new Error('Current password is incorrect.');
      }

      // 2. Update to New Password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      Alert.alert('Success', 'Your password has been changed securely!');
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Security Error', e.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <Pressable style={[styles.circleBtn, { backgroundColor: theme.surfaceSecondary }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Edit Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Expanded Avatar Section ── */}
        <View style={styles.avatarSection}>
          <Pressable style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            <View style={[styles.avatarCircle, { backgroundColor: primaryColor }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={[styles.editCameraBadge, { backgroundColor: theme.card }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name="camera" size={16} color={primaryColor} />
              )}
            </View>
          </Pressable>
          <Text style={[styles.avatarSubtext, { color: theme.textDim }]}>
            {profile?.avatar_url ? 'Tap avatar to view or change' : 'Tap to set profile picture'}
          </Text>
        </View>

        {/* ── Form Fields ── */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Personal Details</Text>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>FULL NAME</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              placeholderTextColor={theme.textDim}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>PHONE NUMBER</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="call-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+233..."
              placeholderTextColor={theme.textDim}
              keyboardType="phone-pad"
            />
          </View>
          <Text style={[styles.hintText, { color: theme.textDim }]}>Phone number verification coming soon</Text>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>USERNAME</Text>
          <View style={[styles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="at-outline" size={18} color={theme.textDim} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              value={username}
              onChangeText={setUsername}
              placeholder="@username"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Security Card ── */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 16 }]}>
          <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Security</Text>

          <Pressable
            style={[styles.securityRow, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.securityRowLeft}>
              <View style={[styles.securityIconCircle, { backgroundColor: primaryColor + '20' }]}>
                <Ionicons name="lock-closed-outline" size={20} color={primaryColor} />
              </View>
              <View>
                <Text style={[styles.securityTitle, { color: theme.text.primary }]}>Change Password</Text>
                <Text style={[styles.securitySub, { color: theme.textMuted }]}>Requires current password verification</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        </View>

        {/* ── Save Button ── */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: primaryColor }]}
          onPress={handleSaveAccount}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </Pressable>
      </ScrollView>

      {/* ══ 1. WHATSAPP-STYLE FULL-SCREEN AVATAR VIEWER MODAL ══ */}
      <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <View style={styles.waAvatarModalContainer}>
          {/* WhatsApp Header */}
          <SafeAreaView edges={['top']} style={styles.waHeader}>
            <View style={styles.waHeaderLeft}>
              <Pressable style={styles.waBackBtn} onPress={() => setAvatarModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </Pressable>
              <Text style={styles.waHeaderTitle}>Profile picture</Text>
            </View>

            <View style={styles.waHeaderRight}>
              <Pressable style={styles.waIconBtn} onPress={showAvatarPickerOptions}>
                <Ionicons name="pencil-outline" size={22} color="#ffffff" />
              </Pressable>
              <Pressable style={styles.waIconBtn} onPress={handleShareAvatar}>
                <Ionicons name="share-social-outline" size={22} color="#ffffff" />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Zoomable Image Container */}
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.waZoomContainer}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.waAvatarImage} resizeMode="contain" />
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* ══ 2. SECURE PASSWORD CHANGE MODAL ══ */}
      <Modal visible={passwordModalVisible} transparent animationType="slide" onRequestClose={() => setPasswordModalVisible(false)}>
        <Pressable style={styles.passwordModalOverlay} onPress={() => setPasswordModalVisible(false)}>
          <Pressable style={[styles.passwordCard, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.passwordHeader}>
              <Ionicons name="shield-checkmark" size={24} color={primaryColor} />
              <Text style={[styles.passwordTitle, { color: theme.text.primary }]}>Secure Password Change</Text>
            </View>
            <Text style={[styles.passwordSub, { color: theme.textMuted }]}>
              Please enter your current password to verify identity.
            </Text>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>CURRENT PASSWORD</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surface, color: theme.text.primary, borderColor: theme.border }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={theme.textDim}
              secureTextEntry
            />

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>NEW PASSWORD</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surface, color: theme.text.primary, borderColor: theme.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={theme.textDim}
              secureTextEntry
            />

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>CONFIRM NEW PASSWORD</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surface, color: theme.text.primary, borderColor: theme.border }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={theme.textDim}
              secureTextEntry
            />

            <View style={styles.passwordActionRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: theme.border }]} onPress={() => setPasswordModalVisible(false)}>
                <Text style={[styles.modalBtnCancelText, { color: theme.text.primary }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtnSave, { backgroundColor: primaryColor }]}
                onPress={handleChangePasswordSubmit}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  editCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  avatarSubtext: {
    fontSize: FONT_SIZE.sm,
    marginTop: 8,
  },

  // Form Card
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
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
    fontSize: FONT_SIZE.body,
  },
  hintText: {
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    marginLeft: 4,
  },

  // Security Row
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: RADIUS.lg,
    marginTop: 8,
  },
  securityRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
  },
  securitySub: {
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },

  // Save Button
  saveBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },

  // WhatsApp Full-Screen Avatar Modal
  waAvatarModalContainer: {
    flex: 1,
    backgroundColor: '#0b141a',
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
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waAvatarImage: {
    width: '100%',
    height: '100%',
  },

  // Full-screen Avatar Modal
  avatarModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  avatarModalHeader: {
    padding: 16,
    paddingBottom: 0,
    alignItems: 'flex-end',
  },
  avatarModalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenAvatarImage: {
    width: '90%',
    height: '70%',
  },
  avatarModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
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
    fontSize: FONT_SIZE.body,
    fontWeight: '600',
  },

  // Secure Password Modal
  passwordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  passwordCard: {
    width: '94%',
    borderRadius: RADIUS.xl,
    padding: 22,
    elevation: 10,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  passwordTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
  },
  passwordSub: {
    fontSize: FONT_SIZE.sm,
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    fontSize: FONT_SIZE.body,
  },
  passwordActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtnCancel: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancelText: { fontWeight: '600', fontSize: FONT_SIZE.body },
  modalBtnSave: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSaveText: { color: '#ffffff', fontWeight: '700', fontSize: FONT_SIZE.body },
});
