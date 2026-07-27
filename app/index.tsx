import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'pharmafindr_onboarding_seen';

export default function Index() {
  const { session, profile, loading, initialize } = useAuthStore();
  const router = useRouter();
  const theme = colors.light;
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    initialize();
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val === null); // null = never seen = first launch
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (loading || !onboardingChecked) return;

    if (showOnboarding) {
      // First launch — show onboarding before anything else
      router.replace('/(auth)/onboarding');
      return;
    }

    if (!session) {
      router.replace('/(auth)/login');
    } else if (profile) {
      if (profile.role === 'pharmacy') {
        router.replace('/(pharmacy)/(tabs)/dashboard');
      } else {
        router.replace('/(patient)/(tabs)/home');
      }
    }
  }, [session, profile, loading, onboardingChecked, showOnboarding]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.patient.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
