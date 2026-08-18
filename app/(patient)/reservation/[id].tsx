import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Header } from '@/components/ui/Header';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import Skeleton from '@/components/ui/Skeleton';
import { logAuditEvent } from '@/lib/auditLogger';
import { useHardwareBack } from '@/hooks/useHardwareBack';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReservationMed {
  name: string;
  strength?: string;
  price: number;
  quantity: number;
}

interface ReservationRecord {
  id: string;
  pharmacy_id?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'collected' | 'cancelled';
  pharmacy_name: string;
  medicine_name: string;
  medicines: ReservationMed[];
  total_cost: number;
  created_at: string;
  expires_at: string | null;
  pharmacies?: { name: string; phone: string; address: string; latitude?: number; longitude?: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE_MAP: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  accepted:  { label: 'Accepted', bg: COLORS.successBg, text: COLORS.success, icon: 'checkmark-circle' },
  declined:  { label: 'Declined', bg: COLORS.errorBg, text: COLORS.error, icon: 'close-circle' },
  collected: { label: 'Collected', bg: COLORS.patientSecondary, text: COLORS.patientPrimary, icon: 'bag-check' },
  cancelled: { label: 'Cancelled', bg: COLORS.surfaceSecondary, text: COLORS.textMuted, icon: 'close-circle-outline' },
  pending:   { label: 'Pending', bg: COLORS.pendingBg, text: COLORS.warningDark, icon: 'time' },
};

function getStatusBadge(status: string) {
  return STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.pending;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReservationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    medName?: string;
    price?: string;
    medicinesJson?: string;
  }>();

  const { user } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/reservations-history');
    }
    return true;
  });

  const id = params.id ?? '';
  const isNewReservation = !!(params.name || params.medicinesJson);

  // ── New reservation mode state ──────────────────────────────────────────
  const pharmName = params.name ?? 'Pharmacy';
  const medName = params.medName ?? 'Medicine';
  const price = params.price ?? '';

  const parsedMeds: ReservationMed[] = (() => {
    if (params.medicinesJson) {
      try {
        return JSON.parse(params.medicinesJson);
      } catch { /* ignore */ }
    }
    const numericPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
    return [{ name: medName, quantity: 1, price: numericPrice }];
  })();

  const totalCost = parsedMeds.reduce((sum, m) => sum + m.price * m.quantity, 0);
  const [submitting, setSubmitting] = useState(false);

  // ── Existing reservation mode state ─────────────────────────────────────
  const [reservation, setReservation] = useState<ReservationRecord | null>(null);
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (isNewReservation) return;
    const fetchReservation = async () => {
      setLoadingReservation(true);
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*, pharmacies(name, phone, address, latitude, longitude)')
          .eq('id', id)
          .single();

        if (error) throw error;
        setReservation(data as ReservationRecord);
      } catch (e: any) {
        console.warn('Error loading reservation:', e.message);
        toast.error('Load Error', 'Could not load reservation details.');
        router.back();
      } finally {
        setLoadingReservation(false);
      }
    };

    fetchReservation();
  }, [id, isNewReservation]);

  // ── In-App Route Navigation Helper ────────────────────────────────────────

  const handleInAppNavigate = (pharmacyId?: string, pharmacyName?: string, lat?: number, lon?: number) => {
    router.push({
      pathname: '/(patient)/pharmacy/[id]/navigate',
      params: {
        id: encodeURIComponent(pharmacyId || 'pharmacy'),
        name: pharmacyName || 'Pharmacy',
        lat: String(lat ?? 0),
        lon: String(lon ?? 0),
      },
    });
  };

  // ── Cancel reservation handler ──────────────────────────────────────────

  const handleCancelReservation = () => {
    Alert.alert(
      'Cancel Reservation?',
      'Are you sure you want to cancel this reservation? The pharmacy will be notified.',
      [
        { text: 'Keep Reservation', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const { error } = await supabase
                .from('reservations')
                .update({ status: 'cancelled' })
                .eq('id', id);

              if (error) throw error;
              setReservation((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              toast.info('Reservation Cancelled', 'Your reservation has been cancelled.');
            } catch (e: any) {
              toast.error('Unable to Cancel', getFriendlyErrorMessage(e, 'Failed to cancel reservation. Please try again.'));
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Confirm new reservation ─────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!user) {
      toast.error('Authentication Required', 'Please log in to make a reservation.');
      return;
    }

    setSubmitting(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const pharmacyId = isUuid ? id : null;
      const idempotencyKey = `idemp_${user.id}_${pharmacyId || 'pub'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const { error } = await supabase.from('reservations').insert({
        user_id: user.id,
        pharmacy_id: pharmacyId,
        medicine_name: parsedMeds.map((m) => m.name).join(', '),
        pharmacy_name: pharmName,
        medicines: parsedMeds,
        status: 'pending',
        total_cost: totalCost,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: idempotencyKey,
      });

      if (error) throw error;

      await logAuditEvent({
        action: 'CREATE_RESERVATION',
        resourceType: 'reservation',
        metadata: { pharmacy_name: pharmName, total_cost: totalCost },
      });

      toast.success('Reservation Requested', `Your request has been sent to ${pharmName}.`);
      router.replace('/(patient)/reservations-history');
    } catch (e: any) {
      toast.error('Reservation Failed', getFriendlyErrorMessage(e, 'Failed to place reservation request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render existing reservation ─────────────────────────────────────────

  if (!isNewReservation) {
    if (loadingReservation || !reservation) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
          <Header title="Reservation Details" showBack />
          <ScrollView contentContainerStyle={styles.scroll}>
            <Skeleton width="60%" height={26} style={{ marginBottom: SPACING.md, marginTop: SPACING.md }} />
            <Skeleton width="80%" height={16} style={{ marginBottom: SPACING.xxl }} />
            <Skeleton width="100%" height={220} style={{ borderRadius: RADIUS.xl, marginBottom: SPACING.xl }} />
          </ScrollView>
        </SafeAreaView>
      );
    }

    const badge = getStatusBadge(reservation.status);
    const resPharmName = reservation.pharmacy_name || reservation.pharmacies?.name || 'Pharmacy';
    const dateStr = new Date(reservation.created_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    const resMeds: ReservationMed[] = Array.isArray(reservation.medicines) && reservation.medicines.length > 0
      ? reservation.medicines
      : [{ name: reservation.medicine_name, quantity: 1, price: reservation.total_cost }];

    const canCancel = reservation.status === 'pending' || reservation.status === 'accepted';

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Header title="Reservation Details" showBack />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Top Header Section (No bag icon, starts with pharmacy name) ── */}
          <View style={styles.topInfoSection}>
            <Text style={[styles.pharmacyTitle, { color: theme.text.primary }]}>{resPharmName}</Text>
            
            {/* Pharmacy Details (Address & Phone below name) */}
            {(reservation.pharmacies?.address || reservation.pharmacies?.phone) && (
              <View style={styles.pharmacyDetailsSub}>
                {reservation.pharmacies?.address ? (
                  <View style={styles.infoInlineRow}>
                    <Ionicons name="location-outline" size={15} color={theme.textMuted} />
                    <Text style={[styles.infoInlineText, { color: theme.textMuted }]}>{reservation.pharmacies.address}</Text>
                  </View>
                ) : null}
                {reservation.pharmacies?.phone ? (
                  <Pressable
                    style={({ pressed }) => [styles.infoInlineRow, pressed && { opacity: 0.6 }]}
                    onPress={() => Linking.openURL(`tel:${reservation.pharmacies!.phone}`)}
                    hitSlop={8}
                  >
                    <Ionicons name="call-outline" size={15} color={primaryColor} />
                    <Text style={[styles.infoInlineText, { color: primaryColor, textDecorationLine: 'underline' }]}>{reservation.pharmacies.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Status Pill & Top Navigate Button (Positioned at top, away from cancel) */}
            <View style={styles.topActionsRow}>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Ionicons name={badge.icon} size={14} color={badge.text} style={{ marginRight: 5 }} />
                <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.topNavigateBtn,
                  pressed && { opacity: 0.7 },
                  { backgroundColor: primaryColor },
                ]}
                onPress={() => handleInAppNavigate(
                  reservation.pharmacy_id || id,
                  resPharmName,
                  reservation.pharmacies?.latitude,
                  reservation.pharmacies?.longitude
                )}
              >
                <Ionicons name="navigate-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.topNavigateText}>Navigate</Text>
              </Pressable>
            </View>

            <Text style={[styles.dateLabel, { color: theme.textMuted }]}>Reserved on {dateStr}</Text>
          </View>

          {/* ── Medicine Details Card ── */}
          <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ padding: SPACING.md, borderBottomWidth: 1, borderColor: theme.border }}>
              <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>Prescribed Medicines</Text>
            </View>
            <View style={{ paddingHorizontal: 14 }}>
              {resMeds.map((m, i) => (
                <View key={i}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.textMuted }]}>
                      {m.name}{m.strength ? ` ${m.strength}` : ''}
                      {m.quantity > 1 ? ` ×${m.quantity}` : ''}
                    </Text>
                    <Text style={[styles.rowValue, { color: primaryColor, fontFamily: 'Inter-Bold' }]}>
                      GH₵{(m.price * (m.quantity || 1)).toFixed(2)}
                    </Text>
                  </View>
                  {i < resMeds.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                </View>
              ))}
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <DetailRow
                label="Total Est. Cost"
                value={`GH₵${Number(reservation.total_cost).toFixed(2)}`}
                highlight
                highlightColor={primaryColor}
                theme={theme}
              />
            </View>
          </View>

          {/* ── Status Banner Message ── */}
          {reservation.status === 'pending' && (
            <View style={[styles.infoBanner, { backgroundColor: COLORS.pendingBg, borderColor: COLORS.warning }]}>
              <Ionicons name="time-outline" size={16} color={COLORS.warningDark} style={{ marginRight: SPACING.sm }} />
              <Text style={{ color: COLORS.pendingText, fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium', flex: 1, lineHeight: 18 }}>
                Your reservation is being reviewed. The pharmacy will confirm shortly.
              </Text>
            </View>
          )}
          {reservation.status === 'accepted' && (
            <View style={[styles.infoBanner, { backgroundColor: COLORS.successBg, borderColor: COLORS.success }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} style={{ marginRight: SPACING.sm }} />
              <Text style={{ color: COLORS.successDark, fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium', flex: 1, lineHeight: 18 }}>
                Your medicines are ready for collection at {resPharmName}.
              </Text>
            </View>
          )}
          {reservation.status === 'declined' && (
            <View style={[styles.infoBanner, { backgroundColor: COLORS.errorBg, borderColor: COLORS.error }]}>
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} style={{ marginRight: SPACING.sm }} />
              <Text style={{ color: COLORS.errorDarkBg, fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium', flex: 1, lineHeight: 18 }}>
                This reservation was declined. You may search for another pharmacy.
              </Text>
            </View>
          )}
          {reservation.status === 'cancelled' && (
            <View style={[styles.infoBanner, { backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.borderSlate }]}>
              <Ionicons name="close-circle-outline" size={16} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
              <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium', flex: 1, lineHeight: 18 }}>
                This reservation has been cancelled.
              </Text>
            </View>
          )}

          {/* ── Bottom Action: Only Cancel Reservation (if eligible), away from Navigate ── */}
          {canCancel && (
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.5 },
                  { borderColor: theme.error, backgroundColor: theme.card },
                ]}
                onPress={handleCancelReservation}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color={theme.error} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={theme.error} style={{ marginRight: 8 }} />
                    <Text style={[styles.cancelBtnText, { color: theme.error }]}>Cancel Reservation</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render new reservation confirmation ─────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Reserve Medicines" showBack />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Top Header Section (No bag icon) ── */}
        <View style={styles.topInfoSection}>
          <Text style={[styles.pharmacyTitle, { color: theme.text.primary }]}>Confirm Reservation</Text>
            <Text style={{ fontFamily: 'Inter-SemiBold', color: theme.text.primary }}>{pharmName}</Text>

          {/* Top Navigate button */}
          <Pressable
            style={({ pressed }) => [
              styles.topNavigateBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: primaryColor, alignSelf: 'center', marginTop: SPACING.xs },
            ]}
            onPress={() => handleInAppNavigate(id, pharmName)}
          >
            <Ionicons name="navigate-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.topNavigateText}>View on Map / Directions</Text>
          </Pressable>
        </View>

        {/* Details card */}
        <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ padding: SPACING.md, borderBottomWidth: 1, borderColor: theme.border }}>
            <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>Medicines</Text>
          </View>
          <View style={{ paddingHorizontal: 14 }}>
            {parsedMeds.map((m, i) => (
              <View key={i}>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{m.name}{m.strength ? ` ${m.strength}` : ''}</Text>
                  <Text style={[styles.rowValue, { color: primaryColor, fontFamily: 'Inter-Bold' }]}>GH₵{m.price.toFixed(2)}</Text>
                </View>
                {i < parsedMeds.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <DetailRow label="Est. Total" value={`GH₵${totalCost.toFixed(2)}`} highlight highlightColor={primaryColor} theme={theme} />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <DetailRow label="Ready in" value="~10 minutes" theme={theme} />
          </View>
        </View>

        {/* Action button */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bag-handle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Confirm Reservation</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Shared sub-component ─────────────────────────────────────────────────────

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
      <Text style={[styles.rowValue, { color: theme.text.primary }, highlight && { color: highlightColor, fontFamily: 'Inter-Bold' }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.lg },

  // Top Info Section
  topInfoSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.sm,
  },
  pharmacyTitle: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  pharmacyDetailsSub: {
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.md,
  },
  infoInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoInlineText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },

  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  topNavigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  topNavigateText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },

  sub: { fontSize: FONT_SIZE.lg, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  dateLabel: { fontSize: FONT_SIZE.sm, textAlign: 'center', fontFamily: 'Inter-Medium' },

  // Status
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  statusText: { fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Bold' },

  // Card
  detailsCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md },
  rowLabel: { fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Medium', flex: 1 },
  rowValue: { fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Regular' },
  divider: { height: 1 },
  sectionLabel: { fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold' },

  // Info banner
  infoBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },

  // Actions
  actionRow: { width: '100%', marginTop: SPACING.sm },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.white, fontSize: FONT_SIZE.xl, fontFamily: 'Inter-SemiBold' },
  cancelBtn: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold' },
});
