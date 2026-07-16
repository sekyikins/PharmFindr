import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const GREEN = '#10b981';

// Dummy medicine inventory data
const INITIAL_INVENTORY = [
  { id: '1', name: 'Amoxicillin', strength: '500mg', quantity: 48, price: 12.5 },
  { id: '2', name: 'Metformin', strength: '850mg', quantity: 124, price: 8.75 },
  { id: '3', name: 'Lisinopril', strength: '10mg', quantity: 37, price: 6.2 },
  { id: '4', name: 'Atorvastatin', strength: '20mg', quantity: 92, price: 15.0 },
  { id: '5', name: 'Cetirizine', strength: '10mg', quantity: 211, price: 4.5 },
];

export default function Inventory() {
  const router = useRouter();
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  // New medicine form state
  const [newName, setNewName] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const filteredInventory = inventory.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMedicine = () => {
    if (!newName.trim() || !newQty.trim() || !newPrice.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Medicine Name, Quantity, and Price.');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      name: newName.trim(),
      strength: newStrength.trim(),
      quantity: parseInt(newQty) || 0,
      price: parseFloat(newPrice) || 0,
    };
    setInventory((prev) => [newItem, ...prev]);
    setNewName('');
    setNewStrength('');
    setNewQty('');
    setNewPrice('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Medicine', `Remove ${name} from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setInventory((prev) => prev.filter((i) => i.id !== id)),
      },
    ]);
  };

  const handleEdit = (item: any) => {
    setEditItem({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
    setInventory((prev) =>
      prev.map((i) => (i.id === editItem.id ? editItem : i))
    );
    setEditItem(null);
  };

  const renderItem = ({ item }: { item: any }) => {
    const isLow = item.quantity < 50;
    return (
      <View style={styles.tableRow}>
        {/* Medicine + strength */}
        <View style={styles.colMed}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medStrength}>{item.strength}</Text>
        </View>
        {/* Qty */}
        <Text style={[styles.colQty, isLow && styles.lowQty]}>{item.quantity}</Text>
        {/* Price */}
        <Text style={styles.colPrice}>${item.price.toFixed(1)}</Text>
        {/* Actions */}
        <View style={styles.colActions}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: '#ede9fe' }]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil-outline" size={13} color="#7c3aed" />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: '#fee2e2' }]}
            onPress={() => handleDelete(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={13} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.push('/(pharmacy)/(tabs)/dashboard')}
          >
            <Ionicons name="arrow-back" size={18} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>Inventory</Text>
        </View>
        <Pressable
          style={styles.fabSmall}
          onPress={() => setShowAddForm((v) => !v)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Add New Medicine inline form ── */}
      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>Add New Medicine</Text>
          <View style={styles.addFormRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Medicine Name"
              placeholderTextColor="#94a3b8"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.addInput}
              placeholder="Strength"
              placeholderTextColor="#94a3b8"
              value={newStrength}
              onChangeText={setNewStrength}
            />
          </View>
          <View style={styles.addFormRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Quantity"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newQty}
              onChangeText={setNewQty}
            />
            <TextInput
              style={styles.addInput}
              placeholder="Price ($/unit)"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              value={newPrice}
              onChangeText={setNewPrice}
            />
          </View>
          <Pressable style={styles.addBtn} onPress={handleAddMedicine}>
            <Text style={styles.addBtnText}>Add Medicine</Text>
          </Pressable>
        </View>
      )}

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable style={styles.uploadBtn} onPress={() => router.push('/(pharmacy)/upload-inventory')}>
          <Ionicons name="cloud-upload-outline" size={18} color="#64748b" />
        </Pressable>
      </View>

      {/* ── Table Header ── */}
      <View style={styles.tableHeader}>
        <Text style={styles.thMed}>MEDICINE</Text>
        <Text style={styles.thQty}>QTY</Text>
        <Text style={styles.thPrice}>PRICE</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* ── Table List ── */}
      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No medicines found.</Text>
        }
      />

      {/* ── Edit Modal ── */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Medicine</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Medicine Name"
              placeholderTextColor="#94a3b8"
              value={editItem?.name || ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, name: v }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Strength"
              placeholderTextColor="#94a3b8"
              value={editItem?.strength || ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, strength: v }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Quantity"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={editItem ? String(editItem.quantity) : ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, quantity: parseInt(v) || 0 }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Price"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              value={editItem ? String(editItem.price) : ''}
              onChangeText={(v) => setEditItem((p: any) => ({ ...p, price: parseFloat(v) || 0 }))}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  fabSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Add Form ──
  addForm: {
    backgroundColor: '#f0fdf8',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  addFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 12,
  },
  addFormRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1e293b',
  },
  addBtn: {
    backgroundColor: GREEN,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    height: 36,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },
  uploadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Table ──
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  thMed: { flex: 1, fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },
  thQty: { width: 40, fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },
  thPrice: { width: 52, fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  colMed: { flex: 1 },
  medName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  medStrength: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  colQty: { width: 40, fontSize: 14, fontWeight: '500', color: '#1e293b' },
  lowQty: { color: '#f97316' },
  colPrice: { width: 52, fontSize: 14, fontWeight: '600', color: GREEN },
  colActions: { width: 56, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontSize: 13 },

  // ── Edit Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 10,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
