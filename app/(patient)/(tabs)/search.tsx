import React, { useState, useCallback, useRef } from 'react';
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
import { Header } from '@/components/ui/Header';

interface InventoryResult {
  id: string;
  name: string;
  genericName?: string | null;
  brandName?: string | null;
  strength: string;
  dosageForm?: string | null;
  pharmacyName: string;
  pharmacyId: string;
  price: number;
  quantity: number;
  isAlternative?: boolean;
}

const RECENT_SEARCHES = ['Paracetamol', 'Amoxicillin', 'Metformin', 'Ibuprofen'];

export default function SearchMedicines() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // 1. Direct query on inventory across generic_name, brand_name, medicine_name
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          medicine_name,
          generic_name,
          brand_name,
          strength,
          dosage_form,
          price,
          quantity,
          pharmacies ( id, name )
        `)
        .or(`generic_name.ilike.%${trimmed}%,brand_name.ilike.%${trimmed}%,medicine_name.ilike.%${trimmed}%`)
        .gt('quantity', 0)
        .order('medicine_name', { ascending: true })
        .limit(30);

      if (error) throw error;

      const directMatches: InventoryResult[] = (data ?? []).map((item: any) => ({
        id: item.id,
        name: item.medicine_name,
        genericName: item.generic_name,
        brandName: item.brand_name,
        strength: item.strength ?? '',
        dosageForm: item.dosage_form ?? '',
        pharmacyName: item.pharmacies?.name ?? 'Pharmacy',
        pharmacyId: item.pharmacies?.id ?? '',
        price: parseFloat(item.price) || 0,
        quantity: item.quantity,
        isAlternative: false,
      }));

      // 2. If we matched a brand name, fetch generic alternatives sharing the same generic_name
      const matchedGenerics = Array.from(
        new Set(directMatches.map((m) => m.genericName).filter(Boolean) as string[])
      );

      let alternativeMatches: InventoryResult[] = [];
      if (matchedGenerics.length > 0) {
        const directIds = new Set(directMatches.map((m) => m.id));
        const { data: altData } = await supabase
          .from('inventory')
          .select(`
            id,
            medicine_name,
            generic_name,
            brand_name,
            strength,
            dosage_form,
            price,
            quantity,
            pharmacies ( id, name )
          `)
          .in('generic_name', matchedGenerics)
          .gt('quantity', 0)
          .limit(20);

        if (altData) {
          alternativeMatches = altData
            .filter((item: any) => !directIds.has(item.id))
            .map((item: any) => ({
              id: item.id,
              name: item.medicine_name,
              genericName: item.generic_name,
              brandName: item.brand_name,
              strength: item.strength ?? '',
              dosageForm: item.dosage_form ?? '',
              pharmacyName: item.pharmacies?.name ?? 'Pharmacy',
              pharmacyId: item.pharmacies?.id ?? '',
              price: parseFloat(item.price) || 0,
              quantity: item.quantity,
              isAlternative: true,
            }));
        }
      }

      setResults([...directMatches, ...alternativeMatches]);
    } catch (e: any) {
      console.warn('Search error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(text);
    }, 300);
  };

  const handleSubmit = () => runSearch(query);
  const handleChip = (term: string) => {
    setQuery(term);
    runSearch(term);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Search Medicines" />

      {/* Search Input Bar */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.card }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search generic or brand name..."
            placeholderTextColor={theme.text.muted}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close" size={20} color={theme.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Loading Skeleton */}
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

      {/* Search Results List */}
      {!loading && searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textDim }]}>
              No medicines found for "{query}". Try searching by generic active ingredient (e.g. Paracetamol).
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.medicineCard,
                { backgroundColor: theme.card, borderColor: theme.border },
                item.isAlternative && { borderStyle: 'dashed', borderColor: theme.textDim },
                pressed && { opacity: 0.5 },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/(patient)/pharmacies',
                  params: {
                    query: item.genericName || item.name,
                    selectedId: item.pharmacyId,
                  },
                })
              }
            >
              <View style={[styles.medIcon, { backgroundColor: theme.patientSecondary }]}>
                <Ionicons name="medkit-outline" size={18} color={primaryColor} />
              </View>

              <View style={styles.medBody}>
                {/* Brand & Generic Labels */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.medName, { color: theme.text.primary }]}>
                    {item.brandName ? item.brandName : item.name}
                  </Text>
                  {item.brandName ? (
                    <View style={[styles.badgePill, { backgroundColor: theme.patientSecondary }]}>
                      <Text style={[styles.badgePillText, { color: primaryColor }]}>Brand</Text>
                    </View>
                  ) : (
                    <View style={[styles.badgePill, { backgroundColor: '#dcfce7' }]}>
                      <Text style={[styles.badgePillText, { color: '#16a34a' }]}>Generic</Text>
                    </View>
                  )}
                  {item.isAlternative && (
                    <View style={[styles.badgePill, { backgroundColor: '#fef3c7' }]}>
                      <Text style={[styles.badgePillText, { color: '#d97706' }]}>Alternative</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.medSub, { color: theme.textMuted }]}>
                  {item.genericName ? `Generic: ${item.genericName} · ` : ''}
                  {item.strength ? `${item.strength} · ` : ''}
                  {item.pharmacyName}
                </Text>
              </View>

              <View style={styles.priceCol}>
                <Text style={[styles.priceText, { color: primaryColor }]}>GH₵{item.price.toFixed(2)}</Text>
                <Text style={[styles.qtyText, { color: theme.textDim }]}>{item.quantity} in stock</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Default View: Recent + Popular Generics */}
      {!loading && !searched && (
        <FlatList
          data={[]}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Recent Searches */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT SEARCHES</Text>
                {RECENT_SEARCHES.map((term) => (
                  <Pressable
                    key={term}
                    style={({ pressed }) => [styles.recentRow, { borderBottomColor: theme.border }, pressed && { opacity: 0.7 }]}
                    onPress={() => handleChip(term)}
                  >
                    <Ionicons name="time-outline" size={18} color={theme.text.muted} style={{ marginRight: 12 }} />
                    <Text style={[styles.recentText, { color: theme.text.primary }]}>{term}</Text>
                    <Ionicons name="arrow-forward-outline" size={18} color={theme.textDim} />
                  </Pressable>
                ))}
              </View>

              {/* Quick Search Chips */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>POPULAR MEDICINES</Text>
                <View style={styles.chipsRow}>
                  {['Paracetamol', 'Amoxicillin', 'Metformin', 'Ibuprofen', 'Augmentin', 'Panadol', 'Omeprazole'].map((chip) => (
                    <Pressable
                      key={chip}
                      style={({ pressed }) => [styles.chip, { backgroundColor: theme.patientSecondary }, pressed && { opacity: 0.7 }]}
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

  searchWrapper: { padding: SPACING.lg, paddingBottom: 0 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 48,
    paddingHorizontal: SPACING.lg,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md },

  section: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
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
  recentText: { flex: 1, fontSize: FONT_SIZE.lg },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: FONT_SIZE.md, fontWeight: '600' },

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
  medName: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  medSub: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  priceText: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  qtyText: { fontSize: FONT_SIZE.sm, marginTop: 2 },

  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  badgePillText: { fontSize: 10, fontWeight: '700' },

  emptyText: { textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.md },
});
