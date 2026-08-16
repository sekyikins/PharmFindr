import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { Alert, StatusBar, View, Text, Pressable, AppState, type AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAuthStore } from '@/store/authStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { ToastProvider } from '@/context/ToastContext';
import {
  getBiometricType,
  getBiometricIcon,
  authenticateBiometrics,
  getBiometricsPreference,
} from '@/lib/biometrics';
import { initializeUpdates } from '@/lib/updates';

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
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Check for OTA updates after the app is visible — never blocks startup.
      initializeUpdates();
    }
  }, [loaded]);

  if (!loaded) {
    // Keep the native splash screen visible until fonts are ready — no spinner flash.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <RootLayoutNav />
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { user, securityNotice, clearSecurityNotice } = useAuthStore();
  const [isLocked, setIsLocked] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricIcon, setBiometricIcon] = useState('scan-outline');
  const lastBackgroundTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
      checkBiometricLock();
    } else {
      setIsLocked(false);
    }
  }, [user?.id]);

  // Handle auto-lock when app goes to background / screen turns off for >= 5 minutes (300,000 ms)
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastBackgroundTimestamp.current = Date.now();
      } else if (nextState === 'active') {
        if (lastBackgroundTimestamp.current && user?.id) {
          const elapsed = Date.now() - lastBackgroundTimestamp.current;
          const FIVE_MINUTES_MS = 5 * 60 * 1000;
          if (elapsed >= FIVE_MINUTES_MS) {
            const enabled = await getBiometricsPreference();
            if (enabled) {
              const label = await getBiometricType();
              const icon = await getBiometricIcon();
              setBiometricType(label);
              setBiometricIcon(icon);
              setIsLocked(true);
              triggerUnlock(label);
            }
          }
        }
        lastBackgroundTimestamp.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [user?.id]);

  const checkBiometricLock = async () => {
    const enabled = await getBiometricsPreference();
    if (!enabled) return;

    const label = await getBiometricType();
    const icon = await getBiometricIcon();
    setBiometricType(label);
    setBiometricIcon(icon);
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
      ], { cancelable: true });
    }
  }, [securityNotice, clearSecurityNotice]);

  return (
    <BottomSheetModalProvider>
      <ThemeProvider value={DefaultTheme}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} translucent={false} />
        <OfflineBanner />

        {isLocked ? (
          <View style={{ flex: 1, backgroundColor: COLORS.surfaceDark, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
            <View style={{ width: 88, height: 88, borderRadius: RADIUS.pill, backgroundColor: COLORS.pharmacyPrimary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl }}>
              <Ionicons name={biometricIcon as any} size={44} color={COLORS.pharmacyPrimary} />
            </View>
            <Text style={{ color: COLORS.white, fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', marginBottom: SPACING.sm }}>PharmFindr Locked</Text>
            <Text style={{ color: COLORS.textDim, fontSize: FONT_SIZE.md, fontFamily: 'Inter-Regular', textAlign: 'center', marginBottom: SPACING.xxxl, paddingHorizontal: SPACING.lg, lineHeight: 20 }}>
              {biometricType} authentication is required to access your medical records and active reservations.
            </Text>
            <Pressable
              style={({ pressed }) => [
                { backgroundColor: COLORS.pharmacyPrimary, paddingHorizontal: SPACING.xxxl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => triggerUnlock()}
            >
              <Ionicons name={biometricIcon as any} size={18} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold' }}>Unlock with {biometricType}</Text>
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
