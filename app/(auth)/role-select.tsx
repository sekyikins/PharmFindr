/**
 * Role Select Screen
 *
 * Shown after onboarding. The user picks whether they are a
 * "Patient" (app user) or a "Pharmacy" — which routes them to
 * the correct login/registration flow.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

const BLUE = '#2563eb';
const GREEN = '#10b981';

export default function RoleSelect() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1d293d" />

      {/* Top hero */}
      <View style={styles.hero}>
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="medkit" size={22} color="#fff" />
            </View>
            <Text style={styles.logoText}>PharmFindr</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome!</Text>
          <Text style={styles.heroSub}>
            Tell us who you are so we can personalise your experience.
          </Text>
        </SafeAreaView>
        <Svg width={width} height={28} viewBox={`0 0 ${width} 28`}>
          <Path
            d={`M0,28 Q${width / 2},0 ${width},28 L${width},28 L0,28 Z`}
            fill="#f8fafc"
          />
        </Svg>
      </View>

      {/* Cards */}
      <View style={styles.content}>
        {/* Patient Card */}
        <Pressable
          style={({ pressed }) => [styles.card, styles.patientCard, pressed && styles.cardPressed]}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { initialRole: 'patient' } })}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: BLUE + '18' }]}>
            <Ionicons name="person" size={34} color={BLUE} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I'm a Patient</Text>
            <Text style={styles.cardDesc}>
              Search for medicines, scan prescriptions, and reserve at nearby pharmacies.
            </Text>
          </View>
          <View style={[styles.cardArrow, { backgroundColor: BLUE }]}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </Pressable>

        {/* Pharmacy Card */}
        <Pressable
          style={({ pressed }) => [styles.card, styles.pharmacyCard, pressed && styles.cardPressed]}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { initialRole: 'pharmacy' } })}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: GREEN + '18' }]}>
            <Ionicons name="shield-checkmark" size={34} color={GREEN} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I'm a Pharmacy</Text>
            <Text style={styles.cardDesc}>
              Register your pharmacy, manage your inventory, and handle patient reservations.
            </Text>
          </View>
          <View style={[styles.cardArrow, { backgroundColor: GREEN }]}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>New here?</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Sign up options */}
        <View style={styles.signupRow}>
          <Pressable
            style={[styles.signupBtn, { borderColor: BLUE }]}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { initialRole: 'patient' } })}
          >
            <Ionicons name="person-add-outline" size={16} color={BLUE} />
            <Text style={[styles.signupText, { color: BLUE }]}>Patient Sign Up</Text>
          </Pressable>
          <Pressable
            style={[styles.signupBtn, { borderColor: GREEN }]}
            onPress={() => router.push('/(auth)/pharmacy-register')}
          >
            <Ionicons name="business-outline" size={16} color={GREEN} />
            <Text style={[styles.signupText, { color: GREEN }]}>Pharmacy Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  hero: {
    backgroundColor: '#1d293d',
  },
  heroInner: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
    maxWidth: 300,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  patientCard: {
    borderColor: BLUE + '30',
  },
  pharmacyCard: {
    borderColor: GREEN + '30',
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1d293d',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#62748e',
    lineHeight: 19,
  },
  cardArrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    flexShrink: 0,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 13,
    color: '#94a3b8',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  signupRow: {
    flexDirection: 'row',
    gap: 10,
  },
  signupBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  signupText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
