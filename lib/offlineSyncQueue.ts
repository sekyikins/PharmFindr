import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_STORAGE_KEY = 'PharmFindr_offline_sync_queue';
const MAX_RETRIES = 3;

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
  retryCount?: number;
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
      retryCount: 0,
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
      const currentRetries = (item.retryCount || 0) + 1;

      try {
        let success = false;

        switch (item.type) {
          case 'UPDATE_PROFILE':
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
            const imageUri = item.payload?.imageUri;
            if (imageUri) {
              // Discard expired blob URLs from previous web sessions immediately
              if (imageUri.startsWith('blob:')) {
                console.warn('[OfflineQueue] Discarding expired web blob avatar URL:', imageUri);
                success = true; // Drop item
                break;
              }

              const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
              const fileName = `${item.userId}-${Date.now()}.${fileExt}`;
              
              const response = await fetch(imageUri).catch((fetchErr) => {
                console.warn('[OfflineQueue] File not accessible, discarding stale upload:', fetchErr);
                return null;
              });

              if (!response || !response.ok) {
                // If file is gone/deleted from cache, do not retry indefinitely
                success = true; // Drop dead file
                break;
              }

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
            } else {
              success = true; // Empty payload, discard
            }
            break;
          }

          default:
            success = true;
            break;
        }

        if (success) {
          syncedCount++;
        } else if (currentRetries < MAX_RETRIES) {
          remainingQueue.push({ ...item, retryCount: currentRetries });
        } else {
          console.warn(`[OfflineQueue] Discarding item ${item.id} after exceeding max retries.`);
        }
      } catch (e) {
        if (currentRetries < MAX_RETRIES) {
          remainingQueue.push({ ...item, retryCount: currentRetries });
        } else {
          console.warn(`[OfflineQueue] Discarding failing item ${item.id} after error:`, e);
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remainingQueue));
    return { syncedCount };
  } catch (e) {
    return { syncedCount: 0 };
  }
}
