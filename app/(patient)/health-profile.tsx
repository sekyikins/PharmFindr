import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import KeyboardAwareContainer from '@/components/ui/KeyboardAwareContainer';
import { supabase } from '@/lib/supabase';

// Master medical suggestion databases for dynamic autocomplete
const ALLERGIES_DB = [
  'Penicillin',
  'Amoxicillin',
  'Aspirin',
  'Sulfa Drugs',
  'Ibuprofen',
  'Latex',
  'Codeine',
  'Ciprofloxacin',
  'Erythromycin',
  'Tetracycline',
  'Morphine',
  'Naproxen',
  'Paracetamol',
  'Cephalosporins',
  'Clarithromycin',
];

const CONDITIONS_DB = [
  'Asthma',
  'Hypertension (High BP)',
  'Diabetes (Type 2)',
  'Diabetes (Type 1)',
  'Kidney Disease',
  'Liver Disease',
  'GERD / Acid Reflux',
  'Epilepsy / Seizures',
  'Glaucoma',
  'Heart Failure',
  'High Cholesterol',
  'Pregnancy / Lactation',
  'G6PD Deficiency',
  'Peptic Ulcer',
];

type EditingGuardrailCategory = 'allergies' | 'conditions' | 'medications' | null;

export default function HealthProfile() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { appUser, fetchAppUser, updateAppUser } = useAuthStore();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
    return true;
  };

  useHardwareBack(handleGoBack);

  // Safety lists (Tag arrays)
  const [allergiesList, setAllergiesList] = useState<string[]>([]);
  const [conditionsList, setConditionsList] = useState<string[]>([]);
  const [medicationsList, setMedicationsList] = useState<string[]>([]);

  // Active Bottom Sheet state
  const [editingCategory, setEditingCategory] = useState<EditingGuardrailCategory>(null);
  const [sheetList, setSheetList] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const guardrailSheetRef = useRef<any>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppUser();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAppUser();
  }, [fetchAppUser]);

  useEffect(() => {
    if (appUser) {
      setAllergiesList(appUser.allergies || []);
      setConditionsList(appUser.existing_conditions || []);
      setMedicationsList(appUser.current_medications || []);
    }
  }, [appUser]);

  // Real-Time BMI & Metric Summary
  const bmiInfo = useMemo(() => {
    if (!appUser?.weight || !appUser?.height || appUser.height <= 0) return null;
    const hMeters = appUser.height / 100;
    const bmiVal = appUser.weight / (hMeters * hMeters);
    let category = 'Normal';
    let color: string = COLORS.pharmacyPrimary;

    if (bmiVal < 18.5) {
      category = 'Underweight';
      color = COLORS.info;
    } else if (bmiVal >= 25 && bmiVal < 29.9) {
      category = 'Overweight';
      color = COLORS.warning;
    } else if (bmiVal >= 30) {
      category = 'Obese';
      color = COLORS.error;
    }

    return { value: bmiVal.toFixed(1), category, color };
  }, [appUser?.weight, appUser?.height]);

  const hasAnyBiometric = !!(appUser?.age || appUser?.weight || appUser?.height || appUser?.gender);

  // Open dedicated category sheet
  const openCategoryEditor = (cat: EditingGuardrailCategory) => {
    setEditingCategory(cat);
    setCustomInput('');
    if (cat === 'allergies') {
      setSheetList([...allergiesList]);
    } else if (cat === 'conditions') {
      setSheetList([...conditionsList]);
    } else if (cat === 'medications') {
      setSheetList([...medicationsList]);
    }
    guardrailSheetRef.current?.present?.() ?? guardrailSheetRef.current?.expand?.();
  };

  // Add tag in bottom sheet
  const handleAddSheetTag = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    if (!sheetList.includes(clean)) {
      setSheetList([...sheetList, clean]);
    }
    setCustomInput('');
  };

  // Remove tag in bottom sheet
  const handleRemoveSheetTag = (val: string) => {
    setSheetList(sheetList.filter((item) => item !== val));
  };

  // Dynamic medication suggestions for current input
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (editingCategory !== 'medications') {
      setMedicationSuggestions([]);
      return;
    }

    const trimmed = customInput.trim();
    if (!trimmed) {
      setMedicationSuggestions([]);
      return;
    }

    let isCancelled = false;
    const searchTimer = setTimeout(async () => {
      try {
        const [{ data: genData }, { data: prodData }] = await Promise.all([
          supabase
            .from('generic_medicines')
            .select('generic_name')
            .ilike('generic_name', `%${trimmed}%`)
            .limit(6),
          supabase
            .from('medicine_products')
            .select('brand_name')
            .ilike('brand_name', `%${trimmed}%`)
            .limit(6),
        ]);

        if (isCancelled) return;

        const names = new Set<string>();
        (genData || []).forEach((g: any) => {
          if (g.generic_name && !sheetList.includes(g.generic_name)) {
            names.add(g.generic_name);
          }
        });
        (prodData || []).forEach((p: any) => {
          if (p.brand_name && !sheetList.includes(p.brand_name)) {
            names.add(p.brand_name);
          }
        });

        setMedicationSuggestions(Array.from(names).slice(0, 6));
      } catch (err) {
        console.warn('Error fetching dynamic medication suggestions:', err);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(searchTimer);
    };
  }, [customInput, editingCategory, sheetList]);

  // Suggestions for allergies / conditions
  const currentSuggestions = useMemo(() => {
    const trimmed = customInput.trim().toLowerCase();
    if (!trimmed) return [];

    if (editingCategory === 'allergies') {
      return ALLERGIES_DB.filter(
        (item) => item.toLowerCase().includes(trimmed) && !sheetList.includes(item)
      );
    }
    if (editingCategory === 'conditions') {
      return CONDITIONS_DB.filter(
        (item) => item.toLowerCase().includes(trimmed) && !sheetList.includes(item)
      );
    }
    return medicationSuggestions;
  }, [customInput, editingCategory, sheetList, medicationSuggestions]);

  // Save changes from bottom sheet
  const handleSaveSheet = async () => {
    if (!editingCategory) return;
    setSavingCategory(true);
    try {
      if (editingCategory === 'allergies') {
        await updateAppUser({ allergies: sheetList });
        setAllergiesList(sheetList);
        toast.success('Allergies Updated', 'Your drug allergies list has been saved.');
      } else if (editingCategory === 'conditions') {
        await updateAppUser({ existing_conditions: sheetList });
        setConditionsList(sheetList);
        toast.success('Conditions Updated', 'Your medical conditions list has been saved.');
      } else if (editingCategory === 'medications') {
        await updateAppUser({ current_medications: sheetList });
        setMedicationsList(sheetList);
        toast.success('Medications Updated', 'Your current medications list has been saved.');
      }

      guardrailSheetRef.current?.dismiss?.() ?? guardrailSheetRef.current?.close?.();
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to update safety guardrail. Please try again.'));
    } finally {
      setSavingCategory(false);
    }
  };

  const getSheetTitle = () => {
    if (editingCategory === 'allergies') return 'Known Drug Allergies';
    if (editingCategory === 'conditions') return 'Existing Medical Conditions';
    if (editingCategory === 'medications') return 'Current Medications';
    return 'Safety Guardrail';
  };

  const getSheetSubtitle = () => {
    if (editingCategory === 'allergies') {
      return 'Active ingredients added here will be flagged in red during drug searches and scans.';
    }
    if (editingCategory === 'conditions') {
      return 'Existing conditions will be cross-checked against medication contraindications.';
    }
    if (editingCategory === 'medications') {
      return 'Monitors potential multi-drug interactions and duplicate therapy risks.';
    }
    return '';
  };

  const getCategoryColor = (cat: EditingGuardrailCategory) => {
    if (cat === 'allergies') return COLORS.error;
    if (cat === 'conditions') return COLORS.warning;
    if (cat === 'medications') return COLORS.purple;
    return primaryColor;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Health Parameters" showBack onBack={handleGoBack} />

      <KeyboardAwareContainer>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        >
          {/* ── CARD 1: BIOMETRIC METRICS HERO CARD ── */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>PHYSICAL PARAMETERS</Text>
                <Text style={[styles.sectionHeadingSub, { color: theme.textMuted }]}>
                  Age, weight, height and calculated body mass index.
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.biometricsCardBtn,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push('/(patient)/biometric-metrics' as any)}
            >
              <View style={styles.biometricsCardInner}>
                <View style={[styles.profileItemIconBox, { backgroundColor: primaryColor + '18' }]}>
                  <Ionicons name="fitness-outline" size={22} color={primaryColor} />
                </View>

                <View style={styles.profileItemTextCol}>
                  <Text style={[styles.profileItemLabel, { color: theme.text.primary, fontSize: FONT_SIZE.md }]}>
                    Biometric Metrics
                  </Text>
                  
                  {hasAnyBiometric ? (
                    <View style={styles.biometricsChipsRow}>
                      {appUser?.age ? (
                        <View style={[styles.miniChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Text style={[styles.miniChipText, { color: theme.text.primary }]}>
                            {appUser.age} yrs
                          </Text>
                        </View>
                      ) : null}
                      {appUser?.weight ? (
                        <View style={[styles.miniChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Text style={[styles.miniChipText, { color: theme.text.primary }]}>
                            {appUser.weight} kg
                          </Text>
                        </View>
                      ) : null}
                      {appUser?.height ? (
                        <View style={[styles.miniChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <Text style={[styles.miniChipText, { color: theme.text.primary }]}>
                            {appUser.height} cm
                          </Text>
                        </View>
                      ) : null}
                      {bmiInfo ? (
                        <View style={[styles.miniChip, { backgroundColor: bmiInfo.color + '15', borderColor: bmiInfo.color + '40' }]}>
                          <Text style={[styles.miniChipText, { color: bmiInfo.color, fontFamily: 'Inter-Bold' }]}>
                            BMI {bmiInfo.value}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.profileItemValue, { color: theme.textDim }]}>
                      Configure your age, weight, height &amp; gender
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>

          {/* ── CARD 2: CLINICAL SAFETY GUARDRAILS (WhatsApp-Style Rows) ── */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>CLINICAL SAFETY GUARDRAILS</Text>
            <Text style={[styles.sectionHeadingSub, { color: theme.textMuted }]}>
              Cross-referenced in real-time during drug searches and AI prescription scans.
            </Text>

            {/* 1. Allergies Row */}
            <Pressable
              style={({ pressed }) => [styles.profileItemRow, pressed && { opacity: 0.65 }]}
              onPress={() => openCategoryEditor('allergies')}
            >
              <View style={[styles.profileItemIconBox, { backgroundColor: COLORS.error + '18' }]}>
                <Ionicons name="warning-outline" size={22} color={COLORS.error} />
              </View>
              <View style={styles.profileItemTextCol}>
                <Text style={[styles.profileItemLabel, { color: theme.textMuted }]}>Known Drug Allergies</Text>
                <Text
                  style={[
                    styles.profileItemValue,
                    { color: allergiesList.length > 0 ? theme.text.primary : theme.textDim },
                  ]}
                  numberOfLines={2}
                >
                  {allergiesList.length > 0 ? allergiesList.join(', ') : 'None added (tap to add)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
            </Pressable>

            <View style={[styles.itemDivider, { backgroundColor: theme.border }]} />

            {/* 2. Conditions Row */}
            <Pressable
              style={({ pressed }) => [styles.profileItemRow, pressed && { opacity: 0.65 }]}
              onPress={() => openCategoryEditor('conditions')}
            >
              <View style={[styles.profileItemIconBox, { backgroundColor: COLORS.warning + '18' }]}>
                <Ionicons name="pulse-outline" size={22} color={COLORS.warning} />
              </View>
              <View style={styles.profileItemTextCol}>
                <Text style={[styles.profileItemLabel, { color: theme.textMuted }]}>Existing Medical Conditions</Text>
                <Text
                  style={[
                    styles.profileItemValue,
                    { color: conditionsList.length > 0 ? theme.text.primary : theme.textDim },
                  ]}
                  numberOfLines={2}
                >
                  {conditionsList.length > 0 ? conditionsList.join(', ') : 'None added (tap to add)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
            </Pressable>

            <View style={[styles.itemDivider, { backgroundColor: theme.border }]} />

            {/* 3. Medications Row */}
            <Pressable
              style={({ pressed }) => [styles.profileItemRow, pressed && { opacity: 0.65 }]}
              onPress={() => openCategoryEditor('medications')}
            >
              <View style={[styles.profileItemIconBox, { backgroundColor: COLORS.purple + '18' }]}>
                <Ionicons name="medical-outline" size={22} color={COLORS.purple} />
              </View>
              <View style={styles.profileItemTextCol}>
                <Text style={[styles.profileItemLabel, { color: theme.textMuted }]}>Current Medications</Text>
                <Text
                  style={[
                    styles.profileItemValue,
                    { color: medicationsList.length > 0 ? theme.text.primary : theme.textDim },
                  ]}
                  numberOfLines={2}
                >
                  {medicationsList.length > 0 ? medicationsList.join(', ') : 'None added (tap to add)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAwareContainer>

      {/* ── DEDICATED GUARDRAIL BOTTOM SHEET EDITOR ── */}
      <AppBottomSheet
        ref={guardrailSheetRef}
        title={getSheetTitle()}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
            {getSheetSubtitle()}
          </Text>

          {/* Active Tag Pills Wrap */}
          {sheetList.length > 0 && (
            <View style={styles.pillsWrap}>
              {sheetList.map((item) => {
                const badgeColor = getCategoryColor(editingCategory);
                return (
                  <View
                    key={item}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: badgeColor + '15',
                        borderColor: badgeColor + '35',
                      },
                    ]}
                  >
                    <Text style={[styles.tagPillText, { color: badgeColor }]}>{item}</Text>
                    <Pressable onPress={() => handleRemoveSheetTag(item)} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color={badgeColor} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add Input Row with Relative Floating Dropdown */}
          <View style={styles.inputWrapper}>
            <View style={styles.addInputRow}>
              <TextInput
                style={[
                  styles.addInput,
                  {
                    backgroundColor: theme.surfaceSecondary,
                    color: theme.text.primary,
                    borderColor: theme.border,
                  },
                ]}
                placeholder={`Type ${editingCategory === 'allergies' ? 'allergy' : editingCategory === 'conditions' ? 'condition' : 'medication'} name`}
                placeholderTextColor={theme.textDim}
                value={customInput}
                onChangeText={setCustomInput}
                onSubmitEditing={() => handleAddSheetTag(customInput)}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.addBtn,
                  { backgroundColor: getCategoryColor(editingCategory) },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleAddSheetTag(customInput)}
              >
                <Ionicons name="add" size={22} color={COLORS.white} />
              </Pressable>
            </View>

            {/* Floating Dropdown Suggestions Overlay */}
            {currentSuggestions.length > 0 && (
              <View
                style={[
                  styles.floatingDropdown,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: 8,
                      },
                    }),
                  },
                ]}
              >
                <ScrollView
                  style={{ maxHeight: 88 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={true}
                >
                  {currentSuggestions.map((item, idx) => {
                    const catColor = getCategoryColor(editingCategory);
                    return (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [
                          styles.dropdownItem,
                          idx < currentSuggestions.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 },
                          pressed && { backgroundColor: theme.surfaceSecondary },
                        ]}
                        onPress={() => handleAddSheetTag(item)}
                      >
                        <Text style={[styles.dropdownText, { color: theme.text.primary }]}>{item}</Text>
                        <Ionicons name="add-circle-outline" size={18} color={catColor} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Save Button for this Category */}
          <Pressable
            style={({ pressed }) => [
              styles.sheetSaveBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: getCategoryColor(editingCategory) },
            ]}
            onPress={handleSaveSheet}
            disabled={savingCategory}
          >
            {savingCategory ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.sheetSaveBtnText}>Save {getSheetTitle()}</Text>
            )}
          </Pressable>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardHeaderRow: {
    marginBottom: SPACING.xs,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  sectionHeadingSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  biometricsCardBtn: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  biometricsCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biometricsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 4,
  },
  miniChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  miniChipText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Medium',
  },
  profileItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  profileItemIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileItemTextCol: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  profileItemLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Medium',
    marginBottom: 3,
  },
  profileItemValue: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    lineHeight: 20,
  },
  itemDivider: {
    height: 1,
    marginLeft: 50,
  },

  // Bottom Sheet Styles
  sheetContent: {
    paddingHorizontal: SPACING.xl,
  },
  sheetSubtitle: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-SemiBold',
  },
  inputWrapper: {
    position: 'relative',
    zIndex: 100,
    marginBottom: SPACING.md,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Regular',
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: SPACING.xs,
    zIndex: 999,
  },
  dropdownHeader: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  dropdownItem: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  dropdownText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
  },
  sheetSaveBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  sheetSaveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
});
