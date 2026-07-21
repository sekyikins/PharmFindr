import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  TextInput 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';

export default function OcrResult() {
  const { medicines, imageUri } = useLocalSearchParams<{ medicines: string, imageUri?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { sendMessage } = useChatStore();
  const { theme, primaryColor } = useThemeContext();

  // Parse list of medicines
  const initialMeds = medicines ? JSON.parse(medicines) : [
    { name: 'Amoxicillin', strength: '500mg', category: 'Antibiotic', dosage: '1 Tablet', frequency: '3× Daily', duration: '5 Days' },
    { name: 'Paracetamol', strength: '500mg', category: 'Analgesic', dosage: '1-2 Tablets', frequency: 'As needed', duration: '5 Days' },
    { name: 'Ibuprofen', strength: '400mg', category: 'NSAID', dosage: '1 Tablet', frequency: '2× Daily', duration: '3 Days' }
  ];
  const [medsList, setMedsList] = useState<any[]>(initialMeds);

  const handleEditField = (index: number, field: string, val: string) => {
    const updated = [...medsList];
    updated[index][field] = val;
    setMedsList(updated);
  };

  const savePrescription = async (meds: any[]) => {
    if (!user?.id) return;
    try {
      await supabase.from('prescriptions').insert({
        user_id: user.id,
        ocr_text: meds.map((m) => `${m.name} ${m.strength || ''}`).join(', '),
        ai_interpretation: {
          medicines: meds,
          doctor: 'AI Analysis',
        },
        status: 'completed',
      });
    } catch (e: any) {
      console.warn('Error saving prescription:', e.message);
    }
  };

  const handleContinueToAI = async () => {
    const formattedList = medsList.map(m => `- ${m.name} ${m.strength || ''} (${m.frequency || ''} for ${m.duration || ''})`).join('\n');
    const prompt = `I just scanned a prescription. Here are the medicines found:\n${formattedList}\n\nPlease explain what these are, how they are used, their dosage, side effects, and precautions.`;
    
    await savePrescription(medsList);
    sendMessage(user?.id, prompt);
    router.replace('/(patient)/(tabs)/chat');
  };

  const handleFindAvailability = async () => {
    const firstMed = medsList[0]?.name || '';
    await savePrescription(medsList);
    router.replace({
      pathname: '/(patient)/pharmacies',
      params: { query: firstMed }
    });
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
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Scan Results</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Success banner ── */}
        <View style={[styles.banner, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginRight: 8 }} />
          <Text style={[styles.bannerText, { color: theme.successText }]}>Prescription detected — {medsList.length} medicines identified</Text>
        </View>

        {/* ── Medicines Cards ── */}
        {medsList.map((med, idx) => (
          <View key={idx} style={[styles.medCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <TextInput
                  style={[styles.medNameInput, { color: theme.text.primary }]}
                  value={med.name}
                  onChangeText={(val) => handleEditField(idx, 'name', val)}
                />
                <View style={styles.badgeRow}>
                  <TextInput
                    style={[styles.strengthBadge, { backgroundColor: theme.patientSecondary, color: primaryColor }]}
                    value={med.strength}
                    onChangeText={(val) => handleEditField(idx, 'strength', val)}
                  />
                  {med.category && (
                    <Text style={[styles.categoryText, { color: theme.textMuted }]}>{med.category}</Text>
                  )}
                </View>
              </View>
              {/* Blue pill circle icon on right */}
              <View style={[styles.pillIconCircle, { backgroundColor: theme.patientSecondary }]}>
                <Ionicons name="ellipse-outline" size={20} color={primaryColor} style={styles.rotatedPill} />
              </View>
            </View>

            {/* Visual dosage / frequency / duration cards */}
            <View style={styles.detailsGrid}>
              {/* Dosage Box */}
              <View style={[styles.gridBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.gridBoxLabel, { color: theme.textDim }]}>DOSAGE</Text>
                <View style={styles.gridInputRow}>
                  <Ionicons name="medkit-outline" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
                  <TextInput
                    style={[styles.gridInput, { color: theme.text.primary }]}
                    value={med.dosage || med.strength}
                    onChangeText={(val) => handleEditField(idx, 'dosage', val)}
                  />
                </View>
              </View>

              {/* Frequency Box */}
              <View style={[styles.gridBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.gridBoxLabel, { color: theme.textDim }]}>FREQUENCY</Text>
                <View style={styles.gridInputRow}>
                  <Ionicons name="time-outline" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
                  <TextInput
                    style={[styles.gridInput, { color: theme.text.primary }]}
                    value={med.frequency}
                    onChangeText={(val) => handleEditField(idx, 'frequency', val)}
                  />
                </View>
              </View>

              {/* Duration Box */}
              <View style={[styles.gridBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.gridBoxLabel, { color: theme.textDim }]}>DURATION</Text>
                <View style={styles.gridInputRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
                  <TextInput
                    style={[styles.gridInput, { color: theme.text.primary }]}
                    value={med.duration}
                    onChangeText={(val) => handleEditField(idx, 'duration', val)}
                  />
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* ── Action Buttons ── */}
        <View style={styles.actionContainer}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: primaryColor }]} onPress={handleContinueToAI}>
            <Text style={styles.primaryBtnText}>Continue to AI</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, { borderColor: primaryColor, backgroundColor: theme.card }]}
            onPress={handleFindAvailability}
          >
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>Find These Medicines Nearby</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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

  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  // ── Banner ──
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.lg,
  },
  bannerText: { fontSize: FONT_SIZE.body, fontWeight: '600' },

  // ── Card ──
  medCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  cardHeaderLeft: { flex: 1 },
  medNameInput: {
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    padding: 0,
    marginBottom: 4,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strengthBadge: {
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryText: { fontSize: FONT_SIZE.md },
  pillIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatedPill: { transform: [{ rotate: '45deg' }] },

  // Grid
  detailsGrid: { flexDirection: 'row', gap: 8 },
  gridBox: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 10,
    borderWidth: 1,
  },
  gridBoxLabel: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  gridInputRow: { flexDirection: 'row', alignItems: 'center' },
  gridInput: { fontSize: FONT_SIZE.body, fontWeight: '600', flex: 1, padding: 0 },

  // ── Actions ──
  actionContainer: { marginTop: SPACING.sm, gap: SPACING.md },
  primaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontWeight: '600' },
  secondaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: FONT_SIZE.lg, fontWeight: '600' },
});
