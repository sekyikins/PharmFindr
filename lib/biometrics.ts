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
 * Check if the device hardware supports biometric authentication.
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    return !!hasHardware;
  } catch (e) {
    return false;
  }
}

/**
 * Check if the user has enrolled biometrics (Face ID, Touch ID, Fingerprint).
 */
export async function isBiometricsEnrolled(): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return !!isEnrolled;
  } catch (e) {
    return false;
  }
}

/**
 * Get human-readable biometric type (e.g. "Fingerprint", "Face ID", "Touch ID", "Biometrics").
 */
export async function getBiometricType(): Promise<string> {
  if (Platform.OS === 'web' || !LocalAuthentication) return 'Biometrics';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

    if (Platform.OS === 'android') {
      if (hasFingerprint && hasFace) {
        return 'Fingerprint / Face Unlock';
      }
      if (hasFingerprint) {
        return 'Fingerprint';
      }
      if (hasFace) {
        return 'Face Unlock';
      }
      if (hasIris) {
        return 'Iris Scanner';
      }
      return 'Biometrics';
    }

    // iOS Devices
    if (hasFace) {
      return 'Face ID';
    }
    if (hasFingerprint) {
      return 'Touch ID';
    }
  } catch (e) {
    // fallback
  }
  return 'Biometrics';
}

/**
 * Prompt native biometric authentication modal.
 */
export async function authenticateBiometrics(promptMessage = 'Authenticate to access PharmFindr'): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
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
