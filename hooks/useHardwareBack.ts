import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

/**
 * Custom hook to ensure Android device hardware back button performs the exact
 * intended navigation action when the screen is focused.
 */
export function useHardwareBack(customBackAction?: () => boolean | void) {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (customBackAction) {
          const res = customBackAction();
          if (res !== false) {
            return true;
          }
        }

        if (router.canGoBack()) {
          router.back();
          return true;
        }

        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => {
        subscription.remove();
      };
    }, [customBackAction, router])
  );
}
