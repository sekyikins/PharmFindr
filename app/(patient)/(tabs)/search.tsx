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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import Skeleton from '@/components/ui/Skeleton';
import { Header, HeaderIconBtn } from '@/components/ui/Header';
import {
  searchMasterMedicines,
  fetchPopularMedicines,
  fetchMedicineCategories,
  type MedicineItem,
  type PopularMedicine,
} from '@/lib/medicineCatalogue';
import { useRecentSearchesStore } from '@/store/recentSearchesStore';
import { useNetworkStore } from '@/store/networkStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { supabase, safeChannel } from '@/lib/supabase';

export default function SearchMedicines() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { user } = useAuthStore();

  const {
    recentSearches,
    loadRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllRecentSearches,
  } = useRecentSearchesStore();

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [results, setResults] = useState<MedicineItem[]>([]);
  const [popularMedicines, setPopularMedicines] = useState<PopularMedicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [popularLoading, setPopularLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRandomPopular = useCallback(async () => {
    const meds = await fetchPopularMedicines(6);
    setPopularMedicines(meds);
    setPopularLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    const cats = await fetchMedicineCategories();
    setCategories(cats);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadRecentSearches(user?.id),
      loadRandomPopular(),
      loadCategories(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadRecentSearches(user?.id);
    loadRandomPopular();
    loadCategories();

    const channel = safeChannel('search-inventory-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        () => {
          if (query.trim() || selectedCategory !== 'All') {
            runSearch(query, selectedCategory);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadRecentSearches, loadRandomPopular, loadCategories]);

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

      try {
        const matches = await searchMasterMedicines(trimmed, activeCat);
        setResults(matches);
      } catch (e: any) {
        console.warn('Search error:', e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory]
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
    if (term.trim()) {
      addRecentSearch(term.trim(), user?.id);
    }
    runSearch(term);
  };

  const handleSelectMedicine = (med: MedicineItem) => {
    if (med.name) {
      addRecentSearch(med.name, user?.id);
    }
    router.push({
      pathname: '/(patient)/medicine/[id]',
      params: { id: med.id, name: med.name },
    });
  };

  const handleSearchSubmit = () => {
    const trimmed = query.trim();
    if (trimmed) {
      addRecentSearch(trimmed, user?.id);
    }
    runSearch(query);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Search Medicines"
        right={
          <HeaderIconBtn
            icon="notifications-outline"
            badge={unreadCount > 0 ? unreadCount : undefined}
            onPress={() => router.push('/(patient)/notifications')}
          />
        }
      />

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
            onSubmitEditing={handleSearchSubmit}
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
              style={{ padding: SPACING.xs }}
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
          {categories.map((cat) => {
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
                    { color: isSelected ? COLORS.white : theme.text.primary },
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={theme.textDim} style={{ marginBottom: SPACING.md }} />
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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>RECENT SEARCHES</Text>
                <Pressable
                  onPress={() => {
                    Alert.alert('Clear History', 'Are you sure you want to clear your recent search history?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear All', style: 'destructive', onPress: () => clearAllRecentSearches(user?.id) },
                    ], { cancelable: true });
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
                    <Pressable onPress={() => removeRecentSearch(term, user?.id)} style={{ padding: 6 }}>
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

            {popularLoading ? (
              <View style={styles.popularGrid}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View
                    key={i}
                    style={[styles.popularCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="40%" height={12} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.popularGrid}>
                {popularMedicines.map((item) => (
                  <Pressable
                    key={item.id}
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
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  searchWrapper: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    height: 48,
    paddingHorizontal: SPACING.lg
  },
  searchInput: {
    fontFamily: 'Inter-SemiBold',
     flex: 1, fontSize: FONT_SIZE.md
  },

  categoryScroll: {
    gap: SPACING.xs, paddingTop: SPACING.sm
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  categoryChipText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold'
  },

  section: {
    padding: SPACING.lg
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm
  },
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  clearText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },

  recentCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden'
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md
  },
  recentText: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Medium'
  },

  popularGrid: {
    gap: SPACING.md, marginTop: SPACING.sm
  },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    gap: SPACING.md
  },
  popularIconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  popularName: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  popularSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md, marginTop: SPACING.xs
  },

  listContent: {
    padding: SPACING.lg, gap: SPACING.md
  },
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1
  },
  medIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  medBody: {
    flex: 1
  },
  medName: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  medSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginTop: 2
  },
  brandSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginTop: 2
  },

  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill
  },
  badgePillText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Bold'
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: 'Inter-Bold', marginBottom: 6
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, textAlign: 'center', lineHeight: 18
  },

});
