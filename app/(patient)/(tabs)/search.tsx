import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import Skeleton from '@/components/ui/Skeleton';
import { Header } from '@/components/ui/Header';
import { searchMasterMedicines, type MedicineItem } from '@/lib/medicineCatalogue';
import { useRecentSearchesStore } from '@/store/recentSearchesStore';
import { useNetworkStore } from '@/store/networkStore';

const CATEGORIES = [
  'All',
  'Pain Relief',
  'Antibiotics',
  'Diabetes',
  'Heart & BP',
  'Gastro',
  'Allergy',
  'Antimalarial',
];

const POPULAR_MEDICINES = [
  { name: 'Paracetamol', category: 'Pain Relief', strength: '500mg' },
  { name: 'Amoxicillin', category: 'Antibiotic', strength: '500mg' },
  { name: 'Metformin', category: 'Diabetes', strength: '850mg' },
  { name: 'Ibuprofen', category: 'Pain Relief', strength: '400mg' },
  { name: 'Coartem', category: 'Antimalarial', strength: '80/480mg' },
  { name: 'Omeprazole', category: 'Gastro', strength: '20mg' },
  { name: 'Lisinopril', category: 'Heart & BP', strength: '10mg' },
  { name: 'Cetirizine', category: 'Allergy', strength: '10mg' },
];

export default function SearchMedicines() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const {
    recentSearches,
    loadRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllRecentSearches,
  } = useRecentSearchesStore();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [results, setResults] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const runSearch = useCallback(
    async (term: string, cat?: string) => {
      const trimmed = term.trim();
      const activeCat = cat !== undefined ? cat : selectedCategory;

      if (!trimmed && activeCat === 'All') {
        setResults([]);
        setSearched(false);
        return;
      }

      if (!useNetworkStore.getState().isConnected) {
        useNetworkStore.getState().triggerOfflineNotice();
      }

      setLoading(true);
      setSearched(true);

      if (trimmed) {
        addRecentSearch(trimmed);
      }

      try {
        const matches = await searchMasterMedicines(trimmed, activeCat);
        setResults(matches);
      } catch (e: any) {
        console.warn('Search error:', e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, addRecentSearch]
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim() && selectedCategory === 'All') {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(text, selectedCategory);
    }, 300);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    if (query.trim() || cat !== 'All') {
      runSearch(query, cat);
    } else {
      setResults([]);
      setSearched(false);
    }
  };

  const handleChipSelect = (term: string) => {
    setQuery(term);
    runSearch(term);
  };

  const handleSelectMedicine = (med: MedicineItem) => {
    router.push({
      pathname: '/(patient)/medicine/[id]',
      params: { id: med.id },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Search Medicines" />

      {/* ── Search Input & Filter Bar ── */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.card }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search generic or brand name (e.g. Paracetamol)..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                if (selectedCategory === 'All') {
                  setResults([]);
                  setSearched(false);
                } else {
                  runSearch('', selectedCategory);
                }
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {/* ── Horizontal Category Filter Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isSelected
                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                    : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleCategorySelect(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isSelected ? '#ffffff' : theme.text.primary },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.medicineCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Skeleton width={44} height={44} borderRadius={RADIUS.md} style={{ marginRight: 14 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="65%" height={16} />
                <Skeleton width="45%" height={13} />
              </View>
              <Skeleton width={60} height={24} borderRadius={RADIUS.pill} />
            </View>
          ))}
        </View>
      )}

      {/* ── Search Results List ── */}
      {!loading && searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={theme.textDim} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No Medicines Found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                We couldn't find matches for "{query}". Try searching by generic active ingredient (e.g. Paracetamol, Amoxicillin).
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.medicineCard,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && { opacity: 0.7, backgroundColor: theme.surfaceSecondary },
              ]}
              onPress={() => handleSelectMedicine(item)}
            >
              <View style={[styles.medIcon, { backgroundColor: theme.patientSecondary }]}>
                <Ionicons name="medkit" size={20} color={primaryColor} />
              </View>

              <View style={styles.medBody}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.medName, { color: theme.text.primary }]}>{item.name}</Text>
                  <View style={[styles.badgePill, { backgroundColor: theme.patientSecondary }]}>
                    <Text style={[styles.badgePillText, { color: primaryColor }]}>{item.strength}</Text>
                  </View>
                </View>

                <Text style={[styles.medSub, { color: theme.textMuted }]} numberOfLines={1}>
                  Generic: {item.genericName} · {item.category}
                </Text>

                {item.brandNames && item.brandNames.length > 0 && (
                  <Text style={[styles.brandSub, { color: theme.textDim }]} numberOfLines={1}>
                    Brands: {item.brandNames.join(', ')}
                  </Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
              </View>
            </Pressable>
          )}
        />
      )}

      {/* ── Default View: Recent Searches + Popular Medicines ── */}
      {!loading && !searched && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT SEARCHES</Text>
                <Pressable
                  onPress={() => {
                    Alert.alert('Clear History', 'Are you sure you want to clear your recent search history?', [
                      { text: 'Clear All', style: 'destructive', onPress: clearAllRecentSearches },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                >
                  <Text style={[styles.clearText, { color: primaryColor }]}>Clear All</Text>
                </Pressable>
              </View>

              <View style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {recentSearches.map((term, index) => (
                  <View
                    key={term}
                    style={[
                      styles.recentRow,
                      index < recentSearches.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                    ]}
                  >
                    <Pressable
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => handleChipSelect(term)}
                    >
                      <Ionicons name="time-outline" size={18} color={theme.textMuted} style={{ marginRight: 12 }} />
                      <Text style={[styles.recentText, { color: theme.text.primary }]}>{term}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeRecentSearch(term)} style={{ padding: 6 }}>
                      <Ionicons name="close" size={16} color={theme.textDim} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Popular Medicines Grid */}
          <View style={[styles.section, { paddingTop: 0 }]}>
            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>POPULAR MEDICINES & GENERICS</Text>

            <View style={styles.popularGrid}>
              {POPULAR_MEDICINES.map((item) => (
                <Pressable
                  key={item.name}
                  style={({ pressed }) => [
                    styles.popularCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    pressed && { opacity: 0.7, backgroundColor: theme.surfaceSecondary },
                  ]}
                  onPress={() => handleChipSelect(item.name)}
                >
                  <View style={[styles.popularIconCircle, { backgroundColor: theme.patientSecondary }]}>
                    <Ionicons name="medkit-outline" size={18} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.popularName, { color: theme.text.primary }]}>{item.name}</Text>
                    <Text style={[styles.popularSub, { color: theme.textMuted }]}>
                      {item.strength} · {item.category}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={theme.textDim} />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchWrapper: { paddingHorizontal: SPACING.lg, paddingTop: 6, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 48,
    paddingHorizontal: SPACING.lg,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md },

  categoryScroll: { gap: 8, paddingTop: 10 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontWeight: '600' },

  section: { padding: SPACING.lg },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  clearText: { fontSize: 12, fontWeight: '600' },

  recentCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentText: { fontSize: FONT_SIZE.md, fontWeight: '500' },

  popularGrid: { gap: 10, marginTop: 8 },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  popularIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularName: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  popularSub: { fontSize: 12, marginTop: 1 },

  listContent: { padding: SPACING.lg, gap: 10 },
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1,
  },
  medIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medBody: { flex: 1 },
  medName: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  medSub: { fontSize: 12, marginTop: 2 },
  brandSub: { fontSize: 11, marginTop: 2 },

  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  badgePillText: { fontSize: 10, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
