import { COLORS } from '@/styles/theme';
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

function getFriendlyAuthErrorMessage(err: any, defaultMsg = 'Authentication failed.'): string {
  const message = err?.message || String(err || '');
  if (!message) return defaultMsg;

  if (/network|fetch|connect|timeout|offline|internet|getaddrinfo|econnrefused/i.test(message)) {
    return 'Login failed due to poor connectivity. Please check your internet connection.';
  }

  if (/invalid login credentials|invalid email or password|user not found/i.test(message)) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many login attempts. Please wait a moment before trying again.';
  }

  return message;
}

export default function Login() {
  const router = useRouter();
  const { initialRole } = useLocalSearchParams<{ initialRole?: string }>();
  const { width } = useWindowDimensions();
  const { signIn, signUp } = useAuthStore();
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

  // Input refs for Enter key navigation
  const passwordRef = useRef<TextInput>(null);
  const otpRef = useRef<OtpInputHandle>(null);

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
      const msg = getFriendlyAuthErrorMessage(error, 'Login failed. Please check your credentials.');
      toast.error(msg);
    } finally {
      setLoading(false);
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
      const isNetwork = /network|fetch|connect|timeout/i.test(result.error || '');
      const msg = isNetwork
        ? 'Failed to send OTP due to poor connectivity. Please check your internet.'
        : (result.error || 'Failed to send OTP. Please try again.');
      toast.error(msg);
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
      const isNetwork = /network|fetch|connect|timeout/i.test(result.error || '');
      const msg = isNetwork
        ? 'Failed to resend OTP due to poor connectivity.'
        : (result.error || 'Failed to resend OTP. Please try again.');
      toast.error(msg);
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
      const msg = getFriendlyAuthErrorMessage(error, 'Login failed.');
      toast.error(msg);
      setLoading(false);
    }
  };

  const isPharmacy = role === 'pharmacy';
  const BLUE = primaryColor;
  const GREEN = '#10b981';
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
              <Text style={[styles.label, { marginTop: 16 }]}>PASSWORD</Text>
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
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
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
                    style={[styles.primaryBtn, { backgroundColor: GREEN, marginTop: 12 }]}
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
                    <Text style={{ color: COLORS.textMuted, fontSize: 13, fontFamily: 'Inter-SemiBold' }}>Change Phone Number</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6
  },
  brandTitle: {
    fontSize: 28, fontFamily: 'Inter-Bold', color: COLORS.white
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 16
  },
  roleContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24, padding: 4
  },
  roleTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 20
  },
  roleTabActive: {
    backgroundColor: COLORS.white
  },
  roleTabText: {
    fontSize: 13, fontFamily: 'Inter-Bold', color: COLORS.white
  },
  form: {
    padding: 24, backgroundColor: COLORS.white
  },
  label: {
    fontSize: 10, fontFamily: 'Inter-Bold', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 8
  },
  inputRow: {
    backgroundColor: COLORS.background, borderRadius: 16, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: 14, color: COLORS.surfaceDark, height: '100%'
  },
  primaryBtn: {
    height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 24
  },
  primaryBtnText: {
    color: COLORS.white, fontSize: 15, fontFamily: 'Inter-Bold'
  },
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: COLORS.borderSubtle
  },
  dividerLabel: {
    fontFamily: 'Inter-Regular',
     marginHorizontal: 12, color: COLORS.textDim, fontSize: 12
  },
  secondaryBtn: {
    height: 50, borderRadius: 25, borderWidth: 1, borderColor: COLORS.borderSlate, justifyContent: 'center', alignItems: 'center'
  },
  secondaryBtnText: {
    color: COLORS.textSecondary, fontSize: 14, fontFamily: 'Inter-SemiBold'
  },

});
