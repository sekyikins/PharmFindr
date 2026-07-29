import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/ui/Header';

export default function OcrResult() {
  const { medicines, imageUri } = useLocalSearchParams<{ medicines: string; imageUri?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { sendMessage, createConsultation } = useChatStore();
  const { theme, primaryColor } = useThemeContext();

  // Parse list of medicines
  const initialMeds = medicines
    ? JSON.parse(medicines)
    : [
        { name: 'Amoxicillin', strength: '500mg', category: 'Antibiotic', dosage: '1 Tablet', frequency: '3× Daily', duration: '5 Days' },
        { name: 'Paracetamol', strength: '500mg', category: 'Analgesic', dosage: '1-2 Tablets', frequency: 'As needed', duration: '5 Days' },
        { name: 'Ibuprofen', strength: '400mg', category: 'NSAID', dosage: '1 Tablet', frequency: '2× Daily', duration: '3 Days' },
      ];
  const [medsList, setMedsList] = useState<any[]>(initialMeds);

  const handleEditField = (index: number, field: string, val: string) => {
    const updated = [...medsList];
    updated[index][field] = val;
    setMedsList(updated);
  };

  const savePrescription = async (meds: any[]) => {
    if (!user?.id) return null;
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

      return data?.id ?? null;
    } catch (e: any) {
      console.warn('Error saving prescription:', e.message);
      return null;
    }
  };

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

  const handleFindAvailability = async () => {
    const firstMed = medsList[0]?.name || '';
    await savePrescription(medsList);
    router.replace({
      pathname: '/(patient)/pharmacies',
      params: { query: firstMed },
    });
  };

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Success banner */}
        <View style={[styles.banner, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginRight: 8 }} />
          <Text style={[styles.bannerText, { color: theme.successText }]}>
            Prescription detected — {medsList.length} medicines identified
          </Text>
        </View>

        {/* Medicines Cards */}
        {medsList.map((med, idx) => (
          <View key={idx} style={[styles.medCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <TextInput
                  style={[styles.medNameInput, { color: theme.text.primary }]}
                  value={med.name}
                  onChangeText={(val) => handleEditField(idx, 'name', val)}
                  placeholder="Medicine Name"
                  placeholderTextColor={theme.textDim}
                />
                <TextInput
                  style={[styles.medStrengthInput, { color: primaryColor, backgroundColor: theme.patientSecondary }]}
                  value={med.strength}
                  onChangeText={(val) => handleEditField(idx, 'strength', val)}
                  placeholder="Strength (e.g. 500mg)"
                  placeholderTextColor={theme.textDim}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
                onPress={() => setMedsList(medsList.filter((_, i) => i !== idx))}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </Pressable>
            </View>

            {/* Details Fields */}
            <View style={styles.cardDetails}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Category</Text>
                <TextInput
                  style={[styles.detailInput, { color: theme.text.primary, borderColor: theme.border }]}
                  value={med.category}
                  onChangeText={(val) => handleEditField(idx, 'category', val)}
                  placeholder="Category"
                  placeholderTextColor={theme.textDim}
                />
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Dosage</Text>
                <TextInput
                  style={[styles.detailInput, { color: theme.text.primary, borderColor: theme.border }]}
                  value={med.dosage}
                  onChangeText={(val) => handleEditField(idx, 'dosage', val)}
                  placeholder="Dosage"
                  placeholderTextColor={theme.textDim}
                />
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Frequency</Text>
                <TextInput
                  style={[styles.detailInput, { color: theme.text.primary, borderColor: theme.border }]}
                  value={med.frequency}
                  onChangeText={(val) => handleEditField(idx, 'frequency', val)}
                  placeholder="Frequency"
                  placeholderTextColor={theme.textDim}
                />
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Duration</Text>
                <TextInput
                  style={[styles.detailInput, { color: theme.text.primary, borderColor: theme.border }]}
                  value={med.duration}
                  onChangeText={(val) => handleEditField(idx, 'duration', val)}
                  placeholder="Duration"
                  placeholderTextColor={theme.textDim}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Actions */}
        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
            onPress={promptNewConsultation}
          >
            <Text style={styles.primaryBtnText}>Start Consultation with AI</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }, { borderColor: primaryColor, backgroundColor: theme.card }]}
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

  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.lg,
  },
  bannerText: { fontSize: FONT_SIZE.lg, fontWeight: '600' },

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
  cardHeaderLeft: { flex: 1, gap: 4 },
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
    alignSelf: 'flex-start',
  },
  deleteBtn: {
    padding: 6,
  },

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
