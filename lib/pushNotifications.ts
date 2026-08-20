import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

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

// Safely configure notification handler
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
      '[PushNotifications] Remote push notifications are disabled in Expo Go (SDK 53+). Use a development build for push tokens.'
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
      console.log('[PushNotifications] Notification permissions not granted.');
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
      'e6ea880a-486a-42e1-8be7-ca44af58f58d';

    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;

    console.log('[PushNotifications] Device push token retrieved:', token);

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
      console.log('[PushNotifications] Push token saved to Supabase successfully.');
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
