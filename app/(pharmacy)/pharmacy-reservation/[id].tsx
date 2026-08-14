import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Linking,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { Header } from '@/components/ui/Header';
import { toast } from '@/context/ToastContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const PHARMACY_GREEN = '#10b981';

export default function PharmacyReservationDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(pharmacy)/(tabs)/reservations');
    }
    return true;
  });

  const [reservation, setReservation] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchReservation();
  }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReservation();
    setRefreshing(false);
  };

  const fetchReservation = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (resErr) throw resErr;
      setReservation(resData);

      if (resData?.user_id) {
        const { data: profileData } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', resData.user_id)
          .maybeSingle();

        setPatient(profileData);
      }
    } catch (e: any) {
      console.warn('Error fetching reservation details:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: 'accepted' | 'declined' | 'collected') => {
    setUpdating(true);
    try {
      const updates: any = { status };
      if (status === 'accepted') {
        updates.expires_at = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase.from('reservations').update(updates).eq('id', id);

      if (error) throw error;
      toast.success('Status Updated', `Reservation has been ${status}.`);
      fetchReservation();
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={PHARMACY_GREEN} />
      </SafeAreaView>
    );
  }

  if (!reservation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Reservation Detail" showBack onBack={() => router.back()} />
        <View style={styles.loadingCenter}>
          <Text style={{ color: theme.textMuted }}>Reservation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items = reservation.medicines || [];
  const isPending = reservation.status === 'pending';
  const isAccepted = reservation.status === 'accepted';
  const refCode = `RES-${(id || '').substring(0, 6).toUpperCase()}`;

  const bannerConfig: Record<string, { bg: string; border: string; color: string; icon: any; text: string }> = {
    pending:   { bg: '#fff7ed', border: '#ffd6a8', color: '#ca3500', icon: 'time-outline', text: 'Awaiting your response' },
    accepted:  { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857', icon: 'checkmark-circle-outline', text: 'Accepted — Ready for pickup' },
    declined:  { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: 'close-circle-outline', text: 'Declined' },
    collected: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'gift-outline', text: 'Collected by patient' },
  };
  const banner = bannerConfig[reservation.status];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Reservation Detail" showBack onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PHARMACY_GREEN}
            colors={[PHARMACY_GREEN]}
          />
        }
      >
        {/* Status Banner */}
        {banner && (
          <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
            <Ionicons name={banner.icon} size={18} color={banner.color} />
            <Text style={[styles.bannerText, { color: banner.color }]}>{banner.text}</Text>
          </View>
        )}

        {/* Card 1: Reservation Info */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardHeading, { color: theme.textMuted }]}>RESERVATION INFO</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Reference</Text>
            <Text style={[styles.infoVal, { color: theme.text.primary }]}>{refCode}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Date</Text>
            <Text style={[styles.infoVal, { color: theme.text.primary }]}>
              {new Date(reservation.created_at).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Est. Total</Text>
            <Text style={[styles.infoVal, { color: PHARMACY_GREEN, fontFamily: 'Inter-Bold' }]}>
              GHS {parseFloat(reservation.total_cost || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Card 2: Patient Details */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardHeading, { color: theme.textMuted }]}>PATIENT DETAILS</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Name</Text>
            <Text style={[styles.infoVal, { color: theme.text.primary }]}>
              {patient?.full_name || 'Patient'}
            </Text>
          </View>

          {patient?.phone && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Phone</Text>
              <Pressable
                onPress={() => Linking.openURL(`tel:${patient.phone}`)}
                style={({ pressed }) => [
                  styles.phoneBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="call-outline" size={14} color={PHARMACY_GREEN} />
                <Text style={[styles.phoneText, { color: PHARMACY_GREEN }]}>{patient.phone}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Card 3: Requested Medicines */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardHeading, { color: theme.textMuted }]}>REQUESTED MEDICINES</Text>

          <View style={{ gap: 10, marginTop: 4 }}>
            {items.map((med: string, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.medItem,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Ionicons name="medkit-outline" size={18} color={PHARMACY_GREEN} />
                <Text style={[styles.medName, { color: theme.text.primary }]}>{med}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.actionCol}>
            <Pressable
              style={({ pressed }) => [
                styles.acceptBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: PHARMACY_GREEN },
              ]}
              onPress={() => updateStatus('accepted')}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.btnText}>Accept Order</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.declineBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
              ]}
              onPress={() => updateStatus('declined')}
              disabled={updating}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
              <Text style={[styles.btnText, { color: '#ef4444' }]}>Decline Order</Text>
            </Pressable>
          </View>
        )}

        {isAccepted && (
          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: '#0f172a' },
            ]}
            onPress={() => updateStatus('collected')}
            disabled={updating}
          >
            <Ionicons name="gift-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Mark as Collected</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SPACING.xl, gap: SPACING.md },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },

  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: 12,
  },
  cardHeading: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FONT_SIZE.md,
  },
  infoVal: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },

  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  medName: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },

  actionCol: {
    gap: 10,
    marginTop: 8,
  },
  acceptBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  declineBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  btnText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
});
