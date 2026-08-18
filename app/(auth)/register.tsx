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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { toast } from '@/context/ToastContext';

const GREEN = COLORS.pharmacyPrimary;
import { getFriendlyErrorMessage } from '@/lib/errorUtils';

const BLUE = COLORS.patientPrimary;
const INPUT_BG = COLORS.surface;
const TEXT_PRIMARY = COLORS.textDark;
const LABEL_COLOR = COLORS.textMuted;
const PLACEHOLDER_COLOR = COLORS.textDim;

function getFriendlyRegisterErrorMessage(err: any, defaultMsg = 'Registration failed.'): string {
  const message = err?.message || String(err || '');
  if (/already registered|already in use|unique constraint|user already exists/i.test(message)) {
    return 'An account with this email already exists. Please login instead.';
  }
  return getFriendlyErrorMessage(err, defaultMsg);
}

export default function Register() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { width } = useWindowDimensions();
  const { signUp, signInWithGoogle } = useAuthStore();
  const { primaryColor } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(auth)/login');
    }
    return true;
  });

  const BLUE = primaryColor;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Input refs for Enter key navigation
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const activeColor = role === 'pharmacy' ? GREEN : BLUE;

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await signUp(phone || '', email, password, 'user', fullName);
      toast.success('Registration successful! Welcome to PharmaFindr.');
      router.replace('/(patient)/(tabs)/home');
    } catch (e: any) {
      const msg = getFriendlyRegisterErrorMessage(e, 'Registration failed. Please try again.');
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

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ backgroundColor: activeColor }}>
            <SafeAreaView edges={['top']} style={styles.heroInner}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}>
                <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Text style={styles.heroTitle}>Create Account</Text>
              <Text style={styles.heroSubtitle}>Join thousands managing their health smarter.</Text>
            </SafeAreaView>
          </View>

        {/* Wave curve */}
        <View style={{ backgroundColor: activeColor }}>
          <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
            <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={COLORS.white} />
          </Svg>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>FULL NAME</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={fullName}
              onChangeText={(text) => setFullName(text)}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, styles.labelGap]}>PHONE NUMBER</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder="+233 24 000 0000"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={phone}
              onChangeText={(text) => setPhone(text)}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, styles.labelGap]}>EMAIL</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={email}
              onChangeText={(text) => setEmail(text)}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, styles.labelGap]}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={password}
              onChangeText={(text) => setPassword(text)}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, styles.labelGap]}>CONFIRM PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              ref={confirmPasswordRef}
              style={styles.input}
              placeholder="Repeat your password"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={confirmPassword}
              onChangeText={(text) => setConfirmPassword(text)}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: activeColor }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Register Account</Text>}
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
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryBtnText}>Already have an account? Log In</Text>
          </Pressable>
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
    paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.lg
  },
  backBtn: {
    flexDirection: 'row',
    padding: 10,
    alignSelf: 'flex-start',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  backText: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold', color: COLORS.white, marginLeft: 8
  },
  heroTitle: {
    fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 6
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.lg, color: 'rgba(255,255,255,0.85)'
  },
  form: {
    padding: SPACING.xxl, backgroundColor: COLORS.white
  },
  label: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', color: LABEL_COLOR, letterSpacing: 0.5, marginBottom: SPACING.sm, textTransform: 'uppercase'
  },
  labelGap: {
    marginTop: SPACING.lg
  },
  inputRow: {
    backgroundColor: INPUT_BG, borderRadius: RADIUS.xl, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: FONT_SIZE.lg, color: TEXT_PRIMARY, height: '100%'
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
    marginHorizontal: SPACING.md,
    color: COLORS.textDim,
    fontSize: FONT_SIZE.md,
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
  secondaryBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.borderSlate,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold',
  },
});
