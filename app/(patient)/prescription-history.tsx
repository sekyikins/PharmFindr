import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { toast } from '@/context/ToastContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Skeleton from '@/components/ui/Skeleton';
import { Header } from '@/components/ui/Header';
import { useHardwareBack } from '@/hooks/useHardwareBack';

export default function PrescriptionHistory() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
    return true;
  });

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setHistory(
        (data ?? []).map((rx) => {
          const date = new Date(rx.created_at);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          
          let meds: string[] = [];
          let doc = 'AI Analysis';
          try {
            if (typeof rx.ai_interpretation === 'object' && rx.ai_interpretation) {
              const interpreter = rx.ai_interpretation;
              if (interpreter.medicines) {
                meds = interpreter.medicines.map((m: any) => `${m.name} ${m.strength || ''}`.trim());
              }
              if (interpreter.doctor) doc = interpreter.doctor;
            }
          } catch (e) {
            console.warn('Error parsing AI interpretation:', e);
          }

          if (meds.length === 0) meds = ['Prescription Scan'];

          return {
            id: rx.id,
            date: dateStr,
            doctor: doc,
            medicines: meds.slice(0, 3),
            count: meds.length,
            fullMeds: meds,
            rawMedicines: (typeof rx.ai_interpretation === 'object' && rx.ai_interpretation?.medicines) || [],
            ocrText: rx.ocr_text,
          };
        })
      );
    } catch (e: any) {
      console.warn('Error loading history:', e.message);
      toast.error('Error', 'Failed to load prescription history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const renderSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.cardIcon, { backgroundColor: theme.surfaceSecondary }]}>
            <Skeleton width={20} height={20} borderRadius={4} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Skeleton width={110} height={16} borderRadius={4} />
              <Skeleton width={75} height={20} borderRadius={10} />
            </View>
            <Skeleton width={130} height={12} borderRadius={4} style={{ marginVertical: 8 }} />
            <View style={styles.chipsRow}>
              <Skeleton width={95} height={24} borderRadius={12} />
              <Skeleton width={80} height={24} borderRadius={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const handleAddPrescription = () => {
    Alert.alert(
      'Add Prescription',
      'Choose how you would like to add a prescription:',
      [
        { text: 'Scan Prescription', onPress: () => router.push('/(patient)/scan') },
        { text: 'Enter Details', onPress: () => {
            const blankMed = [
              {
                name: '',
                strength: '',
                dosage: '',
                frequency: '',
                duration: '',
                route: '',
                instructions: '',
                confidence: 100,
              },
            ];
            router.push({
              pathname: '/(patient)/ocr-result',
              params: {
                medicines: JSON.stringify(blankMed),
                isManual: 'true',
              },
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ], { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header
        title="Prescription History"
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/profile'))}
        right={
          <Pressable
            style={({ pressed }) => [
              styles.addHeaderBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: primaryColor + '15' },
            ]}
            onPress={handleAddPrescription}
          >
            <Ionicons name="add-circle" size={16} color={primaryColor} />
            <Text style={[styles.addHeaderBtnText, { color: primaryColor }]}>Add</Text>
          </Pressable>
        }
      />

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No prescriptions found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({pressed})=>[styles.card, pressed && { opacity: 0.5 }, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                // Pass full medicine objects if available, otherwise wrap names
                const medsToPass = item.rawMedicines.length > 0
                  ? item.rawMedicines
                  : item.fullMeds.map((name: string) => ({ name, strength: null, dosage: null, frequency: null, duration: null, route: null, instructions: null, confidence: 0 }));
                router.push({
                  pathname: '/(patient)/ocr-result',
                  params: {
                    medicines: JSON.stringify(medsToPass),
                    prescriptionId: item.id,
                  },
                });
              }}
            >
              {/* Icon */}
              <View style={[styles.cardIcon, { backgroundColor: theme.patientSecondary }]}>
                <Ionicons name="document-text-outline" size={20} color={primaryColor} />
              </View>
              {/* Body */}
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardDate, { color: theme.text.primary }]}>{item.date}</Text>
                  <View style={[styles.countBadge, { backgroundColor: theme.patientSecondary }]}>
                    <Text style={[styles.countText, { color: primaryColor }]}>{item.count} medicines</Text>
                  </View>
                </View>
                <Text style={[styles.cardDoctor, { color: theme.textMuted }]}>{item.doctor}</Text>
                <View style={styles.chipsRow}>
                  {item.medicines.map((m: string, i: number) => (
                    <View key={i} style={[styles.chip, { backgroundColor: theme.patientSecondary }]}>
                      <Text style={[styles.chipText, { color: primaryColor }]}>{m}</Text>
                    </View>
                  ))}
                  {item.count > 3 && (
                    <View style={[styles.chip, { backgroundColor: theme.surfaceSecondary }]}>
                      <Text style={[styles.chipText, { color: theme.textMuted }]}>+{item.count - 3} more</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  listContent: {
    padding: SPACING.lg, gap: 12
  },
  emptyContainer: {
    alignItems: 'center', marginTop: 80, gap: 10
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.lg, textAlign: 'center'
  },

  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md
  },
  cardBody: {
    flex: 1
  },
  cardTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2
  },
  cardDate: {
    fontSize: FONT_SIZE.xl, fontFamily: 'Inter-Bold'
  },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill
  },
  countText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold'
  },
  cardDoctor: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginBottom: 8
  },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6
  },
  chip: {
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3
  },
  chipText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Medium'
  },

  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: RADIUS.pill
  },
  addHeaderBtnText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold'
  },

});