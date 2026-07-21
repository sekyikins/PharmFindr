import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  ActivityIndicator,
  Linking,
  Pressable
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function PharmacyReservationDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = colors.light;

  const [reservation, setReservation] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchReservation();
  }, [id]);

  const fetchReservation = async () => {
    setLoading(true);
    try {
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single();

      if (resErr) throw resErr;
      setReservation(resData);

      if (resData?.user_id) {
        const { data: profileData, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', resData.user_id)
          .single();

        if (profErr) throw profErr;
        setPatient(profileData);
      }
    } catch (e) {
      console.error('Error fetching reservation details:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: 'accepted' | 'declined' | 'collected') => {
    setUpdating(true);
    try {
      const updates: any = { status };
      if (status === 'accepted') {
        updates.expires_at = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      fetchReservation();
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.pharmacy.primary} />
      </SafeAreaView>
    );
  }

  const items = reservation?.medicines || [];
  const isPending = reservation?.status === 'pending';
  const isAccepted = reservation?.status === 'accepted';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Reservation Request" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
        {/* Status Card */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>Current Status</Text>
          <View style={styles.statusRow}>
            <Badge 
              label={reservation?.status || 'pending'} 
              status={
                reservation?.status === 'accepted' ? 'success' : 
                reservation?.status === 'pending' ? 'warning' : 
                reservation?.status === 'declined' ? 'error' : 'success'
              } 
            />
          </View>
        </Card>

        {/* Patient Details */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Patient Information</Text>
          <Text style={[styles.patientName, { color: theme.text.primary }]}>
            👤 {patient?.full_name || 'Patient'}
          </Text>
          {patient?.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${patient.phone}`)}>
              <Text style={[styles.phoneLink, { color: theme.pharmacy.primary }]}>
                📞 {patient.phone} (Call Patient)
              </Text>
            </Pressable>
          )}
        </Card>

        {/* Medicines Reserved */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Requested Medicines</Text>
          {items.map((item: any, idx: number) => (
            <View key={idx} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.itemName, { color: theme.text.primary }]}>
                  {item.name} {item.strength || ''}
                </Text>
                <Text style={[styles.itemQty, { color: theme.text.secondary }]}>
                  Qty: {item.quantity}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: theme.text.primary }]}>
                GH₵ {(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.text.primary }]}>Total Cost</Text>
            <Text style={[styles.totalVal, { color: theme.pharmacy.primary }]}>
              GH₵ {Number(reservation?.total_cost || 0).toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Action Controls */}
        {isPending && (
          <View style={styles.btnRow}>
            <Button 
              title="Accept Request" 
              loading={updating}
              onPress={() => updateStatus('accepted')}
              style={{ flex: 1 }}
            />
            <Button 
              title="Decline" 
              variant="outline"
              loading={updating}
              onPress={() => updateStatus('declined')}
              style={{ flex: 1, borderColor: theme.error }}
              textStyle={{ color: theme.error }}
            />
          </View>
        )}

        {isAccepted && (
          <Button 
            title="Mark as Collected" 
            loading={updating}
            onPress={() => updateStatus('collected')}
            style={styles.collectedBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
  },
  card: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusRow: {
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  patientName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  phoneLink: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 40,
  },
  collectedBtn: {
    marginTop: 16,
    marginBottom: 40,
    width: '100%',
  },
});
