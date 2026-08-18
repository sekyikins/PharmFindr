import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore, PHARMACY_PASS } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { sendArkeselOtp, verifyArkeselOtp, validateGhanaPhone } from '@/lib/arkeselSms';
import { supabase } from '@/lib/supabase';
import OtpInput, { type OtpInputHandle } from '@/components/ui/OtpInput';
import { toast } from '@/context/ToastContext';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import * as Linking from 'expo-linking';

import { getFriendlyErrorMessage } from '@/lib/errorUtils';

export default function Login() {
  const router = useRouter();
  const { initialRole } = useLocalSearchParams<{ initialRole?: string }>();
  const { width } = useWindowDimensions();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();
  const { primaryColor } = useThemeContext();

  const [role, setRole] = useState<'patient' | 'pharmacy'>(
    initialRole === 'pharmacy' ? 'pharmacy' : 'patient'
  );

  // Patient Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Pharmacy Phone OTP State
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [pharmStep, setPharmStep] = useState<1 | 2>(1);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password state
  const forgotSheetRef = useRef<BottomSheetModal>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Input refs for Enter key navigation
  const passwordRef = useRef<TextInput>(null);
  const otpRef = useRef<OtpInputHandle>(null);

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    try {
      const redirectUrl = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      toast.success('Password reset link sent! Check your email inbox.');
      forgotSheetRef.current?.dismiss();
      setResetEmail('');
    } catch (e: any) {
      toast.error(getFriendlyErrorMessage(e, 'Failed to send reset link. Please try again.'));
    } finally {
      setResetLoading(false);
    }
  };

  const handlePatientLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in both email and password.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login successful! Welcome back.');
      router.replace('/(patient)/(tabs)/home');
    } catch (error: any) {
      const msg = getFriendlyErrorMessage(error, 'Login failed. Please check your credentials.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast.success('Signed in with Google!');
        router.replace('/(patient)/(tabs)/home');
      }
    } catch (error: any) {
      console.warn('Google sign-in error:', error);
      const msg = getFriendlyErrorMessage(error, 'Google sign-in was cancelled or failed.');
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const [formattedPhone, setFormattedPhone] = useState('');

  const handleSendOtp = async () => {
    const raw = phone.trim();
    if (!raw) {
      toast.error('Please enter your pharmacy phone number.');
      return;
    }

    const validation = validateGhanaPhone(raw);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid phone number.');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = validation.formatted.replace(/[\s+]+/g, '');
      const { data: pharmacies, error: dbError } = await supabase
        .from('pharmacies')
        .select('id')
        .or(`phone.eq.${validation.formatted},phone.eq.${raw},phone.eq.${cleanPhone}`)
        .limit(1);

      if (dbError) {
        console.warn('Supabase pharmacy phone lookup error:', dbError.message);
      } else if (!pharmacies || pharmacies.length === 0) {
        toast.error('No pharmacy account found with this number. Please register first.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('DB lookup failed:', e.message);
    }

    setFormattedPhone(validation.formatted);
    const result = await sendArkeselOtp(validation.formatted);
    setLoading(false);

    if (!result.success) {
      toast.error(getFriendlyErrorMessage(result.error, 'Failed to send OTP. Please try again.'));
      return;
    }

    toast.success(`OTP sent! A 6-digit code has been sent via SMS to ${raw}.`);
    setPharmStep(2);
  };

  const handleResendOtp = async () => {
    setLoading(true);

    const result = await sendArkeselOtp(formattedPhone);
    setLoading(false);

    if (!result.success) {
      toast.error(getFriendlyErrorMessage(result.error, 'Failed to resend OTP. Please try again.'));
      return;
    }

    toast.success('A new OTP code has been sent to your phone.');
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const token = (codeToVerify || otpToken).trim();
    if (!token) {
      toast.error('Please enter the 6-digit code sent to your phone.');
      return;
    }

    setLoading(true);

    const verification = await verifyArkeselOtp(formattedPhone, token);
    if (!verification.success) {
      toast.error(verification.error || 'Invalid OTP code.');
      otpRef.current?.shake();
      setLoading(false);
      return;
    }

    try {
      const rawPhone = phone.trim();
      const cleanPhone = formattedPhone.replace(/[\s+]+/g, '');

      // 1. Look up registered pharmacy record in database
      const { data: pharm } = await supabase
        .from('pharmacies')
        .select('id, name, email, owner_id, phone')
        .or(`phone.eq.${formattedPhone},phone.eq.${rawPhone},phone.eq.${cleanPhone}`)
        .maybeSingle();

      const candidateEmails = [
        pharm?.email,
        `${cleanPhone}@PharmFindr.com`,
        `${formattedPhone}@PharmFindr.com`,
        `${rawPhone}@PharmFindr.com`,
        `${cleanPhone}@pharmafindr.com`,
        `${formattedPhone}@pharmafindr.com`,
        `${rawPhone}@pharmafindr.com`,
      ].filter(Boolean) as string[];

      let signedIn = false;
      for (const emailCand of candidateEmails) {
        try {
          await signIn(emailCand, PHARMACY_PASS);
          signedIn = true;
          break;
        } catch {
          // Try next email format candidate
        }
      }

      // If credentials didn't match existing Auth account, auto-bind Auth profile for database pharmacy
      if (!signedIn) {
        const targetEmail = pharm?.email || `${cleanPhone}@PharmFindr.com`;
        const targetName = pharm?.name || 'Pharmacy Account';
        const user = await signUp(formattedPhone, targetEmail, PHARMACY_PASS, 'pharmacy', targetName);

        if (user && pharm) {
          await supabase
            .from('pharmacies')
            .update({ owner_id: user.id })
            .eq('id', pharm.id);
        }
        await signIn(targetEmail, PHARMACY_PASS);
      }

      otpRef.current?.showSuccess();
      toast.success('Pharmacy login successful! Welcome back.');
      setTimeout(() => {
        router.replace('/(pharmacy)/(tabs)/inventory');
      }, 400);
    } catch (error: any) {
      console.warn('Pharmacy auth sign-in error:', error.message);
      const msg = getFriendlyErrorMessage(error, 'Login failed.');
      toast.error(msg);
      setLoading(false);
    }
  };

  const isPharmacy = role === 'pharmacy';
  const BLUE = primaryColor;
  const GREEN = COLORS.pharmacyPrimary;
  const activeColor = isPharmacy ? GREEN : BLUE;

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
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header Hero */}
        <View style={{ backgroundColor: activeColor }}>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <View style={styles.brandRow}>
              <Ionicons name="medical" size={28} color={COLORS.white} />
              <Text style={styles.brandTitle}>PharmFindr</Text>
            </View>
            <Text style={styles.heroSubtitle}>Access medicines, prescriptions &amp; pharmacy stock instantly.</Text>

            {/* Role Switcher */}
            <View style={styles.roleContainer}>
              <Pressable
                style={[styles.roleTab, !isPharmacy && styles.roleTabActive]}
                onPress={() => setRole('patient')}
              >
                <Ionicons name="person-outline" size={14} color={!isPharmacy ? BLUE : COLORS.white} style={{ marginRight: 6 }} />
                <Text style={[styles.roleTabText, !isPharmacy && { color: BLUE }]}>Patient</Text>
              </Pressable>

              <Pressable
                style={[styles.roleTab, isPharmacy && styles.roleTabActive]}
                onPress={() => setRole('pharmacy')}
              >
                <Ionicons name="business-outline" size={14} color={isPharmacy ? GREEN : COLORS.white} style={{ marginRight: 6 }} />
                <Text style={[styles.roleTabText, isPharmacy && { color: GREEN }]}>Pharmacy</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {/* Wave curve */}
        <View style={{ backgroundColor: activeColor }}>
          <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
            <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={COLORS.white} />
          </Svg>
        </View>

        {/* Form Container */}
        <View style={styles.form}>
          {/* PATIENT LOGIN FORM */}
          {!isPharmacy && (
            <View>
              {/* Email Address */}
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your.email@example.com"
                  placeholderTextColor={COLORS.textDim}
                  value={email}
                  onChangeText={(text) => setEmail(text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              {/* Password */}
              <View style={styles.passwordHeaderRow}>
                <Text style={styles.label}>PASSWORD</Text>
                <Pressable
                  onPress={() => {
                    setResetEmail(email.trim());
                    forgotSheetRef.current?.present();
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.forgotBtnText, { color: BLUE }]}>Forgot Password?</Text>
                </Pressable>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textDim}
                  value={password}
                  onChangeText={(text) => setPassword(text)}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handlePatientLogin}
                />
              </View>

              {/* Login Button */}
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: BLUE }]}
                onPress={handlePatientLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Login</Text>}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Continue with Google Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleGoogleLogin}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={COLORS.textDark} />
                ) : (
                  <>
                    <Image
                      source={require('@/assets/google.png')}
                      style={styles.googleIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'user' } })}
              >
                <Text style={styles.secondaryBtnText}>Create New Account</Text>
              </Pressable>
            </View>
          )}

          {/* PHARMACY OTP LOGIN FORM */}
          {isPharmacy && (
            <View>
              {pharmStep === 1 ? (
                <>
                  <Text style={styles.label}>PHARMACY PHONE NUMBER</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="call-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 0244123456"
                      placeholderTextColor={COLORS.textDim}
                      value={phone}
                      onChangeText={(text) => setPhone(text)}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                    />
                  </View>

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: GREEN }]}
                    onPress={handleSendOtp}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Send Verification Code</Text>}
                  </Pressable>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerLabel}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => router.push({ pathname: '/(auth)/pharmacy-register' })}
                  >
                    <Text style={styles.secondaryBtnText}>Register New Pharmacy</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
                    <Text style={styles.label}>ENTER THE 6-DIGIT SMS CODE</Text>
                  </View>

                  <OtpInput
                    ref={otpRef}
                    accentColor={GREEN}
                    onChange={(code) => setOtpToken(code)}
                    onComplete={(code) => {
                      setOtpToken(code);
                      handleVerifyOtp(code);
                    }}
                    onResend={handleSendOtp}
                    disabled={loading}
                  />

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: GREEN, marginTop: SPACING.md }]}
                    onPress={() => handleVerifyOtp()}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Verify Code &amp; Login</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      pressed && { opacity: 0.5 },
                      {
                        marginTop: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      },
                    ]}
                    onPress={() => setPharmStep(1)}
                  >
                    <Ionicons name="arrow-back" size={14} color={COLORS.textMuted} />
                    <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold' }}>Change Phone Number</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password BottomSheet */}
      <AppBottomSheet ref={forgotSheetRef} title="Reset Password">
        <View style={styles.modalContent}>
          <Text style={styles.modalSub}>
            Enter your registered account email and we'll send you instructions to reset your password.
          </Text>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={16} color={COLORS.textDim} style={styles.inputIcon} />
            <BottomSheetTextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={COLORS.textDim}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: BLUE, marginTop: SPACING.xl }]}
            onPress={handleResetPassword}
            disabled={resetLoading}
          >
            {resetLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            )}
          </Pressable>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: COLORS.white
  },
  scroll: {
    flexGrow: 1
  },
  heroInner: {
    paddingHorizontal: SPACING.xxl, paddingTop: SPACING.lg, paddingBottom: SPACING.xl
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6
  },
  brandTitle: {
    fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', color: COLORS.white
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.85)', marginBottom: SPACING.lg
  },
  roleContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.xxl, padding: SPACING.xs
  },
  roleTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: RADIUS.xl
  },
  roleTabActive: {
    backgroundColor: COLORS.white
  },
  roleTabText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold', color: COLORS.white
  },
  form: {
    padding: SPACING.xxl, backgroundColor: COLORS.white
  },
  label: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  forgotBtnText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold',
    marginBottom: SPACING.sm,
  },
  inputRow: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.xl, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: FONT_SIZE.lg, color: COLORS.surfaceDark, height: '100%'
  },
  primaryBtn: {
    height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xxl
  },
  primaryBtnText: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xl
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: COLORS.borderSubtle
  },
  dividerLabel: {
    fontFamily: 'Inter-Regular',
     marginHorizontal: SPACING.md, color: COLORS.textDim, fontSize: FONT_SIZE.md
  },
  secondaryBtn: {
    height: 50, borderRadius: 25, borderWidth: 1, borderColor: COLORS.borderSlate, justifyContent: 'center', alignItems: 'center'
  },
  secondaryBtnText: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold'
  },
  googleBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.borderSlate,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    gap: 12,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleBtnText: {
    color: COLORS.textDark,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
  modalContent: {
    padding: SPACING.lg,
  },
  modalSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
    color: COLORS.textDim,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
});
