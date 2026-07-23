import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';

export default function HealthProfile() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { appUser, fetchAppUser, updateAppUser } = useAuthStore();

  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [genderModalVisible, setGenderModalVisible] = useState(false);

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

      Alert.alert('Success', 'Health & Safety parameters updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
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
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.navBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Health & Safety Parameters</Text>
        <View style={{ width: 15 }} />
      </View>

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
              style={[
                styles.dropdownTrigger,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => setGenderModalVisible(true)}
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
                style={[styles.toggleSegment, !hasAllergies && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasAllergies(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasAllergies ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleSegment, hasAllergies && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
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
                style={[styles.toggleSegment, !hasConditions && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasConditions(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasConditions ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleSegment, hasConditions && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
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
                style={[styles.toggleSegment, !hasMedications && [styles.toggleActiveSegment, { backgroundColor: theme.card }]]}
                onPress={() => setHasMedications(false)}
              >
                <Text style={[styles.toggleSegmentText, { color: !hasMedications ? theme.text.primary : theme.textDim }]}>No</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleSegment, hasMedications && [styles.toggleActiveSegment, { backgroundColor: primaryColor }]]}
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
          style={[styles.saveBtn, { backgroundColor: primaryColor }]}
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

      {/* Gender Dropdown Modal */}
      <Modal visible={genderModalVisible} transparent animationType="fade" onRequestClose={() => setGenderModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setGenderModalVisible(false)}>
          <View style={[styles.dropdownModalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.dropdownModalTitle, { color: theme.text.primary }]}>Select Gender</Text>
            {genderOptions.map((g) => (
              <Pressable
                key={g}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: theme.border },
                  gender === g && { backgroundColor: theme.patientSecondary + '66' },
                ]}
                onPress={() => {
                  setGender(g);
                  setGenderModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    { color: gender === g ? primaryColor : theme.text.primary, fontWeight: gender === g ? '700' : '400' },
                  ]}
                >
                  {g}
                </Text>
                {gender === g ? <Ionicons name="checkmark" size={18} color={primaryColor} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
    fontSize: FONT_SIZE.body,
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
  dropdownValue: { fontSize: FONT_SIZE.body },
  saveBtn: {
    height: 48,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    width: '85%',
    borderRadius: RADIUS.xl,
    padding: 20,
    elevation: 8,
  },
  dropdownModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: 14,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
  },
  dropdownOptionText: {
    fontSize: FONT_SIZE.body,
  },
});
