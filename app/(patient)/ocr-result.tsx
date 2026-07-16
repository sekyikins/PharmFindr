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
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

export default function OcrResult() {
  const { medicines, imageUri } = useLocalSearchParams<{ medicines: string, imageUri?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { sendMessage } = useChatStore();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  // Parse list of medicines
  const initialMeds = medicines ? JSON.parse(medicines) : [];
  const [medsList, setMedsList] = useState<any[]>(initialMeds);

  const handleEditField = (index: number, field: string, val: string) => {
    const updated = [...medsList];
    updated[index][field] = val;
    setMedsList(updated);
  };

  const handleAskAI = () => {
    // Construct prompt about the scanned meds
    const formattedList = medsList.map(m => `- ${m.name} ${m.strength || ''} (${m.frequency || ''} for ${m.duration || ''})`).join('\n');
    const prompt = `I just scanned a prescription. Here are the medicines found:\n${formattedList}\n\nPlease explain what these are, how they are used, their dosage, side effects, and precautions.`;
    
    // Send to Gemini and switch tab
    sendMessage(user?.id, prompt);
    router.replace('/(patient)/(tabs)/chat');
  };

  const handleFindAvailability = () => {
    // Navigate to pharmacy list with query
    const firstMed = medsList[0]?.name || '';
    router.replace({
      pathname: '/(patient)/(tabs)/pharmacies',
      params: { query: firstMed }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="OCR Scan Results" showBack />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Medicines Extracted</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Review and correct any mistakes made by the OCR scanner.
        </Text>

        {medsList.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No medicines could be identified.</Text>
        ) : (
          medsList.map((med, idx) => (
            <Card key={idx} style={styles.medCard}>
              <View style={styles.inputRow}>
                <Text style={[styles.label, { color: theme.text.secondary }]}>Medicine Name</Text>
                <TextInput
                  style={[styles.input, { color: theme.text.primary, borderBottomColor: theme.border }]}
                  value={med.name}
                  onChangeText={(val) => handleEditField(idx, 'name', val)}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={[styles.label, { color: theme.text.secondary }]}>Strength</Text>
                <TextInput
                  style={[styles.input, { color: theme.text.primary, borderBottomColor: theme.border }]}
                  value={med.strength}
                  placeholder="e.g. 500mg"
                  placeholderTextColor={theme.text.muted}
                  onChangeText={(val) => handleEditField(idx, 'strength', val)}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={[styles.label, { color: theme.text.secondary }]}>Frequency</Text>
                <TextInput
                  style={[styles.input, { color: theme.text.primary, borderBottomColor: theme.border }]}
                  value={med.frequency}
                  placeholder="e.g. 3 times daily"
                  placeholderTextColor={theme.text.muted}
                  onChangeText={(val) => handleEditField(idx, 'frequency', val)}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={[styles.label, { color: theme.text.secondary }]}>Duration</Text>
                <TextInput
                  style={[styles.input, { color: theme.text.primary, borderBottomColor: theme.border }]}
                  value={med.duration}
                  placeholder="e.g. 5 days"
                  placeholderTextColor={theme.text.muted}
                  onChangeText={(val) => handleEditField(idx, 'duration', val)}
                />
              </View>
            </Card>
          ))
        )}

        <View style={styles.actionContainer}>
          <Button 
            title="Ask AI Assistant about these" 
            onPress={handleAskAI}
            style={styles.actionBtn}
          />
          <Button 
            title="Find Nearby Availability" 
            variant="outline"
            onPress={handleFindAvailability}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  medCard: {
    marginBottom: 16,
    padding: 16,
  },
  inputRow: {
    marginVertical: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 40,
  },
  actionContainer: {
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    width: '100%',
  },
});
