import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Alert, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { useAuthStore } from '@/store/authStore';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import OfflineBanner from '@/components/ui/OfflineBanner';

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

  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
    }
  }, [user?.id]);

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
        {/* Default to dark status bar text (visible on white/light backgrounds) */}
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <OfflineBanner />
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
      </ThemeProvider>
    </BottomSheetModalProvider>
  );
}
