import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { revokeAllOtherSessions } from '@/lib/deviceSession';
import { processAuthUrl } from '@/lib/authUrlHandler';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const { width } = useWindowDimensions();
  const { primaryColor } = useThemeContext();

  useHardwareBack(() => {
    router.replace('/(auth)/login');
    return true;
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Session verification state
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const confirmRef = useRef<TextInput>(null);

  // Automatically process deep link tokens on mount
  useEffect(() => {
    let mounted = true;

    async function initRecoverySession() {
      try {
        const res = await processAuthUrl(incomingUrl);
        if (!mounted) return;

        if (res.session || res.user) {
          setHasSession(true);
        } else {
          // Check getSession directly
          const { data } = await supabase.auth.getSession();
          setHasSession(!!data.session);
        }
      } catch (err) {
        console.warn('Init recovery session error:', err);
        if (mounted) setHasSession(false);
      } finally {
        if (mounted) setVerifyingSession(false);
      }
    }

    initRecoverySession();

    return () => {
      mounted = false;
    };
  }, [incomingUrl]);

  const isMinLength = password.length >= 6;
  const isMatching = password.length > 0 && password === confirmPassword;

  const handleUpdatePassword = async () => {
    const trimmedPass = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPass || !trimmedConfirm) {
      toast.error('Please enter and confirm your new password.');
      return;
    }

    if (trimmedPass.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (trimmedPass !== trimmedConfirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Ensure active recovery session is present
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error('Recovery session expired or not found. Please request a new reset link.');
      }

      // 2. Update user password
      const { error } = await supabase.auth.updateUser({
        password: trimmedPass,
      });

      if (error) throw error;

      // 3. Invalidate other active remote sessions for security
      try {
        await revokeAllOtherSessions();
      } catch (_) {}

      // 4. Refresh local auth state
      await useAuthStore.getState().initialize();

      toast.success('Password updated successfully! Welcome back.');
      router.replace('/(patient)/(tabs)/home');
    } catch (err: any) {
      console.warn('Reset password error:', err);
      const msg = getFriendlyErrorMessage(err, 'Failed to update password. Please request a new reset link.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const BLUE = primaryColor || COLORS.patientPrimary;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Hero */}
          <View style={{ backgroundColor: BLUE }}>
            <SafeAreaView edges={['top']} style={styles.heroInner}>
              <View style={styles.brandRow}>
                <Ionicons name="key-outline" size={28} color={COLORS.white} />
                <Text style={styles.brandTitle}>Set New Password</Text>
              </View>
              <Text style={styles.heroSubtitle}>
                Create a strong, secure password for your PharmFindr account.
              </Text>
            </SafeAreaView>
          </View>

          {/* Wave curve */}
          <View style={{ backgroundColor: BLUE }}>
            <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
              <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={COLORS.white} />
            </Svg>
          </View>

          {/* Form Content */}
          <View style={styles.form}>
            {verifyingSession ? (
              <View style={styles.verifyingBox}>
                <ActivityIndicator size="large" color={BLUE} />
                <Text style={styles.verifyingText}>Verifying recovery link...</Text>
              </View>
            ) : !hasSession ? (
              <View style={styles.expiredBox}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
                <Text style={styles.expiredTitle}>Invalid or Expired Link</Text>
                <Text style={styles.expiredSub}>
                  This password reset link is invalid, already used, or has expired. Please request a new link from the login page.
                </Text>

                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: BLUE, width: '100%', marginTop: SPACING.xl }]}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.primaryBtnText}>Request New Link</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* New Password */}
                <Text style={styles.label}>NEW PASSWORD</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password (min. 6 characters)"
                    placeholderTextColor={COLORS.textDim}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.textDim}
                    />
                  </Pressable>
                </View>

                {/* Confirm Password */}
                <Text style={[styles.label, { marginTop: SPACING.lg }]}>CONFIRM NEW PASSWORD</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="Re-enter your new password"
                    placeholderTextColor={COLORS.textDim}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleUpdatePassword}
                  />
                  <Pressable onPress={() => setShowConfirmPassword((prev) => !prev)} hitSlop={10}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.textDim}
                    />
                  </Pressable>
                </View>

                {/* Validation Checklist */}
                <View style={styles.checklist}>
                  <View style={styles.checkItem}>
                    <Ionicons
                      name={isMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isMinLength ? COLORS.success : COLORS.textDim}
                    />
                    <Text style={[styles.checkText, isMinLength && styles.checkTextActive]}>
                      At least 6 characters
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Ionicons
                      name={isMatching ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isMatching ? COLORS.success : COLORS.textDim}
                    />
                    <Text style={[styles.checkText, isMatching && styles.checkTextActive]}>
                      Passwords match
                    </Text>
                  </View>
                </View>

                {/* Submit Button */}
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: BLUE }, (!isMinLength || !isMatching) && styles.disabledBtn]}
                  onPress={handleUpdatePassword}
                  disabled={loading || !isMinLength || !isMatching}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Update & Sign In</Text>
                  )}
                </Pressable>

                {/* Back to Login */}
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    flexGrow: 1,
  },
  heroInner: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  form: {
    padding: SPACING.xxl,
    backgroundColor: COLORS.white,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  inputRow: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    fontFamily: 'Inter-Regular',
    flex: 1,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textDark,
    height: '100%',
  },
  checklist: {
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    color: COLORS.textDim,
  },
  checkTextActive: {
    color: COLORS.textDark,
    fontFamily: 'Inter-Medium',
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.borderSlate,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
  verifyingBox: {
    paddingVertical: SPACING.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  verifyingText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
    color: COLORS.textMuted,
  },
  expiredBox: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  expiredTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    color: COLORS.textDark,
    marginTop: SPACING.xs,
  },
  expiredSub: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
});
