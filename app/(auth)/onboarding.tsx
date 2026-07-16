import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { colors } from '@/theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Scan Your Prescription',
    description: 'Take a picture of your prescription and let AI identify your medicines instantly.',
    icon: '✨ 🔍 📄', // Emoji mockup for illustrations
    bgColorLight: '#eff6ff',
  },
  {
    id: '2',
    title: 'Understand Your Medicines',
    description: 'Ask the AI questions about dosage, usage, precautions and side effects.',
    icon: '💊 ✨ 💬',
    bgColorLight: '#eff6ff',
  },
  {
    id: '3',
    title: 'Locate & Reserve',
    description: 'Find nearby pharmacies that have the medicine, and request reservations with a click.',
    icon: '📍 🏥 🛒',
    bgColorLight: '#eff6ff',
  }
];

export default function Onboarding() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      handleSkip();
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  const currentSlide = slides[currentSlideIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? theme.background : currentSlide.bgColorLight }]}>
      {/* Header */}
      <View style={styles.header}>
        <View />
        <Pressable onPress={handleSkip}>
          <Text style={[styles.skipText, { color: theme.text.secondary }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Slide Content */}
      <View style={styles.slideContent}>
        {/* Mock Graphic Container matching Figma */}
        <View style={[styles.graphicContainer, { backgroundColor: isDark ? theme.surface : '#ffffff' }]}>
          <Text style={styles.graphicEmoji}>{currentSlide.icon}</Text>
        </View>

        <Text style={[styles.title, { color: theme.text.primary }]}>
          {currentSlide.title}
        </Text>
        
        <Text style={[styles.description, { color: theme.text.secondary }]}>
          {currentSlide.description}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Indicators */}
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor: index === currentSlideIndex 
                    ? theme.patient.primary 
                    : (isDark ? theme.surfaceSecondary : '#cad5e2'),
                  width: index === currentSlideIndex ? 24 : 8,
                }
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <Pressable 
          style={[styles.button, { backgroundColor: theme.patient.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentSlideIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
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
    height: 48,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  graphicContainer: {
    width: 260,
    height: 200,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  graphicEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
