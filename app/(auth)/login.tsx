import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  ScrollView,
  useWindowDimensions,
  StatusBar} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { validateGhanaPhone, sendArkeselOtp, verifyArkeselOtp } from '@/lib/arkeselSms';

// Figma extracted colors
const BLUE = '#2563eb';
const GREEN = '#10b981';
const INPUT_BG = '#f8fafc';
const LABEL_COLOR = '#62748e';
const PLACEHOLDER_COLOR = '#90a1b9';
const TEXT_PRIMARY = '#1d293d';

export default function Login() {
  const { width } = useWindowDimensions();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'pharmacy'>('patient');
  
  // Pharmacy login steps
  const [pharmStep, setPharmStep] = useState<1 | 2>(1);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef<Array<TextInput | null>>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { signIn } = useAuthStore();
  const router = useRouter();
  const isPharmacy = role === 'pharmacy';
  const activeColor = isPharmacy ? GREEN : BLUE;

  const handlePatientLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);

    try {
      await signIn(email, password);
      router.replace('/(patient)/(tabs)/home');
    } catch (error: any) {
      setErrorMsg(error.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const [formattedPhone, setFormattedPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const raw = phone.trim();
    if (!raw) {
      setErrorMsg('Please enter your pharmacy phone number.');
      return;
    }

    // Step 1: Validate Ghana phone format (free — no credits spent)
    const validation = validateGhanaPhone(raw);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid phone number.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Step 2: Check pharmacies table — phone is stored there, not in profiles
    try {
      const { data: pharmacies, error: dbError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('phone', validation.formatted)
        .limit(1);

      if (dbError) {
        console.warn('Supabase pharmacy phone lookup error:', dbError.message);
        // Don't block on DB errors — proceed to OTP
      } else if (!pharmacies || pharmacies.length === 0) {
        setErrorMsg('No pharmacy account found with this number. Please register first.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('DB lookup failed:', e.message);
      // Proceed — don't block login on DB errors
    }

    // Step 3: Send OTP via Arkesel's managed OTP service (costs credit)
    setFormattedPhone(validation.formatted);
    const result = await sendArkeselOtp(validation.formatted);
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to send OTP. Please try again.');
      return;
    }

    setSuccessMsg(`OTP sent! A 6-digit code has been sent via SMS to ${raw}.`);
    setPharmStep(2);
    startResendTimer();
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await sendArkeselOtp(formattedPhone);
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to resend OTP. Please try again.');
      return;
    }

    setSuccessMsg(`A new OTP code has been sent via SMS to ${phone.trim()}.`);
    startResendTimer();
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length < 6) {
      setErrorMsg('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Defensively re-derive formattedPhone in case state is stale
    const phoneToUse = formattedPhone || validateGhanaPhone(phone.trim()).formatted;

    // Verify code with Arkesel's server-side OTP service
    const verify = await verifyArkeselOtp(phoneToUse, code);
    if (!verify.success) {
      setErrorMsg(verify.error || 'Invalid verification code.');
      setLoading(false);
      return;
    }

    try {
      console.log('[PharmLogin] Signing in with phone:', phoneToUse);
      await signIn(phoneToUse, 'PharmacyPass123!');
      router.replace('/(pharmacy)/(tabs)/dashboard');
    } catch (error: any) {
      console.error('[PharmLogin] signIn error:', error.message, '| phone used:', phoneToUse);
      setErrorMsg(error.message || 'Login failed after OTP verification.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = () => {
    setRole(prev => prev === 'patient' ? 'pharmacy' : 'patient');
    setPharmStep(1);
    setErrorMsg(null);
  };

  const handleOtpChange = (val: string, idx: number) => {
    const next = [...otpCode];
    next[idx] = val.slice(-1);
    setOtpCode(next);
    if (val && idx < 5) {
      otpInputs.current[idx + 1]?.focus();
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={activeColor} />
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        bounces={false}
        keyboardShouldPersistTaps="handled"
      
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>

        {/* ── Figma Hero Header ── */}
        <View style={[styles.hero, { backgroundColor: activeColor }]}>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            {/* Pill icon badge */}
            <View style={styles.iconBadge}>
              <Ionicons 
                name={isPharmacy ? 'shield-checkmark' : 'medical'} 
                size={22} 
                color={activeColor} 
              />
            </View>

            <Text style={styles.heroTitle}>
              {isPharmacy ? 'Pharmacy Portal' : 'Welcome back'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isPharmacy ? 'Sign in to manage your pharmacy' : 'Sign in to your PharmFindr account'}
            </Text>
          </SafeAreaView>
        </View>

        {/* ── SVG Wave Curve (exact Figma shape) ── */}
        <View style={{ backgroundColor: activeColor }}>
          <Svg 
            width={width} 
            height={20} 
            viewBox={`0 0 ${width} 20`}
            style={{ display: 'flex' }}
          >
            <Path
              d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`}
              fill="#ffffff"
            />
          </Svg>
        </View>

        {/* ── Form Area ── */}
        <View style={styles.form}>
          {errorMsg && (
            <View style={[styles.errorBox, { borderColor: '#ef4444' }]}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {successMsg && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={GREEN} style={{ marginRight: 8 }} />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}

          {/* PATIENT LOGIN FORM */}
          {!isPharmacy && (
            <View>
              {/* Email Address */}
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your.email@example.com"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password */}
              <Text style={[styles.label, { marginTop: 16 }]}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {/* Forgot Password */}
              <Pressable style={styles.forgotRow}>
                <Text style={[styles.forgotText, { color: BLUE }]}>Forgot Password?</Text>
              </Pressable>

              {/* Primary Login Button */}
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: BLUE }]}
                onPress={handlePatientLogin}
                disabled={loading}
              >
                {loading 
                  ? <ActivityIndicator color="#ffffff" /> 
                  : <Text style={styles.primaryBtnText}>Login</Text>
                }
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Create Account Button */}
              <Pressable
                style={[styles.outlineBtn, { borderColor: BLUE }]}
                onPress={() => router.push({ pathname: '/(auth)/register', params: { initialRole: 'patient' } })}
              >
                <Text style={[styles.outlineBtnText, { color: BLUE }]}>Create Account</Text>
              </Pressable>
            </View>
          )}

          {/* PHARMACY LOGIN FORM - STEP 1 (Phone Input) */}
          {isPharmacy && pharmStep === 1 && (
            <View>
              {/* Pharmacy Phone */}
              <Text style={styles.label}>PHARMACY PHONE</Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 555 000 0000"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>

              {/* Send OTP Button */}
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: GREEN }]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading 
                  ? <ActivityIndicator color="#ffffff" /> 
                  : <Text style={styles.primaryBtnText}>Send OTP Code</Text>
                }
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register Pharmacy Button */}
              <Pressable
                style={[styles.outlineBtn, { borderColor: GREEN }]}
                onPress={() => router.push('/(auth)/pharmacy-register')}
              >
                <Text style={[styles.outlineBtnText, { color: GREEN }]}>Register Your Pharmacy</Text>
              </Pressable>
            </View>
          )}

          {/* PHARMACY LOGIN FORM - STEP 2 (OTP Input) */}
          {isPharmacy && pharmStep === 2 && (
            <View>
              <Text style={styles.otpHeading}>
                Enter the 6-digit code sent to <Text style={{ fontWeight: 'bold' }}>{phone}</Text>
              </Text>

              {/* OTP Box inputs */}
              <View style={styles.otpContainer}>
                {otpCode.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={el => { otpInputs.current[i] = el; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : {}]}
                    value={digit}
                    onChangeText={val => handleOtpChange(val, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>

              {/* Verify & Login Button */}
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: GREEN }]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading 
                  ? <ActivityIndicator color="#ffffff" /> 
                  : <Text style={styles.primaryBtnText}>Verify & Login</Text>
                }
              </Pressable>

              {/* Resend OTP Button */}
              <Pressable
                style={styles.resendRow}
                onPress={handleResendOtp}
                disabled={loading || resendTimer > 0}
              >
                <Text style={[styles.resendText, { color: resendTimer > 0 ? PLACEHOLDER_COLOR : GREEN }]}>
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                </Text>
              </Pressable>

              {/* Back to Step 1 */}
              <Pressable style={ styles.backToPhoneRow } onPress={() => setPharmStep(1)}>
                <Ionicons name="chevron-back" size={20} color={LABEL_COLOR} />
                <Text style={styles.backToPhoneText}>Change Phone Number</Text>
              </Pressable>
            </View>
          )}

          {/* Portal Switcher */}
          <Pressable style={styles.switchRow} onPress={toggleRole}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.switchText}>{isPharmacy ? 'Are you a patient? ' : 'Are you a pharmacy? '}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: isPharmacy ? BLUE : GREEN, fontWeight: '600' }}>Login</Text>
                <Ionicons name="chevron-forward" size={20} color={isPharmacy ? BLUE : GREEN} />
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
      {/* Ensure content extends to the bottom of the device */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#ffffff' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flexGrow: 1,
  },
  // ── Hero ──
  hero: {
    paddingBottom: 0,
  },
  heroInner: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ffffff38',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '400',
  },
  // ── Form ──
  form: {
    padding: 24,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    color: '#047857',
    fontSize: 13,
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: LABEL_COLOR,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputRow: {
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    height: '100%',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerLabel: {
    fontSize: 13,
    color: PLACEHOLDER_COLOR,
  },
  outlineBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchRow: {
    alignItems: 'center',
    marginTop: 28,
    paddingBottom: 12,
  },
  switchText: {
    fontSize: 13,
    color: LABEL_COLOR,
  },
  // OTP Styles
  otpHeading: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: INPUT_BG,
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  otpBoxFilled: {
    borderColor: GREEN,
    backgroundColor: GREEN + "20",
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backToPhoneRow: {
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row', 
    justifyContent: 'center'
  },
  backToPhoneText: {
    fontSize: 14,
    color: LABEL_COLOR,
  },
});
