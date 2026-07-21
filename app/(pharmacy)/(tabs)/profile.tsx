import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';

export default function PharmacyProfile() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  const [pharmId, setPharmId] = useState<string | null>(null);
  const [pharmacyName, setPharmacyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error) throw error;

      setPharmId(data.id);
      setPharmacyName(data.name || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setOpeningTime(data.opening_time || '');
      setClosingTime(data.closing_time || '');
    } catch (e: any) {
      console.warn('Error loading pharmacy profile:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!pharmId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pharmacies')
        .update({
          name: pharmacyName,
          address,
          phone,
          opening_time: openingTime,
          closing_time: closingTime,
        })
        .eq('id', pharmId);

      if (error) throw error;
      Alert.alert('Saved', 'Pharmacy profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.push('/(pharmacy)/(tabs)/dashboard')}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Pharmacy Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.scrollContent}>
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Skeleton width={70} height={70} borderRadius={RADIUS.pill} />
          </View>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ marginBottom: 16, gap: 6 }}>
              <Skeleton width={120} height={14} />
              <Skeleton width="100%" height={44} borderRadius={RADIUS.md} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
        >
          {/* ── Avatar / Icon ── */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.successBg }]}>
              <Ionicons name="shield-checkmark-outline" size={28} color={primaryColor} />
            </View>
          </View>

          {/* ── Fields ── */}
          <ProfileField
            label="PHARMACY NAME"
            value={pharmacyName}
            onChange={setPharmacyName}
            placeholder="City Care Pharmacy"
            theme={theme}
          />
          <ProfileField
            label="ADDRESS"
            value={address}
            onChange={setAddress}
            placeholder="12 Health Avenue, Downtown"
            theme={theme}
          />
          <ProfileField
            label="PHONE NUMBER"
            value={phone}
            onChange={setPhone}
            placeholder="+1 555-0101"
            keyboardType="phone-pad"
            theme={theme}
          />
          <ProfileField
            label="OPENING TIME"
            value={openingTime}
            onChange={setOpeningTime}
            placeholder="08:00:00"
            theme={theme}
          />
          <ProfileField
            label="CLOSING TIME"
            value={closingTime}
            onChange={setClosingTime}
            placeholder="22:00:00"
            theme={theme}
          />

          {/* ── Save Button ── */}
          <Pressable style={[styles.saveBtn, { backgroundColor: primaryColor }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </Pressable>

          {/* ── Sign Out ── */}
          <Pressable style={[styles.signOutBtn, { backgroundColor: theme.errorBg }]} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={[styles.signOutText, { color: theme.error }]}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  theme: any;
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={[fieldStyles.label, { color: theme.textMuted }]}>{label}</Text>
      <View style={[fieldStyles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TextInput
          style={[fieldStyles.input, { color: theme.text.primary }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.text.muted}
          keyboardType={keyboardType || 'default'}
        />
        <Ionicons name="pencil-outline" size={14} color={theme.text.muted} />
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },

  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 60,
  },

  // ── Avatar ──
  avatarContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg*2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Save Button ──
  saveBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
  },

  // ── Sign Out ──
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  signOutText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
});
