import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { Alert, StatusBar, View, Text, Pressable, AppState, type AppStateStatus, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { ToastProvider } from '@/context/ToastContext';
import {
  getBiometricType,
  getBiometricIcon,
  authenticateBiometrics,
  getBiometricsPreference,
} from '@/lib/biometrics';
import { hasAppPin, verifyAppPin } from '@/lib/appPin';
import { initializeUpdates } from '@/lib/updates';
import * as Linking from 'expo-linking';
import { redactUrl } from '@/lib/authUrlHandler';

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
  const router = useRouter();
  const { user, securityNotice, clearSecurityNotice, signOut } = useAuthStore();
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');
  const [biometricIcon, setBiometricIcon] = useState('finger-print-outline');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const lastBackgroundTimestamp = useRef<number | null>(null);
  const pinInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // 1. Cold start deep link detection
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log('[DeepLink Entry: Cold Start] URL received:', redactUrl(url));
        } else {
          console.log('[DeepLink Entry: Cold Start] No initial URL detected (Linking.getInitialURL() returned null)');
        }
      })
      .catch((e) => {
        console.warn('[DeepLink Entry: Cold Start Error]', e);
      });

    // 2. Warm / Background deep link detection
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink Entry: Warm/Background] URL received:', redactUrl(url));
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
      useNotificationStore.getState().fetchNotifications(user.id);
      useNotificationStore.getState().subscribe(user.id);
      checkLockStatus();
    } else {
      setIsLocked(false);
      useNotificationStore.getState().unsubscribe();
    }
  }, [user?.id]);

  const checkLockStatus = async () => {
    const [bioPref, pinSet, label, icon] = await Promise.all([
      getBiometricsPreference(),
      hasAppPin(),
      getBiometricType(),
      getBiometricIcon(),
    ]);

    setBiometricsEnabled(bioPref);
    setHasPin(pinSet);
    setBiometricType(label);
    setBiometricIcon(icon);

    if (bioPref || pinSet) {
      if (bioPref) {
        setIsLocked(true);
        triggerUnlock(label);
      }
    }
  };

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
            const [bioPref, pinSet, label, icon] = await Promise.all([
              getBiometricsPreference(),
              hasAppPin(),
              getBiometricType(),
              getBiometricIcon(),
            ]);

            setBiometricsEnabled(bioPref);
            setHasPin(pinSet);
            setBiometricType(label);
            setBiometricIcon(icon);

            if (bioPref || pinSet) {
              setIsLocked(true);
              setPinInput('');
              setPinError('');
              if (bioPref) {
                triggerUnlock(label);
              }
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
  }, [user?.id, biometricType]);

  const handlePinSubmit = async (enteredPin: string) => {
    if (enteredPin.length === 4) {
      const valid = await verifyAppPin(enteredPin);
      if (valid) {
        setIsLocked(false);
        setPinInput('');
        setPinError('');
      } else {
        setPinError('Incorrect PIN. Please try again.');
        setPinInput('');
      }
    }
  };

  const triggerUnlock = async (label = biometricType) => {
    const success = await authenticateBiometrics(`Unlock PharmFindr with ${label}`);
    if (success) {
      setIsLocked(false);
      setPinInput('');
      setPinError('');
    }
  };

  // Compulsory Non-Dismissible Alert on Deleted Account or Revoked Session
  useEffect(() => {
    if (securityNotice) {
      Alert.alert(
        'Account Notice',
        securityNotice,
        [
          {
            text: 'OK',
            onPress: async () => {
              clearSecurityNotice();
              await signOut();
              router.replace('/(auth)/login');
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, [securityNotice, clearSecurityNotice, signOut, router]);

  return (
    <BottomSheetModalProvider>
      <ThemeProvider value={DefaultTheme}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} translucent={false} />
        <OfflineBanner />

        {isLocked ? (
          <View style={{ flex: 1, backgroundColor: COLORS.surfaceDark, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
            <View style={{ width: 80, height: 80, borderRadius: RADIUS.pill, backgroundColor: COLORS.pharmacyPrimary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg }}>
              <Ionicons name="lock-closed" size={38} color={COLORS.pharmacyPrimary} />
            </View>

            <Text style={{ color: COLORS.white, fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', marginBottom: SPACING.xs }}>PharmFindr Locked</Text>
            <Text style={{ color: COLORS.textDim, fontSize: FONT_SIZE.md, fontFamily: 'Inter-Regular', textAlign: 'center', marginBottom: SPACING.xxl, paddingHorizontal: SPACING.lg, lineHeight: 20 }}>
              {hasPin ? 'Enter your 4-digit security PIN to unlock' : 'Authentication required to access your account.'}
            </Text>

            {hasPin && (
              <View style={{ alignItems: 'center', marginBottom: SPACING.xl, width: '100%' }}>
                {/* 4 Digit Visual Indicator Dots */}
                <Pressable
                  onPress={() => pinInputRef.current?.focus()}
                  style={{ flexDirection: 'row', gap: 16, marginBottom: SPACING.md, paddingVertical: SPACING.sm }}
                >
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = pinInput.length > idx;
                    return (
                      <View
                        key={idx}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: filled ? COLORS.pharmacyPrimary : COLORS.borderSlate,
                          backgroundColor: filled ? COLORS.pharmacyPrimary : 'transparent',
                        }}
                      />
                    );
                  })}
                </Pressable>

                {/* Hidden numeric input */}
                <TextInput
                  ref={pinInputRef}
                  value={pinInput}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, '').slice(0, 4);
                    setPinInput(clean);
                    setPinError('');
                    if (clean.length === 4) {
                      handlePinSubmit(clean);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                />

                {!!pinError && (
                  <Text style={{ color: COLORS.error, fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium', marginTop: SPACING.xs }}>
                    {pinError}
                  </Text>
                )}
              </View>
            )}

            {biometricsEnabled && (
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: COLORS.pharmacyPrimary,
                    paddingHorizontal: SPACING.xxxl,
                    paddingVertical: SPACING.md,
                    borderRadius: RADIUS.pill,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: SPACING.xs,
                    marginTop: SPACING.sm,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => triggerUnlock()}
              >
                <Ionicons name={biometricIcon as any} size={20} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold' }}>
                  Unlock with {biometricType}
                </Text>
              </Pressable>
            )}
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
