import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'pharmafindr_device_id';
const LAST_ACTIVE_KEY = 'pharmafindr_last_active_at';
const INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get or generate a persistent unique Device ID for this installation.
 */
export async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      const randomSegment = Math.random().toString(36).substring(2, 10);
      const timestamp = Date.now().toString(36);
      deviceId = `dev_${Platform.OS}_${timestamp}_${randomSegment}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    return `dev_fallback_${Date.now()}`;
  }
}

/**
 * Record user activity timestamp.
 */
export async function updateLastActiveTimestamp(): Promise<void> {
  try {
    const now = Date.now().toString();
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, now);
  } catch (e) {
    // Ignore storage write errors
  }
}

/**
 * Check if the current account session has been inactive for > 7 days.
 */
export async function checkInactivityTimeout(): Promise<boolean> {
  try {
    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActiveStr) {
      await updateLastActiveTimestamp();
      return false;
    }
    const lastActive = parseInt(lastActiveStr, 10);
    if (isNaN(lastActive)) return false;

    const diff = Date.now() - lastActive;
    return diff > INACTIVITY_TIMEOUT_MS;
  } catch (e) {
    return false;
  }
}

interface ActiveSessionItem {
  device_id: string;
  platform: string;
  last_seen: string;
}

/**
 * Enforce maximum concurrent active device sessions (2 for patients, 3 for pharmacies).
 */
export async function registerDeviceSession(userId: string, role: 'patient' | 'pharmacy' | 'user' | 'both'): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const maxDevices = role === 'pharmacy' ? 3 : 2;

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return;

    const metadata = userRes.user.user_metadata || {};
    let activeSessions: ActiveSessionItem[] = metadata.active_sessions || [];

    // Filter out stale sessions older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    activeSessions = activeSessions.filter((s) => s.last_seen > thirtyDaysAgo);

    // Remove existing entry for current device if present
    activeSessions = activeSessions.filter((s) => s.device_id !== deviceId);

    // Add current device session to top of list
    activeSessions.unshift({
      device_id: deviceId,
      platform: Platform.OS,
      last_seen: new Date().toISOString(),
    });

    // If active devices exceed limit, enforce cutoff by truncating oldest device
    if (activeSessions.length > maxDevices) {
      activeSessions = activeSessions.slice(0, maxDevices);
    }

    // Update user metadata in Supabase
    await supabase.auth.updateUser({
      data: {
        active_sessions: activeSessions,
        current_device_id: deviceId,
      },
    });

    await updateLastActiveTimestamp();
  } catch (e) {
    console.warn('Device session registration warning:', e);
  }
}

/**
 * Revoke all active sessions on other devices when user changes their password.
 */
export async function revokeAllOtherSessions(): Promise<void> {
  try {
    const currentDeviceId = await getDeviceId();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return;

    const updatedSessions = [
      {
        device_id: currentDeviceId,
        platform: Platform.OS,
        last_seen: new Date().toISOString(),
      },
    ];

    // Global sign out via Supabase auth (revokes all refresh tokens globally)
    await supabase.auth.signOut({ scope: 'global' });

    // Update user metadata to clear remote active device list
    await supabase.auth.updateUser({
      data: {
        active_sessions: updatedSessions,
        password_changed_at: new Date().toISOString(),
      },
    });

    await updateLastActiveTimestamp();
  } catch (e) {
    console.warn('Revoke all other sessions warning:', e);
  }
}
