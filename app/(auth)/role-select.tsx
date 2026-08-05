/**
 * Role Select Screen
 *
 * Shown after onboarding. The user picks whether they are a
 * "Patient" (app user) or a "Pharmacy" — which routes them to
 * the correct login/registration flow.
 */
import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHARMACY_GREEN = '#10b981';

export default function RoleSelect() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const patientScale = useRef(new Animated.Value(1)).current;
  const pharmacyScale = useRef(new Animated.Value(1)).current;

  const animPress = (anim: Animated.Value, pressed: boolean) => {
    Animated.spring(anim, {
      toValue: pressed ? 0.97 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Full-bleed Hero with arch ── */}
      <View style={[styles.hero, { backgroundColor: primaryColor }]}>
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          {/* Brand row */}
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.brandIcon}
            />
            <Text style={styles.brandName}>PharmFindr</Text>
          </View>

          {/* Badge + Title */}
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.white} />
            <Text style={styles.heroBadgeText}>ROLE SELECTION</Text>
          </View>
          <Text style={styles.heroTitle}>Who are you?</Text>
          <Text style={styles.heroSub}>
            Tell us who you are so we can personalise your experience from the start.
          </Text>
        </SafeAreaView>

        {/* SVG arch — the signature transition */}
        <Svg
          width={SCREEN_WIDTH}
          height={32}
          viewBox={`0 0 ${SCREEN_WIDTH} 32`}
          style={{ display: 'flex' }}
        >
          <Path
            d={`M0,32 Q${SCREEN_WIDTH / 2},0 ${SCREEN_WIDTH},32 L${SCREEN_WIDTH},32 L0,32 Z`}
            fill={theme.background}
          />
        </Svg>
      </View>

      {/* ── Role Cards ── */}
      <View style={styles.cardsContainer}>

        {/* Patient Card */}
        <Pressable
          onPressIn={() => animPress(patientScale, true)}
          onPressOut={() => animPress(patientScale, false)}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { initialRole: 'patient' } })}
        >
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: primaryColor + '40' },
              { transform: [{ scale: patientScale }] },
            ]}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: primaryColor + '15' }]}>
              <Ionicons name="person" size={30} color={primaryColor} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: theme.text.primary }]}>I'm a Patient</Text>
              <Text style={[styles.cardDesc, { color: theme.textMuted }]}>
                Search medicines, scan prescriptions, and reserve at nearby pharmacies.
              </Text>
              <View style={[styles.cardTag, { backgroundColor: primaryColor + '12' }]}>
                <Ionicons name="checkmark-circle" size={11} color={primaryColor} />
                <Text style={[styles.cardTagText, { color: primaryColor }]}>Most Common</Text>
              </View>
            </View>
            <View style={[styles.cardChevron, { backgroundColor: primaryColor }]}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
            </View>
          </Animated.View>
        </Pressable>

        {/* Pharmacy Card */}
        <Pressable
          onPressIn={() => animPress(pharmacyScale, true)}
          onPressOut={() => animPress(pharmacyScale, false)}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { initialRole: 'pharmacy' } })}
        >
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: PHARMACY_GREEN + '40' },
              { transform: [{ scale: pharmacyScale }] },
            ]}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: PHARMACY_GREEN + '15' }]}>
              <Ionicons name="business" size={30} color={PHARMACY_GREEN} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: theme.text.primary }]}>I'm a Pharmacy</Text>
              <Text style={[styles.cardDesc, { color: theme.textMuted }]}>
                Register your pharmacy, manage inventory, and handle patient reservations.
              </Text>
              <View style={[styles.cardTag, { backgroundColor: PHARMACY_GREEN + '12' }]}>
                <Ionicons name="storefront" size={11} color={PHARMACY_GREEN} />
                <Text style={[styles.cardTagText, { color: PHARMACY_GREEN }]}>Business Account</Text>
              </View>
            </View>
            <View style={[styles.cardChevron, { backgroundColor: PHARMACY_GREEN }]}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* ── Sign Up Footer ── */}
      <View style={styles.footer}>
        <View style={[styles.dividerRow]}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textMuted }]}>New here?</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>
        <View style={styles.signupRow}>
          <Pressable
            style={({ pressed }) => [
              styles.signupBtn,
              pressed && { opacity: 0.75 },
              { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { initialRole: 'patient' } })}
          >
            <Ionicons name="person-add-outline" size={15} color={primaryColor} />
            <Text style={[styles.signupText, { color: theme.text.primary }]}>Patient Sign Up</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.signupBtn,
              pressed && { opacity: 0.75 },
              { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
            ]}
            onPress={() => router.push('/(auth)/pharmacy-register')}
          >
            <Ionicons name="business-outline" size={15} color={primaryColor} />
            <Text style={[styles.signupText, { color: theme.text.primary }]}>Pharmacy Sign Up</Text>
          </Pressable>
        </View>
    </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },

  // ── Full-bleed hero ──
  hero: {
    paddingBottom: 0
  },
  heroInner: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 7
  },
  brandName: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
    letterSpacing: -0.3
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    marginBottom: 10
  },
  heroBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
    letterSpacing: 0.8
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: COLORS.white,
    marginBottom: 6,
    letterSpacing: -0.4
  },
  heroSub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 21
  },

  // ── Cards content area ──
  cardsContainer: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    flex: 1
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5
  },
  cardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    flexShrink: 0
  },
  cardBody: {
    flex: 1
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    marginBottom: 3
  },
  cardDesc: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md,
    lineHeight: 18,
    marginBottom: 8
  },
  cardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill
  },
  cardTagText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold'
  },
  cardChevron: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    flexShrink: 0
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: SPACING.sm
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  dividerText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium'
  },
  signupRow: {
    flexDirection: 'row',
    gap: SPACING.sm
  },
  signupBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.lg,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  signupText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },

});
