import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  Pressable 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLocationStore } from '@/store/locationStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import MapView, { Marker } from 'react-native-maps';

export default function Pharmacies() {
  const router = useRouter();
  const { coords, requestLocationPermission } = useLocationStore();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestLocationPermission().then((currentCoords) => {
      fetchPharmacies();
    });
  }, []);

  const fetchPharmacies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*');

      if (error || !data || data.length === 0) {
        setPharmacies([
          { id: 'p1', name: 'MediPlus Pharmacy', phone: '+1 555 101 2020', address: '45 Wellness Blvd, Midtown', latitude: 5.6037, longitude: -0.1870 },
          { id: 'p2', name: 'City Care Pharmacy', phone: '+1 555 202 3030', address: '12 Health Plaza, Downtown', latitude: 5.6100, longitude: -0.1800 },
          { id: 'p3', name: 'St. Jude Pharmacare', phone: '+1 555 303 4040', address: '88 Cure Avenue, Northside', latitude: 5.5950, longitude: -0.1920 },
          { id: 'p4', name: 'Alpha Health Services', phone: '+1 555 404 5050', address: '303 Biotech Lane, East End', latitude: 5.6200, longitude: -0.1700 }
        ]);
      } else {
        setPharmacies(data);
      }
    } catch (e) {
      console.error('Error fetching pharmacies:', e);
      setPharmacies([
        { id: 'p1', name: 'MediPlus Pharmacy', phone: '+1 555 101 2020', address: '45 Wellness Blvd, Midtown', latitude: 5.6037, longitude: -0.1870 },
        { id: 'p2', name: 'City Care Pharmacy', phone: '+1 555 202 3030', address: '12 Health Plaza, Downtown', latitude: 5.6100, longitude: -0.1800 },
        { id: 'p3', name: 'St. Jude Pharmacare', phone: '+1 555 303 4040', address: '88 Cure Avenue, Northside', latitude: 5.5950, longitude: -0.1920 },
        { id: 'p4', name: 'Alpha Health Services', phone: '+1 555 404 5050', address: '303 Biotech Lane, East End', latitude: 5.6200, longitude: -0.1700 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPharmacies = pharmacies.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const defaultRegion = {
    latitude: coords?.latitude || 5.6037,
    longitude: coords?.longitude || -0.1870,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const renderPharmacyItem = ({ item }: { item: any }) => {
    return (
      <Pressable onPress={() => router.push(`/(patient)/pharmacy/${item.id}`)}>
        <Card style={styles.pharmacyCard}>
          <View style={styles.pharmacyInfoRow}>
            <Text style={[styles.pharmacyName, { color: theme.text.primary }]}>{item.name}</Text>
            <View style={[styles.badge, { backgroundColor: theme.patient.secondary }]}>
              <Text style={[styles.badgeText, { color: theme.patient.primary }]}>Open</Text>
            </View>
          </View>
          <Text style={[styles.pharmacyDetails, { color: theme.text.secondary }]}>
            📍 {item.address || 'Accra, Ghana'}
          </Text>
          <Text style={[styles.pharmacyDetails, { color: theme.text.secondary }]}>
            📞 {item.phone || 'N/A'}
          </Text>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header 
        title="Pharmacies Finder" 
        rightElement={
          <Pressable 
            onPress={() => setViewMode(prev => prev === 'list' ? 'map' : 'list')} 
            style={styles.toggleBtn}
          >
            <Ionicons 
              name={viewMode === 'list' ? 'map-outline' : 'list-outline'} 
              size={20} 
              color={theme.patient.primary} 
            />
          </Pressable>
        }
      />

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={20} color={theme.text.muted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text.primary }]}
          placeholder="Search by name or address..."
          placeholderTextColor={theme.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Render View Mode */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={defaultRegion}
            showsUserLocation
          >
            {/* User Location Marker */}
            {coords && (
              <Marker
                coordinate={coords}
                title="Your Location"
                pinColor="blue"
              />
            )}
            
            {/* Pharmacy Markers */}
            {filteredPharmacies.map((p) => {
              if (!p.latitude || !p.longitude) return null;
              return (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                  title={p.name}
                  description={p.address || ''}
                  onCalloutPress={() => router.push(`/(patient)/pharmacy/${p.id}`)}
                />
              );
            })}
          </MapView>
        </View>
      ) : (
        <FlatList
          data={filteredPharmacies}
          renderItem={renderPharmacyItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No pharmacies found.
            </Text>
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
  toggleBtn: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  pharmacyCard: {
    marginBottom: 12,
  },
  pharmacyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  pharmacyDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
