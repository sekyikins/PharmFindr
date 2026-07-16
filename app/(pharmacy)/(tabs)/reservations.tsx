import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const GREEN = '#10b981';

type ResStatus = 'pending' | 'accepted' | 'declined';

interface Reservation {
  id: string;
  ref: string;
  patientId: string;
  timeAgo: string;
  medicines: string[];
  status: ResStatus;
}

// Dummy reservation data matching the Figma design
const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: '1',
    ref: 'REF-001',
    patientId: '#4821',
    timeAgo: '10 min ago',
    medicines: ['Amoxicillin 500mg', 'Paracetamol 500mg'],
    status: 'pending',
  },
  {
    id: '2',
    ref: 'REF-002',
    patientId: '#3319',
    timeAgo: '25 min ago',
    medicines: ['Metformin 850mg'],
    status: 'pending',
  },
  {
    id: '3',
    ref: 'REF-003',
    patientId: '#7755',
    timeAgo: '1 hr ago',
    medicines: ['Lisinopril 10mg', 'Atorvastatin 20mg'],
    status: 'pending',
  },
];

export default function Reservations() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);

  const handleAccept = (id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r))
    );
  };

  const handleDecline = (id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'declined' } : r))
    );
  };

  const renderItem = ({ item }: { item: Reservation }) => {
    const isPending = item.status === 'pending';
    const isAccepted = item.status === 'accepted';
    const isDeclined = item.status === 'declined';

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientId}>Patient {item.patientId}</Text>
            <Text style={styles.refText}>
              {item.ref} · {item.timeAgo}
            </Text>
          </View>
          {/* Status badge (only when not pending) */}
          {isAccepted && (
            <View style={styles.badgeAccepted}>
              <Text style={styles.badgeAcceptedText}>Accepted</Text>
            </View>
          )}
          {isDeclined && (
            <View style={styles.badgeDeclined}>
              <Text style={styles.badgeDeclinedText}>Declined</Text>
            </View>
          )}
        </View>

        {/* Medicine chips */}
        <View style={styles.chipsRow}>
          {item.medicines.map((med, idx) => (
            <View key={idx} style={styles.chip}>
              <Text style={styles.chipText}>{med}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons (pending only) */}
        {isPending && (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.acceptBtn}
              onPress={() => handleAccept(item.id)}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              style={styles.declineBtn}
              onPress={() => handleDecline(item.id)}
            >
              <Ionicons name="close" size={15} color="#ef4444" />
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.push('/(pharmacy)/(tabs)/dashboard')}
        >
          <Ionicons name="arrow-back" size={18} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Reservations</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No reservation requests.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },

  listContent: { padding: 20, gap: 12 },

  // ── Card ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  patientId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  refText: { fontSize: 12, color: '#94a3b8' },

  // ── Status Badges ──
  badgeAccepted: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeAcceptedText: { fontSize: 11, fontWeight: '600', color: GREEN },
  badgeDeclined: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeDeclinedText: { fontSize: 11, fontWeight: '600', color: '#ef4444' },

  // ── Medicine Chips ──
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },

  // ── Action Buttons ──
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 24,
    backgroundColor: GREEN,
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 24,
    backgroundColor: '#fee2e2',
  },
  declineBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontSize: 13 },
});
