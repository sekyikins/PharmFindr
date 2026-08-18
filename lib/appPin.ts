import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_PIN_KEY = 'PharmFindr_pharmacy_app_pin';

/**
 * Check whether a 4-digit security PIN has been set for the app.
 */
export async function hasAppPin(): Promise<boolean> {
  try {
    const pin = await AsyncStorage.getItem(APP_PIN_KEY);
    return !!pin && pin.length === 4;
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve the stored 4-digit security PIN.
 */
export async function getAppPin(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(APP_PIN_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Save or update the 4-digit security PIN.
 */
export async function setAppPin(pin: string): Promise<boolean> {
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return false;
  }
  try {
    await AsyncStorage.setItem(APP_PIN_KEY, pin);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Verify if the entered PIN matches the stored 4-digit PIN.
 */
export async function verifyAppPin(enteredPin: string): Promise<boolean> {
  try {
    const storedPin = await AsyncStorage.getItem(APP_PIN_KEY);
    if (!storedPin) return false;
    return storedPin.trim() === enteredPin.trim();
  } catch (e) {
    return false;
  }
}

/**
 * Remove / reset the stored PIN.
 */
export async function removeAppPin(): Promise<void> {
  try {
    await AsyncStorage.removeItem(APP_PIN_KEY);
  } catch (e) {
    // Ignore storage errors
  }
}
