import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_STORAGE_KEY = 'pharmafindr_offline_sync_queue';

export type OfflineActionType =
  | 'UPDATE_PROFILE'
  | 'UPDATE_APP_USER'
  | 'TOGGLE_SAVED_MEDICINE'
  | 'UPLOAD_AVATAR';

export interface PendingOfflineAction {
  id: string;
  type: OfflineActionType;
  userId: string;
  payload: any;
  createdAt: string;
}

/**
 * Enqueue a pending mutation when device is offline.
 */
export async function enqueueOfflineAction(
  type: OfflineActionType,
  userId: string,
  payload: any
): Promise<void> {
  try {
    const existingStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    let queue: PendingOfflineAction[] = existingStr ? JSON.parse(existingStr) : [];

    // Filter out duplicate action of same type for user if payload targets same entity
    queue = queue.filter((item) => !(item.type === type && item.userId === userId));

    queue.push({
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      userId,
      payload,
      createdAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('enqueueOfflineAction error:', e);
  }
}

/**
 * Flush all pending queued mutations once internet connection is restored.
 */
export async function flushOfflineSyncQueue(): Promise<{ syncedCount: number }> {
  try {
    const existingStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!existingStr) return { syncedCount: 0 };

    const queue: PendingOfflineAction[] = JSON.parse(existingStr);
    if (queue.length === 0) return { syncedCount: 0 };

    const remainingQueue: PendingOfflineAction[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        let success = false;

        switch (item.type) {
          case 'UPDATE_PROFILE': {
            const { error } = await supabase.from('app_users').upsert({
              id: item.userId,
              ...item.payload,
              updated_at: new Date().toISOString(),
            });
            if (!error) success = true;
            break;
          }

          case 'UPDATE_APP_USER': {
            const { error } = await supabase.from('app_users').upsert({
              id: item.userId,
              ...item.payload,
              updated_at: new Date().toISOString(),
            });
            if (!error) success = true;
            break;
          }

          case 'UPLOAD_AVATAR': {
            if (item.payload?.imageUri) {
              const fileExt = item.payload.imageUri.split('.').pop()?.toLowerCase() || 'jpg';
              const fileName = `${item.userId}-${Date.now()}.${fileExt}`;
              const response = await fetch(item.payload.imageUri);
              const blob = await response.blob();

              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('avatars')
                .upload(fileName, blob, {
                  contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                  upsert: true,
                });

              if (!uploadErr && uploadData) {
                const { data: urlData } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(fileName);
                if (urlData?.publicUrl) {
                  await supabase.from('app_users').upsert({
                    id: item.userId,
                    avatar_url: urlData.publicUrl,
                    updated_at: new Date().toISOString(),
                  });
                  success = true;
                }
              }
            }
            break;
          }

          default:
            success = true;
            break;
        }

        if (success) {
          syncedCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch (e) {
        remainingQueue.push(item);
      }
    }

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remainingQueue));
    return { syncedCount };
  } catch (e) {
    return { syncedCount: 0 };
  }
}
