import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const ONBOARDING_KEY = 'PharmFindr_onboarding_seen';

const slides = [
  {
    id: '1',
    badge: 'INSTANT PRESCRIPTION EXTRACTION',
    title: 'Scan Medical Prescriptions',
    description:
      'Snap a photo of your prescription. PharmFindr AI instantly extracts dosages, frequencies, and medicine names.',
    icon: 'scan-outline' as const,
    featureTags: ['Handwriting OCR', 'Instant Extraction', 'Safety Check'],
  },
  {
    id: '2',
    badge: 'DYNAMIC CLINICAL AI',
    title: 'Understand Dosage & Safety',
    description:
      'Get personalized guidance tailored to your age, weight, allergies, and medical profile directly from your Clinical AI Assistant.',
    icon: 'sparkles-outline' as const,
    featureTags: ['Personalized AI', 'Allergy Alerts', 'Side Effects'],
  },
  {
    id: '3',
    badge: 'LIVE PHARMACY SEARCH',
    title: 'Locate Stock & Reserve Nearby',
    description:
      'Find verified nearby pharmacies with real-time stock availability, compare prices, and reserve your medications in one tap.',
    icon: 'location-outline' as const,
    featureTags: ['Nearby Pharmacies', 'Live Stock', 'Easy Reservation'],
  },
];

export default function Onboarding() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const currentIndexRef = useRef(0); // ref so PanResponder always reads latest value
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const markSeenAndContinue = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/role-select');
  };

  const animateTransition = (toIndex: number, direction: 'forward' | 'backward' = 'forward') => {
    const outX = direction === 'forward' ? -40 : 40;
    const inX = direction === 'forward' ? 40 : -40;

    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.93, duration: 120, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(translateX, { toValue: outX, duration: 120, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();

    currentIndexRef.current = toIndex;
    setCurrentSlideIndex(toIndex);
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      animateTransition(currentSlideIndex + 1, 'forward');
    } else {
      markSeenAndContinue();
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      animateTransition(currentSlideIndex - 1, 'backward');
    }
  };

  const handleSkip = () => {
    markSeenAndContinue();
  };

  // Swipe gesture handler — reads currentIndexRef to avoid stale closure
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30,
      onPanResponderRelease: (_, gestureState) => {
        const idx = currentIndexRef.current;
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left → forward
          if (idx < slides.length - 1) {
            animateTransition(idx + 1, 'forward');
          } else {
            markSeenAndContinue();
          }
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right → backward
          if (idx > 0) {
            animateTransition(idx - 1, 'backward');
          }
        }
      },
    })
  ).current;

  const currentSlide = slides[currentSlideIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Top Header Bar ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.brandIcon}
          />
          <Text style={[styles.brandName, { color: theme.text.primary }]}>PharmFindr</Text>
        </View>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipBtn,
            pressed && { opacity: 0.6 },
            { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      {/* ── Slide Content ── */}
      <Animated.View
        style={[
          styles.slideContent,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Graphic Card */}
        <View
          style={[
            styles.graphicCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.ringOuter, { backgroundColor: primaryColor + '18', borderRadius: RADIUS.pill }]}>
            <View style={[styles.ringInner, { backgroundColor: primaryColor + '28' }]}>
              <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}>
                <Ionicons name={currentSlide.icon} size={36} color={COLORS.white} />
              </View>
            </View>
          </View>
        </View>

        {/* Badge pill below card */}
        <View style={[styles.badgePill, { backgroundColor: primaryColor + '15' }]}>
          <Text style={[styles.badgePillText, { color: primaryColor }]}>
            {currentSlide.badge}
          </Text>
        </View>

        {/* Title & Description */}
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {currentSlide.title}
        </Text>

        <Text style={[styles.description, { color: theme.textMuted }]}>
          {currentSlide.description}
        </Text>

        {/* Feature Tag Chips */}
        <View style={styles.tagRow}>
          {currentSlide.featureTags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.featureTag,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons name="checkmark-circle" size={12} color={primaryColor} />
              <Text style={[styles.featureTagText, { color: theme.text.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── Bottom Controls ── */}
      <View style={styles.footer}>
        {/* Progress Indicators */}
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <Pressable
              key={index}
              onPress={() =>
                animateTransition(index, index > currentSlideIndex ? 'forward' : 'backward')
              }
              style={({ pressed }) => [
                styles.indicator,
                pressed && { opacity: 0.6 },
                {
                  backgroundColor:
                    index === currentSlideIndex ? primaryColor : theme.borderLight,
                  width: index === currentSlideIndex ? 28 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Back + Next row */}
        <View style={styles.buttonRow}>
          {currentSlideIndex > 0 && (
            <Pressable
              onPress={handlePrev}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.7 },
                { borderColor: primaryColor, backgroundColor: theme.card },
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={primaryColor} />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.85 },
              { backgroundColor: primaryColor },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.buttonText}>
              {currentSlideIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
            </Text>
            <Ionicons
              name={currentSlideIndex === slides.length - 1 ? 'arrow-forward' : 'chevron-forward'}
              size={18}
              color={COLORS.white}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between'
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm
  },
  brandName: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  skipBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  skipText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },

  // ── Slide Content ──
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl
  },
  graphicCard: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28
  },
  ringOuter: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  ringInner: {
    width: 104,
    height: 104,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgePill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    marginTop: 10,
    marginBottom: SPACING.xs
  },
  badgePillText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8
  },

  title: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4
  },
  description: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.lg,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 18
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  featureTagText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold'
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: 'center'
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    gap: 6,
    alignItems: 'center'
  },
  indicator: {
    height: 8,
    borderRadius: 4
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%'
  },
  backBtn: {
    width: 48,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3
  },

});
