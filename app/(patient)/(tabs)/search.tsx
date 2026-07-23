import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';

interface InventoryResult {
  id: string;
  name: string;
  strength: string;
  pharmacyName: string;
  pharmacyId: string;
  price: number;
  quantity: number;
}

const RECENT_SEARCHES = ['Amoxicillin', 'Metformin', 'Lisinopril'];

export default function SearchMedicines() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          medicine_name,
          strength,
          price,
          quantity,
          pharmacies ( id, name )
        `)
        .ilike('medicine_name', `%${trimmed}%`)
        .gt('quantity', 0)
        .order('medicine_name', { ascending: true })
        .limit(30);

      if (error) throw error;

      setResults(
        (data ?? []).map((item: any) => ({
          id: item.id,
          name: item.medicine_name,
          strength: item.strength ?? '',
          pharmacyName: item.pharmacies?.name ?? 'Unknown Pharmacy',
          pharmacyId: item.pharmacies?.id ?? '',
          price: parseFloat(item.price) || 0,
          quantity: item.quantity,
        }))
      );
    } catch (e: any) {
      console.warn('Search error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
    }
  };

  const handleSubmit = () => runSearch(query);
  const handleChip = (term: string) => {
    setQuery(term);
    runSearch(term);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Search Medicines</Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.card }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={16} color={theme.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search medicine name..."
            placeholderTextColor={theme.text.muted}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-outline" size={18} color={theme.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.medicineCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Skeleton width={38} height={38} borderRadius={RADIUS.pill} style={{ marginRight: 12 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={14} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Skeleton width={50} height={16} />
                <Skeleton width={60} height={12} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Search Results */}
      {!loading && searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textDim }]}>
              No medicines found for "{query}" in any pharmacy.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.medicineCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                router.push({
                  pathname: '/(patient)/pharmacies',
                  params: { query: item.name },
                })
              }
            >
              <View style={[styles.medIcon, { backgroundColor: theme.patientSecondary }]}>
                <Ionicons name="medkit-outline" size={18} color={primaryColor} />
              </View>
              <View style={styles.medBody}>
                <Text style={[styles.medName, { color: theme.text.primary }]}>{item.name}</Text>
                <Text style={[styles.medSub, { color: theme.textMuted }]}>
                  {item.strength ? `${item.strength} · ` : ''}{item.pharmacyName}
                </Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={[styles.priceText, { color: primaryColor }]}>${item.price.toFixed(2)}</Text>
                <Text style={[styles.qtyText, { color: theme.textDim }]}>{item.quantity} in stock</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Default: Recent + Suggestions */}
      {!loading && !searched && (
        <FlatList
          data={[]}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Recent Searches */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT SEARCHES</Text>
                {RECENT_SEARCHES.map((term) => (
                  <Pressable
                    key={term}
                    style={[styles.recentRow, { borderBottomColor: theme.border }]}
                    onPress={() => handleChip(term)}
                  >
                    <Ionicons name="time-outline" size={16} color={theme.text.muted} style={{ marginRight: 12 }} />
                    <Text style={[styles.recentText, { color: theme.text.primary }]}>{term}</Text>
                    <Ionicons name="arrow-forward-outline" size={14} color={theme.textDim} />
                  </Pressable>
                ))}
              </View>

              {/* Quick Search Chips */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>POPULAR MEDICINES</Text>
                <View style={styles.chipsRow}>
                  {['Paracetamol', 'Ibuprofen', 'Omeprazole', 'Cetirizine', 'Aspirin', 'Metformin'].map((chip) => (
                    <Pressable
                      key={chip}
                      style={[styles.chip, { backgroundColor: theme.patientSecondary }]}
                      onPress={() => handleChip(chip)}
                    >
                      <Text style={[styles.chipText, { color: primaryColor }]}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

  searchWrapper: { padding: SPACING.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 48,
    paddingHorizontal: SPACING.lg,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.xl },

  section: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  recentText: { flex: 1, fontSize: FONT_SIZE.xl },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: FONT_SIZE.body, fontWeight: '600' },

  listContent: { padding: SPACING.lg, gap: 10 },
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
  },
  medIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medBody: { flex: 1 },
  medName: { fontSize: FONT_SIZE.xl, fontWeight: '600', marginBottom: 2 },
  medSub: { fontSize: FONT_SIZE.md },
  priceCol: { alignItems: 'flex-end' },
  priceText: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  qtyText: { fontSize: FONT_SIZE.sm, marginTop: 2 },

  emptyText: { textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.lg },
});
