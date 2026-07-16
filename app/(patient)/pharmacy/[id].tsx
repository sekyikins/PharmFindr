import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  Linking,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function PharmacyDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [pharmacy, setPharmacy] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchPharmacyData();
  }, [id]);

  const fetchPharmacyData = async () => {
    setLoading(true);
    try {
      // Fetch Pharmacy Details
      const { data: pharmacyData, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('id', id)
        .single();

      if (pharmErr) throw pharmErr;
      setPharmacy(pharmacyData);

      // Fetch Inventory List for this Pharmacy
      const { data: inventoryData, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('pharmacy_id', id);

      if (invErr) throw invErr;
      setInventory(inventoryData || []);
    } catch (e) {
      console.error('Error fetching pharmacy details:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[itemId]) {
        delete copy[itemId];
      } else {
        copy[itemId] = 1;
      }
      return copy;
    });
  };

  const handleUpdateQty = (itemId: string, increment: boolean, maxQty: number) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      const current = copy[itemId] || 0;
      if (increment) {
        copy[itemId] = Math.min(current + 1, maxQty);
      } else {
        copy[itemId] = Math.max(current - 1, 1);
      }
      return copy;
    });
  };

  const handleReserve = async () => {
    const itemsToReserve = Object.keys(selectedItems).map(itemId => {
      const item = inventory.find(i => i.id === itemId);
      return {
        id: item.id,
        name: item.medicine_name,
        strength: item.strength || '',
        quantity: selectedItems[itemId],
        price: item.price
      };
    });

    if (itemsToReserve.length === 0) return;

    setReserving(true);
    try {
      const totalCost = itemsToReserve.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          user_id: user?.id,
          pharmacy_id: id,
          medicines: itemsToReserve,
          total_cost: totalCost,
          status: 'pending',
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours from now
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/(patient)/reservation/${data.id}`);
    } catch (e) {
      console.error('Error creating reservation:', e);
    } finally {
      setReserving(false);
    }
  };

  const handleNavigate = () => {
    if (!pharmacy?.latitude || !pharmacy?.longitude) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${pharmacy.latitude},${pharmacy.longitude}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.patient.primary} />
      </SafeAreaView>
    );
  }

  const selectedCount = Object.keys(selectedItems).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={pharmacy?.name || 'Pharmacy details'} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Detail Info Card */}
        <Card style={styles.detailCard}>
          <Text style={[styles.title, { color: theme.text.primary }]}>{pharmacy?.name}</Text>
          <Text style={[styles.address, { color: theme.text.secondary }]}>📍 {pharmacy?.address || 'Address N/A'}</Text>
          <Text style={[styles.phone, { color: theme.text.secondary }]}>📞 {pharmacy?.phone || 'Phone N/A'}</Text>
          <Text style={[styles.hours, { color: theme.text.secondary }]}>
            🕒 Hours: {pharmacy?.opening_time || '08:00'} - {pharmacy?.closing_time || '20:00'}
          </Text>

          <View style={styles.badgeRow}>
            <Badge label={pharmacy?.verified ? 'Verified' : 'Pending Verification'} status={pharmacy?.verified ? 'success' : 'warning'} />
          </View>

          <Button 
            title="Navigate in Google Maps" 
            variant="outline" 
            onPress={handleNavigate}
            style={styles.navigateBtn}
          />
        </Card>

        {/* Medicines Section */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Available Medicines</Text>
        
        {inventory.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No inventory updated yet.</Text>
        ) : (
          inventory.map((item) => {
            const isSelected = !!selectedItems[item.id];
            const selectedQty = selectedItems[item.id] || 0;
            return (
              <Card key={item.id} style={[styles.medItemCard, isSelected && { borderColor: theme.patient.primary }]}>
                <View style={styles.medRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.medName, { color: theme.text.primary }]}>
                      {item.medicine_name} {item.strength || ''}
                    </Text>
                    <Text style={[styles.medPrice, { color: theme.patient.primary }]}>
                      GH₵ {item.price}
                    </Text>
                    <Text style={[styles.medQty, { color: theme.text.secondary }]}>
                      Stock: {item.quantity} available
                    </Text>
                  </View>

                  {/* Quantity selector or checkbox */}
                  <View style={styles.actionColumn}>
                    {isSelected ? (
                      <View style={styles.qtyContainer}>
                        <Pressable 
                          onPress={() => handleUpdateQty(item.id, false, item.quantity)}
                          style={[styles.qtyBtn, { backgroundColor: theme.surfaceSecondary }]}
                        >
                          <Text style={{ color: theme.text.primary, fontWeight: 'bold' }}>-</Text>
                        </Pressable>
                        <Text style={[styles.qtyText, { color: theme.text.primary }]}>{selectedQty}</Text>
                        <Pressable 
                          onPress={() => handleUpdateQty(item.id, true, item.quantity)}
                          style={[styles.qtyBtn, { backgroundColor: theme.surfaceSecondary }]}
                        >
                          <Text style={{ color: theme.text.primary, fontWeight: 'bold' }}>+</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable 
                        onPress={() => handleToggleSelect(item.id, item.quantity)}
                        style={[styles.selectBtn, { backgroundColor: theme.patient.primary }]}
                      >
                        <Text style={styles.selectBtnText}>Add</Text>
                      </Pressable>
                    )}
                    
                    {isSelected && (
                      <Pressable onPress={() => handleToggleSelect(item.id, item.quantity)} style={styles.removeBtn}>
                        <Text style={[styles.removeBtnText, { color: theme.error }]}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Floating reservation button */}
      {selectedCount > 0 && (
        <View style={[styles.floatingFooter, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <Button 
            title={reserving ? 'Reserving...' : `Request Reservation (${selectedCount} items)`}
            loading={reserving}
            onPress={handleReserve}
            style={styles.reserveBtn}
          />
        </View>
      )}
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
    paddingBottom: 100, // Padding for floating button
  },
  detailCard: {
    padding: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  address: {
    fontSize: 13,
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    marginBottom: 4,
  },
  hours: {
    fontSize: 13,
    marginBottom: 12,
  },
  badgeRow: {
    marginBottom: 16,
  },
  navigateBtn: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  medItemCard: {
    marginBottom: 12,
    borderWidth: 1.5,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  medPrice: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  medQty: {
    fontSize: 12,
  },
  actionColumn: {
    alignItems: 'center',
    gap: 8,
  },
  selectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeBtn: {
    paddingVertical: 2,
  },
  removeBtnText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
  },
  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  reserveBtn: {
    width: '100%',
  },
});
