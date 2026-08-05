import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'PharmFindr_onboarding_seen';

export default function Index() {
  const { session, profile, loading, initialize } = useAuthStore();
  const router = useRouter();
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

  // Blank screen — routing happens in the effect above.
  // The native splash screen stays visible until the redirect fires.
  return null;
}
