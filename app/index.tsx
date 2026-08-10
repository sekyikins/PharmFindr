import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'PharmFindr_onboarding_seen';

export default function Index() {
  const { session, profile, loading, initialize } = useAuthStore();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    initialize();
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val === null); // null = never seen = first launch
      setOnboardingChecked(true);
    });
  }, []);

  if (loading || !onboardingChecked) {
    // Splash screen stays visible while initializing auth & onboarding state
    return null;
  }

  if (showOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile?.role === 'pharmacy') {
    return <Redirect href="/(pharmacy)/(tabs)/dashboard" />;
  }

  return <Redirect href="/(patient)/(tabs)/home" />;
}
