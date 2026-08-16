import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { useHardwareBack } from '@/hooks/useHardwareBack';
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

  // Biometrics
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const genderSheetRef = useRef<any>(null);

  // Safety lists (Tag arrays)
  const [allergiesList, setAllergiesList] = useState<string[]>([]);
  const [conditionsList, setConditionsList] = useState<string[]>([]);
  const [medicationsList, setMedicationsList] = useState<string[]>([]);

  // Input fields for adding custom tags
  const [customAllergy, setCustomAllergy] = useState('');
  const [customCondition, setCustomCondition] = useState('');
  const [customMedication, setCustomMedication] = useState('');

  // Toggles
  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasConditions, setHasConditions] = useState(false);
  const [hasMedications, setHasMedications] = useState(false);

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      setAge(appUser.age ? String(appUser.age) : '');
      setWeight(appUser.weight ? String(appUser.weight) : '');
      setHeight(appUser.height ? String(appUser.height) : '');
      setGender(appUser.gender || 'Prefer not to say');

      const allergies = appUser.allergies || [];
      const conditions = appUser.existing_conditions || [];
      const meds = appUser.current_medications || [];

      setHasAllergies(allergies.length > 0);
      setAllergiesList(allergies);

      setHasConditions(conditions.length > 0);
      setConditionsList(conditions);

      setHasMedications(meds.length > 0);
      setMedicationsList(meds);
    }
  }, [appUser]);

  // Real-Time BMI Calculation
  const bmiData = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h || w <= 0 || h <= 0) return null;
    const heightInMeters = h / 100;
    const bmi = w / (heightInMeters * heightInMeters);
    let category = 'Normal';
    let color: string = COLORS.pharmacyPrimary;

    if (bmi < 18.5) {
      category = 'Underweight';
      color = COLORS.info;
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      color = COLORS.warning;
    } else if (bmi >= 30) {
      category = 'Obese';
      color = COLORS.error;
    }

    return { value: bmi.toFixed(1), category, color };
  }, [weight, height]);

  // Active Guardrails Count
  const activeGuardrailCount = (hasAllergies ? 1 : 0) + (hasConditions ? 1 : 0) + (hasMedications ? 1 : 0);

  // Tag Handlers
  const addTag = (type: 'allergies' | 'conditions' | 'medications', val: string) => {
    const clean = val.trim();
    if (!clean) return;

    if (type === 'allergies') {
      if (!allergiesList.includes(clean)) setAllergiesList([...allergiesList, clean]);
      setCustomAllergy('');
      setHasAllergies(true);
    } else if (type === 'conditions') {
      if (!conditionsList.includes(clean)) setConditionsList([...conditionsList, clean]);
      setCustomCondition('');
      setHasConditions(true);
    } else if (type === 'medications') {
      if (!medicationsList.includes(clean)) setMedicationsList([...medicationsList, clean]);
      setCustomMedication('');
      setHasMedications(true);
    }
  };

  const removeTag = (type: 'allergies' | 'conditions' | 'medications', val: string) => {
    if (type === 'allergies') {
      const updated = allergiesList.filter((item) => item !== val);
      setAllergiesList(updated);
      if (updated.length === 0) setHasAllergies(false);
    } else if (type === 'conditions') {
      const updated = conditionsList.filter((item) => item !== val);
      setConditionsList(updated);
      if (updated.length === 0) setHasConditions(false);
    } else if (type === 'medications') {
      const updated = medicationsList.filter((item) => item !== val);
      setMedicationsList(updated);
      if (updated.length === 0) setHasMedications(false);
    }
  };

  // Dynamic suggestion filtering while typing
  const allergySuggestions = customAllergy.trim()
    ? ALLERGIES_DB.filter(
        (item) =>
          item.toLowerCase().includes(customAllergy.trim().toLowerCase()) &&
          !allergiesList.includes(item)
      )
    : [];

  const conditionSuggestions = customCondition.trim()
    ? CONDITIONS_DB.filter(
        (item) =>
          item.toLowerCase().includes(customCondition.trim().toLowerCase()) &&
          !conditionsList.includes(item)
      )
    : [];

  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = customMedication.trim();
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
          if (g.generic_name && !medicationsList.includes(g.generic_name)) {
            names.add(g.generic_name);
          }
        });
        (prodData || []).forEach((p: any) => {
          if (p.brand_name && !medicationsList.includes(p.brand_name)) {
            names.add(p.brand_name);
          }
        });

        setMedicationSuggestions(Array.from(names).slice(0, 8));
      } catch (err) {
        console.warn('Error fetching dynamic medication suggestions:', err);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(searchTimer);
    };
  }, [customMedication, medicationsList]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAppUser({
        age: age ? parseInt(age, 10) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        gender: gender || null,
        allergies: hasAllergies ? allergiesList : [],
        existing_conditions: hasConditions ? conditionsList : [],
        current_medications: hasMedications ? medicationsList : [],
      });

      toast.success('Health parameters saved', 'Your clinical safety profile has been updated successfully.');
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Health Parameters" showBack onBack={handleGoBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        >
          {/* ── SECTION 1: BIOMETRICS & METRICS ── */}
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="fitness-outline" size={18} color={primaryColor} />
            <Text style={[styles.sectionTitleText, { color: theme.text.primary }]}>
              Biometric Metrics
            </Text>
          </View>

          <View style={[styles.metricsContainerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Grid 2x2 */}
            <View style={styles.gridRow}>
              {/* Age */}
              <View style={styles.gridCol}>
                <Text style={[styles.inputLabel, { color: theme.textDim }]}>AGE</Text>
                <View style={[styles.inputWithSuffix, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.numericInput, { color: theme.text.primary }]}
                    placeholder="25"
                    placeholderTextColor={theme.textDim}
                    keyboardType="number-pad"
                    value={age}
                    onChangeText={setAge}
                  />
                  <Text style={[styles.suffixBadge, { color: theme.textDim }]}>yrs</Text>
                </View>
              </View>

              {/* Weight */}
              <View style={styles.gridCol}>
                <Text style={[styles.inputLabel, { color: theme.textDim }]}>WEIGHT</Text>
                <View style={[styles.inputWithSuffix, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.numericInput, { color: theme.text.primary }]}
                    placeholder="70.0"
                    placeholderTextColor={theme.textDim}
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                  />
                  <Text style={[styles.suffixBadge, { color: theme.textDim }]}>kg</Text>
                </View>
              </View>
            </View>

            <View style={styles.gridRow}>
              {/* Height */}
              <View style={styles.gridCol}>
                <Text style={[styles.inputLabel, { color: theme.textDim }]}>HEIGHT</Text>
                <View style={[styles.inputWithSuffix, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.numericInput, { color: theme.text.primary }]}
                    placeholder="175"
                    placeholderTextColor={theme.textDim}
                    keyboardType="decimal-pad"
                    value={height}
                    onChangeText={setHeight}
                  />
                  <Text style={[styles.suffixBadge, { color: theme.textDim }]}>cm</Text>
                </View>
              </View>

              {/* Gender Dropdown */}
              <View style={styles.gridCol}>
                <Text style={[styles.inputLabel, { color: theme.textDim }]}>GENDER</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.genderSelector,
                    { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => genderSheetRef.current?.present?.() ?? genderSheetRef.current?.expand?.()}
                >
                  <Text style={[styles.genderSelectorValue, { color: theme.text.primary }]} numberOfLines={1}>
                    {gender || 'Select'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={theme.textDim} />
                </Pressable>
              </View>
            </View>

            {/* Calculated BMI Callout */}
            {bmiData && (
              <View style={[styles.bmiBar, { backgroundColor: bmiData.color + '12', borderColor: bmiData.color + '30' }]}>
                <Ionicons name="analytics-outline" size={18} color={bmiData.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bmiTitle, { color: theme.text.primary }]}>
                    Your Body Mass Index (BMI): <Text style={{ color: bmiData.color, fontFamily: 'Inter-Bold' }}>{bmiData.value}</Text>
                  </Text>
                </View>
                <View style={[styles.bmiStatusPill, { backgroundColor: bmiData.color }]}>
                  <Text style={styles.bmiStatusText}>{bmiData.category}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── SECTION 2: SAFETY & INTERACTION GUARDRAILS ── */}
          <View style={[styles.sectionHeaderRow, { marginTop: SPACING.xxl }]}>
            <Ionicons name="shield-checkmark-sharp" size={18} color={COLORS.error} />
            <Text style={[styles.sectionTitleText, { color: theme.text.primary }]}>
              Clinical Safety Guardrails
            </Text>
          </View>
          <Text style={[styles.sectionHelperText, { color: theme.textMuted }]}>
            Cross-referenced in real-time during drug searches and AI prescription scans.
          </Text>

          {/* 1. KNOWN DRUG ALLERGIES CARD */}
          <View style={[styles.safetyCard, { backgroundColor: theme.card, borderColor: hasAllergies ? COLORS.errorBorder : theme.border }]}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => {
                const nextState = !hasAllergies;
                setHasAllergies(nextState);
                if (!nextState) setAllergiesList([]);
              }}
            >
              <Ionicons
                name={hasAllergies ? 'checkbox' : 'square-outline'}
                size={22}
                color={hasAllergies ? COLORS.error : theme.textDim}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitleText, { color: theme.text.primary }]}>
                  Known Drug Allergies
                </Text>
                <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
                  Filters active ingredients to prevent severe allergic reactions
                </Text>
              </View>
            </Pressable>

            {hasAllergies && (
              <View style={styles.cardBody}>
                {/* Active Tag Pills */}
                {allergiesList.length > 0 && (
                  <View style={styles.pillsWrap}>
                    {allergiesList.map((item) => (
                      <View key={item} style={[styles.tagPill, { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder }]}>
                        <Ionicons name="warning-outline" size={13} color={COLORS.error} />
                        <Text style={[styles.tagPillText, { color: COLORS.errorText }]}>{item}</Text>
                        <Pressable onPress={() => removeTag('allergies', item)} hitSlop={6}>
                          <Ionicons name="close-circle" size={15} color={COLORS.error} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Input */}
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
                    placeholder="Type allergy name"
                    placeholderTextColor={theme.textDim}
                    value={customAllergy}
                    onChangeText={setCustomAllergy}
                    onSubmitEditing={() => addTag('allergies', customAllergy)}
                  />
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, { backgroundColor: COLORS.error }, pressed && { opacity: 0.7 }]}
                    onPress={() => addTag('allergies', customAllergy)}
                  >
                    <Ionicons name="add" size={20} color={COLORS.white} />
                  </Pressable>
                </View>

                {/* Dynamic Autocomplete Suggestions List */}
                {allergySuggestions.length > 0 && (
                  <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.suggestionHeader, { color: theme.textDim }]}>MATCHING ALLERGIES:</Text>
                    {allergySuggestions.map((item) => (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          { borderBottomColor: theme.border },
                          pressed && { backgroundColor: theme.card },
                        ]}
                        onPress={() => addTag('allergies', item)}
                      >
                        <Ionicons name="warning-outline" size={15} color={COLORS.error} />
                        <Text style={[styles.suggestionText, { color: theme.text.primary }]}>{item}</Text>
                        <Ionicons name="add-circle-outline" size={18} color={COLORS.error} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 2. EXISTING MEDICAL CONDITIONS CARD */}
          <View style={[styles.safetyCard, { backgroundColor: theme.card, borderColor: hasConditions ? COLORS.pendingBorder : theme.border }]}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => {
                const nextState = !hasConditions;
                setHasConditions(nextState);
                if (!nextState) setConditionsList([]);
              }}
            >
              <Ionicons
                name={hasConditions ? 'checkbox' : 'square-outline'}
                size={22}
                color={hasConditions ? COLORS.warning : theme.textDim}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitleText, { color: theme.text.primary }]}>
                  Existing Medical Conditions
                </Text>
                <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
                  Cross-checks contraindications against your medical history
                </Text>
              </View>
            </Pressable>

            {hasConditions && (
              <View style={styles.cardBody}>
                {/* Active Tag Pills */}
                {conditionsList.length > 0 && (
                  <View style={styles.pillsWrap}>
                    {conditionsList.map((item) => (
                      <View key={item} style={[styles.tagPill, { backgroundColor: COLORS.pendingBg, borderColor: COLORS.pendingBorder }]}>
                        <Ionicons name="pulse-outline" size={13} color={COLORS.warningDark} />
                        <Text style={[styles.tagPillText, { color: COLORS.warningDark }]}>{item}</Text>
                        <Pressable onPress={() => removeTag('conditions', item)} hitSlop={6}>
                          <Ionicons name="close-circle" size={15} color={COLORS.warningDark} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Input */}
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
                    placeholder="Type condition name"
                    placeholderTextColor={theme.textDim}
                    value={customCondition}
                    onChangeText={setCustomCondition}
                    onSubmitEditing={() => addTag('conditions', customCondition)}
                  />
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, { backgroundColor: COLORS.warning }, pressed && { opacity: 0.7 }]}
                    onPress={() => addTag('conditions', customCondition)}
                  >
                    <Ionicons name="add" size={20} color={COLORS.white} />
                  </Pressable>
                </View>

                {/* Dynamic Autocomplete Suggestions List */}
                {conditionSuggestions.length > 0 && (
                  <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.suggestionHeader, { color: theme.textDim }]}>MATCHING CONDITIONS:</Text>
                    {conditionSuggestions.map((item) => (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          { borderBottomColor: theme.border },
                          pressed && { backgroundColor: theme.card },
                        ]}
                        onPress={() => addTag('conditions', item)}
                      >
                        <Ionicons name="pulse-outline" size={15} color={COLORS.warning} />
                        <Text style={[styles.suggestionText, { color: theme.text.primary }]}>{item}</Text>
                        <Ionicons name="add-circle-outline" size={18} color={COLORS.warning} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 3. CURRENT MEDICATIONS CARD */}
          <View style={[styles.safetyCard, { backgroundColor: theme.card, borderColor: hasMedications ? COLORS.borderSlate : theme.border }]}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => {
                const nextState = !hasMedications;
                setHasMedications(nextState);
                if (!nextState) setMedicationsList([]);
              }}
            >
              <Ionicons
                name={hasMedications ? 'checkbox' : 'square-outline'}
                size={22}
                color={hasMedications ? COLORS.purple : theme.textDim}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitleText, { color: theme.text.primary }]}>
                  Current Medications
                </Text>
                <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
                  Monitors multi-drug interactions &amp; duplicate therapy risks
                </Text>
              </View>
            </Pressable>

            {hasMedications && (
              <View style={styles.cardBody}>
                {/* Active Tag Pills */}
                {medicationsList.length > 0 && (
                  <View style={styles.pillsWrap}>
                    {medicationsList.map((item) => (
                      <View key={item} style={[styles.tagPill, { backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.borderSlate }]}>
                        <Ionicons name="medical-outline" size={13} color={COLORS.purple} />
                        <Text style={[styles.tagPillText, { color: COLORS.purple }]}>{item}</Text>
                        <Pressable onPress={() => removeTag('medications', item)} hitSlop={6}>
                          <Ionicons name="close-circle" size={15} color={COLORS.purple} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Input */}
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
                    placeholder="Type medication name"
                    placeholderTextColor={theme.textDim}
                    value={customMedication}
                    onChangeText={setCustomMedication}
                    onSubmitEditing={() => addTag('medications', customMedication)}
                  />
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, { backgroundColor: COLORS.purple }, pressed && { opacity: 0.7 }]}
                    onPress={() => addTag('medications', customMedication)}
                  >
                    <Ionicons name="add" size={20} color={COLORS.white} />
                  </Pressable>
                </View>

                {/* Dynamic Autocomplete Suggestions List */}
                {medicationSuggestions.length > 0 && (
                  <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    <Text style={[styles.suggestionHeader, { color: theme.textDim }]}>MATCHING MEDICATIONS:</Text>
                    {medicationSuggestions.map((item) => (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [
                          styles.suggestionRow,
                          { borderBottomColor: theme.border },
                          pressed && { backgroundColor: theme.card },
                        ]}
                        onPress={() => addTag('medications', item)}
                      >
                        <Ionicons name="medical-outline" size={15} color="#8b5cf6" />
                        <Text style={[styles.suggestionText, { color: theme.text.primary }]}>{item}</Text>
                        <Ionicons name="add-circle-outline" size={18} color="#8b5cf6" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Sticky Save Button */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }, { backgroundColor: primaryColor }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <View style={styles.saveBtnInner}>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.saveBtnText}>Save Health Parameters</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Gender Picker — Bottom Sheet */}
      <AppBottomSheet ref={genderSheetRef} snapPoints={['38%']} title="Select Gender">
        <View style={styles.genderOptions}>
          {genderOptions.map((g) => (
            <Pressable
              key={g}
              style={({ pressed }) => [
                styles.genderOption,
                { borderBottomColor: theme.border },
                gender === g && { backgroundColor: theme.patientSecondary + '66' },
                pressed && { backgroundColor: theme.surfaceSecondary },
              ]}
              onPress={() => {
                setGender(g);
                genderSheetRef.current?.dismiss?.() ?? genderSheetRef.current?.close?.();
              }}
            >
              <Text
                style={[
                  styles.genderOptionText,
                  {
                    color: gender === g ? primaryColor : theme.text.primary,
                    fontFamily: gender === g ? 'Inter-Bold' : 'Inter-Regular',
                  },
                ]}
              >
                {g}
              </Text>
              {gender === g ? (
                <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={theme.textDim} />
              )}
            </Pressable>
          ))}
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scroll: {
    padding: SPACING.xl, paddingTop: SPACING.sm
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm
  },
  sectionTitleText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  sectionHelperText: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
    marginBottom: 14,
    lineHeight: 16
  },

  // Biometrics Card Grid
  metricsContainerCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.md,
    marginBottom: 10
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.md
  },
  gridCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.6,
    marginBottom: 6
  },
  inputWithSuffix: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md
  },
  numericInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    height: '100%'
  },
  suffixBadge: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },

  genderSelector: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md
  },
  genderSelectorValue: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },

  // BMI Bar
  bmiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  bmiTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
  },
  bmiStatusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  bmiStatusText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },

  // Safety Card UI
  safetyCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardTitleText: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold',
  },
  cardSubText: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, lineHeight: 15,
  },

  cardBody: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold',
  },

  addInputRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  addInput: {
    fontFamily: 'Inter-Regular',
    flex: 1,
    height: 42,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    fontSize: FONT_SIZE.md,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dynamic Autocomplete Dropdown
  suggestionsBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
  },
  suggestionHeader: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Bold', letterSpacing: 0.5, marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    flex: 1, fontSize: FONT_SIZE.md, marginLeft: 8, fontFamily: 'Inter-SemiBold'
  },

  saveBtn: {
    height: 52,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  saveBtnText: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },

  // Bottom sheet gender options
  genderOptions: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md
  },
  genderOptionText: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.lg,
    flex: 1
  },

});
