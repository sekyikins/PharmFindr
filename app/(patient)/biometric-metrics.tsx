import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
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

export default function BiometricMetricsScreen() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { appUser, fetchAppUser, updateAppUser } = useAuthStore();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/health-profile');
    }
    return true;
  };

  useHardwareBack(handleGoBack);

  // Form State
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [saving, setSaving] = useState(false);

  const genderSheetRef = useRef<any>(null);

  useEffect(() => {
    fetchAppUser();
  }, [fetchAppUser]);

  useEffect(() => {
    if (appUser) {
      setAge(appUser.age ? String(appUser.age) : '');
      setWeight(appUser.weight ? String(appUser.weight) : '');
      setHeight(appUser.height ? String(appUser.height) : '');
      setGender(appUser.gender || 'Prefer not to say');
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAppUser({
        age: age ? parseInt(age, 10) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        gender: gender || null,
      });

      toast.success('Biometric metrics saved', 'Your physical metrics have been updated successfully.');
      if (router.canGoBack()) {
        router.back();
      }
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to update biometric metrics. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header title="Biometric Metrics" showBack onBack={handleGoBack} />

      <KeyboardAwareContainer>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Subtitle / Context Card */}
          <View style={[styles.infoBanner, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="fitness-outline" size={22} color={primaryColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerTitle, { color: theme.text.primary }]}>Physical Parameters</Text>
              <Text style={[styles.infoBannerSub, { color: theme.textMuted }]}>
                Used to calculate pediatric/adult dosages and cross-reference body mass indices.
              </Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
                    Your Body Mass Index (BMI):{' '}
                    <Text style={{ color: bmiData.color, fontFamily: 'Inter-Bold' }}>{bmiData.value}</Text>
                  </Text>
                </View>
                <View style={[styles.bmiStatusPill, { backgroundColor: bmiData.color }]}>
                  <Text style={styles.bmiStatusText}>{bmiData.category}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Save Button */}
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: primaryColor },
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <View style={styles.saveBtnInner}>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.saveBtnText}>Save Metrics</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAwareContainer>

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
    flex: 1,
  },
  scroll: {
    padding: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  infoBannerTitle: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  infoBannerSub: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  gridCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  numericInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    height: '100%',
    padding: 0,
  },
  suffixBadge: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  genderSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  genderSelectorValue: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  bmiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  bmiTitle: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Medium',
  },
  bmiStatusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  bmiStatusText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
  },
  saveBtn: {
    height: 50,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  genderOptions: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderRadius: RADIUS.md,
  },
  genderOptionText: {
    fontSize: FONT_SIZE.md,
  },
});
