import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPharmacyForUser } from '@/lib/pharmacyService';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import Skeleton from '@/components/ui/Skeleton';
import AppBottomSheet from '@/components/ui/AppBottomSheet';
import { Header } from '@/components/ui/Header';

export default function Inventory() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [inventory, setInventory] = useState<any[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const editSheetRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Get pharmacy owned by current user
      const pharm = await getPharmacyForUser(user);

      if (!pharm?.id) {
        setInventory([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const pharmId = pharm.id;
      setPharmacyId(pharmId);

      // 2. Get inventory
      const { data: inv, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('pharmacy_id', pharmId)
        .order('medicine_name', { ascending: true });

      if (invErr) throw invErr;
      setInventory(
        inv.map((item) => ({
          id: item.id,
          name: item.medicine_name,
          strength: item.strength || '',
          quantity: item.quantity,
          price: parseFloat(item.price),
        }))
      );
    } catch (e: any) {
      console.warn('Error fetching inventory:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Medicine', `Remove ${name} from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('inventory').delete().eq('id', id);
            if (error) throw error;
            setInventory((prev) => prev.filter((i) => i.id !== id));
          } catch (e: any) {
            toast.error('Delete Failed', getFriendlyErrorMessage(e, 'Failed to delete medicine item.'));
          }
        },
      },
    ],
    { cancelable: true });
  };

  const handleEdit = (item: any) => {
    setEditItem({ ...item });
    // Small timeout to let state settle before opening sheet
    setTimeout(() => editSheetRef.current?.present?.() ?? editSheetRef.current?.expand?.(), 50);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          medicine_name: editItem.name,
          strength: editItem.strength || null,
          quantity: editItem.quantity,
          price: editItem.price,
        })
        .eq('id', editItem.id);

      if (error) throw error;

      setInventory((prev) =>
        prev.map((i) => (i.id === editItem.id ? editItem : i))
      );
      setEditItem(null);
      editSheetRef.current?.dismiss?.() ?? editSheetRef.current?.close?.();
    } catch (e: any) {
      toast.error('Update Failed', getFriendlyErrorMessage(e, 'Failed to update medicine details.'));
    } finally {
      setSaving(false);
    }
  };

  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'instock'>('all');

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(q) ||
        (item.strength && item.strength.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (filterMode === 'low') return item.quantity <= 10;
      if (filterMode === 'instock') return item.quantity > 10;
      return true;
    });
  }, [inventory, searchQuery, filterMode]);

  const renderItem = ({ item }: { item: any }) => {
    const isOutOfStock = item.quantity <= 0;
    const isLow = item.quantity > 0 && item.quantity < 30;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.itemCard,
          pressed && { opacity: 0.88 },
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() => handleEdit(item)}
      >
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.medName, { color: theme.text.primary }]}>{item.name}</Text>
            {item.strength ? (
              <View style={[styles.strengthChip, { backgroundColor: theme.surfaceSecondary }]}>
                <Text style={[styles.strengthText, { color: theme.textMuted }]}>{item.strength}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.itemRight}>
            <Text style={[styles.priceText, { color: COLORS.pharmacyPrimary }]}>GHS {item.price.toFixed(2)}</Text>
            <Text style={[styles.stockQty, { color: theme.textMuted }]}>{item.quantity} units</Text>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <View
            style={[
              styles.statusPill,
              isOutOfStock
                ? { backgroundColor: COLORS.errorBg }
                : isLow
                ? { backgroundColor: '#fffbeb' }
                : { backgroundColor: '#ecfdf5' },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOutOfStock
                    ? COLORS.error
                    : isLow
                    ? COLORS.warning
                    : COLORS.pharmacyPrimary,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                {
                  color: isOutOfStock
                    ? '#b91c1c'
                    : isLow
                    ? '#b45309'
                    : COLORS.pharmacyTextDark,
                },
              ]}
            >
              {isOutOfStock ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              pressed && { opacity: 0.6 },
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
            onPress={() =>
              router.push({
                pathname: '/(pharmacy)/add-medicine',
                params: {
                  editId: item.id,
                  name: item.name,
                  strength: item.strength,
                  quantity: String(item.quantity),
                  price: String(item.price),
                },
              })
            }
          >
            <Ionicons name="create-outline" size={14} color={theme.text.primary} />
            <Text style={[styles.editBtnText, { color: theme.text.primary }]}>Edit</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <Header
        title="Inventory"
        right={
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            
            <Pressable
              style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.5 }, { borderColor: theme.border }]}
              onPress={() => router.push('/(pharmacy)/upload-inventory')}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        }
        left={
          <Pressable
            style={({ pressed }) => [styles.fabSmall, pressed && { opacity: 0.8 }, { backgroundColor: COLORS.pharmacyPrimary }]}
            onPress={() => router.push('/(pharmacy)/add-medicine')}
          >
            <Ionicons name="add" size={22} color={COLORS.white} />
          </Pressable>
        }
      />
      {/* Search Bar & Filter Chips */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={16} color={theme.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search medicine name or strength..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.chipRow}>
        <Pressable
          style={[
            styles.chip,
            filterMode === 'all'
              ? { backgroundColor: COLORS.pharmacyPrimary, borderColor: COLORS.pharmacyPrimary }
              : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
          ]}
          onPress={() => setFilterMode('all')}
        >
          <Text style={[styles.chipText, { color: filterMode === 'all' ? COLORS.white : theme.text.primary }]}>
            All Items ({inventory.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.chip,
            filterMode === 'low'
              ? { backgroundColor: COLORS.pharmacyPrimary, borderColor: COLORS.pharmacyPrimary }
              : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
          ]}
          onPress={() => setFilterMode('low')}
        >
          <Text style={[styles.chipText, { color: filterMode === 'low' ? COLORS.white : theme.text.primary }]}>
            Low Stock
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.chip,
            filterMode === 'instock'
              ? { backgroundColor: COLORS.pharmacyPrimary, borderColor: COLORS.pharmacyPrimary }
              : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
          ]}
          onPress={() => setFilterMode('instock')}
        >
          <Text style={[styles.chipText, { color: filterMode === 'instock' ? COLORS.white : theme.text.primary }]}>
            In Stock
          </Text>
        </Pressable>
      </View>

      {/* Item List */}
      {loading ? (
        <View style={{ padding: SPACING.xl, gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={80} borderRadius={16} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.xl, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.pharmacyPrimary}
              colors={['#10b981']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No medicines found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {searchQuery ? 'Try matching a different keyword' : 'Tap + above to add your first medicine'}
              </Text>
            </View>
          }
        />
      )}

      {/* Edit Item — Bottom Sheet */}
      <AppBottomSheet
        ref={editSheetRef}
        snapPoints={['65%']}
        title="Edit Medicine"
        rightBtn={
          <Pressable
            style={({pressed})=>[styles.iconBtn, pressed && {opacity: 0.5}, { backgroundColor: theme.errorBg }]}
            onPress={() => {
              if (editItem) {
                handleDelete(editItem.id, editItem.name);
                editSheetRef.current?.dismiss?.();
              }
            }}
          >
            <Ionicons name="trash-outline" size={15} color={theme.error} />
          </Pressable>
        }
        onClose={() => setEditItem(null)}
      >
        <View
          style={styles.editSheetContent}
        >
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>MEDICINE</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
            placeholder="Medicine Name"
            placeholderTextColor={theme.text.muted}
            value={editItem?.name || ''}
            onChangeText={(v) => setEditItem((p: any) => ({ ...p, name: v }))}
          />
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>STRENGTH</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
            placeholder="Strength (e.g. 500mg)"
            placeholderTextColor={theme.text.muted}
            value={editItem?.strength || ''}
            onChangeText={(v) => setEditItem((p: any) => ({ ...p, strength: v }))}
          />
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>QUANTITY</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
            placeholder="Quantity"
            placeholderTextColor={theme.text.muted}
            keyboardType="numeric"
            value={editItem ? String(editItem.quantity) : ''}
            onChangeText={(v) => setEditItem((p: any) => ({ ...p, quantity: parseInt(v) || 0 }))}
          />
          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>PRICE ($)</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
            placeholder="Price ($/unit)"
            placeholderTextColor={theme.text.muted}
            keyboardType="decimal-pad"
            value={editItem ? String(editItem.price) : ''}
            onChangeText={(v) => setEditItem((p: any) => ({ ...p, price: parseFloat(v) || 0.0 }))}
          />
          <View style={styles.modalActions}>
            <Pressable
              style={({pressed})=>[styles.modalBtn, { flex: 1 }, pressed && {opacity: 0.5}, { backgroundColor: primaryColor }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={{ color: COLORS.white, fontFamily: 'Inter-SemiBold' }}>Save Medicine</Text>
              }
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  fabSmall: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center'
  },

  searchRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 8
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    height: 40,
    paddingHorizontal: 14
  },
  searchInput: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: FONT_SIZE.lg
  },
  uploadBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  chipText: {
    fontSize: SPACING.md,
    fontFamily: 'Inter-Bold'
  },

  itemCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: SPACING.md
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  medName: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  strengthChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.xs
  },
  strengthText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold'
  },
  itemRight: {
    alignItems: 'flex-end'
  },
  priceText: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  stockQty: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md,
    marginTop: 2
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.sm
  },
  statusPillText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2
  },
  editBtnText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: SPACING.sm
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md,
    textAlign: 'center'
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Bottom sheet edit form
  editSheetContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    gap: SPACING.md
  },
  fieldLabel: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5
  },
  modalInput: {
    fontFamily: 'Inter-Regular',
    
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.lg
  },
  modalActions: {
    flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },

});