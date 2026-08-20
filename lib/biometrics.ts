import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRICS_ENABLED_KEY = 'PharmFindr_biometrics_enabled';

let LocalAuthentication: any = null;

try {
  LocalAuthentication = require('expo-local-authentication');
} catch (e) {
  // Graceful fallback if native module is unavailable on web
}

/**
 * Check if the device hardware supports biometric authentication (Face ID, Face Unlock, Fingerprint, Iris).
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return hasHardware || (Array.isArray(types) && types.length > 0) || level > 0;
  } catch (e) {
    return true; // Allow native prompt to determine
  }
}

/**
 * Check if the user has enrolled biometrics (Face ID, Face Unlock, Fingerprint, or device credentials).
 */
export async function isBiometricsEnrolled(): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (isEnrolled) return true;
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    // SecurityLevel: NONE (0), SECRET (1), BIOMETRIC_WEAK (2, e.g. Android Face Unlock), BIOMETRIC_STRONG (3)
    return level > 0;
  } catch (e) {
    return true; // Allow native prompt to determine
  }
}

/**
 * Get human-readable biometric type (always returns "Biometrics").
 */
export async function getBiometricType(): Promise<string> {
  return 'Biometrics';
}

/**
 * Get the standard biometrics icon.
 */
export async function getBiometricIcon(): Promise<string> {
  return 'finger-print-outline';
}

/**
 * Prompt native biometric authentication modal (Face ID / Touch ID / Fingerprint).
 */
export async function authenticateBiometrics(promptMessage = 'Authenticate to access PharmFindr'): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return !!result.success;
  } catch (e) {
    console.warn('Biometric authentication error:', e);
    return false;
  }
}

/**
 * Get user biometric preference setting.
 */
export async function getBiometricsPreference(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
    return val === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Set user biometric preference setting.
 */
export async function setBiometricsPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    // Ignore storage write error
  }
}
