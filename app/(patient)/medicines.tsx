import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { Header } from '@/components/ui/Header';
import { useSavedMedicinesStore } from '@/store/savedMedicinesStore';
import { type MedicineItem } from '@/lib/medicineCatalogue';
import { useHardwareBack } from '@/hooks/useHardwareBack';

export default function SavedMedicinesScreen() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const { savedMedicines, loadSavedMedicines, removeSavedMedicine, clearAllSaved } =
    useSavedMedicinesStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSavedMedicines();
    setRefreshing(false);
  };

  useEffect(() => {
    loadSavedMedicines();
  }, []);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
  };

  useHardwareBack(handleGoBack);

  const filteredMedicines = savedMedicines.filter((m) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.genericName.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  const handleRemoveConfirm = (item: MedicineItem) => {
    Alert.alert('Remove Medicine', `Are you sure you want to remove ${item.name} from your saved list?`, [
      { text: 'Remove', style: 'destructive', onPress: () => removeSavedMedicine(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSelectMedicine = (item: MedicineItem) => {
    router.push({
      pathname: '/(patient)/medicine/[id]',
      params: { id: item.id, name: item.name },
    });
  };

  const handleFindPharmacies = (item: MedicineItem) => {
    router.push({
      pathname: '/(patient)/pharmacies',
      params: { query: item.genericName || item.name },
    });
  };

  const handleAskAI = (item: MedicineItem) => {
    router.push({
      pathname: '/(patient)/(tabs)/chat',
      params: {
        initialQuery: `Tell me about ${item.name} (${item.strength}). What are key precautions and usage guidelines?`,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Saved Medicines" showBack onBack={handleGoBack} />

      {/* ── Filter Bar & Clear All Option ── */}
      {savedMedicines.length > 0 && (
        <View style={styles.topSection}>
          <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder="Filter saved medicines..."
              placeholderTextColor={theme.textMuted}
              value={filterQuery}
              onChangeText={setFilterQuery}
            />
            {filterQuery.length > 0 && (
              <Pressable onPress={() => setFilterQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.countRow}>
            <Text style={[styles.countText, { color: theme.textMuted }]}>
              {filteredMedicines.length} Saved {filteredMedicines.length === 1 ? 'Item' : 'Items'}
            </Text>
            <Pressable
              onPress={() => {
                Alert.alert('Remove Saved Medicines', 'Are you sure you want to remove all saved medicines?', [
                  { text: 'Remove All', style: 'destructive', onPress: clearAllSaved },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              <Text style={[styles.removeText, { color: primaryColor }]}>Remove All</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Saved Medicines List ── */}
      <FlatList
        data={filteredMedicines}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.patientSecondary }]}>
              <Ionicons name="heart-dislike-outline" size={40} color={primaryColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No Saved Medicines</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {filterQuery.trim()
                ? `No saved medicines matched "${filterQuery}".`
                : 'Bookmark medicines during search or viewing details to save them for quick access.'}
            </Text>

            <Pressable
              style={({ pressed }) => [styles.exploreBtn, { backgroundColor: primaryColor }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/(patient)/(tabs)/search')}
            >
              <Ionicons name="search" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.exploreBtnText}>Explore & Search Medicines</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Card Main Info */}
            <Pressable
              style={({ pressed }) => [styles.cardTopRow, pressed && { opacity: 0.7 }]}
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

                <Text style={[styles.medSub, { color: theme.textMuted }]}>
                  Generic: {item.genericName} · {item.category}
                </Text>
                <Text style={[styles.priceSub, { color: primaryColor }]}>
                  {item.estimatedPriceRange || 'Stock Available'}
                </Text>
              </View>

              <Pressable onPress={() => handleRemoveConfirm(item)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color="#ff4d4f" />
              </Pressable>
            </Pressable>

            {/* Card Action Row */}
            <View style={[styles.cardActionRow, { borderTopColor: theme.border }]}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleFindPharmacies(item)}
              >
                <Ionicons name="location-outline" size={16} color={COLORS.pharmacyPrimary} />
                <Text style={[styles.actionBtnText, { color: COLORS.pharmacyPrimary }]}>Find Stock</Text>
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Pressable
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
                onPress={() => handleAskAI(item)}
              >
                <Ionicons name="sparkles-outline" size={16} color={primaryColor} />
                <Text style={[styles.actionBtnText, { color: primaryColor }]}>Ask AI</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 46,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
  },
  searchInput: {
    fontFamily: 'Inter-Regular',
    flex: 1,
    fontSize: FONT_SIZE.md,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  removeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  listContent: {
    padding: SPACING.md,
    gap: 14,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  medIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medBody: {
    flex: 1,
  },
  medName: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  medSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  priceSub: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  badgePillText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  divider: {
    width: 1,
    height: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 46,
    borderRadius: RADIUS.pill,
  },
  exploreBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
});
