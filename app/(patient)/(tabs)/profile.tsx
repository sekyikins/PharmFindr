import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';

export default function Profile() {
  const { user, profile, signOut } = useAuthStore();
  const router = useRouter();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="My Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.patient.secondary }]}>
            <Text style={[styles.avatarText, { color: theme.patient.primary }]}>
              {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.text.primary }]}>
            {profile?.full_name || 'User'}
          </Text>
          <Text style={[styles.info, { color: theme.text.secondary }]}>
            ✉️ {user?.email || 'N/A'}
          </Text>
          <Text style={[styles.info, { color: theme.text.secondary }]}>
            📞 {profile?.phone || 'No phone registered'}
          </Text>
        </Card>

        {/* Options */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Settings</Text>

        <Pressable 
          style={({ pressed }) => [
            styles.optionRow, 
            { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={() => router.push('/(patient)/scan')}
        >
          <View style={styles.optionLeft}>
            <Ionicons name="camera-outline" size={20} color={theme.text.secondary} />
            <Text style={[styles.optionText, { color: theme.text.primary }]}>Scan Prescription</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
        </Pressable>

        <Pressable 
          style={({ pressed }) => [
            styles.optionRow, 
            { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={() => router.replace('/(patient)/(tabs)/chat')}
        >
          <View style={styles.optionLeft}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.text.secondary} />
            <Text style={[styles.optionText, { color: theme.text.primary }]}>AI Chat History</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
        </Pressable>

        {/* Sign Out Button */}
        <Pressable 
          style={[styles.signOutBtn, { backgroundColor: theme.error + '15' }]} 
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={[styles.signOutText, { color: theme.error }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  info: {
    fontSize: 13,
    marginVertical: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    marginTop: 40,
    gap: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
