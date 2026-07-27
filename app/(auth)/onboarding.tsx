import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'pharmafindr_onboarding_seen';

const slides = [
  {
    id: '1',
    title: 'Scan Your Prescription',
    description:
      'Take a picture of your prescription and let AI identify your medicines instantly.',
    icon: 'scan-outline' as const,
    emoji: '📄',
    accent: '#2563eb',
    bg: '#eff6ff',
    iconBg: '#dbeafe',
  },
  {
    id: '2',
    title: 'Understand Your Medicines',
    description:
      'Ask the AI questions about dosage, usage, precautions and side effects.',
    icon: 'chatbubble-ellipses-outline' as const,
    emoji: '💊',
    accent: '#7c3aed',
    bg: '#f5f3ff',
    iconBg: '#ede9fe',
  },
  {
    id: '3',
    title: 'Locate & Reserve',
    description:
      'Find nearby pharmacies that have the medicine, and request reservations with a click.',
    icon: 'location-outline' as const,
    emoji: '🏥',
    accent: '#10b981',
    bg: '#ecfdf5',
    iconBg: '#d1fae5',
  },
];

export default function Onboarding() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const router = useRouter();
  const theme = colors.light;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const markSeenAndContinue = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/role-select');
  };

  const animateTransition = (toIndex: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrentSlideIndex(toIndex);
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      animateTransition(currentSlideIndex + 1);
    } else {
      markSeenAndContinue();
    }
  };

  const handleSkip = () => {
    markSeenAndContinue();
  };

  const currentSlide = slides[currentSlideIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentSlide.bg }]}>
      {/* Skip button */}
      <View style={styles.header}>
        <View />
        <Pressable onPress={handleSkip} style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}>
          <Text style={[styles.skipText, { color: currentSlide.accent }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Slide Content */}
      <Animated.View style={[styles.slideContent, { opacity: fadeAnim }]}>
        {/* Graphic */}
        <View style={[styles.graphicContainer, { backgroundColor: currentSlide.iconBg }]}>
          <Text style={styles.graphicEmoji}>{currentSlide.emoji}</Text>
          <View style={[styles.iconCircle, { backgroundColor: currentSlide.accent + '22' }]}>
            <Ionicons name={currentSlide.icon} size={40} color={currentSlide.accent} />
          </View>
        </View>

        <Text style={styles.title}>
          {currentSlide.title}
        </Text>

        <Text style={[styles.description, { color: theme.textMuted }]}>
          {currentSlide.description}
        </Text>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Dot indicators */}
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => animateTransition(index)}
              style={({ pressed }) =>[styles.indicator, pressed && { opacity: 0.5 },
                {
                  backgroundColor:
                    index === currentSlideIndex ? currentSlide.accent : '#cbd5e1',
                  width: index === currentSlideIndex ? 28 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <Pressable
          style={({ pressed }) =>[styles.button, pressed && { opacity: 0.5 }, { backgroundColor: currentSlide.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentSlideIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={currentSlideIndex === slides.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 52,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  graphicContainer: {
    width: 220,
    height: 220,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 44,
    position: 'relative',
  },
  graphicEmoji: {
    fontSize: 56,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 6,
    alignItems: 'center',
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
