import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { COMMON_DOSAGE_FORMS, type DosageForm } from '@/types/medicine';

interface GenericOption {
  id: string;
  generic_name: string;
  dosage_forms?: string[];
}

interface ProductOption {
  id: string;
  generic_id: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  manufacturer?: string | null;
}

const PHARMACY_GREEN = '#10b981';

export default function AddMedicine() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    strength?: string;
    quantity?: string;
    price?: string;
  }>();

  const { user } = useAuthStore();
  const { theme } = useThemeContext();

  const isEditMode = !!params.editId;

  // Form State
  const [genericName, setGenericName] = useState('');
  const [selectedGenericId, setSelectedGenericId] = useState<string | null>(null);

  const [brandName, setBrandName] = useState(params.name || '');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [strength, setStrength] = useState(params.strength || '');
  const [dosageForm, setDosageForm] = useState<DosageForm>('Tablet');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [price, setPrice] = useState(params.price || '');
  const [quantity, setQuantity] = useState(params.quantity || '');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Autocomplete Suggestions State
  const [genericSuggestions, setGenericSuggestions] = useState<GenericOption[]>([]);
  const [showGenericDropdown, setShowGenericDropdown] = useState(false);

  const [brandSuggestions, setBrandSuggestions] = useState<ProductOption[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const genericDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.name) setBrandName(params.name);
    if (params.strength) setStrength(params.strength);
    if (params.quantity) setQuantity(params.quantity);
    if (params.price) setPrice(params.price);
  }, [params.editId]);

  // ── 1. Fetch Generic Suggestions ──────────────────────────────────────────

  const fetchGenericSuggestions = (text: string) => {
    if (genericDebounceRef.current) clearTimeout(genericDebounceRef.current);
    if (!text.trim()) {
      setGenericSuggestions([]);
      setShowGenericDropdown(false);
      return;
    }

    genericDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('generic_medicines')
          .select('id, generic_name, dosage_forms')
          .ilike('generic_name', `%${text.trim()}%`)
          .limit(8);

        setGenericSuggestions(data ?? []);
        setShowGenericDropdown((data ?? []).length > 0);
      } catch {
        setGenericSuggestions([]);
        setShowGenericDropdown(false);
      }
    }, 250);
  };

  // ── 2. Fetch Brand Suggestions ────────────────────────────────────────────

  const fetchBrandSuggestions = (text: string) => {
    if (brandDebounceRef.current) clearTimeout(brandDebounceRef.current);
    if (!text.trim()) {
      setBrandSuggestions([]);
      setShowBrandDropdown(false);
      return;
    }

    brandDebounceRef.current = setTimeout(async () => {
      try {
        let query = supabase
          .from('products')
          .select('id, generic_id, brand_name, strength, dosage_form, manufacturer')
          .ilike('brand_name', `%${text.trim()}%`);

        if (selectedGenericId) {
          query = query.eq('generic_id', selectedGenericId);
        }

        const { data } = await query.limit(8);
        setBrandSuggestions(data ?? []);
        setShowBrandDropdown((data ?? []).length > 0);
      } catch {
        setBrandSuggestions([]);
        setShowBrandDropdown(false);
      }
    }, 250);
  };

  const handleSelectGeneric = (item: GenericOption) => {
    setGenericName(item.generic_name);
    setSelectedGenericId(item.id);
    setShowGenericDropdown(false);

    if (item.dosage_forms && item.dosage_forms.length > 0) {
      const matchedForm = COMMON_DOSAGE_FORMS.find(
        (df) => df.toLowerCase() === item.dosage_forms![0].toLowerCase()
      );
      if (matchedForm) setDosageForm(matchedForm);
    }
  };

  const handleSelectBrand = (item: ProductOption) => {
    setBrandName(item.brand_name);
    setSelectedProductId(item.id);
    setStrength(item.strength);
    if (item.manufacturer) setManufacturer(item.manufacturer);
    setShowBrandDropdown(false);

    const matchedForm = COMMON_DOSAGE_FORMS.find(
      (df) => df.toLowerCase() === item.dosage_form.toLowerCase()
    );
    if (matchedForm) setDosageForm(matchedForm);
  };

  // ── 3. Handle Save Stock ───────────────────────────────────────────────────

  const handleSave = async () => {
    setErrorMsg(null);

    const name = brandName.trim() || genericName.trim();
    if (!name) {
      setErrorMsg('Please enter a Brand Name or Generic Name.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid price (greater than 0).');
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      setErrorMsg('Please enter a valid stock quantity.');
      return;
    }

    setLoading(true);

    try {
      if (!user) throw new Error('User authentication lost.');

      let pharmId: string | null = null;
      const { data: pharm } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (pharm) pharmId = pharm.id;

      if (!pharmId) throw new Error('No registered pharmacy found for your account.');

      if (isEditMode && params.editId) {
        const { error: updateErr } = await supabase
          .from('inventory')
          .update({
            medicine_name: name,
            strength: strength.trim() || null,
            quantity: qtyNum,
            price: priceNum,
          })
          .eq('id', params.editId);

        if (updateErr) throw updateErr;

        Alert.alert('Success', 'Medicine stock updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const { error: insertErr } = await supabase.from('inventory').insert({
          pharmacy_id: pharmId,
          medicine_name: name,
          strength: strength.trim() || null,
          quantity: qtyNum,
          price: priceNum,
        });

        if (insertErr) throw insertErr;

        Alert.alert('Success', 'Medicine added to inventory successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save inventory stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title={isEditMode ? 'Edit Medicine' : 'Add Medicine'}
        showBack
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {errorMsg && (
          <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: '#ef4444' }]}>{errorMsg}</Text>
          </View>
        )}

        {/* ── 1. Generic Name Autocomplete ── */}
        <View style={styles.inputContainer}>
          <Input
            label="Generic Name (INN / Chemical Name)"
            placeholder="e.g. Amoxicillin, Paracetamol"
            value={genericName}
            onChangeText={(text) => {
              setGenericName(text);
              setSelectedGenericId(null);
              fetchGenericSuggestions(text);
            }}
          />
          {showGenericDropdown && genericSuggestions.length > 0 && (
            <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {genericSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectGeneric(item)}
                >
                  <Ionicons name="medical-outline" size={16} color={PHARMACY_GREEN} style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>
                    {item.generic_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 2. Brand / Trade Name Autocomplete ── */}
        <View style={styles.inputContainer}>
          <Input
            label="Brand / Trade Name *"
            placeholder="e.g. Amoxil, Panadol Extra"
            value={brandName}
            onChangeText={(text) => {
              setBrandName(text);
              setSelectedProductId(null);
              fetchBrandSuggestions(text);
            }}
          />
          {showBrandDropdown && brandSuggestions.length > 0 && (
            <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {brandSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectBrand(item)}
                >
                  <Ionicons name="pricetag-outline" size={16} color={PHARMACY_GREEN} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>
                      {item.brand_name}
                    </Text>
                    {item.strength && (
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>{item.strength}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 3. Dosage Form Chip Selector ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Dosage Form</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COMMON_DOSAGE_FORMS.map((form) => {
              const isSelected = dosageForm === form;
              return (
                <Pressable
                  key={form}
                  style={[
                    styles.formChip,
                    isSelected
                      ? { backgroundColor: PHARMACY_GREEN, borderColor: PHARMACY_GREEN }
                      : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  ]}
                  onPress={() => setDosageForm(form)}
                >
                  <Text
                    style={[
                      styles.formChipText,
                      { color: isSelected ? '#ffffff' : theme.text.primary },
                    ]}
                  >
                    {form}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 4. Strength & Manufacturer ── */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Input
              label="Strength / Concentration"
              placeholder="e.g. 500mg, 10mg/5ml"
              value={strength}
              onChangeText={setStrength}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Manufacturer"
              placeholder="e.g. GSK, Sanofi"
              value={manufacturer}
              onChangeText={setManufacturer}
            />
          </View>
        </View>

        {/* ── 5. Price & Stock Quantity ── */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Input
              label="Price (GH₵) *"
              placeholder="e.g. 25.00"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Stock Quantity *"
              placeholder="e.g. 100"
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
        </View>

        {/* Save Button */}
        <Button
          title={loading ? 'Saving...' : isEditMode ? 'Update Medicine Stock' : 'Save Medicine Stock'}
          loading={loading}
          onPress={handleSave}
          style={{ marginTop: 24, backgroundColor: PHARMACY_GREEN }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: 160 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: RADIUS.lg,
    marginBottom: 20,
  },
  errorText: { fontSize: FONT_SIZE.sm, fontWeight: '600', flex: 1 },
  inputContainer: { position: 'relative', zIndex: 1, marginBottom: 4 },
  dropdownCard: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    zIndex: 99,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
  },
  dropdownItemText: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  fieldLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 6 },
  formChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  formChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  rowTwo: { flexDirection: 'row', gap: 12 },
});
