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
import { getPharmacyForUser } from '@/lib/pharmacyService';
import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { toast } from '@/context/ToastContext';

import { getFriendlyErrorMessage } from '@/lib/errorUtils';

export default function UploadInventory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(pharmacy)/(tabs)/inventory');
    }
    return true;
  });

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const handlePickDocument = async () => {
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
      toast.error(getFriendlyErrorMessage(e, 'Failed to read file.'));
      setParsedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!parsedItems.length || !user) return;
    setUploading(true);

    try {
      // Fetch pharmacy ID owned by user
      const pharm = await getPharmacyForUser(user);
      const pharmId = pharm?.id;

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

      // Notify the pharmacy owner (in-app + push) about the successful import
      try {
        await supabase.functions.invoke('push-notifier', {
          body: {
            direct: true,
            user_id: user.id,
            title: '✅ Inventory Updated',
            body: `Successfully imported ${parsedItems.length} medicine item${parsedItems.length !== 1 ? 's' : ''} into your inventory.`,
            notif_type: 'pharmacy_action',
            data: { pharmacy_id: pharmId, count: parsedItems.length },
          },
        });
      } catch (_) { /* non-critical — don't block the UI */ }

      Alert.alert(
        'Import Successful!',
        `Successfully imported ${parsedItems.length} medicine items into your inventory.`,
        [
          {
            text: 'View Inventory',
            onPress: () => router.replace('/(pharmacy)/(tabs)/inventory'),
          },
        ],
        { cancelable: true }
      );
    } catch (e: any) {
      // Notify about failure too
      try {
        await supabase.functions.invoke('push-notifier', {
          body: {
            direct: true,
            user_id: user.id,
            title: '❌ Inventory Import Failed',
            body: getFriendlyErrorMessage(e, 'Your inventory import failed. Please try again.'),
            notif_type: 'pharmacy_action',
            data: {},
          },
        });
      } catch (_) { /* non-critical */ }
      toast.error(getFriendlyErrorMessage(e, 'Failed to import inventory batch.'));
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
        <View style={[styles.dropZone, { backgroundColor: theme.card, borderColor: COLORS.pharmacyPrimary }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload-outline" size={32} color={COLORS.pharmacyPrimary} />
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
              { backgroundColor: COLORS.pharmacyPrimary },
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
              <Ionicons name="checkmark-circle" size={16} color={COLORS.pharmacyPrimary} />
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
                <View style={[styles.colTag, { backgroundColor: col.req ? COLORS.errorBg : COLORS.surfaceSecondary }]}>
                  <Text style={[styles.colTagText, { color: col.color }]}>{col.tag}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

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
                  <Text style={[styles.itemPrice, { color: COLORS.pharmacyPrimary }]}>
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
              style={{ backgroundColor: COLORS.pharmacyPrimary, marginTop: SPACING.md }}
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
    gap: SPACING.xs,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.pharmacySecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dropTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold',
  },
  dropSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  chooseBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  chooseBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  fileSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.pharmacySecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.md,
  },
  fileNameText: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
    color: COLORS.pharmacyPrimary,
  },

  formatCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  formatTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  formatSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md,
  },
  colGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  colPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  colPillName: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  colTag: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  colTagText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Inter-Bold',
  },

  previewCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.pharmacySecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  validBadgeText: {
    color: COLORS.pharmacyTextDark,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
  },
  previewList: {
    gap: SPACING.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  itemTitle: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  itemQty: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  itemPrice: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  moreText: {
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-SemiBold',
    marginTop: SPACING.xs,
  },

});
