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
  KeyboardTypeOptions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const GREEN = '#10b981';
const INPUT_BG = '#f8fafc';
const TEXT_PRIMARY = '#0f172a';
const LABEL_COLOR = '#64748b';
const PLACEHOLDER_COLOR = '#94a3b8';

export default function Register() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { width } = useWindowDimensions();
  const { signUp } = useAuthStore();
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Input refs for Enter key navigation
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const activeColor = role === 'pharmacy' ? GREEN : BLUE;

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await signUp(phone || '', email, password, 'user', fullName);
      router.replace('/(patient)/(tabs)/home');
    } catch (e: any) {
      setErrorMsg(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Text style={styles.label}>FULL NAME</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={fullName}
              onChangeText={setFullName}
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
              onChangeText={setPhone}
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
              onChangeText={setEmail}
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
              onChangeText={setPassword}
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
              onChangeText={setConfirmPassword}
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
    paddingHorizontal: 24, paddingVertical: 16
  },
  backBtn: {
    flexDirection: 'row',
    padding: 10,
    alignSelf: 'flex-start',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  backText: {
    fontSize: 14, fontFamily: 'Inter-SemiBold', color: COLORS.white, marginLeft: 8
  },
  heroTitle: {
    fontSize: 26, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 6
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
     fontSize: 14, color: 'rgba(255,255,255,0.85)'
  },
  form: {
    padding: 24, backgroundColor: COLORS.white
  },
  errorBox: {
    backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: COLORS.error, borderRadius: 12, padding: 12, marginBottom: 16
  },
  errorText: {
    fontFamily: 'Inter-Regular',
     color: COLORS.error, fontSize: 13, textAlign: 'center'
  },
  label: {
    fontSize: 10, fontFamily: 'Inter-Bold', color: LABEL_COLOR, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase'
  },
  labelGap: {
    marginTop: 16
  },
  inputRow: {
    backgroundColor: INPUT_BG, borderRadius: 16, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: 14, color: TEXT_PRIMARY, height: '100%'
  },
  primaryBtn: {
    height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 32
  },
  primaryBtnText: {
    color: COLORS.white, fontSize: 15, fontFamily: 'Inter-Bold'
  },

});
