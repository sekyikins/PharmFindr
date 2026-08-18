import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { COLORS, FONT_SIZE, SPACING } from '@/styles/theme';
import { registerDeviceSession } from '@/lib/deviceSession';
import { processAuthUrl } from '@/lib/authUrlHandler';

export default function AuthCallback() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      try {
        const result = await processAuthUrl(incomingUrl);

        if (!mounted) return;

        // Route to reset password if this is a recovery link
        if (result.isRecovery) {
          router.replace('/(auth)/reset-password');
          return;
        }

        if (result.user) {
          const user = result.user;
          const metaName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.user_metadata?.user_name ||
            user.email?.split('@')[0] ||
            'PharmFindr User';
          const metaAvatar =
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null;

          // Background DB provisioning
          Promise.allSettled([
            supabase.from('user_roles').upsert({ id: user.id, role: 'user' }, { onConflict: 'id' }),
            supabase.from('app_users').upsert({
              id: user.id,
              full_name: metaName,
              avatar_url: metaAvatar,
            }, { onConflict: 'id' }),
            registerDeviceSession(user.id, 'patient'),
          ]).then(() => {
            useAuthStore.getState().initialize().catch(() => {});
          });

          // Immediate Navigation
          router.replace('/(patient)/(tabs)/home');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (err) {
        console.warn('Auth callback error:', err);
        if (mounted) {
          router.replace('/(auth)/login');
        }
      }
    }

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [incomingUrl]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.patientPrimary} />
      <Text style={styles.text}>Processing authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  text: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.textDark,
  },
});
