import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
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

export default function Inventory() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const { user } = useAuthStore();

  const [inventory, setInventory] = useState<any[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  // New medicine form state
  const [newName, setNewName] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Get pharmacy owned by current user
      const { data: pharm, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (pharmErr) throw pharmErr;
      setPharmacyId(pharm.id);

      // 2. Get inventory
      const { data: inv, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('pharmacy_id', pharm.id)
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
      Alert.alert('Error', 'Failed to load inventory.');
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

  const filteredInventory = inventory.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMedicine = async () => {
    if (!newName.trim() || !newQty.trim() || !newPrice.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Medicine Name, Quantity, and Price.');
      return;
    }
    if (!pharmacyId) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          pharmacy_id: pharmacyId,
          medicine_name: newName.trim(),
          strength: newStrength.trim() || null,
          quantity: parseInt(newQty, 10) || 0,
          price: parseFloat(newPrice) || 0.0,
        })
        .select()
        .single();

      if (error) throw error;

      const newItem = {
        id: data.id,
        name: data.medicine_name,
        strength: data.strength || '',
        quantity: data.quantity,
        price: parseFloat(data.price),
      };

      setInventory((prev) => [newItem, ...prev]);
      setNewName('');
      setNewStrength('');
      setNewQty('');
      setNewPrice('');
      setShowAddForm(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add medicine.');
    } finally {
      setSaving(false);
    }
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
            Alert.alert('Error', e.message || 'Failed to delete medicine.');
          }
        },
      },
    ]);
  };

  const handleEdit = (item: any) => {
    setEditItem({ ...item });
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
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update medicine.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isLow = item.quantity < 50;
    return (
      <View style={[styles.tableRow, { borderBottomColor: theme.border }]}>
        <View style={styles.colMed}>
          <Text style={[styles.medName, { color: theme.text.primary }]}>{item.name}</Text>
          <Text style={[styles.medStrength, { color: theme.textDim }]}>{item.strength}</Text>
        </View>
        <Text style={[styles.colQty, { color: theme.text.primary }, isLow && { color: theme.warning }]}>
          {item.quantity}
        </Text>
        <Text style={[styles.colPrice, { color: primaryColor }]}>${item.price.toFixed(2)}</Text>
        <View style={styles.colActions}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: theme.patientSecondary }]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil-outline" size={13} color={theme.patientPrimary} />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: theme.errorBg }]}
            onPress={() => handleDelete(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={13} color={theme.error} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push('/(pharmacy)/(tabs)/dashboard')}
          >
            <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Inventory</Text>
        </View>
        <Pressable
          style={[styles.fabSmall, { backgroundColor: primaryColor }]}
          onPress={() => setShowAddForm((v) => !v)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Add New Medicine inline form */}
      {showAddForm && (
        <View style={[styles.addForm, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
          <Text style={[styles.addFormTitle, { color: theme.successText }]}>Add New Medicine</Text>
          <View style={styles.addFormRow}>
            <TextInput
              style={[styles.addInput, { borderColor: theme.successBorder, backgroundColor: theme.card, color: theme.text.primary }]}
              placeholder="Medicine Name"
              placeholderTextColor={theme.text.muted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.addInput, { borderColor: theme.successBorder, backgroundColor: theme.card, color: theme.text.primary }]}
              placeholder="Strength"
              placeholderTextColor={theme.text.muted}
              value={newStrength}
              onChangeText={setNewStrength}
            />
          </View>
          <View style={styles.addFormRow}>
            <TextInput
              style={[styles.addInput, { borderColor: theme.successBorder, backgroundColor: theme.card, color: theme.text.primary }]}
              placeholder="Quantity"
              placeholderTextColor={theme.text.muted}
              keyboardType="numeric"
              value={newQty}
              onChangeText={setNewQty}
            />
            <TextInput
              style={[styles.addInput, { borderColor: theme.successBorder, backgroundColor: theme.card, color: theme.text.primary }]}
              placeholder="Price ($/unit)"
              placeholderTextColor={theme.text.muted}
              keyboardType="decimal-pad"
              value={newPrice}
              onChangeText={setNewPrice}
            />
          </View>
          <Pressable style={[styles.addBtn, { backgroundColor: primaryColor }]} onPress={handleAddMedicine} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Add Medicine</Text>}
          </Pressable>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={15} color={theme.text.muted} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search inventory..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable style={[styles.uploadBtn, { borderColor: theme.border }]} onPress={() => router.push('/(pharmacy)/upload-inventory')}>
          <Ionicons name="cloud-upload-outline" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      {/* Table Header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.surfaceSecondary }]}>
        <Text style={[styles.thMed, { color: theme.textDim }]}>MEDICINE</Text>
        <Text style={[styles.thQty, { color: theme.textDim }]}>QTY</Text>
        <Text style={[styles.thPrice, { color: theme.textDim }]}>PRICE</Text>
        <Text style={[styles.thPrice, { color: theme.textDim }]}>ACTIONS</Text>
      </View>

      {/* Table List */}
      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <View style={{ flex: 2, gap: 4 }}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="40%" height={12} />
              </View>
              <Skeleton width={30} height={16} style={{ flex: 1 }} />
              <Skeleton width={45} height={16} style={{ flex: 1 }} />
              <Skeleton width={40} height={20} borderRadius={RADIUS.md} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} colors={[primaryColor]} />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textDim }]}>No medicines found.</Text>
          }
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Edit Medicine</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
              placeholder="Medicine Name"
              placeholderTextColor={theme.text.muted}
              value={editItem?.name || ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, name: v }))}
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
              placeholder="Strength"
              placeholderTextColor={theme.text.muted}
              value={editItem?.strength || ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, strength: v }))}
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
              placeholder="Quantity"
              placeholderTextColor={theme.text.muted}
              keyboardType="numeric"
              value={editItem ? String(editItem.quantity) : ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, quantity: parseInt(v) || 0 }))}
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text.primary }]}
              placeholder="Price ($/unit)"
              placeholderTextColor={theme.text.muted}
              keyboardType="decimal-pad"
              value={editItem ? String(editItem.price) : ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, price: parseFloat(v) || 0.0 }))}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.surfaceSecondary }]} onPress={() => setEditItem(null)}>
                <Text style={{ color: theme.text.primary }}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: primaryColor }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  fabSmall: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addForm: { padding: SPACING.lg, borderBottomWidth: 1, gap: 10 },
  addFormTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  addFormRow: { flexDirection: 'row', gap: 10 },
  addInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    fontSize: FONT_SIZE.body,
  },
  addBtn: {
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.lg },

  searchRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 8 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    height: 40,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.lg },
  uploadBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  thMed: { flex: 2, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  thQty: { width: 50, fontSize: FONT_SIZE.sm, fontWeight: '700', textAlign: 'center' },
  thPrice: { width: 75, fontSize: FONT_SIZE.sm, fontWeight: '700', textAlign: 'center' },

  listContent: { paddingBottom: 40 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.body },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
  },
  colMed: { flex: 2 },
  medName: { fontSize: FONT_SIZE.lg, fontWeight: '600' },
  medStrength: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  colQty: { width: 50, fontSize: FONT_SIZE.lg, fontWeight: '700', textAlign: 'center' },
  colPrice: { width: 75, fontSize: FONT_SIZE.lg, fontWeight: '600', textAlign: 'center' },
  colActions: { width: 75, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: { borderRadius: RADIUS.xl, padding: SPACING.xl, gap: 12 },
  modalTitle: { fontSize: FONT_SIZE.title, fontWeight: '700', marginBottom: 6 },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    fontSize: FONT_SIZE.lg,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
});