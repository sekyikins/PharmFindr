import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Alert, StatusBar, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAuthStore } from '@/store/authStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import OfflineBanner from '@/components/ui/OfflineBanner';
import {
  isBiometricsSupported,
  isBiometricsEnrolled,
  getBiometricType,
  authenticateBiometrics,
  getBiometricsPreference,
} from '@/lib/biometrics';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    // Keep the native splash screen visible until fonts are ready — no spinner flash.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { user, securityNotice, clearSecurityNotice } = useAuthStore();
  const [isLocked, setIsLocked] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
      checkBiometricLock();
    } else {
      setIsLocked(false);
    }
  }, [user?.id]);

  const checkBiometricLock = async () => {
    const enabled = await getBiometricsPreference();
    if (!enabled) return;

    const label = await getBiometricType();
    setBiometricType(label);
    setIsLocked(true);
    triggerUnlock(label);
  };

  const triggerUnlock = async (label = biometricType) => {
    const success = await authenticateBiometrics(`Unlock PharmFindr with ${label}`);
    if (success) {
      setIsLocked(false);
    }
  };

  useEffect(() => {
    if (securityNotice) {
      Alert.alert('Security Notice', securityNotice, [
        { text: 'OK', onPress: () => clearSecurityNotice() },
      ]);
    }
  }, [securityNotice, clearSecurityNotice]);

  return (
    <BottomSheetModalProvider>
      <ThemeProvider value={DefaultTheme}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <OfflineBanner />

        {isLocked ? (
          <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Ionicons name="lock-closed" size={64} color="#10b981" style={{ marginBottom: 16 }} />
            <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>PharmFindr Locked</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
              Biometric authentication is required to access your medical records and active reservations.
            </Text>
            <Pressable
              style={({ pressed }) => [
                { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => triggerUnlock()}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Unlock with {biometricType}</Text>
            </Pressable>
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 220,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(patient)" />
            <Stack.Screen name="(pharmacy)" />
          </Stack>
        )}
      </ThemeProvider>
    </BottomSheetModalProvider>
  );
}
