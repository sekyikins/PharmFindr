import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

const { width } = Dimensions.get('window');

const MEDICINE_DETAILS: Record<string, any> = {
  Amoxicillin: {
    name: 'Amoxicillin',
    strength: '500mg',
    category: 'Antibiotic',
    dosage: '1 Tablet',
    frequency: '3× Daily',
    duration: '5 Days',
    uses: 'Treats bacterial infections including pneumonia, ear infections, urinary tract infections, and skin infections caused by susceptible organisms.',
    howToTake: 'Take with or without food. Swallow whole with a full glass of water. Complete the full course even if you feel better after a few days.',
    sideEffects: 'Common: Nausea, diarrhea, stomach upset. Rare: Allergic reactions (rash, hives). Stop immediately if you develop severe skin reaction or difficulty breathing.',
    warnings: 'Inform your doctor of any antibiotic allergies. May reduce efficacy of oral contraceptives. Complete the full course to prevent resistance.',
    alternatives: ['Ampicillin 500mg', 'Azithromycin 250mg', 'Clarithromycin 500mg'],
  },
  Metformin: {
    name: 'Metformin',
    strength: '850mg',
    category: 'Antidiabetic',
    dosage: '1 Tablet',
    frequency: '2× Daily',
    duration: 'Ongoing',
    uses: 'Improves glycemic control in adults and pediatric patients 10 years of age and older with type 2 diabetes mellitus.',
    howToTake: 'Take with meals to reduce gastrointestinal side effects. Swallow whole, do not crush or chew.',
    sideEffects: 'Common: Diarrhea, nausea, vomiting, flatulence. Rare: Lactic acidosis (requires immediate medical attention).',
    warnings: 'Should not be used in patients with severe renal impairment or metabolic acidosis. Monitor kidney function regularly.',
    alternatives: ['Glipizide 5mg', 'Pioglitazone 15mg', 'Sitagliptin 100mg'],
  },
  Lisinopril: {
    name: 'Lisinopril',
    strength: '10mg',
    category: 'ACE Inhibitor',
    dosage: '1 Tablet',
    frequency: '1× Daily',
    duration: 'Ongoing',
    uses: 'Treats high blood pressure (hypertension) to lower the risk of stroke and heart attack. Also used for heart failure.',
    howToTake: 'Take at the same time each day, with or without food. Drink plenty of water.',
    sideEffects: 'Common: Dry cough, dizziness, headache. Rare: Angioedema (swelling of face, lips, tongue, or throat).',
    warnings: 'Do not use during pregnancy as it can harm the unborn baby. Monitor potassium levels and kidney function.',
    alternatives: ['Losartan 50mg', 'Enalapril 10mg', 'Amlodipine 5mg'],
  },
};

export default function MedicineDetail() {
  const router = useRouter();
  const { query } = useLocalSearchParams<{ query?: string }>();
  const { theme, primaryColor } = useThemeContext();
  
  // Default to Amoxicillin if query is not found
  const medKey = query && MEDICINE_DETAILS[query] ? query : 'Amoxicillin';
  const med = MEDICINE_DETAILS[medKey];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        
        {/* ── Blue Hero Header ── */}
        <View style={[styles.hero, { backgroundColor: primaryColor }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#ffffff" />
          </Pressable>

          <View style={styles.heroContent}>
            {/* Pill icon white circle */}
            <View style={styles.pillCircle}>
              <Ionicons name="ellipse-outline" size={28} color={primaryColor} style={styles.rotatedPill} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medSub}>{med.strength} · {med.category}</Text>
            </View>
          </View>
        </View>

        {/* ── Wave curve at bottom of hero ── */}
        <View style={{ backgroundColor: primaryColor }}>
          <Svg width={width} height={20} viewBox={`0 0 ${width} 20`} style={{ display: 'flex' }}>
            <Path d={`M0,20 Q${width/2},0 ${width},20 L${width},20 L0,20 Z`} fill={theme.background} />
          </Svg>
        </View>

        {/* ── Cards Grid (Dosage, Frequency, Duration) ── */}
        <View style={styles.cardsRow}>
          <DetailCard icon="medkit" iconColor={theme.error} label="DOSAGE" value={med.dosage} theme={theme} />
          <DetailCard icon="time" iconColor={theme.warning} label="FREQUENCY" value={med.frequency} theme={theme} />
          <DetailCard icon="calendar" iconColor={theme.success} label="DURATION" value={med.duration} theme={theme} />
        </View>

        {/* ── Info Panels ── */}
        <InfoPanel title="Uses" content={med.uses} theme={theme} />
        <InfoPanel title="How to Take" content={med.howToTake} theme={theme} />
        <InfoPanel title="Side Effects" content={med.sideEffects} theme={theme} />
        <InfoPanel title="Warnings" content={med.warnings} theme={theme} />

        {/* ── Possible Alternatives ── */}
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.panelTitle, { color: theme.text.primary }]}>Possible Alternatives</Text>
          <View style={styles.alternativesRow}>
            {med.alternatives.map((alt: string, index: number) => (
              <View key={index} style={[styles.alternativeBadge, { backgroundColor: theme.patientSecondary }]}>
                <Text style={[styles.alternativeText, { color: primaryColor }]}>{alt}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Find Nearby Button ── */}
        <Pressable
          style={[styles.findBtn, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/(patient)/pharmacies')}
        >
          <Text style={styles.findBtnText}>Find Nearby Pharmacies</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

function DetailCard({ icon, iconColor, label, value, theme }: { icon: any; iconColor: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Ionicons name={icon} size={20} color={iconColor} style={{ marginBottom: 8 }} />
      <Text style={[styles.cardLabel, { color: theme.textDim }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: theme.text.primary }]}>{value}</Text>
    </View>
  );
}

function InfoPanel({ title, content, theme }: { title: string; content: string; theme: any }) {
  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.panelTitle, { color: theme.text.primary }]}>{title}</Text>
      <Text style={[styles.panelContent, { color: theme.textMuted }]}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32 },

  // ── Hero ──
  hero: {
    paddingTop: 12,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pillCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rotatedPill: { transform: [{ rotate: '45deg' }] },
  heroTextCol: { flex: 1 },
  medName: { fontSize: FONT_SIZE.hero, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  medSub: { fontSize: FONT_SIZE.lg, color: 'rgba(255, 255, 255, 0.8)' },

  // ── Cards Row ──
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.xl,
    marginTop: 10,
    marginBottom: 20,
  },
  detailCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardLabel: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: FONT_SIZE.body, fontWeight: '600', textAlign: 'center' },

  // ── Panels ──
  panel: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  panelTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 8 },
  panelContent: { fontSize: FONT_SIZE.body, lineHeight: 20 },

  // ── Alternatives ──
  alternativesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  alternativeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  alternativeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },

  // ── Find Button ──
  findBtn: {
    marginHorizontal: SPACING.xl,
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  findBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
  },
});
