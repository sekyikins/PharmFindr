import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';

export default function MedicinesSearch() {
  const { query } = useLocalSearchParams<{ query?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedicines();
  }, [query]);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      // Query the inventory to find matches along with their pharmacy details
      const { data, error } = await supabase
        .from('inventory')
        .select('*, pharmacies(name, address, verified)')
        .ilike('medicine_name', `%${query || ''}%`);

      if (error) throw error;
      setResults(data || []);
    } catch (e) {
      console.error('Error searching medicines:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <Pressable onPress={() => router.push(`/(patient)/pharmacy/${item.pharmacy_id}`)}>
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={[styles.medName, { color: theme.text.primary }]}>
              {item.medicine_name} {item.strength || ''}
            </Text>
            <Text style={[styles.price, { color: theme.patient.primary }]}>
              GH₵ {Number(item.price).toFixed(2)}
            </Text>
          </View>
          
          <Text style={[styles.pharmacyName, { color: theme.text.secondary }]}>
            🏥 Store: {item.pharmacies?.name || 'Unknown Pharmacy'}
          </Text>
          
          <Text style={[styles.address, { color: theme.text.muted }]}>
            📍 {item.pharmacies?.address || 'Address N/A'}
          </Text>

          <View style={styles.footer}>
            <Badge 
              label={item.quantity > 0 ? 'In Stock' : 'Out of Stock'} 
              status={item.quantity > 0 ? 'success' : 'error'} 
            />
            <Text style={[styles.stockText, { color: theme.text.secondary }]}>
              Qty: {item.quantity} available
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={`Search: "${query || ''}"`} showBack />

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={theme.patient.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                No matching medicines found in nearby pharmacies.
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.text.muted }]}>
                Try searching for another product name or checking spelling.
              </Text>
            </View>
          }
        />
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
  listContent: {
    padding: 24,
  },
  card: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medName: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pharmacyName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  stockText: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
});
