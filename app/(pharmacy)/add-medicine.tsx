import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { supabase } from '@/lib/supabase';
import { getPharmacyForUser } from '@/lib/pharmacyService';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { COMMON_DOSAGE_FORMS, type DosageForm } from '@/types/medicine';
import KeyboardAwareContainer from '@/components/ui/KeyboardAwareContainer';

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
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    strength?: string;
    quantity?: string;
    price?: string;
  }>();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(pharmacy)/(tabs)/inventory');
    }
    return true;
  });

  const { user } = useAuthStore();
  const { theme } = useThemeContext();

  const isEditMode = !!params.editId;

  // Form State
  const [genericName, setGenericName] = useState('');
  const [selectedGenericId, setSelectedGenericId] = useState<string | null>(null);

  const [brandName, setBrandName] = useState(params.name || '');

  const [strength, setStrength] = useState(params.strength || '');
  const [dosageForm, setDosageForm] = useState<DosageForm>('Tablet');
  const [manufacturer, setManufacturer] = useState('');
  const [price, setPrice] = useState(params.price || '');
  const [quantity, setQuantity] = useState(params.quantity || '');

  const [loading, setLoading] = useState(false);

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
    const name = brandName.trim() || genericName.trim();
    if (!name) {
      toast.error('Please enter a Brand Name or Generic Name.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price (greater than 0).');
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      toast.error('Please enter a valid stock quantity.');
      return;
    }

    setLoading(true);

    try {
      if (!user) throw new Error('User authentication lost.');

      const pharm = await getPharmacyForUser(user);
      const pharmId = pharm?.id;

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

        toast.success('Stock Updated', 'Medicine stock updated successfully!');
        router.back();
      } else {
        const { error: insertErr } = await supabase.from('inventory').insert({
          pharmacy_id: pharmId,
          medicine_name: name,
          strength: strength.trim() || null,
          quantity: qtyNum,
          price: priceNum,
        });

        if (insertErr) throw insertErr;

        toast.success('Medicine Added', 'Medicine added to inventory successfully!');
        router.back();
      }
    } catch (e: any) {
      toast.error(getFriendlyErrorMessage(e, 'Failed to save inventory stock. Please try again.'));
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

      <KeyboardAwareContainer>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

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
                  <Ionicons name="medical-outline" size={16} color={COLORS.pharmacyPrimary} style={{ marginRight: 8 }} />
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
                  <Ionicons name="pricetag-outline" size={16} color={COLORS.pharmacyPrimary} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>
                      {item.brand_name}
                    </Text>
                    {item.strength && (
                      <Text style={{ fontSize: FONT_SIZE.sm, color: theme.textMuted }}>{item.strength}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 3. Dosage Form Chip Selector ── */}
        <View style={{ marginBottom: SPACING.lg }}>
          <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Dosage Form</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            {COMMON_DOSAGE_FORMS.map((form) => {
              const isSelected = dosageForm === form;
              return (
                <Pressable
                  key={form}
                  style={[
                    styles.formChip,
                    isSelected
                      ? { backgroundColor: COLORS.pharmacyPrimary, borderColor: COLORS.pharmacyPrimary }
                      : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  ]}
                  onPress={() => setDosageForm(form)}
                >
                  <Text
                    style={[
                      styles.formChipText,
                      { color: isSelected ? COLORS.white : theme.text.primary },
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
          style={{ marginTop: SPACING.xxl, backgroundColor: COLORS.pharmacyPrimary }}
        />
      </ScrollView>
      </KeyboardAwareContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: SPACING.xl },
  inputContainer: { position: 'relative', zIndex: 1, marginBottom: SPACING.xs },
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSlate,
  },
  dropdownItemText: { fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold' },
  fieldLabel: { fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold', marginBottom: SPACING.xs },
  formChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  formChipText: { fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold' },
  rowTwo: { gap: SPACING.md },
});
