import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';

export default function HealthProfile() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { appUser, fetchAppUser, updateAppUser } = useAuthStore();

  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const genderSheetRef = useRef<any>(null);

  const [allergiesText, setAllergiesText] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [medicationsText, setMedicationsText] = useState('');

  const [hasAllergies, setHasAllergies] = useState(false);
  const [hasConditions, setHasConditions] = useState(false);
  const [hasMedications, setHasMedications] = useState(false);

  const [saving, setSaving] = useState(false);

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
      setAllergiesText(allergies.join(', '));

      setHasConditions(conditions.length > 0);
      setConditionsText(conditions.join(', '));

      setHasMedications(meds.length > 0);
      setMedicationsText(meds.join(', '));
    }
  }, [appUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const splitTags = (str: string) =>
        str
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

      await updateAppUser({
        age: age ? parseInt(age, 10) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        gender: gender || null,
        allergies: hasAllergies ? splitTags(allergiesText) : [],
        existing_conditions: hasConditions ? splitTags(conditionsText) : [],
        current_medications: hasMedications ? splitTags(medicationsText) : [],
      });

      Alert.alert('Success', 'Health parameters updated successfully!', [
        { text: 'OK', onPress: () => router.navigate('/(patient)/(tabs)/profile') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Health Parameters" showBack onBack={() => router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/profile')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <View style={[styles.infoBox, { backgroundColor: theme.patientSecondary + '66', borderColor: primaryColor + '30' }]}>
          <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
          <Text style={[styles.infoText, { color: theme.text.primary }]}>
            Your health details help assess dosages, risks, and drug interactions accurately.
          </Text>
        </View>

        {/* Biometrics */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Biometrics &amp; Demographics</Text>

        <View style={styles.rowTwo}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: theme.textDim }]}>AGE (YEARS)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border }]}
              placeholder="e.g. 28"
              placeholderTextColor={theme.textDim}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
            />
          </View>

          <View style={styles.col}>
            <Text style={[styles.label, { color: theme.textDim }]}>WEIGHT (KG)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border }]}
              placeholder="e.g. 70.5"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>

        <View style={styles.rowTwo}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: theme.textDim }]}>HEIGHT (CM)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border }]}
              placeholder="e.g. 175"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
          </View>

          <View style={styles.col}>
            <Text style={[styles.label, { color: theme.textDim }]}>GENDER</Text>
            <Pressable
              style={({pressed})=>[
                styles.dropdownTrigger, pressed && {opacity: 0.5}, 
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => genderSheetRef.current?.present?.() ?? genderSheetRef.current?.expand?.()}
            >
              <Text style={[styles.dropdownValue, { color: theme.text.primary }]}>
                {gender || 'Select Gender'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textDim} />
            </Pressable>
          </View>
        </View>

        {/* Safety & Medical Context */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary, marginTop: 24 }]}>Safety &amp; Interaction Parameters</Text>

        {/* 1. Allergies */}
        <View style={styles.paramBox}>
          <View style={styles.paramHeader}>
            <Text style={[styles.label, { color: theme.textDim, marginBottom: 0 }]}>KNOWN DRUG ALLERGIES?</Text>
            <View style={[styles.toggleRow, { backgroundColor: theme.surfaceSecondary }]}>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, !hasAllergies && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasAllergies(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasAllergies ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, hasAllergies && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
                onPress={() => setHasAllergies(true)}
              >
                <Text style={[styles.toggleSegmentText, { color: hasAllergies ? '#fff' : theme.textDim }]}>Yes</Text>
              </Pressable>
            </View>
          </View>
          {hasAllergies && (
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border, marginTop: 10 }]}
              placeholder="Enter allergies (e.g. Penicillin, Aspirin, Sulfa)"
              placeholderTextColor={theme.textDim}
              multiline
              value={allergiesText}
              onChangeText={setAllergiesText}
            />
          )}
        </View>

        {/* 2. Existing Conditions */}
        <View style={styles.paramBox}>
          <View style={styles.paramHeader}>
            <Text style={[styles.label, { color: theme.textDim, marginBottom: 0 }]}>EXISTING MEDICAL CONDITIONS?</Text>
            <View style={[styles.toggleRow, { backgroundColor: theme.surfaceSecondary }]}>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, !hasConditions && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasConditions(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasConditions ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, hasConditions && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
                onPress={() => setHasConditions(true)}
              >
                <Text style={[styles.toggleSegmentText, { color: hasConditions ? '#fff' : theme.textDim }]}>Yes</Text>
              </Pressable>
            </View>
          </View>
          {hasConditions && (
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border, marginTop: 10 }]}
              placeholder="Enter conditions (e.g. Asthma, Hypertension, Diabetes)"
              placeholderTextColor={theme.textDim}
              multiline
              value={conditionsText}
              onChangeText={setConditionsText}
            />
          )}
        </View>

        {/* 3. Current Medications */}
        <View style={styles.paramBox}>
          <View style={styles.paramHeader}>
            <Text style={[styles.label, { color: theme.textDim, marginBottom: 0 }]}>TAKING CURRENT MEDICATIONS?</Text>
            <View style={[styles.toggleRow, { backgroundColor: theme.surfaceSecondary }]}>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, !hasMedications && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasMedications(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasMedications ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={({pressed})=>[styles.toggleSegment, pressed && {opacity: 0.5}, hasMedications && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
                onPress={() => setHasMedications(true)}
              >
                <Text style={[styles.toggleSegmentText, { color: hasMedications ? '#fff' : theme.textDim }]}>Yes</Text>
              </Pressable>
            </View>
          </View>
          {hasMedications && (
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.card, color: theme.text.primary, borderColor: theme.border, marginTop: 10 }]}
              placeholder="Enter medications (e.g. Metformin 500mg, Lisinopril 10mg)"
              placeholderTextColor={theme.textDim}
              multiline
              value={medicationsText}
              onChangeText={setMedicationsText}
            />
          )}
        </View>

        <Pressable
          style={({pressed})=>[styles.saveBtn, pressed && {opacity: 0.5}, { backgroundColor: primaryColor }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Parameters</Text>
          )}
        </Pressable>
      </ScrollView>

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
                  { color: gender === g ? primaryColor : theme.text.primary,
                    fontWeight: gender === g ? '700' : '400' },
                ]}
              >
                {g}
              </Text>
              {gender === g
                ? <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
                : <Ionicons name="ellipse-outline" size={20} color={theme.textDim} />
              }
            </Pressable>
          ))}
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  scroll: { padding: SPACING.xl },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, lineHeight: 18 },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 14 },
  rowTwo: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  col: { flex: 1 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: 6 },
  input: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: FONT_SIZE.lg,
  },
  textArea: { height: 70, textAlignVertical: 'top' },
  paramBox: {
    marginBottom: 16,
  },
  paramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.pill,
    padding: 2,
  },
  toggleSegment: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  toggleActiveSegment: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleSegmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownTrigger: {
    height: 42,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: { fontSize: FONT_SIZE.lg },
  saveBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  // Bottom sheet gender option rows
  genderOptions: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
  },
  genderOptionText: {
    fontSize: FONT_SIZE.lg,
    flex: 1,
  },
});
