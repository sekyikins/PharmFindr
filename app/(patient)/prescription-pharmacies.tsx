import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { Header } from '@/components/ui/Header';
import { getCurrentLocation } from '@/lib/location';
import { cleanDistanceString, cleanDurationString } from '@/lib/ors';
import { searchPharmaciesForPrescription } from '@/lib/inventorySearch';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import Skeleton from '@/components/ui/Skeleton';
import type {
  PrescriptionMedicine,
  PharmacyWithMedicines,
} from '@/types/prescription';

export default function PrescriptionPharmacies() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { medicines, title, prescriptionId } = useLocalSearchParams<{
    medicines: string;
    title?: string;
    prescriptionId?: string;
  }>();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/home');
    }
    return true;
  });

  const parsedMeds: PrescriptionMedicine[] = (() => {
    if (!medicines) return [];
    try {
      const parsed = JSON.parse(medicines);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [pharmacyResults, setPharmacyResults] = useState<PharmacyWithMedicines[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPharmacies = useCallback(async () => {
    if (parsedMeds.length === 0) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const userLocation = await getCurrentLocation().catch(() => null);
      const results = await searchPharmaciesForPrescription(parsedMeds, userLocation);
      setPharmacyResults(results);
    } catch (e: any) {
      console.warn('Error finding pharmacies for prescription:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [medicines]);

  useEffect(() => {
    fetchPharmacies();
  }, [fetchPharmacies]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPharmacies();
  };

  const handleReserve = (pharmacy: PharmacyWithMedicines) => {
    const medsParam = pharmacy.medicines.map((m) => ({
      name: m.medicineName,
      strength: m.strength,
      price: m.price,
      quantity: 1,
    }));

    const totalCost = medsParam.reduce((sum, m) => sum + m.price, 0);

    router.push({
      pathname: '/(patient)/reservation/[id]',
      params: {
        id: pharmacy.pharmacyId,
        name: pharmacy.pharmacyName,
        medName: pharmacy.medicines.map((m) => `${m.medicineName} ${m.strength}`.trim()).join(', '),
        price: `GH₵${totalCost.toFixed(2)}`,
        medicinesJson: JSON.stringify(medsParam),
      },
    });
  };

  const handleNavigate = (pharmacy: PharmacyWithMedicines) => {
    router.push({
      pathname: '/(patient)/pharmacy/[id]/navigate',
      params: {
        id: encodeURIComponent(pharmacy.pharmacyId),
        name: pharmacy.pharmacyName,
        lat: String(pharmacy.latitude ?? 5.6037),
        lon: String(pharmacy.longitude ?? -0.187),
        distanceKm: pharmacy.distanceKm != null ? String(pharmacy.distanceKm) : undefined,
        walkMinutes: pharmacy.walkMinutes != null ? String(pharmacy.walkMinutes) : undefined,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header
        title={title || 'Available Pharmacies'}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/home'))}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
      >
        {/* Prescription medicines summary header card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.summaryTopRow}>
            <View style={[styles.badge, { backgroundColor: primaryColor + '15' }]}>
              <Ionicons name="medical" size={14} color={primaryColor} />
              <Text style={[styles.badgeText, { color: primaryColor }]}>
                {parsedMeds.length} Medicine{parsedMeds.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {!loading && (
              <Text style={[styles.resultCount, { color: theme.textMuted }]}>
                {pharmacyResults.length} {pharmacyResults.length === 1 ? 'match' : 'matches'} found
              </Text>
            )}
          </View>

          <View style={styles.medChipsRow}>
            {parsedMeds.map((m, idx) => (
              <View
                key={idx}
                style={[styles.medChip, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              >
                <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
                <Text style={[styles.medChipText, { color: theme.text.primary }]}>
                  {m.name} {m.strength || ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.pharmacyCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.pharmacyHeader}>
                  <Skeleton width={42} height={42} borderRadius={21} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="65%" height={16} borderRadius={4} />
                    <Skeleton width="45%" height={12} borderRadius={4} />
                  </View>
                  <Skeleton width={50} height={22} borderRadius={11} />
                </View>
                <View style={{ marginTop: 14, gap: SPACING.sm }}>
                  <Skeleton width="100%" height={32} borderRadius={6} />
                  <Skeleton width="100%" height={32} borderRadius={6} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Skeleton width="75%" height={44} borderRadius={12} />
                  <Skeleton width="22%" height={44} borderRadius={12} />
                </View>
              </View>
            ))}
          </View>
        ) : pharmacyResults.length === 0 ? (
          /* Empty State */
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="storefront-outline" size={40} color={theme.textDim} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No Pharmacies In Stock</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              None of our registered partner pharmacies currently have these exact medicines in stock nearby.
            </Text>

            <View style={styles.emptyActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.emptyBtn,
                  { backgroundColor: primaryColor },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push('/(patient)/pharmacies')}
              >
                <Ionicons name="map-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Explore All On Map</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Pharmacy Results List */
          <View style={styles.resultsList}>
            {pharmacyResults.map((pharmacy) => {
              const isFullMatch = pharmacy.matchCount === pharmacy.totalPrescribed;
              const totalCost = pharmacy.medicines.reduce((sum, m) => sum + m.price, 0);

              return (
                <View
                  key={pharmacy.pharmacyId}
                  style={[styles.pharmacyCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  {/* Pharmacy Card Header */}
                  <View style={styles.pharmacyHeader}>
                    <View style={[styles.pharmacyIconCircle, { backgroundColor: theme.patientSecondary }]}>
                      <Ionicons name="storefront" size={20} color={primaryColor} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pharmacyName, { color: theme.text.primary }]} numberOfLines={1}>
                        {pharmacy.pharmacyName}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.pharmacyMeta, { color: theme.textMuted }]}>
                          {pharmacy.matchCount}/{pharmacy.totalPrescribed} in stock
                        </Text>
                        {pharmacy.distanceKm != null && (
                          <>
                            <Text style={[styles.pharmacyMeta, { color: theme.textDim }]}>·</Text>
                            <Ionicons name="navigate" size={12} color={primaryColor} />
                            <Text style={[styles.pharmacyMeta, { color: primaryColor, fontFamily: 'Inter-SemiBold' }]}>
                              {cleanDistanceString(pharmacy.distanceKm)}
                            </Text>
                            {pharmacy.walkMinutes != null && (
                              <Text style={[styles.pharmacyMeta, { color: theme.textMuted }]}>
                                ({cleanDurationString(pharmacy.walkMinutes)})
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                    </View>

                    {/* Match percentage badge */}
                    <View
                      style={[
                        styles.matchBadge,
                        {
                          backgroundColor: isFullMatch ? COLORS.successBg : COLORS.pendingBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchBadgeText,
                          {
                            color: isFullMatch ? COLORS.successText : COLORS.pendingText,
                          },
                        ]}
                      >
                        {Math.round((pharmacy.matchCount / pharmacy.totalPrescribed) * 100)}% Match
                      </Text>
                    </View>
                  </View>

                  {/* Medicines List In Stock at this Pharmacy */}
                  <View style={[styles.medsBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    {pharmacy.medicines.map((m, mIdx) => (
                      <View
                        key={mIdx}
                        style={[
                          styles.medRow,
                          mIdx > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.medRowName, { color: theme.text.primary }]}>
                            {m.medicineName}
                          </Text>
                          {m.strength ? (
                            <Text style={[styles.medRowStrength, { color: theme.textMuted }]}>
                              {m.strength}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.medRowPrice, { color: primaryColor }]}>
                          GH₵{m.price.toFixed(2)}
                        </Text>
                      </View>
                    ))}

                    <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>Est. Total</Text>
                      <Text style={[styles.totalValue, { color: theme.text.primary }]}>
                        GH₵{totalCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.reserveBtn,
                        { flex: 1, backgroundColor: primaryColor },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleReserve(pharmacy)}
                    >
                      <Ionicons name="bag-handle-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                      <Text style={styles.reserveBtnText}>Reserve</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.navigateBtn,
                        { borderColor: primaryColor, backgroundColor: theme.card },
                        pressed && { opacity: 0.6 },
                      ]}
                      onPress={() => handleNavigate(pharmacy)}
                    >
                      <Ionicons name="navigate-outline" size={18} color={primaryColor} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: SPACING.lg,
  },
  summaryCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  badgeText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
  },
  resultCount: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
  },
  medChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  medChipText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },
  loadingContainer: {
    gap: SPACING.md,
  },
  resultsList: {
    gap: SPACING.md,
  },
  pharmacyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  pharmacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pharmacyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyName: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  pharmacyMeta: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
  },
  matchBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  matchBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
  medsBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  medRowName: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
  },
  medRowStrength: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    marginTop: SPACING.xs,
  },
  medRowPrice: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginTop: SPACING.xs,
  },
  totalLabel: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
  },
  totalValue: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: RADIUS.lg,
  },
  reserveBtnText: {
    color: COLORS.white,
    fontFamily: 'Inter-Bold',
    fontSize: FONT_SIZE.lg,
  },
  navigateBtn: {
    width: 48,
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Inter-Bold',
  },
  emptySub: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionRow: {
    marginTop: SPACING.md,
    width: '100%',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: RADIUS.lg,
  },
  emptyBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
});
