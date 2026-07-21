import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function ConfirmReservation() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    medName?: string;
    price?: string;
  }>();

  const { user } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  const id = params.id ?? '';
  const pharmName = params.name ?? 'City Care Pharmacy';
  const medName = params.medName ?? 'Amoxicillin 500mg';
  const price = params.price ?? '$12.50';

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to make a reservation.');
      return;
    }

    setSubmitting(true);
    try {
      // Parse numeric price out of string, e.g. "$12.50" -> 12.50
      const numericPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || 10.00;

      // Check if id is a UUID (registered pharmacy). If not, we can still save it with null pharmacy_id for tracking,
      // or check if we can resolve the UUID by owner_id or search.
      // For now, if the ID doesn't look like a UUID, we pass null as pharmacy_id.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const pharmacyId = isUuid ? id : null;

      const { error } = await supabase.from('reservations').insert({
        user_id: user.id,
        pharmacy_id: pharmacyId,
        medicine_name: medName,
        pharmacy_name: pharmName,
        medicines: [{ name: medName, quantity: 1, price: numericPrice }],
        status: 'pending',
        total_cost: numericPrice,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours expiry
      });

      if (error) throw error;

      Alert.alert(
        'Reservation Requested',
        `Your request has been sent to ${pharmName}. You'll receive a notification when it's ready.`,
        [
          {
            text: 'Go to Reservations',
            onPress: () => router.replace('/(patient)/reservations-history'),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place reservation request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Reserve Medicines</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Center Bag Icon ── */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: theme.patientSecondary }]}>
            <Ionicons name="bag-handle-outline" size={32} color={primaryColor} />
          </View>
        </View>

        {/* ── Titles ── */}
        <Text style={[styles.title, { color: theme.text.primary }]}>Confirm Reservation</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          <Text style={{ fontWeight: '600', color: theme.text.primary }}>{pharmName}</Text> has the medicines you need. Would you like to request a reservation?
        </Text>

        {/* ── Details Box ── */}
        <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <DetailRow label="Medicine" value={medName} theme={theme} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Quantity" value="1 strip (10 tablets)" theme={theme} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Price" value={price} highlight highlightColor={primaryColor} theme={theme} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Pharmacy" value={pharmName} theme={theme} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Ready in" value="~30 minutes" theme={theme} />
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Reserve</Text>}
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, { borderColor: primaryColor, backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  highlightColor,
  theme,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  highlightColor?: string;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text.primary }, highlight && { color: highlightColor, fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

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

  scroll: { padding: SPACING.xxl, alignItems: 'center' },

  // ── Icon ──
  iconContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Titles ──
  title: { fontSize: FONT_SIZE.hero, fontWeight: '700', marginBottom: SPACING.md, textAlign: 'center' },
  sub: { fontSize: FONT_SIZE.lg, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.lg, marginBottom: 28 },

  // ── Card ──
  detailsCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: 32,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md },
  rowLabel: { fontSize: FONT_SIZE.lg },
  rowValue: { fontSize: FONT_SIZE.lg, fontWeight: '600' },
  divider: { height: 1 },

  // ── Actions ──
  actionRow: { width: '100%', gap: SPACING.md },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontWeight: '600' },
  secondaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: FONT_SIZE.lg, fontWeight: '600' },
});
