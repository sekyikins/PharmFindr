import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { router } from 'expo-router';

/**
 * Safely load the expo-notifications module only when NOT running in Expo Go.
 * (Expo Go in SDK 53+ throws an error at module load time if expo-notifications is imported statically).
 */
async function getNotificationsModule() {
  if (Platform.OS === 'web') return null;

  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    (Constants.executionEnvironment as string) === 'storeClient';

  if (isExpoGo) {
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');
    return Notifications;
  } catch (e) {
    console.warn('[PushNotifications] Could not load expo-notifications module:', e);
    return null;
  }
}

// Safely configure notification handler & interaction listener
getNotificationsModule().then((Notifications) => {
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
        if (!data) return;

        // 1. Mark notification as read
        const notificationId = data.notification_id;
        if (notificationId) {
          try {
            const { useNotificationStore } = await import('@/store/notificationStore');
            useNotificationStore.getState().markRead(notificationId);
          } catch (_) {}
        } else if (data.reservation_id) {
          try {
            const { supabase } = await import('./supabase');
            const { data: notifRows } = await supabase
              .from('notifications')
              .select('id')
              .eq('is_read', false)
              .filter('metadata->>reservation_id', 'eq', data.reservation_id)
              .limit(1);

            if (notifRows && notifRows[0]?.id) {
              const { useNotificationStore } = await import('@/store/notificationStore');
              useNotificationStore.getState().markRead(notifRows[0].id);
            }
          } catch (_) {}
        }

        // 2. Resolve active role to determine patient vs pharmacy layout navigation
        let isPharmacy = false;
        try {
          const { useAuthStore } = await import('@/store/authStore');
          isPharmacy = useAuthStore.getState().profile?.role === 'pharmacy';
        } catch (_) {}

        // 3. Route to exact detail screen
        if (data.type === 'reservation') {
          if (data.reservation_id) {
            if (isPharmacy) {
              router.push({
                pathname: '/(pharmacy)/pharmacy-reservation/[id]',
                params: { id: data.reservation_id },
              } as any);
            } else {
              router.push({
                pathname: '/(patient)/reservation/[id]',
                params: { id: data.reservation_id },
              } as any);
            }
          } else {
            router.push(isPharmacy ? '/(pharmacy)/(tabs)/reservations' : '/(patient)/reservations-history' as any);
          }
        } else if (data.type === 'prescription') {
          router.push('/(patient)/prescription-history' as any);
        }
      } catch (err) {
        console.warn('[PushNotifications] Error handling notification response:', err);
      }
    });
  }
});

/**
 * Register the device for Expo Push Notifications and save the push token to Supabase.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    console.log(
      '[PushNotifications] Remote push notifications are disabled in Expo Go (SDK 53+). Please use a Development Build or Standalone APK for push notification support.'
    );
    return null;
  }

  try {
    const settings = (await Notifications.getPermissionsAsync()) as any;
    let isGranted = settings?.granted || settings?.status === 'granted';

    if (!isGranted) {
      const req = (await Notifications.requestPermissionsAsync()) as any;
      isGranted = req?.granted || req?.status === 'granted';
    }

    if (!isGranted) {
      console.warn('[PushNotifications] Notification permission request denied by user.');
      return null;
    }

    // Configure Android notification channel (required for Android 8.0+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'PharmFindr Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00875A',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Retrieve Expo Push Token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      '7e2c77fd-b4be-4420-a531-f37eec823599';

    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;

    console.log('[PushNotifications] Device push token retrieved successfully:', token);

    if (userId && token) {
      await savePushTokenToSupabase(userId, token);
    }

    return token;
  } catch (error: any) {
    console.warn('[PushNotifications] Error registering for push notifications:', error?.message || error);
    return null;
  }
}

/**
 * Save or update Expo Push Token in Supabase `push_tokens` table.
 */
export async function savePushTokenToSupabase(userId: string, token: string): Promise<void> {
  try {
    // Delete any old stale push tokens for this user
    await supabase.from('push_tokens').delete().eq('user_id', userId).neq('token', token);

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token: token,
        device_type: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) {
      console.warn('[PushNotifications] Error saving push token to Supabase:', error.message);
    } else {
      console.log('[PushNotifications] Push token saved to Supabase successfully for user:', userId);
    }
  } catch (err: any) {
    console.warn('[PushNotifications] Exception saving push token:', err?.message || err);
  }
}

/**
 * Schedule a local medication reminder alarm directly on the user's device.
 */
export async function scheduleLocalMedicationReminder(params: {
  id?: string;
  title: string;
  body: string;
  triggerDate: Date;
}): Promise<string | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: true,
        data: { type: 'medication_reminder', id: params.id },
      },
      trigger: params.triggerDate as any,
    });
    return identifier;
  } catch (err: any) {
    console.warn('[PushNotifications] Error scheduling local reminder:', err?.message || err);
    return null;
  }
}

/**
 * Cancel a scheduled local notification.
 */
export async function cancelLocalNotification(identifier: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err: any) {
    console.warn('[PushNotifications] Error cancelling local notification:', err?.message || err);
  }
}
