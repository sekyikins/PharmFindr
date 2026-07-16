import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  TextInput, 
  FlatList 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { coords, requestLocationPermission } = useLocationStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyPharmacies, setNearbyPharmacies] = useState<any[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  useEffect(() => {
    // Request location immediately on home mount
    requestLocationPermission().then((userCoords) => {
      if (userCoords) {
        fetchNearbyPharmacies(userCoords.latitude, userCoords.longitude);
      } else {
        // Fallback or fetch all pharmacies
        fetchNearbyPharmacies(5.6037, -0.1870); // Default to Accra coordinates
      }
    });
  }, []);

  const fetchNearbyPharmacies = async (lat: number, lng: number) => {
    setLoadingPharmacies(true);
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .limit(3);

      if (error || !data || data.length === 0) {
        // Fallback to dummy data
        setNearbyPharmacies([
          { id: 'p1', name: 'MediPlus Pharmacy', phone: '+1 555 101 2020', address: '45 Wellness Blvd, Midtown', latitude: 5.6037, longitude: -0.1870 },
          { id: 'p2', name: 'City Care Pharmacy', phone: '+1 555 202 3030', address: '12 Health Plaza, Downtown', latitude: 5.6100, longitude: -0.1800 },
          { id: 'p3', name: 'St. Jude Pharmacare', phone: '+1 555 303 4040', address: '88 Cure Avenue, Northside', latitude: 5.5950, longitude: -0.1920 }
        ]);
      } else {
        setNearbyPharmacies(data);
      }
    } catch (e) {
      console.error('Error fetching pharmacies:', e);
      setNearbyPharmacies([
        { id: 'p1', name: 'MediPlus Pharmacy', phone: '+1 555 101 2020', address: '45 Wellness Blvd, Midtown', latitude: 5.6037, longitude: -0.1870 },
        { id: 'p2', name: 'City Care Pharmacy', phone: '+1 555 202 3030', address: '12 Health Plaza, Downtown', latitude: 5.6100, longitude: -0.1800 },
        { id: 'p3', name: 'St. Jude Pharmacare', phone: '+1 555 303 4040', address: '88 Cure Avenue, Northside', latitude: 5.5950, longitude: -0.1920 }
      ]);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    router.push({
      pathname: '/(patient)/medicines',
      params: { query: searchQuery }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.text.secondary }]}>Hello,</Text>
            <Text style={[styles.name, { color: theme.text.primary }]}>
              {profile?.full_name || 'Valued Patient'}
            </Text>
          </View>
          <Pressable 
            style={[styles.profileButton, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push('/(patient)/(tabs)/profile')}
          >
            <Ionicons name="person" size={20} color={theme.patient.primary} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
          <Ionicons name="search" size={20} color={theme.text.muted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search medicine name..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>

        {/* Quick Actions Grid */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Quick Actions</Text>
        <View style={styles.grid}>
          {/* Action 1: Scan Prescription */}
          <Pressable 
            style={[styles.gridItem, { backgroundColor: theme.patient.secondary }]}
            onPress={() => router.push('/(patient)/scan')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="camera" size={32} color={theme.patient.primary} />
            </View>
            <Text style={[styles.gridTitle, { color: theme.text.primary }]}>Scan Prescription</Text>
            <Text style={[styles.gridDesc, { color: theme.text.secondary }]}>Identify meds instantly</Text>
          </Pressable>

          {/* Action 2: Chat with AI */}
          <Pressable 
            style={[styles.gridItem, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.replace('/(patient)/(tabs)/chat')}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="chatbubbles" size={32} color={theme.patient.primary} />
            </View>
            <Text style={[styles.gridTitle, { color: theme.text.primary }]}>Ask AI Assistant</Text>
            <Text style={[styles.gridDesc, { color: theme.text.secondary }]}>dosage, usage details</Text>
          </Pressable>
        </View>

        {/* Nearby Pharmacies Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Nearby Pharmacies</Text>
          <Pressable onPress={() => router.replace('/(patient)/(tabs)/pharmacies')}>
            <Text style={[styles.seeAll, { color: theme.patient.primary }]}>See All</Text>
          </Pressable>
        </View>

        {loadingPharmacies ? (
          <Text style={{ color: theme.text.secondary, textAlign: 'center', marginTop: 12 }}>Loading...</Text>
        ) : nearbyPharmacies.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              No pharmacies registered near you yet.
            </Text>
          </Card>
        ) : (
          nearbyPharmacies.map((item) => (
            <Pressable 
              key={item.id} 
              onPress={() => router.push(`/(patient)/pharmacy/${item.id}`)}
            >
              <Card style={styles.pharmacyCard}>
                <View style={styles.pharmacyHeader}>
                  <Text style={[styles.pharmacyName, { color: theme.text.primary }]}>
                    {item.name}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: theme.patient.secondary }]}>
                    <Text style={[styles.badgeText, { color: theme.patient.primary }]}>Active</Text>
                  </View>
                </View>
                <Text style={[styles.pharmacyInfo, { color: theme.text.secondary }]}>
                  📞 {item.phone || 'No phone'} | 📍 {item.address || 'Address pending'}
                </Text>
              </Card>
            </Pressable>
          ))
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
  },
  gridItem: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gridDesc: {
    fontSize: 11,
  },
  pharmacyCard: {
    marginVertical: 6,
  },
  pharmacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  pharmacyInfo: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
