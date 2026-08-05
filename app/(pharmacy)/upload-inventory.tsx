import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeContext } from '@/hooks/useThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';

const PHARMACY_GREEN = '#10b981';

export default function UploadInventory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeContext();

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
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
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const file = result.assets[0];
        setFileName(file.name);
        if (file.size) {
          setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
        }
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
          throw new Error('The selected file is empty or missing headers.');
        }

        // Header mapping logic (case-insensitive column search)
        const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase());

        const nameIdx = headers.indexOf('name');
        const strengthIdx = headers.indexOf('strength');
        const priceIdx = headers.indexOf('price');
        const qtyIdx = headers.findIndex(
          (h: string) => h.includes('quantity') || h.includes('qty') || h.includes('stock')
        );

        if (nameIdx === -1 || priceIdx === -1 || qtyIdx === -1) {
          throw new Error(
            'Invalid file format. Spreadsheet must contain "Name", "Price", and "Quantity" columns.'
          );
        }

        const items = rawRows
          .slice(1)
          .map((row) => ({
            medicine_name: String(row[nameIdx] ?? '').trim(),
            strength: strengthIdx !== -1 ? String(row[strengthIdx] ?? '').trim() : '',
            quantity: parseInt(String(row[qtyIdx] ?? 0), 10),
            price: parseFloat(String(row[priceIdx] ?? 0)),
          }))
          .filter((item) => item.medicine_name && !isNaN(item.price) && !isNaN(item.quantity));

        if (items.length === 0) {
          throw new Error('No valid medicine rows could be extracted from this spreadsheet.');
        }

        setParsedItems(items);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to read file.');
      setParsedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!parsedItems.length || !user) return;
    setUploading(true);
    setErrorMsg(null);

    try {
      // Fetch pharmacy ID owned by user
      let pharmId: string | null = null;
      const { data: pharm } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (pharm?.id) {
        pharmId = pharm.id;
      } else {
        // Fallback check by phone/email
        let query = supabase.from('pharmacies').select('id');
        if (user.phone) query = query.eq('phone', user.phone);
        else if (user.email) query = query.eq('email', user.email);

        const { data: fallbackPharm } = await query.maybeSingle();
        if (fallbackPharm?.id) pharmId = fallbackPharm.id;
      }

      if (!pharmId) throw new Error('Pharmacy account not found.');

      // Batch insert items
      const payload = parsedItems.map((item) => ({
        pharmacy_id: pharmId,
        medicine_name: item.medicine_name,
        strength: item.strength || null,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: insertErr } = await supabase.from('inventory').insert(payload);
      if (insertErr) throw insertErr;

      Alert.alert(
        'Import Successful!',
        `Successfully imported ${parsedItems.length} medicine items into your inventory.`,
        [
          {
            text: 'View Inventory',
            onPress: () => router.replace('/(pharmacy)/(tabs)/inventory'),
          },
        ]
      );
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to import inventory batch.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="CSV Bulk Import"
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(pharmacy)/(tabs)/inventory'))}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. Upload Dropzone Card ── */}
        <View style={[styles.dropZone, { backgroundColor: theme.card, borderColor: PHARMACY_GREEN }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload-outline" size={32} color={PHARMACY_GREEN} />
          </View>

          <Text style={[styles.dropTitle, { color: theme.text.primary }]}>
            Upload Stock Spreadsheet
          </Text>
          <Text style={[styles.dropSub, { color: theme.textMuted }]}>
            Supports CSV, XLS, and XLSX file formats.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.chooseBtn,
              pressed && { opacity: 0.8 },
              { backgroundColor: PHARMACY_GREEN },
            ]}
            onPress={handlePickDocument}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
                <Text style={styles.chooseBtnText}>Choose File from Device</Text>
              </>
            )}
          </Pressable>

          {fileName && (
            <View style={styles.fileSelectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={PHARMACY_GREEN} />
              <Text style={styles.fileNameText} numberOfLines={1}>
                {fileName} {fileSize ? `(${fileSize})` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── 2. Format Requirements Guide ── */}
        <View style={[styles.formatCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.formatHeader}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.patientPrimary} />
            <Text style={[styles.formatTitle, { color: theme.text.primary }]}>Spreadsheet Column Format</Text>
          </View>
          <Text style={[styles.formatSub, { color: theme.textMuted }]}>
            Your file must include a top header row with these column names:
          </Text>

          <View style={styles.colGrid}>
            {[
              { name: 'Name', tag: 'REQUIRED', req: true, color: COLORS.error },
              { name: 'Quantity', tag: 'REQUIRED', req: true, color: COLORS.error },
              { name: 'Price', tag: 'REQUIRED', req: true, color: COLORS.error },
              { name: 'Strength', tag: 'OPTIONAL', req: false, color: COLORS.textMuted },
            ].map((col) => (
              <View
                key={col.name}
                style={[styles.colPill, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              >
                <Text style={[styles.colPillName, { color: theme.text.primary }]}>{col.name}</Text>
                <View style={[styles.colTag, { backgroundColor: col.req ? '#fee2e2' : COLORS.surfaceSecondary }]}>
                  <Text style={[styles.colTagText, { color: col.color }]}>{col.tag}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── 3. Error Alert ── */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* ── 4. File Preview & Import Action ── */}
        {parsedItems.length > 0 && (
          <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.previewHeaderRow}>
              <Text style={[styles.previewTitle, { color: theme.text.primary }]}>
                Items Found ({parsedItems.length})
              </Text>
              <View style={styles.validBadge}>
                <Ionicons name="checkmark-done" size={14} color="#047857" />
                <Text style={styles.validBadgeText}>Valid File</Text>
              </View>
            </View>

            <View style={styles.previewList}>
              {parsedItems.slice(0, 5).map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.previewRow, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.text.primary }]}>
                      {item.medicine_name} {item.strength ? `(${item.strength})` : ''}
                    </Text>
                    <Text style={[styles.itemQty, { color: theme.textMuted }]}>
                      Stock: {item.quantity} units
                    </Text>
                  </View>
                  <Text style={[styles.itemPrice, { color: PHARMACY_GREEN }]}>
                    GH₵ {item.price.toFixed(2)}
                  </Text>
                </View>
              ))}

              {parsedItems.length > 5 && (
                <Text style={[styles.moreText, { color: theme.textMuted }]}>
                  ... and {parsedItems.length - 5} more items
                </Text>
              )}
            </View>

            <Button
              title={uploading ? 'Importing Medicines...' : 'Confirm & Import All Items'}
              loading={uploading}
              onPress={handleUpload}
              style={{ backgroundColor: PHARMACY_GREEN, marginTop: 12 }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: SPACING.xl, gap: SPACING.lg
  },

  dropZone: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  dropTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  dropSub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md,
    textAlign: 'center'
  },
  chooseBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12
  },
  chooseBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },
  fileSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginTop: 10
  },
  fileNameText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: PHARMACY_GREEN
  },

  formatCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: 10
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  formatTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  formatSub: {
    fontFamily: 'Inter-Regular',
    
    fontSize: FONT_SIZE.md
  },
  colGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  colPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  colPillName: {
    fontSize: 12,
    fontFamily: 'Inter-Bold'
  },
  colTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  colTagText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold'
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.errorBg,
    borderColor: '#fecaca',
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    flex: 1
  },

  previewCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: 12
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  previewTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill
  },
  validBadgeText: {
    color: COLORS.pharmacyTextDark,
    fontSize: 11,
    fontFamily: 'Inter-Bold'
  },
  previewList: {
    gap: 8
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1
  },
  itemTitle: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold'
  },
  itemQty: {
    fontFamily: 'Inter-Regular',
    
    fontSize: 11,
    marginTop: 2
  },
  itemPrice: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold'
  },
  moreText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginTop: 4
  },

});
