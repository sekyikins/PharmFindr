import * as Updates from 'expo-updates';

let hasCheckedThisSession = false;

export async function initializeUpdates(): Promise<void> {
  if (!Updates.isEnabled || __DEV__) return;
  if (hasCheckedThisSession) return;
  hasCheckedThisSession = true;

  try {
    const check = await Updates.checkForUpdateAsync();

    if (!check.isAvailable) return;

    const fetch = await Updates.fetchUpdateAsync();

    if (fetch.isNew) {
      await Updates.reloadAsync();
    }
  } catch {
    if (__DEV__) {
      console.log('[updates] Update check skipped or failed (dev mode or error).');
    }
  }
}
