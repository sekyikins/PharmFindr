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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Skeleton from '@/components/ui/Skeleton';

export default function PrescriptionHistory() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

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
            ocrText: rx.ocr_text,
          };
        })
      );
    } catch (e: any) {
      console.warn('Error loading history:', e.message);
      Alert.alert('Error', 'Failed to load prescription history.');
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
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Skeleton width={40} height={40} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
          <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="70%" height={14} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Prescription History</Text>
        <View style={{ width: 36 }} />
      </View>

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
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                router.push({
                  pathname: '/(patient)/ocr-result',
                  params: {
                    medicines: JSON.stringify(item.fullMeds.map((name: string) => ({ name }))),
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },

  listContent: { padding: SPACING.lg, gap: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardDate: { fontSize: FONT_SIZE.xl, fontWeight: '700' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  countText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  cardDoctor: { fontSize: FONT_SIZE.sm, marginBottom: 8 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: FONT_SIZE.sm, fontWeight: '500' },
});