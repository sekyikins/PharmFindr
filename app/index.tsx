import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'PharmFindr_onboarding_seen';

export default function Index() {
  const { session, profile, initialize } = useAuthStore();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    initialize();
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => {
        setShowOnboarding(val === null); // null = never seen = first launch
        setOnboardingChecked(true);
      })
      .catch(() => {
        setShowOnboarding(false);
        setOnboardingChecked(true);
      });
  }, []);

  if (!onboardingChecked) {
    return null;
  }

  if (showOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const role = profile?.role || session.user?.user_metadata?.role;

  if (role === 'pharmacy') {
    return <Redirect href="/(pharmacy)/(tabs)/dashboard" />;
  }

  return <Redirect href="/(patient)/(tabs)/home" />;
}
