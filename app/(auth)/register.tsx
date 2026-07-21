import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  ScrollView,
  Platform,
  Dimensions} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

// Figma design tokens
const PATIENT_BLUE = '#2563eb';
const PHARMACY_GREEN = '#10b981';
const INPUT_BG = '#f8fafc';
const LABEL_COLOR = '#62748e';
const PLACEHOLDER_COLOR = '#90a1b9';
const TEXT_PRIMARY = '#1d293d';

const { width } = Dimensions.get('window');

function FieldRow({ icon, placeholder, value, onChange, secure, keyboard }: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.inputRow}>
      <Ionicons name={icon} size={16} color={PLACEHOLDER_COLOR} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function Register() {
  const { initialRole } = useLocalSearchParams<{ initialRole?: 'patient' | 'pharmacy' }>();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role] = useState<'patient' | 'pharmacy'>(initialRole || 'patient');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const router = useRouter();
  const isPharmacy = role === 'pharmacy';
  const activeColor = isPharmacy ? PHARMACY_GREEN : PATIENT_BLUE;

  const { signUp } = useAuthStore();

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await signUp(phone || 'N/A', email, password, role, fullName);
      router.replace(isPharmacy ? '/(pharmacy)/(tabs)/dashboard' : '/(patient)/(tabs)/home');
    } catch (e: any) {
      setErrorMsg(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={{ backgroundColor: activeColor }}>
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name='arrow-back' size={20} color="#ffffff" />
            </Pressable>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSubtitle}>Join thousands managing their health smarter.</Text>
          </SafeAreaView>
        </View>

        {/* Wave curve */}
        <View style={{ backgroundColor: activeColor }}>
          <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
            <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`}
            fill="#ffffff" />
          </Svg>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>
          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Text style={styles.label}>FULL NAME</Text>
          <FieldRow
            icon="person-outline"
            placeholder="John Doe"
            value={fullName}
            onChange={setFullName}
          />

          <Text style={[styles.label, styles.labelGap]}>PHONE NUMBER</Text>
          <FieldRow
            icon="call-outline"
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={setPhone}
            keyboard="phone-pad"
          />

          <Text style={[styles.label, styles.labelGap]}>EMAIL</Text>
          <FieldRow
            icon="mail-outline"
            placeholder="john@example.com"
            value={email}
            onChange={setEmail}
            keyboard="email-address"
          />

          <Text style={[styles.label, styles.labelGap]}>PASSWORD</Text>
          <FieldRow
            icon="lock-closed-outline"
            placeholder="Create a password"
            value={password}
            onChange={setPassword}
            secure
          />

          <Text style={[styles.label, styles.labelGap]}>CONFIRM PASSWORD</Text>
          <FieldRow
            icon="lock-closed-outline"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            secure
          />

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: activeColor }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.primaryBtnText}>Create Account</Text>
            }
          </Pressable>

          <Text style={styles.termsText}>
            By registering you agree to our{' '}
            <Text style={[styles.termsLink, { color: PATIENT_BLUE }]}>Terms &amp; Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
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
  heroInner: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    backgroundColor: '#ffffff',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: LABEL_COLOR,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  labelGap: {
    marginTop: 16,
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
  primaryBtn: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: LABEL_COLOR,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: '600',
  },
});
