import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { Header } from '@/components/ui/Header';
import { toast } from '@/context/ToastContext';
import { getFriendlyErrorMessage } from '@/lib/errorUtils';
import { supabase } from '@/lib/supabase';
import { getPharmacyForUser } from '@/lib/pharmacyService';
import { formatTimeHHMM } from '@/lib/osm';
import { useAuthStore } from '@/store/authStore';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PHARMACY_GREEN = '#10b981';

interface DaySchedule {
  day: string;
  isOpen: boolean;
  opens: string;
  closes: string;
}

export default function OperatingHours() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const { user } = useAuthStore();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(pharmacy)/(tabs)/profile');
    }
    return true;
  });

  const [pharmId, setPharmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS.map((d) => ({
      day: d,
      isOpen: d !== 'Sunday',
      opens: '08:00',
      closes: '20:00',
    }))
  );

  useEffect(() => {
    loadSchedule();
  }, [user?.id]);

  const loadSchedule = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 1. Fetch pharmacy record
      const pharm = await getPharmacyForUser(user);

      if (pharm) {
        setPharmId(pharm.id);

        // 2. Pull directly from pharmacy_operating_hours table
        try {
          const { data: dbHours, error: hoursErr } = await supabase
            .from('pharmacy_operating_hours')
            .select('*')
            .eq('pharmacy_id', pharm.id);

          if (!hoursErr && dbHours && dbHours.length > 0) {
            const mapped = DAYS.map((d) => {
              const row = dbHours.find((h) => h.day_of_week === d);
              return {
                day: d,
                isOpen: row ? row.is_open : d !== 'Sunday',
                opens: formatTimeHHMM(row ? row.opening_time || '08:00' : '08:00'),
                closes: formatTimeHHMM(row ? row.closing_time || '20:00' : '20:00'),
              };
            });
            setSchedule(mapped);
            return;
          }

          // If table is empty for this pharmacy, seed default 7 days!
          const defaultRows = DAYS.map((d) => ({
            pharmacy_id: pharm.id,
            day_of_week: d,
            is_open: d !== 'Sunday',
            opening_time: '08:00',
            closing_time: '20:00',
          }));

          await supabase.from('pharmacy_operating_hours').insert(defaultRows);
          setSchedule(
            defaultRows.map((r) => ({
              day: r.day_of_week,
              isOpen: r.is_open,
              opens: formatTimeHHMM(r.opening_time),
              closes: formatTimeHHMM(r.closing_time),
            }))
          );
          return;
        } catch (e: any) {
          console.warn('pharmacy_operating_hours notice:', e.message);
        }

        // 3. Fallback to default opening_time/closing_time
        if (pharm.opening_time || pharm.closing_time) {
          const opens = formatTimeHHMM(pharm.opening_time || '08:00');
          const closes = formatTimeHHMM(pharm.closing_time || '20:00');
          setSchedule(
            DAYS.map((d) => ({
              day: d,
              isOpen: d !== 'Sunday',
              opens,
              closes,
            }))
          );
        }
      }
    } catch (e: any) {
      console.warn('Error loading operating hours:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (index: number) => {
    setSchedule((prev) =>
      prev.map((item, i) => (i === index ? { ...item, isOpen: !item.isOpen } : item))
    );
  };

  const handleChangeTime = (index: number, field: 'opens' | 'closes', val: string) => {
    setSchedule((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('Error', 'User is not signed in.');
      return;
    }

    let activePharmId = pharmId;
    if (!activePharmId) {
      // Re-query pharmacy record
      let { data: pharm } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!pharm && user.phone) {
        const { data: pByPhone } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('phone', user.phone)
          .maybeSingle();
        if (pByPhone) pharm = pByPhone;
      }

      if (pharm) {
        activePharmId = pharm.id;
        setPharmId(pharm.id);
      }
    }

    if (!activePharmId) {
      toast.error('Error', 'Pharmacy record not found. Please log out and sign back in.');
      return;
    }

    setSaving(true);
    try {
      const monday = schedule[0];
      const opening_time = monday?.opens || '08:00';
      const closing_time = monday?.closes || '20:00';

      // 1. Save directly into pharmacy_operating_hours table in a single batch upsert
      try {
        const rows = schedule.map((item) => ({
          pharmacy_id: activePharmId,
          day_of_week: item.day,
          is_open: item.isOpen,
          opening_time: item.opens,
          closing_time: item.closes,
        }));

        await supabase
          .from('pharmacy_operating_hours')
          .upsert(rows, { onConflict: 'pharmacy_id,day_of_week' });
      } catch (e: any) {
        console.warn('pharmacy_operating_hours update warning:', e.message);
      }

      // 2. Sync default opening and closing times to pharmacies table
      try {
        await supabase
          .from('pharmacies')
          .update({
            opening_time,
            closing_time,
          })
          .eq('id', activePharmId);
      } catch (e: any) {
        console.warn('pharmacies table update warning:', e.message);
      }

      toast.success('Operating Hours Saved', 'Operating hours saved successfully!');
      router.back();
    } catch (e: any) {
      toast.error('Save Failed', getFriendlyErrorMessage(e, 'Failed to save operating hours. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Operating Hours" showBack onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {loading ? (
            <ActivityIndicator size="large" color={PHARMACY_GREEN} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.dayList}>
              {schedule.map((item, idx) => (
                <View
                  key={item.day}
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: item.isOpen ? PHARMACY_GREEN + '60' : theme.border,
                    },
                  ]}
                >
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayTitle, { color: theme.text.primary }]}>{item.day}</Text>
                    <View style={styles.switchRow}>
                      <Text
                        style={[
                          styles.switchStatus,
                          { color: item.isOpen ? PHARMACY_GREEN : theme.textMuted },
                        ]}
                      >
                        {item.isOpen ? 'OPEN' : 'CLOSED'}
                      </Text>
                      <Switch
                        value={item.isOpen}
                        onValueChange={() => handleToggleDay(idx)}
                        trackColor={{ false: '#cbd5e1', true: '#a7f3d0' }}
                        thumbColor={item.isOpen ? PHARMACY_GREEN : '#f1f5f9'}
                      />
                    </View>
                  </View>

                  {item.isOpen && (
                    <View style={styles.timeRow}>
                      <View style={styles.timeCol}>
                        <Text style={[styles.timeLabel, { color: theme.textMuted }]}>Opens</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text.primary },
                          ]}
                          value={item.opens}
                          onChangeText={(v) => handleChangeTime(idx, 'opens', v)}
                          placeholder="08:00"
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>

                      <Text style={[styles.timeDash, { color: theme.textMuted }]}>–</Text>

                      <View style={styles.timeCol}>
                        <Text style={[styles.timeLabel, { color: theme.textMuted }]}>Closes</Text>
                        <TextInput
                          style={[
                            styles.timeInput,
                            { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text.primary },
                          ]}
                          value={item.closes}
                          onChangeText={(v) => handleChangeTime(idx, 'closes', v)}
                          placeholder="20:00"
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.8 },
                  { backgroundColor: PHARMACY_GREEN },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Operating Hours</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.xl, gap: SPACING.md },
  dayList: { gap: 12 },
  dayCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Inter-Bold'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchStatus: {
    fontSize: FONT_SIZE.md,
    fontFamily: 'Inter-Bold',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeCol: {
    flex: 1,
    gap: 4,
  },
  timeLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  timeInput: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
  timeDash: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginTop: 14,
  },
  saveBtn: {
    height: 50,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Inter-Bold',
  },
});
