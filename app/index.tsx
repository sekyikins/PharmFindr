import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

export default function Index() {
  const { session, profile, loading, initialize } = useAuthStore();
  const router = useRouter();
  const theme = colors.light;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      // Redirect to onboarding/login
      router.replace('/(auth)/login');
    } else if (profile) {
      if (profile.role === 'pharmacy') {
        router.replace('/(pharmacy)/(tabs)/dashboard');
      } else {
        router.replace('/(patient)/(tabs)/home');
      }
    }
  }, [session, profile, loading]);

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
