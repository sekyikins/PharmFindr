import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { COLORS, FONT_SIZE, SPACING } from '@/styles/theme';
import { registerDeviceSession } from '@/lib/deviceSession';
import { processAuthUrl, redactUrl } from '@/lib/authUrlHandler';
import { toast } from '@/context/ToastContext';

export default function AuthCallback() {
  const router = useRouter();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      console.log('[Callback Screen] Mounted with incoming URL:', redactUrl(incomingUrl));
      try {
        const result = await processAuthUrl(incomingUrl);

        if (!mounted) return;

        console.log(
          `[Callback Screen] Result: isRecovery=${result.isRecovery}, hasSession=${!!result.session}, user=${result.user?.id || 'none'}`
        );

        // Route to reset password if this is a recovery link
        if (result.isRecovery) {
          if (result.session) {
            console.log('[Callback Screen] Recovery session confirmed. Navigating to /(auth)/reset-password...');
            router.replace('/(auth)/reset-password');
            return;
          } else {
            console.warn('[Callback Screen] Recovery flow detected, but session is null. Error:', result.error?.message);
            toast.error('Password reset link is invalid or has expired. Please request a new link.');
            router.replace('/(auth)/login');
            return;
          }
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

          // Immediate Navigation to Patient Home
          router.replace('/(patient)/(tabs)/home');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (err: any) {
        console.warn('[Callback Screen] Fatal callback error:', err);
        if (mounted) {
          toast.error('Authentication failed. Please try signing in again.');
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
      <Text style={styles.text}>Verifying authentication...</Text>
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
