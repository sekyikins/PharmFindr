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
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/ui/Header';
import { searchPharmaciesForPrescription } from '@/lib/inventorySearch';
import { useHardwareBack } from '@/hooks/useHardwareBack';
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
  const { medicines, imageUri, prescriptionId, isManual } = useLocalSearchParams<{
    medicines: string;
    imageUri?: string;
    prescriptionId?: string;
    isManual?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { sendMessage, createConsultation, selectConsultation } = useChatStore();
  const { theme, primaryColor } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/home');
    }
    return true;
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const isSavedRef = useRef<boolean>(!!prescriptionId);
  const [savedPrescriptionId, setSavedPrescriptionId] = useState<string | null>(prescriptionId || null);

  const isManualEntry = isManual === 'true';

  const handleAddDrugSet = () => {
    // Do not add another card if there is already a completely empty one
    const hasEmptyCard = medsList.some(
      (m) =>
        !m.name?.trim() &&
        !m.strength?.trim() &&
        !m.dosage?.trim() &&
        !m.instructions?.trim()
    );

    if (hasEmptyCard) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
      return;
    }

    const newMed: PrescriptionMedicine = {
      name: '',
      strength: '',
      dosage: '',
      frequency: '',
      duration: '',
      route: '',
      instructions: '',
      confidence: 100,
    };
    setMedsList((prev) => [...prev, newMed]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

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

  // Keep ref of latest medsList for cleanup/leave handlers
  const medsListRef = useRef(medsList);
  useEffect(() => {
    medsListRef.current = medsList;
  }, [medsList]);

  // ─── Save or Update prescription in Supabase ──────────────────────────────

  const saveOrUpdatePrescription = async (meds: PrescriptionMedicine[]) => {
    if (!user?.id) return null;
    const validMeds = meds.filter((m) => m.name && m.name.trim() !== '');
    if (validMeds.length === 0) return null;

    const targetId = savedPrescriptionId || prescriptionId;

    try {
      if (targetId) {
        // Update existing prescription
        const { error } = await supabase
          .from('prescriptions')
          .update({
            ocr_text: validMeds.map((m) => `${m.name} ${m.strength || ''}`).join(', '),
            ai_interpretation: {
              medicines: validMeds,
              doctor: isManualEntry ? 'Manual Entry' : 'AI Analysis',
            },
          })
          .eq('id', targetId);

        if (error) throw error;
        isSavedRef.current = true;
        return targetId;
      } else {
        // Insert new prescription
        const { data, error } = await supabase
          .from('prescriptions')
          .insert({
            user_id: user.id,
            image_url: imageUri || null,
            ocr_text: validMeds.map((m) => `${m.name} ${m.strength || ''}`).join(', '),
            ai_interpretation: {
              medicines: validMeds,
              doctor: isManualEntry ? 'Manual Entry' : 'AI Analysis',
            },
            status: 'completed',
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data?.id) {
          isSavedRef.current = true;
          setSavedPrescriptionId(data.id);
          return data.id;
        }
      }
    } catch (e: any) {
      console.warn('Error saving/updating prescription:', e.message);
    }
    return null;
  };

  const savePrescription = (meds: PrescriptionMedicine[]) => saveOrUpdatePrescription(meds);

  // ─── Auto-Save/Update on leave ─────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      const validMeds = medsListRef.current.filter((m) => m.name && m.name.trim() !== '');
      if (validMeds.length > 0 && user?.id) {
        await saveOrUpdatePrescription(validMeds);
      }
    });

    return unsubscribe;
  }, [navigation, user?.id, savedPrescriptionId, prescriptionId, isManualEntry]);

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
        title="Prescription Details"
        showBack
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.navigate('/(patient)/(tabs)/home');
          }
        }}
        right={
          <Pressable
            style={({ pressed }) => [
              styles.headerAddBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: primaryColor + '15' },
            ]}
            onPress={handleAddDrugSet}
          >
            <Ionicons name="add-circle" size={16} color={primaryColor} />
            <Text style={[styles.headerAddBtnText, { color: primaryColor }]}>Add</Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {medsList.length === 0 ? (
          /* ── Empty state — no medicines detected ── */
          <View style={styles.emptyStateContainer}>
            <View style={{ alignItems: "center" }}>
              <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              No Medicines Listed
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No medicines currently added. Tap "Add" in the top header or retake the prescription photo.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor, marginTop: SPACING.lg }]}
              onPress={handleAddDrugSet}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Add Medicine Manually</Text>
            </Pressable>
          </View>
        ) : (
        <>
        {/* ── Success Banner / Hero Card ── */}
        <View style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.bannerTopRow}>
            <View style={[styles.bannerBadge, { backgroundColor: isManualEntry ? '#0284c715' : '#10b98115' }]}>
              <Ionicons
                name={isManualEntry ? 'create-outline' : 'checkmark-circle'}
                size={14}
                color={isManualEntry ? '#0284c7' : COLORS.pharmacyPrimary}
              />
              <Text style={[styles.bannerBadgeText, { color: isManualEntry ? '#0284c7' : COLORS.pharmacyPrimary }]}>
                {isManualEntry ? 'Manual Entry' : 'AI Extracted'}
              </Text>
            </View>
            <Text style={[styles.bannerCountText, { color: theme.textDim }]}>
              {medsList.length} medicine{medsList.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>
            {isManualEntry ? 'Prescription Medicines & Dosage' : 'Extracted Medicines & Dosage'}
          </Text>
        </View>

        {/* ── Low-confidence warning ── */}
        {medsList.some((m) => m.confidence < 50) && (
          <View style={[styles.warningBanner, { backgroundColor: '#fffbeb', borderColor: COLORS.pendingBorder }]}>
            <Ionicons name="warning" size={18} color="#d97706" style={{ marginRight: 10 }} />
            <Text style={[styles.warningBannerText, { color: '#92400e', flex: 1 }]}>
              Some detected items have lower confidence. Tap any field to edit details if needed.
            </Text>
          </View>
        )}

        {/* ── Medicine Cards ── */}
        {medsList.map((med, idx) => (
          <View key={idx} style={[styles.medCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Card Top Row */}
            <View style={styles.cardHeader}>
              <View style={[styles.medIconCircle, { backgroundColor: primaryColor + '15' }]}>
                <Ionicons name="medkit" size={20} color={primaryColor} />
              </View>
              <View style={styles.cardHeaderContent}>
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
                      style={[styles.medStrengthInput, { color: primaryColor, backgroundColor: primaryColor + '12' }]}
                      value={med.strength}
                      onChangeText={(val) => handleEditField(idx, 'strength', val)}
                      placeholder="Strength"
                      placeholderTextColor={theme.textDim}
                    />
                  )}
                </View>

                <View style={styles.metaBadgeRow}>
                  <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor(med.confidence)}15` }]}>
                    <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(med.confidence) }]} />
                    <Text style={[styles.confidenceText, { color: confidenceColor(med.confidence) }]}>
                      {confidenceLabel(med.confidence)} ({med.confidence}%)
                    </Text>
                  </View>
                  {med.targetDemographic && (
                    <View style={[styles.demographicBadge, { backgroundColor: '#3b82f615', borderColor: '#93c5fd' }]}>
                      <Ionicons name="people" size={12} color={COLORS.patientPrimary} />
                      <Text style={[styles.demographicText, { color: COLORS.patientPrimary }]}>{med.targetDemographic}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
                onPress={() => handleDeleteMed(idx)}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </Pressable>
            </View>

            {/* Structured Details Grid */}
            <View style={styles.cardDetailsGrid}>
              {[
                { label: 'Dosage', placeholder: '10 ml', field: 'dosage' as const, icon: 'flask-outline' },
                { label: 'Frequency', placeholder: 'twice daily', field: 'frequency' as const, icon: 'time-outline' },
                { label: 'Duration', placeholder: '7 days', field: 'duration' as const, icon: 'calendar-outline' },
                { label: 'Route', placeholder: 'oral', field: 'route' as const, icon: 'body-outline' },
              ].map(({ label, placeholder, field, icon }) => (
                <View key={field} style={[styles.gridCell, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                  <View style={styles.cellHeader}>
                    <Ionicons name={icon as any} size={12} color={theme.textDim} />
                    <Text style={[styles.cellLabel, { color: theme.textMuted }]}>{label}</Text>
                  </View>
                  <TextInput
                    style={[styles.cellInput, { color: theme.text.primary }]}
                    value={med[field] ?? ''}
                    onChangeText={(val) => handleEditField(idx, field, val)}
                    placeholder={`e.g. ${placeholder}`}
                    placeholderTextColor={theme.textDim}
                  />
                </View>
              ))}
            </View>

            {/* Special Instructions Row */}
            <View style={[styles.instructionsRow, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
              <View style={styles.instructionsHeader}>
                <Ionicons name="information-circle-outline" size={14} color={primaryColor} />
                <Text style={[styles.cellLabel, { color: theme.textMuted }]}>Instructions</Text>
              </View>
              <TextInput
                style={[styles.instructionsInput, { color: theme.text.primary }]}
                value={med.instructions ?? ''}
                onChangeText={(val) => handleEditField(idx, 'instructions', val)}
                placeholder="Dosage instructions..."
                placeholderTextColor={theme.textDim}
                multiline
              />
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
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="search-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
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
                    <Ionicons name="bag-handle-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  scroll: {
    padding: SPACING.lg
  },

  // ── Banners ──
  banner: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.2,
    padding: SPACING.lg,
    marginBottom: SPACING.md
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill
  },
  bannerBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  bannerCountText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold'
  },
  bannerTitle: {
    fontSize: FONT_SIZE.title,
    fontFamily: 'Inter-Bold',
    marginBottom: 4
  },
  bannerSub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.sm,
    lineHeight: 18
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.lg
  },
  warningBannerText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold', lineHeight: 18
  },

  // ── Medicine Card ──
  medCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1.2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: SPACING.md
  },
  medIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardHeaderContent: {
    flex: 1, gap: 4
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  medNameInput: {
    fontSize: FONT_SIZE.title,
    fontFamily: 'Inter-Bold',
    padding: 0
  },
  medStrengthInput: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 5
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  confidenceText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold'
  },
  deleteBtn: {
    padding: 4
  },

  // ── Structured Grid ──
  cardDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  gridCell: {
    width: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  cellLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  cellInput: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    padding: 0
  },

  // ── Instructions Row ──
  instructionsRow: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  instructionsInput: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
    padding: 0,
    minHeight: 32
  },

  // ── Action Buttons ──
  actionContainer: {
    marginTop: SPACING.sm, gap: SPACING.md
  },
  primaryBtn: {
    padding: 12,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  primaryBtnText: {
    color: COLORS.white, fontSize: FONT_SIZE.xl, fontFamily: 'Inter-SemiBold'
  },
  secondaryBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold'
  },

  // ── Pharmacy Results ──
  pharmacySection: {
    marginTop: SPACING.xxxl
  },
  sectionTitle: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    marginBottom: SPACING.lg
  },

  emptyStateContainer: {
    marginTop: SPACING.xl,
    width: '100%'
  },
  emptyTitle: {
    fontSize: FONT_SIZE.hero,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginTop: SPACING.sm
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.lg,
    textAlign: 'center',
    lineHeight: 22
  },

  pharmacyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg
  },
  pharmacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md
  },
  pharmacyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pharmacyName: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  pharmacyMeta: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.sm,
    marginTop: 2
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm
  },
  matchBadgeText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },

  pharmacyMedsList: {
    marginTop: SPACING.md
  },
  pharmacyMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1
  },
  pharmacyMedName: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold'
  },
  pharmacyMedStrength: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.sm
  },
  pharmacyMedPrice: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },

  reserveBtn: {
    flexDirection: 'row',
    height: 42,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  reserveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-SemiBold'
  },

  demographicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1
  },
  demographicText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  advisoryNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm
  },
  advisoryNoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Medium'
  },
  profileAdvisoryCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.md
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg
  },

  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: RADIUS.pill
  },
  headerAddBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold'
  },

});
