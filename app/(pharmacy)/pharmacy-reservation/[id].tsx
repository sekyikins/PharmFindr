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
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useHardwareBack } from '@/hooks/useHardwareBack';

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
      toast.error('Update Failed', getFriendlyErrorMessage(e, 'Failed to update status. Please try again.'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={COLORS.pharmacyPrimary} />
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
    pending:   { bg: COLORS.pendingBg, border: COLORS.pendingBorder, color: COLORS.pendingText, icon: 'time-outline', text: 'Awaiting your response' },
    accepted:  { bg: COLORS.successBg, border: COLORS.successBorder, color: COLORS.pharmacyTextDark, icon: 'checkmark-circle-outline', text: 'Accepted — Ready for pickup' },
    declined:  { bg: COLORS.errorBg, border: COLORS.errorBorder, color: COLORS.errorText, icon: 'close-circle-outline', text: 'Declined' },
    collected: { bg: COLORS.patientSecondary, border: COLORS.patientBorder, color: COLORS.patientPrimaryDark, icon: 'gift-outline', text: 'Collected by patient' },
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
            tintColor={COLORS.pharmacyPrimary}
            colors={[COLORS.pharmacyPrimary]}
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
            <Text style={[styles.infoVal, { color: COLORS.pharmacyPrimary, fontFamily: 'Inter-Bold' }]}>
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
                <Ionicons name="call-outline" size={14} color={COLORS.pharmacyPrimary} />
                <Text style={[styles.phoneText, { color: COLORS.pharmacyPrimary }]}>{patient.phone}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Card 3: Requested Medicines */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardHeading, { color: theme.textMuted }]}>REQUESTED MEDICINES</Text>

          <View style={{ gap: SPACING.md, marginTop: SPACING.xs }}>
            {items.map((med: any, idx: number) => {
              const medName =
                typeof med === 'object' && med
                  ? `${med.name || ''} ${med.strength || ''}`.trim()
                  : String(med || '');
              const qty = typeof med === 'object' && med?.quantity ? med.quantity : null;
              const price = typeof med === 'object' && med?.price ? parseFloat(med.price).toFixed(2) : null;

              return (
                <View
                  key={idx}
                  style={[
                    styles.medItem,
                    { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="medkit-outline" size={18} color={COLORS.pharmacyPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.medName, { color: theme.text.primary }]}>
                      {medName || reservation.medicine_name || 'Medicine'}
                    </Text>
                    {qty ? (
                      <Text style={[styles.medSub, { color: theme.textMuted }]}>
                        Qty: {qty} {price ? `· GHS ${price}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.actionCol}>
            <Pressable
              style={({ pressed }) => [
                styles.acceptBtn,
                pressed && { opacity: 0.8 },
                { backgroundColor: COLORS.pharmacyPrimary },
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
                { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder },
              ]}
              onPress={() => updateStatus('declined')}
              disabled={updating}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
              <Text style={[styles.btnText, { color: COLORS.error }]}>Decline Order</Text>
            </Pressable>
          </View>
        )}

        {isAccepted && (
          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: COLORS.surfaceDark },
            ]}
            onPress={() => updateStatus('collected')}
            disabled={updating}
          >
            <Ionicons name="gift-outline" size={18} color={COLORS.white} />
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
    gap: SPACING.xs,
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
    gap: SPACING.md,
  },
  cardHeading: {
    fontSize: FONT_SIZE.sm,
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
    fontFamily: 'Inter-Regular',
  },
  infoVal: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  phoneText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },

  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  medName: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  medSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
    marginTop: 2,
  },

  actionCol: {
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  acceptBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  declineBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
  },
  btnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
});
