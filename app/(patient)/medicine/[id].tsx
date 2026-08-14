import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { getMedicineByIdOrName, fetchMedicineDetails, type MedicineItem } from '@/lib/medicineCatalogue';
import { useSavedMedicinesStore } from '@/store/savedMedicinesStore';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const { width } = Dimensions.get('window');

export default function MedicineDetailsScreen() {
  const router = useRouter();
  const { id, query, name } = useLocalSearchParams<{ id?: string; query?: string; name?: string }>();
  const { theme, primaryColor } = useThemeContext();

  const { isSaved, toggleSaveMedicine, loadSavedMedicines } = useSavedMedicinesStore();

  const lookupKey = id || query || 'paracetamol-500mg';
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupKey) || /^[0-9a-f-]{20,}$/i.test(lookupKey);
  const initialName = name || (isUUID ? '' : lookupKey.replace(/[-_]/g, ' '));

  const [medicine, setMedicine] = useState<MedicineItem>(getMedicineByIdOrName(lookupKey, initialName || undefined));
  const [saved, setSaved] = useState(false);

  // Wire hardware back button
  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/search');
    }
    return true;
  });

  useEffect(() => {
    loadSavedMedicines();
    let cancelled = false;

    // 1. Initial instant load from synchronous lookup
    const initialItem = getMedicineByIdOrName(lookupKey, initialName || undefined);
    setMedicine(initialItem);
    setSaved(isSaved(initialItem.id));

    // 2. Fetch live enriched details from Supabase database
    fetchMedicineDetails(lookupKey).then((fullItem) => {
      if (!cancelled && fullItem) {
        setMedicine(fullItem);
        setSaved(isSaved(fullItem.id));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lookupKey, initialName]);

  const handleToggleSave = async () => {
    const newStatus = await toggleSaveMedicine(medicine);
    setSaved(newStatus);
    Alert.alert(
      newStatus ? 'Saved to Library' : 'Removed from Saved',
      newStatus
        ? `${medicine.name} has been saved to your Saved Medicines library.`
        : `${medicine.name} has been removed from your saved list.`
    );
  };

  const handleAskAI = () => {
    router.push({
      pathname: '/(patient)/(tabs)/chat',
      params: {
        initialQuery: `Tell me about ${medicine.name} (${medicine.strength}). What are key precautions, side effects, and dosage guidelines?`,
      },
    });
  };

  const handleFindPharmacies = () => {
    router.push({
      pathname: '/(patient)/pharmacies',
      params: {
        query: medicine.genericName || medicine.name,
      },
    });
  };

  const handleFindPrescriptionPharmacies = () => {
    const med = [{
      name: medicine.name,
      strength: medicine.strength || null,
      dosage: null,
      frequency: null,
      duration: null,
      route: null,
      instructions: null,
      confidence: 100,
    }];
    router.push({
      pathname: '/(patient)/prescription-pharmacies',
      params: {
        medicines: JSON.stringify(med),
        title: 'Found Pharmacies',
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* ── Blue Hero Header ── */}
        <View style={[styles.hero, { backgroundColor: primaryColor }]}>
          <View style={styles.topNavRow}>
            <Pressable
              style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.6 }]}
              onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/search'))}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.white} />
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.6 }]}
                onPress={handleToggleSave}
              >
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#ff4d4f' : COLORS.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.pillCircle}>
              <Ionicons name="medkit" size={28} color={primaryColor} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.medName}>
                {medicine.name && !/^[0-9a-f-]{20,}$/i.test(medicine.name)
                  ? medicine.name
                  : initialName || 'Loading...'}
              </Text>
              <Text style={styles.medSub}>
                {medicine.strength && medicine.strength !== '—'
                  ? `${medicine.strength} · ${medicine.category}`
                  : medicine.category || 'Medicine Details'}
              </Text>
              {medicine.genericName &&
                medicine.genericName !== medicine.name &&
                !/^[0-9a-f-]{20,}$/i.test(medicine.genericName) && (
                  <Text style={styles.genericSub}>Generic: {medicine.genericName}</Text>
                )}
            </View>
          </View>
        </View>

        {/* ── Smooth Wave SVG ── */}
        <View style={{ backgroundColor: primaryColor }}>
          <Svg width={width} height={20} viewBox={`0 0 ${width} 20`} style={{ display: 'flex' }}>
            <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={theme.background} />
          </Svg>
        </View>

        {/* ── Action Buttons Row ── */}
        <View style={styles.actionGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, { backgroundColor: theme.card, borderColor: theme.patientPrimary }, pressed && { opacity: 0.7 }]}
            onPress={handleToggleSave}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? '#ff4d4f' : primaryColor} />
            <Text style={[styles.actionCardText, { color: theme.text.primary }]}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, { backgroundColor: theme.card, borderColor: theme.patientPrimary }, pressed && { opacity: 0.7 }]}
            onPress={handleAskAI}
          >
            <Ionicons name="sparkles" size={22} color={primaryColor} />
            <Text style={[styles.actionCardText, { color: theme.text.primary }]}>Ask AI</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, { backgroundColor: theme.card, borderColor: theme.patientPrimary }, pressed && { opacity: 0.7 }]}
            onPress={handleFindPharmacies}
          >
            <Ionicons name="location" size={22} color={COLORS.pharmacyPrimary} />
            <Text style={[styles.actionCardText, { color: theme.text.primary }]}>Stock</Text>
          </Pressable>
        </View>

        {/* ── Key Facts Summary Cards (Dosage, Frequency, Duration) ── */}
        <View style={styles.cardsRow}>
          <DetailCard icon="medkit-outline" iconColor={COLORS.error} label="DOSAGE" value={medicine.dosage} theme={theme} />
          <DetailCard icon="time-outline" iconColor={COLORS.warning} label="FREQUENCY" value={medicine.frequency} theme={theme} />
          <DetailCard icon="calendar-outline" iconColor={COLORS.pharmacyPrimary} label="DURATION" value={medicine.duration} theme={theme} />
        </View>

        {/* ── Regulatory & Price Info Card ── */}
        <View style={[styles.infoBanner, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>{medicine.fdaStatus}</Text>
            <Text style={[styles.bannerSub, { color: theme.textMuted }]}>
              Est. Price: {medicine.estimatedPriceRange || 'Varies by pharmacy'}
            </Text>
          </View>
        </View>

        {/* ── Comprehensive Info Panels ── */}
        <InfoPanel title="Uses & Indications" content={medicine.uses} icon="information-circle-outline" theme={theme} primaryColor={primaryColor} />
        <InfoPanel title="How to Take" content={medicine.howToTake} icon="checkmark-circle-outline" theme={theme} primaryColor={primaryColor} />
        <InfoPanel title="Common Side Effects" content={medicine.sideEffects} icon="warning-outline" theme={theme} primaryColor={primaryColor} />
        <InfoPanel title="Warnings & Precautions" content={medicine.warnings} icon="alert-circle-outline" theme={theme} primaryColor={primaryColor} />
        {medicine.contraindications ? (
          <InfoPanel title="Contraindications" content={medicine.contraindications} icon="close-circle-outline" theme={theme} primaryColor={COLORS.error} />
        ) : null}
        {medicine.storage ? (
          <InfoPanel title="Storage Conditions" content={medicine.storage} icon="thermometer-outline" theme={theme} primaryColor={primaryColor} />
        ) : null}

        {/* ── Generic Alternatives ── */}
        {medicine.alternatives && medicine.alternatives.length > 0 && (
          <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="swap-horizontal-outline" size={20} color={primaryColor} />
              <Text style={[styles.panelTitle, { color: theme.text.primary }]}>Generic Alternatives</Text>
            </View>
            <View style={styles.alternativesRow}>
              {medicine.alternatives.map((alt: string, index: number) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [styles.alternativeBadge, { backgroundColor: theme.patientSecondary }, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    const altName = alt.split(' ')[0];
                    router.push({
                      pathname: '/(patient)/medicine/[id]',
                      params: { id: altName },
                    });
                  }}
                >
                  <Text style={[styles.alternativeText, { color: primaryColor }]}>{alt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Pharmacies Carrying Prescription Button ── */}
        <Pressable
          style={({ pressed }) => [styles.prescriptionPharmBtn, pressed && { opacity: 0.7 }, { backgroundColor: primaryColor + '15', borderColor: primaryColor }]}
          onPress={handleFindPrescriptionPharmacies}
        >
          <Ionicons name="medical-outline" size={18} color={primaryColor} style={{ marginRight: 8 }} />
          <Text style={[styles.prescriptionPharmBtnText, { color: primaryColor }]}>Pharmacies Carrying Prescription</Text>
        </Pressable>

        {/* ── Primary Action Button: Find Pharmacies ── */}
        <Pressable
          style={({ pressed }) => [styles.findBtn, pressed && { opacity: 0.7 }, { backgroundColor: theme.card, borderColor: primaryColor, borderWidth: 1 }]}
          onPress={handleFindPharmacies}
        >
          <Ionicons name="map" size={18} color={primaryColor} style={{ marginRight: 8 }} />
          <Text style={[styles.findBtnText, { color: primaryColor }]}>Check It Out On Map</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

function DetailCard({ icon, iconColor, label, value, theme }: { icon: any; iconColor: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: 6 }} />
      <Text style={[styles.cardLabel, { color: theme.textDim }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: theme.text.primary }]}>{value}</Text>
    </View>
  );
}

function InfoPanel({ title, content, icon, theme, primaryColor }: { title: string; content: string; icon: any; theme: any; primaryColor: string }) {
  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name={icon} size={20} color={primaryColor} />
        <Text style={[styles.panelTitle, { color: theme.text.primary }]}>{title}</Text>
      </View>
      <Text style={[styles.panelContent, { color: theme.textMuted }]}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },

  hero: {
    paddingTop: 12,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 24
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  pillCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  heroTextCol: {
    flex: 1
  },
  medName: {
    fontSize: 24, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 2
  },
  medSub: {
    fontSize: 14, color: 'rgba(255, 255, 255, 0.85)', fontFamily: 'Inter-SemiBold'
  },
  genericSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 2
  },

  // Action Bar Grid
  actionGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: 12,
    marginTop: 6,
    marginBottom: 16
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    borderWidth: 1
  },
  actionCardText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold'
  },

  // Cards Row
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.xl,
    marginBottom: 16
  },
  detailCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1
  },
  cardLabel: {
    fontSize: 9, fontFamily: 'Inter-Bold', letterSpacing: 0.5, marginBottom: 4
  },
  cardValue: {
    fontSize: 12, fontFamily: 'Inter-SemiBold', textAlign: 'center'
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: SPACING.xl,
    marginBottom: 16,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1
  },
  bannerTitle: {
    fontSize: 13, fontFamily: 'Inter-Bold'
  },
  bannerSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 11, marginTop: 2
  },

  panel: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1
  },
  panelTitle: {
    fontSize: 16, fontFamily: 'Inter-Bold'
  },
  panelContent: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, lineHeight: 20
  },

  alternativesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  alternativeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill
  },
  alternativeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold'
  },

  findBtn: {
    marginHorizontal: SPACING.xl,
    marginVertical: 6,
    height: 52,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  findBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontFamily: 'Inter-Bold'
  },

  prescriptionPharmBtn: {
    marginHorizontal: SPACING.xl,
    marginTop: 10,
    marginBottom: 4,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  prescriptionPharmBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },

});
