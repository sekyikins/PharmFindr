import { COLORS } from '@/styles/theme';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Alert, StatusBar, View, Text as RNText, TextInput as RNTextInput, StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAuthStore } from '@/store/authStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { ToastProvider } from '@/context/ToastContext';
import {
  isBiometricsSupported,
  isBiometricsEnrolled,
  getBiometricType,
  authenticateBiometrics,
  getBiometricsPreference,
} from '@/lib/biometrics';

// Global font interceptor: Automatically applies Inter font family to all StyleSheet objects & Text/TextInput
try {
  (RNText as any).defaultProps = (RNText as any).defaultProps || {};
  const existingTextStyle = (RNText as any).defaultProps.style;
  (RNText as any).defaultProps.style = existingTextStyle
    ? [{ fontFamily: 'Inter-Regular' }, existingTextStyle]
    : { fontFamily: 'Inter-Regular' };
} catch {}

try {
  (RNTextInput as any).defaultProps = (RNTextInput as any).defaultProps || {};
  const existingInputStyle = (RNTextInput as any).defaultProps.style;
  (RNTextInput as any).defaultProps.style = existingInputStyle
    ? [{ fontFamily: 'Inter-Regular' }, existingInputStyle]
    : { fontFamily: 'Inter-Regular' };
} catch {}

const originalStyleSheetCreate = StyleSheet.create;
(StyleSheet as any).create = function (styles: any) {
  if (!styles) return originalStyleSheetCreate(styles);
  const patched: any = {};
  for (const key of Object.keys(styles)) {
    const styleObj = styles[key];
    if (styleObj && typeof styleObj === 'object') {
      const { fontWeight, fontFamily: existingFontFamily, ...restStyle } = styleObj;
      let fontFamily = existingFontFamily;
      if (!fontFamily) {
        if (fontWeight === '700' || fontWeight === 'bold' || fontWeight === '800' || fontWeight === '900') {
          fontFamily = 'Inter-Bold';
        } else if (fontWeight === '600') {
          fontFamily = 'Inter-SemiBold';
        } else if (fontWeight === '500') {
          fontFamily = 'Inter-Medium';
        } else {
          fontFamily = 'Inter-Regular';
        }
      }
      patched[key] = { fontFamily, ...restStyle };
    } else {
      patched[key] = styleObj;
    }
  }
  return originalStyleSheetCreate(patched);
};

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
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <OfflineBanner />

        {isLocked ? (
          <View style={{ flex: 1, backgroundColor: COLORS.surfaceDark, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Ionicons name="lock-closed" size={64} color={COLORS.pharmacyPrimary} style={{ marginBottom: 16 }} />
            <Text style={{ color: COLORS.white, fontSize: 22, fontFamily: 'Inter-Bold', marginBottom: 8 }}>PharmFindr Locked</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
              Biometric authentication is required to access your medical records and active reservations.
            </Text>
            <Pressable
              style={({ pressed }) => [
                { backgroundColor: COLORS.pharmacyPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => triggerUnlock()}
            >
              <Text style={{ color: COLORS.white, fontSize: 16, fontFamily: 'Inter-Bold' }}>Unlock with {biometricType}</Text>
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
