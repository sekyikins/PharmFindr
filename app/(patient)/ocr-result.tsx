import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/ui/Header';
import { searchPharmaciesForPrescription } from '@/lib/inventorySearch';
import type {
  PrescriptionMedicine,
  PharmacyWithMedicines,
} from '@/types/prescription';

// ─── Confidence helpers ──────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return '#16a34a'; // green
  if (confidence >= 50) return '#d97706'; // amber
  return '#dc2626'; // red
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 50) return 'Medium';
  return 'Low';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OcrResult() {
  const { medicines, imageUri, prescriptionId } = useLocalSearchParams<{ medicines: string; imageUri?: string; prescriptionId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { sendMessage, createConsultation, selectConsultation } = useChatStore();
  const { theme, primaryColor } = useThemeContext();

  const scrollViewRef = useRef<ScrollView>(null);
  const isSavedRef = useRef<boolean>(!!prescriptionId);
  const [savedPrescriptionId, setSavedPrescriptionId] = useState<string | null>(prescriptionId || null);

  // Parse list of medicines from route params (guard against null/invalid JSON)
  const initialMeds: PrescriptionMedicine[] = (() => {
    if (!medicines) return [];
    try {
      const parsed = JSON.parse(medicines);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const [medsList, setMedsList] = useState<PrescriptionMedicine[]>(initialMeds);

  // Pharmacy search state
  const [pharmacyResults, setPharmacyResults] = useState<PharmacyWithMedicines[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Existing consultation state
  const [existingConsultationId, setExistingConsultationId] = useState<string | null>(null);

  // ─── Check for existing AI chat thread ─────────────────────────────────────

  useEffect(() => {
    if (!user?.id || !prescriptionId) return;

    const checkExisting = async () => {
      try {
        const { data } = await supabase
          .from('consultations')
          .select('id')
          .eq('user_id', user.id)
          .eq('prescription_id', prescriptionId)
          .eq('type', 'prescription')
          .limit(1)
          .single();

        if (data?.id) {
          setExistingConsultationId(data.id);
        }
      } catch {
        // No existing consultation found — that's fine
      }
    };

    checkExisting();
  }, [user?.id, prescriptionId]);

  // ─── Edit helpers ──────────────────────────────────────────────────────────

  const handleEditField = (index: number, field: keyof PrescriptionMedicine, val: string) => {
    const updated = [...medsList];
    updated[index] = { ...updated[index], [field]: val };
    setMedsList(updated);
  };

  const handleDeleteMed = (index: number) => {
    setMedsList(medsList.filter((_, i) => i !== index));
    // Reset search if medicines changed
    if (hasSearched) {
      setHasSearched(false);
      setPharmacyResults([]);
    }
  };

  // ─── Save prescription to Supabase ────────────────────────────────────────

  const savePrescription = async (meds: PrescriptionMedicine[]) => {
    if (!user?.id) return null;
    if (isSavedRef.current && savedPrescriptionId) return savedPrescriptionId;
    try {
      const { data } = await supabase
        .from('prescriptions')
        .insert({
          user_id: user.id,
          image_url: imageUri || null,
          ocr_text: meds.map((m) => `${m.name} ${m.strength || ''}`).join(', '),
          ai_interpretation: {
            medicines: meds,
            doctor: 'AI Analysis',
          },
          status: 'completed',
        })
        .select('id')
        .single();

      if (data?.id) {
        isSavedRef.current = true;
        setSavedPrescriptionId(data.id);
        return data.id;
      }
      return null;
    } catch (e: any) {
      console.warn('Error saving prescription:', e.message);
      return null;
    }
  };

  // ─── Unsaved confirmation prompt on leave ──────────────────────────────────

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isSavedRef.current || medsList.length === 0) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Save Prescription?',
        'Would you like to save this prescription to your history before leaving?',
        [
          {
            text: 'Save to History',
            onPress: async () => {
              await savePrescription(medsList);
              isSavedRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Discard & Leave',
            style: 'destructive',
            onPress: () => {
              isSavedRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, medsList]);

  // ─── Search pharmacies ────────────────────────────────────────────────────

  const handleSearchPharmacies = async () => {
    if (medsList.length === 0) {
      Alert.alert('No Medicines', 'There are no medicines to search for.');
      return;
    }

    setSearching(true);
    try {
      const results = await searchPharmaciesForPrescription(medsList);
      setPharmacyResults(results);
      setHasSearched(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch (e: any) {
      console.warn('Pharmacy search error:', e.message);
      Alert.alert('Search Error', 'Could not search for pharmacies. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // ─── AI consultation ──────────────────────────────────────────────────────

  const handleContinueToAI = async () => {
    const presId = await savePrescription(medsList);
    const medNames = medsList.slice(0, 2).map((m) => m.name).join(', ');
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = `💊 ${medNames || 'Prescription'} - ${dateStr}`;

    if (user?.id) {
      await createConsultation(user.id, {
        title,
        type: 'prescription',
        prescription_id: presId || undefined,
        image_url: imageUri || undefined,
        medicines: medsList,
      });

      const formattedList = medsList
        .map((m) => `- ${m.name} ${m.strength || ''} (${m.frequency || ''} for ${m.duration || ''})`)
        .join('\n');

      const prompt = `I just scanned a new prescription (${title}). Here are the medicines found:\n${formattedList}\n\nPlease explain what these medicines are, their uses, dosage guidelines, side effects, and key precautions. Keep the explanation clear, patient-friendly, and well-structured using bullet points.`;

      sendMessage(user.id, prompt);
    }

    router.replace('/(patient)/(tabs)/chat');
  };

  // ─── Continue existing chat ─────────────────────────────────────────────────

  const handleContinueChat = async () => {
    if (!user?.id || !existingConsultationId) return;
    await selectConsultation(user.id, existingConsultationId);
    router.replace('/(patient)/(tabs)/chat');
  };

  // ─── Reserve from pharmacy ────────────────────────────────────────────────

  const handleReserve = async (pharmacy: PharmacyWithMedicines) => {
    await savePrescription(medsList);

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
        medName: pharmacy.medicines.map((m) => `${m.medicineName} ${m.strength}`).join(', '),
        price: `GH₵${totalCost.toFixed(2)}`,
        medicinesJson: JSON.stringify(medsParam),
      },
    });
  };

  // ─── Prompt before AI consultation ────────────────────────────────────────

  const promptNewConsultation = () => {
    const medNames = medsList.slice(0, 2).map((m) => m.name).join(', ');
    Alert.alert(
      'Start a new consultation?',
      `Would you like to start a dedicated AI consultation for ${medNames || 'this prescription'}?`,
      [
        {
          text: 'Yes, Start Consultation',
          onPress: () => handleContinueToAI(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Decide which handler to use for the AI button
  const handleAIButtonPress = existingConsultationId
    ? handleContinueChat
    : promptNewConsultation;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Scan Results"
        showBack
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.navigate('/(patient)/(tabs)/home');
          }
        }}
      />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {medsList.length === 0 ? (
          /* ── Empty state — no medicines detected ── */
          <View style={styles.emptyStateContainer}>
            <View style={{ alignItems: "center" }}>
              <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              No Medicines Detected
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              I couldn't identify any medicines in this image. This can happen with poor lighting, or non-prescription images.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor, marginTop: SPACING.lg }]}
              onPress={() => {
                if (router.canGoBack()) {
                    router.back();
                  } else {
                  router.push('/(patient)/scan');
                }
              }}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Retake Photo</Text>
            </Pressable>
          </View>
        ) : (
        <>
        {/* ── Success banner ── */}
        <View style={[styles.banner, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginRight: 8 }} />
          <Text style={[styles.bannerText, { color: theme.successText }]}>
            Prescription detected — {medsList.length} medicine{medsList.length !== 1 ? 's' : ''} identified
          </Text>
        </View>

        {/* ── Low-confidence warning ── */}
        {medsList.some((m) => m.confidence < 50) && (
          <View style={[styles.warningBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Ionicons name="warning" size={16} color="#d97706" style={{ marginRight: 8 }} />
            <Text style={[styles.bannerText, { color: '#92400e', flex: 1 }]}>
              I have low confidence in some of the medicines I detected. Please verify before proceeding.
            </Text>
          </View>
        )}

        {/* ── Medicine Cards ── */}
        {medsList.map((med, idx) => (
          <View key={idx} style={[styles.medCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Header row: name + confidence badge + delete */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                
                <View style={styles.badgeRow}>
                  <TextInput
                    style={[styles.medNameInput, { color: theme.text.primary }]}
                    value={med.name}
                    onChangeText={(val) => handleEditField(idx, 'name', val)}
                    placeholder="Medicine Name"
                    placeholderTextColor={theme.textDim}
                  />
                  {med.strength && (
                    <TextInput
                      style={[styles.medStrengthInput, { color: primaryColor, backgroundColor: theme.patientSecondary }]}
                      value={med.strength}
                      onChangeText={(val) => handleEditField(idx, 'strength', val)}
                      placeholder="Strength"
                      placeholderTextColor={theme.textDim}
                    />
                  )}
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor(med.confidence)}18` }]}>
                  <Text style={[styles.confidenceText, { color: confidenceColor(med.confidence) }]}>
                    Confidence
                  </Text>
                  <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(med.confidence) }]} />
                  <Text style={[styles.confidenceText, { color: confidenceColor(med.confidence) }]}>
                    {confidenceLabel(med.confidence)} ({med.confidence}%)
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
                onPress={() => handleDeleteMed(idx)}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </Pressable>
            </View>

            {/* Detail fields */}
            <View style={styles.cardDetails}>
              {[
                { label: 'Dosage', field: 'dosage' as const },
                { label: 'Frequency', field: 'frequency' as const },
                { label: 'Duration', field: 'duration' as const },
                { label: 'Route', field: 'route' as const },
                { label: 'Instructions', field: 'instructions' as const },
              ].map(({ label, field }) => (
                <View key={field} style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
                  <TextInput
                    style={[styles.detailInput, { color: theme.text.primary, borderColor: theme.border }]}
                    value={med[field] ?? ''}
                    onChangeText={(val) => handleEditField(idx, field, val)}
                    placeholder={label}
                    placeholderTextColor={theme.textDim}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Action Buttons ── */}
        <View style={styles.actionContainer}>
          {/* Primary: Find Medicines Nearby */}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
            onPress={handleSearchPharmacies}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="search-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {hasSearched ? 'Search Again' : 'Find Medicines Nearby'}
                </Text>
              </>
            )}
          </Pressable>

          {/* Secondary: Ask AI / Continue Chat */}
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }, { borderColor: primaryColor, backgroundColor: theme.card }]}
            onPress={handleAIButtonPress}
          >
            <Ionicons
              name={existingConsultationId ? 'chatbubbles-outline' : 'chatbubble-ellipses-outline'}
              size={18}
              color={primaryColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.secondaryBtnText, { color: primaryColor }]}>
              {existingConsultationId ? 'Continue Chat' : 'Ask AI About These'}
            </Text>
          </Pressable>
        </View>

        {/* ── Pharmacy Results ── */}
        {hasSearched && (
          <View style={styles.pharmacySection}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {pharmacyResults.length > 0
                ? `${pharmacyResults.length} Pharmac${pharmacyResults.length === 1 ? 'y' : 'ies'} Found`
                : 'No Pharmacies Found'}
            </Text>

            {pharmacyResults.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Could not find any nearby pharmacies that stock these medicines. Try asking AI for alternatives.
              </Text>
            )}

            {pharmacyResults.map((pharmacy) => (
              <View
                key={pharmacy.pharmacyId}
                style={[styles.pharmacyCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                {/* Pharmacy header */}
                <View style={styles.pharmacyHeader}>
                  <View style={[styles.pharmacyIconCircle, { backgroundColor: theme.patientSecondary }]}>
                    <Ionicons name="storefront" size={18} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pharmacyName, { color: theme.text.primary }]}>{pharmacy.pharmacyName}</Text>
                    <Text style={[styles.pharmacyMeta, { color: theme.textMuted }]}>
                      {pharmacy.matchCount}/{pharmacy.totalPrescribed} medicines available
                    </Text>
                  </View>
                  {/* Match percentage badge */}
                  <View style={[
                    styles.matchBadge,
                    {
                      backgroundColor: pharmacy.matchCount === pharmacy.totalPrescribed
                        ? '#dcfce7'
                        : '#fef9c3',
                    },
                  ]}>
                    <Text style={[
                      styles.matchBadgeText,
                      {
                        color: pharmacy.matchCount === pharmacy.totalPrescribed
                          ? '#16a34a'
                          : '#a16207',
                      },
                    ]}>
                      {Math.round((pharmacy.matchCount / pharmacy.totalPrescribed) * 100)}%
                    </Text>
                  </View>
                </View>

                {/* Medicine list in this pharmacy */}
                <View style={styles.pharmacyMedsList}>
                  {pharmacy.medicines.map((m, mIdx) => (
                    <View key={mIdx} style={[styles.pharmacyMedRow, { borderTopColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pharmacyMedName, { color: theme.text.primary }]}>
                          {m.medicineName}
                        </Text>
                        <Text style={[styles.pharmacyMedStrength, { color: theme.textMuted }]}>
                          {m.strength}
                        </Text>
                      </View>
                      <Text style={[styles.pharmacyMedPrice, { color: primaryColor }]}>
                        GH₵{m.price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Actions: Reserve + Navigate */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.md }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.reserveBtn,
                      { flex: 1 },
                      pressed && { opacity: 0.5 },
                      { backgroundColor: primaryColor },
                    ]}
                    onPress={() => handleReserve(pharmacy)}
                  >
                    <Ionicons name="bag-handle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.reserveBtnText}>Reserve</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      { paddingHorizontal: 16, height: 44, borderRadius: RADIUS.lg, borderColor: primaryColor, backgroundColor: theme.card },
                      pressed && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: '/(patient)/pharmacy/[id]/navigate',
                        params: {
                          id: encodeURIComponent(pharmacy.pharmacyId),
                          name: pharmacy.pharmacyName,
                          lat: String(pharmacy.latitude ?? 5.6037),
                          lon: String(pharmacy.longitude ?? -0.187),
                        },
                      });
                    }}
                  >
                    <Ionicons name="navigate-outline" size={18} color={primaryColor} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  scroll: { padding: SPACING.lg },

  // ── Banners ──
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.md,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.lg,
  },
  bannerText: { fontSize: FONT_SIZE.lg, fontWeight: '600' },

  // ── Medicine Card ──
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
    marginBottom: SPACING.md,
  },
  cardHeaderLeft: { gap: 6 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  medNameInput: {
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    padding: 0,
  },
  medStrengthInput: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  deleteBtn: { padding: 6 },

  cardDetails: { gap: 8, marginTop: 4 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: FONT_SIZE.sm,
    width: 80,
  },
  detailInput: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '500',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  // ── Action Buttons ──
  actionContainer: { marginTop: SPACING.sm, gap: SPACING.md },
  primaryBtn: {
    padding: 12,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: FONT_SIZE.xl, fontWeight: '600' },
  secondaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: FONT_SIZE.lg, fontWeight: '600' },

  // ── Pharmacy Results ──
  pharmacySection: { marginTop: SPACING.xxxl },
  sectionTitle: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },

  emptyStateContainer: {
    marginTop: SPACING.xl,
    width: '100%',
  },
  emptyTitle: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    textAlign: 'center',
    lineHeight: 22,
  },

  pharmacyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  pharmacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  pharmacyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  pharmacyMeta: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  matchBadgeText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },

  pharmacyMedsList: { marginTop: SPACING.md },
  pharmacyMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  pharmacyMedName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  pharmacyMedStrength: {
    fontSize: FONT_SIZE.sm,
  },
  pharmacyMedPrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },

  reserveBtn: {
    flexDirection: 'row',
    height: 42,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reserveBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
});
