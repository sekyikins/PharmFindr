import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function AddMedicine() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, primaryColor } = useThemeContext();

  // Form State
  const [genericName, setGenericName] = useState('');
  const [selectedGenericId, setSelectedGenericId] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState<DosageForm>('Tablet');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Autocomplete Suggestions State
  const [genericSuggestions, setGenericSuggestions] = useState<GenericOption[]>([]);
  const [showGenericDropdown, setShowGenericDropdown] = useState(false);

  const [brandSuggestions, setBrandSuggestions] = useState<ProductOption[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const genericDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        let queryBuilder = supabase
          .from('medicine_products')
          .select('id, generic_id, brand_name, strength, dosage_form, manufacturer')
          .ilike('brand_name', `%${text.trim()}%`);

        if (selectedGenericId) {
          queryBuilder = queryBuilder.eq('generic_id', selectedGenericId);
        }

        const { data } = await queryBuilder.limit(8);
        setBrandSuggestions(data ?? []);
        setShowBrandDropdown((data ?? []).length > 0);
      } catch {
        setBrandSuggestions([]);
        setShowBrandDropdown(false);
      }
    }, 250);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectGeneric = (item: GenericOption) => {
    setGenericName(item.generic_name);
    setSelectedGenericId(item.id);
    setShowGenericDropdown(false);
  };

  const handleSelectBrand = (item: ProductOption) => {
    setBrandName(item.brand_name);
    setSelectedProductId(item.id);
    if (item.strength) setStrength(item.strength);
    if (item.dosage_form && COMMON_DOSAGE_FORMS.includes(item.dosage_form as any)) {
      setDosageForm(item.dosage_form as DosageForm);
    }
    if (item.manufacturer) setManufacturer(item.manufacturer);
    setShowBrandDropdown(false);
  };

  // ── Add Stock to Inventory ────────────────────────────────────────────────

  const handleSave = async () => {
    const trimmedGeneric = genericName.trim();
    if (!trimmedGeneric || !price.trim() || !quantity.trim()) {
      setErrorMsg('Please fill in required fields: Generic Name, Price, and Quantity.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // A. Fetch Pharmacy ID for logged in owner
      const { data: pharmData, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (pharmErr || !pharmData?.id) {
        throw new Error('Pharmacy profile not found. Please complete pharmacy profile registration.');
      }

      const pharmacyId = pharmData.id;

      // B. Resolve or Insert Generic Medicine Record
      let genericId = selectedGenericId;
      if (!genericId) {
        // Try exact match query first
        const { data: existingGen } = await supabase
          .from('generic_medicines')
          .select('id')
          .ilike('generic_name', trimmedGeneric)
          .maybeSingle();

        if (existingGen?.id) {
          genericId = existingGen.id;
        } else {
          // Insert new Generic Medicine catalog record
          const { data: newGen, error: newGenErr } = await supabase
            .from('generic_medicines')
            .insert({
              generic_name: trimmedGeneric,
              dosage_forms: [dosageForm],
            })
            .select('id')
            .single();

          if (newGenErr && newGenErr.code !== '23505') throw newGenErr;
          genericId = newGen?.id ?? null;
        }
      }

      // C. Resolve or Insert Medicine Product (Brand) Record if brandName provided
      let productId = selectedProductId;
      const trimmedBrand = brandName.trim();
      if (genericId && trimmedBrand && !productId) {
        const { data: existingProd } = await supabase
          .from('medicine_products')
          .select('id')
          .eq('generic_id', genericId)
          .ilike('brand_name', trimmedBrand)
          .eq('strength', strength.trim() || 'Standard')
          .eq('dosage_form', dosageForm)
          .maybeSingle();

        if (existingProd?.id) {
          productId = existingProd.id;
        } else {
          const { data: newProd, error: newProdErr } = await supabase
            .from('medicine_products')
            .insert({
              generic_id: genericId,
              brand_name: trimmedBrand,
              strength: strength.trim() || 'Standard',
              dosage_form: dosageForm,
              manufacturer: manufacturer.trim() || null,
            })
            .select('id')
            .single();

          if (newProdErr && newProdErr.code !== '23505') throw newProdErr;
          productId = newProd?.id ?? null;
        }
      }

      // D. Cached Display Medicine Name (e.g. "Panadol 500 mg (Paracetamol)")
      const displayMedicineName = trimmedBrand
        ? `${trimmedBrand} ${strength.trim()} (${trimmedGeneric})`.trim()
        : `${trimmedGeneric} ${strength.trim()}`.trim();

      // E. Insert into Inventory
      const { error: invErr } = await supabase
        .from('inventory')
        .insert({
          pharmacy_id: pharmacyId,
          medicine_product_id: productId,
          medicine_name: displayMedicineName,
          generic_name: trimmedGeneric,
          brand_name: trimmedBrand || null,
          strength: strength.trim() || null,
          dosage_form: dosageForm,
          manufacturer: manufacturer.trim() || null,
          batch_number: batchNumber.trim() || null,
          expiry_date: expiryDate.trim() || null,
          quantity: parseInt(quantity, 10),
          price: parseFloat(price),
        });

      if (invErr) throw invErr;

      Alert.alert('Success ✓', `${displayMedicineName} added to your inventory!`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.warn('Error saving inventory:', e.message);
      setErrorMsg(e.message || 'Failed to add medicine to inventory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Add Stock Medicine"
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/(pharmacy)/(tabs)/inventory'))}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {errorMsg && (
          <View style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.error} style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
          </View>
        )}

        {/* ── 1. Generic Name (Primary Identifier) ── */}
        <View style={styles.inputContainer}>
          <Input
            label="Generic Name (Active Ingredient) *"
            placeholder="e.g. Paracetamol, Amoxicillin, Metformin"
            value={genericName}
            onChangeText={(text) => {
              setGenericName(text);
              setSelectedGenericId(null);
              fetchGenericSuggestions(text);
            }}
          />
          {showGenericDropdown && (
            <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {genericSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: theme.surfaceSecondary }]}
                  onPress={() => handleSelectGeneric(item)}
                >
                  <Ionicons name="flask-outline" size={16} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>{item.generic_name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 2. Brand Name (Product Identifier) ── */}
        <View style={styles.inputContainer}>
          <Input
            label="Brand Name (Optional if unbranded)"
            placeholder="e.g. Panadol, Augmentin, Glucophage"
            value={brandName}
            onChangeText={(text) => {
              setBrandName(text);
              setSelectedProductId(null);
              fetchBrandSuggestions(text);
            }}
          />
          {showBrandDropdown && (
            <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {brandSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: theme.surfaceSecondary }]}
                  onPress={() => handleSelectBrand(item)}
                >
                  <Ionicons name="pricetag-outline" size={16} color={primaryColor} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>{item.brand_name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>{item.strength} · {item.dosage_form}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 3. Dosage Form Pill Selector ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Dosage Form</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {COMMON_DOSAGE_FORMS.map((form) => (
              <Pressable
                key={form}
                style={[
                  styles.formChip,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  dosageForm === form && { backgroundColor: theme.patientSecondary, borderColor: primaryColor },
                ]}
                onPress={() => setDosageForm(form)}
              >
                <Text style={[styles.formChipText, { color: dosageForm === form ? primaryColor : theme.textMuted }]}>
                  {form}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── 4. Strength & Manufacturer ── */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Input
              label="Strength"
              placeholder="e.g. 500 mg, 10mg/ml"
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

        {/* ── 5. Batch & Expiry Date (Optional) ── */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Input
              label="Batch Number"
              placeholder="e.g. BATCH-2026-X"
              value={batchNumber}
              onChangeText={setBatchNumber}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Expiry Date"
              placeholder="YYYY-MM-DD"
              value={expiryDate}
              onChangeText={setExpiryDate}
            />
          </View>
        </View>

        {/* ── 6. Price & Stock Quantity ── */}
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
          title="Save Medicine Stock"
          loading={loading}
          onPress={handleSave}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.xl },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: RADIUS.lg,
    marginBottom: 20,
  },
  errorText: { fontSize: FONT_SIZE.sm, fontWeight: '500', flex: 1 },
  inputContainer: { position: 'relative', zIndex: 1, marginBottom: 4 },
  dropdownCard: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    zIndex: 99,
    elevation: 8,
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
