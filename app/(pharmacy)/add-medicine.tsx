import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function AddMedicine() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name || !price || !quantity) {
      setErrorMsg('Please fill in all required fields (Name, Price, Quantity).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Pharmacy ID
      const { data: pharmData, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (pharmErr) throw pharmErr;

      // 2. Add to Inventory table (we denormalize medicine details directly for simplicity in the junction table)
      const { error: invErr } = await supabase
        .from('inventory')
        .insert({
          pharmacy_id: pharmData.id,
          medicine_name: name,
          generic_name: genericName || null,
          strength: strength || null,
          quantity: parseInt(quantity, 10),
          price: parseFloat(price)
        });

      if (invErr) throw invErr;

      router.back();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to add medicine to inventory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Add Medicine" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {errorMsg && (
            <View style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
            </View>
          )}

          <Input 
            label="Medicine Name *"
            placeholder="e.g. Amoxicillin"
            value={name}
            onChangeText={setName}
          />

          <Input 
            label="Generic Name"
            placeholder="e.g. Amoxicillin Trihydrate"
            value={genericName}
            onChangeText={setGenericName}
          />

          <Input 
            label="Strength"
            placeholder="e.g. 500mg"
            value={strength}
            onChangeText={setStrength}
          />

          <Input 
            label="Price (GH₵) *"
            placeholder="e.g. 12.50"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />

          <Input 
            label="Stock Quantity *"
            placeholder="e.g. 150"
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
          />

          <Button 
            title="Save Medicine"
            loading={loading}
            onPress={handleAdd}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  errorBox: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 24,
  },
});
