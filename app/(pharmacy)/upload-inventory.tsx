import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  ActivityIndicator,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export default function UploadInventory() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePickDocument = async () => {
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/comma-separated-values',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const file = result.assets[0];
        setFileName(file.name);
        setLoading(true);

        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64',
        });

        // Parse using SheetJS (XLSX)
        const workbook = XLSX.read(base64, { type: 'base64' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rawRows.length < 2) {
          throw new Error('The selected sheet is empty or lacks headers.');
        }

        // Header mapping logic (case-insensitive column search)
        const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase());
        
        const nameIdx = headers.indexOf('name');
        const genericIdx = headers.findIndex((h: string) => h.includes('generic') || h.includes('chemical'));
        const strengthIdx = headers.indexOf('strength');
        const priceIdx = headers.indexOf('price');
        const qtyIdx = headers.findIndex((h: string) => h.includes('quantity') || h.includes('qty') || h.includes('stock'));

        if (nameIdx === -1 || priceIdx === -1 || qtyIdx === -1) {
          throw new Error('Invalid columns. Sheet must contain Name, Price, and Quantity columns.');
        }

        const items = rawRows.slice(1).map((row) => ({
          medicine_name: row[nameIdx],
          generic_name: genericIdx !== -1 ? row[genericIdx] : null,
          strength: strengthIdx !== -1 ? row[strengthIdx] : null,
          price: parseFloat(row[priceIdx]) || 0.00,
          quantity: parseInt(row[qtyIdx], 10) || 0,
        })).filter(item => item.medicine_name);

        setParsedItems(items);
      }
    } catch (e: any) {
      console.error('File pick or parse error:', e);
      setErrorMsg(e.message || 'Failed to parse file. Make sure headers are correct.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (parsedItems.length === 0) return;
    setUploading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Pharmacy ID
      const { data: pharmData, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (pharmErr) throw pharmErr;

      // 2. Format row additions
      const payload = parsedItems.map(item => ({
        pharmacy_id: pharmData.id,
        ...item
      }));

      // 3. Upsert inventory to Supabase
      const { error } = await supabase
        .from('inventory')
        .insert(payload);

      if (error) throw error;

      alert(`Successfully imported ${parsedItems.length} items!`);
      router.back();
    } catch (e: any) {
      console.error('Import error:', e);
      setErrorMsg(e.message || 'Import failed. Check database connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="CSV / Excel Import" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.pickerCard}>
          <Ionicons name="cloud-upload-outline" size={48} color={theme.pharmacy.primary} />
          <Text style={[styles.pickerTitle, { color: theme.text.primary }]}>Upload Inventory File</Text>
          <Text style={[styles.pickerDesc, { color: theme.text.secondary }]}>
            Supports CSV, XLS, and XLSX files. The file should have columns matching Name, Price, and Quantity.
          </Text>

          <Button 
            title={loading ? 'Processing...' : 'Choose File'} 
            onPress={handlePickDocument}
            loading={loading}
            style={styles.pickBtn}
          />

          {fileName && (
            <Text style={[styles.fileName, { color: theme.pharmacy.primary }]}>
              Selected: {fileName}
            </Text>
          )}
        </Card>

        {errorMsg && (
          <View style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
          </View>
        )}

        {parsedItems.length > 0 && (
          <View style={styles.previewContainer}>
            <Text style={[styles.previewTitle, { color: theme.text.primary }]}>
              Preview ({parsedItems.length} items found)
            </Text>
            
            {parsedItems.slice(0, 5).map((item, idx) => (
              <Card key={idx} style={styles.previewItem}>
                <View style={styles.previewHeader}>
                  <Text style={[styles.medName, { color: theme.text.primary }]}>
                    {item.medicine_name} {item.strength || ''}
                  </Text>
                  <Text style={[styles.medPrice, { color: theme.pharmacy.primary }]}>
                    GH₵ {item.price.toFixed(2)}
                  </Text>
                </View>
                <Text style={[styles.medQty, { color: theme.text.secondary }]}>
                  Stock Qty: {item.quantity}
                </Text>
              </Card>
            ))}

            {parsedItems.length > 5 && (
              <Text style={[styles.moreText, { color: theme.text.muted }]}>
                ... and {parsedItems.length - 5} more items
              </Text>
            )}

            <Button 
              title={uploading ? 'Importing...' : 'Confirm Import'} 
              loading={uploading}
              onPress={handleUpload}
              style={styles.importBtn}
            />
          </View>
        )}
      </ScrollView>
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
  pickerCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  pickerDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  pickBtn: {
    width: '80%',
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
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
  previewContainer: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  previewItem: {
    marginBottom: 8,
    padding: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  medName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  medPrice: {
    fontSize: 13,
    fontWeight: '600',
  },
  medQty: {
    fontSize: 11,
  },
  moreText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  importBtn: {
    marginTop: 16,
    marginBottom: 40,
  },
});
