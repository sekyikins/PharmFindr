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
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function ReservationConfirmation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [reservation, setReservation] = useState<any>(null);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservation();

    // Subscribe to reservation changes in real-time!
    const channel = supabase
      .channel(`reservation-update-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime reservation update:', payload.new);
          setReservation(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      if (resData?.pharmacy_id) {
        const { data: pharmData, error: pharmErr } = await supabase
          .from('pharmacies')
          .select('*')
          .eq('id', resData.pharmacy_id)
          .single();

        if (pharmErr) throw pharmErr;
        setPharmacy(pharmData);
      }
    } catch (e) {
      console.error('Error fetching reservation details:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'accepted':
        return { label: 'Confirmed', type: 'success' as const };
      case 'declined':
        return { label: 'Declined', type: 'error' as const };
      case 'expired':
        return { label: 'Expired', type: 'default' as const };
      case 'collected':
        return { label: 'Collected', type: 'success' as const };
      case 'pending':
      default:
        return { label: 'Pending Confirmation', type: 'warning' as const };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.patient.primary} />
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusDetails(reservation?.status || 'pending');
  const items = reservation?.medicines || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title="Reservation Details" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <Text style={[styles.statusLabel, { color: theme.text.secondary }]}>Status</Text>
          <Badge label={statusInfo.label} status={statusInfo.type} style={styles.badge} />
          
          {reservation?.status === 'pending' && (
            <Text style={[styles.pendingTip, { color: theme.text.secondary }]}>
              Waiting for pharmacy to confirm. We'll update this page in real-time as soon as they respond!
            </Text>
          )}

          {reservation?.status === 'accepted' && (
            <View style={styles.confirmDetails}>
              <Text style={[styles.successTitle, { color: theme.success }]}>
                ABC Pharmacy confirmed your reservation!
              </Text>
              <Text style={[styles.expiryText, { color: theme.text.primary }]}>
                Please collect your medicines before:{'\n'}
                <Text style={{ fontWeight: 'bold' }}>
                  {new Date(reservation.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Text>
            </View>
          )}
        </Card>

        {/* Pharmacy Details */}
        <Card style={styles.pharmCard}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Pharmacy Information</Text>
          <Text style={[styles.pharmName, { color: theme.text.primary }]}>{pharmacy?.name}</Text>
          <Text style={[styles.pharmInfo, { color: theme.text.secondary }]}>📍 {pharmacy?.address}</Text>
          {pharmacy?.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${pharmacy.phone}`)}>
              <Text style={[styles.pharmInfo, { color: theme.patient.primary, textDecorationLine: 'underline' }]}>
                📞 {pharmacy.phone} (Call Pharmacy)
              </Text>
            </Pressable>
          )}
        </Card>

        {/* Reservation Items */}
        <Card style={styles.itemsCard}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Medicines Reserved</Text>
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
            <Text style={[styles.totalLabel, { color: theme.text.primary }]}>Estimated Cost</Text>
            <Text style={[styles.totalVal, { color: theme.patient.primary }]}>
              GH₵ {Number(reservation?.total_cost || 0).toFixed(2)}
            </Text>
          </View>
        </Card>

        <Button 
          title="Back to Home" 
          onPress={() => router.replace('/(patient)/(tabs)/home')} 
          style={styles.homeBtn}
        />
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
  statusCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingTip: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  confirmDetails: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  pharmCard: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  pharmName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  pharmInfo: {
    fontSize: 12,
    marginVertical: 2,
  },
  itemsCard: {
    marginBottom: 24,
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
  homeBtn: {
    width: '100%',
    marginBottom: 40,
  },
});
