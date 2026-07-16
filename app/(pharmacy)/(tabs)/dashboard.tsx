import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Dummy data
const DUMMY_PHARMACY = {
  name: 'City Care Pharmacy',
};
const DUMMY_STATS = {
  medicines: 142,
  active: 8,
  pending: 3,
};

const GREEN = '#10b981';
const GREEN_DARK = '#059669';

export default function Dashboard() {
  const router = useRouter();
  const [pharmacy] = useState(DUMMY_PHARMACY);
  const [stats] = useState(DUMMY_STATS);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ─── Green Hero Header ─── */}
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            {/* Left: welcome text */}
            <View style={styles.heroLeft}>
              <Text style={styles.welcomeBack}>Welcome back</Text>
              <Text style={styles.pharmName}>{pharmacy.name}</Text>
            </View>
            {/* Right: profile icon button */}
            <Pressable
              style={styles.profileBtn}
              onPress={() => router.push('/(pharmacy)/(tabs)/profile')}
            >
              <Ionicons name="person-outline" size={20} color={GREEN} />
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.medicines}</Text>
              <Text style={styles.statLabel}>Medicines</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.active}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* Wave curve at bottom of hero */}
          <View style={styles.wave} />
        </View>

        {/* ─── Action Buttons ─── */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: GREEN }]}
            onPress={() => router.push('/(pharmacy)/(tabs)/inventory')}
          >
            <Ionicons name="add-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Add Medicine</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
            onPress={() => router.push('/(pharmacy)/upload-inventory')}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Upload CSV</Text>
          </Pressable>
        </View>

        {/* ─── Navigation Cards ─── */}
        <NavCard
          icon="cube-outline"
          iconBg="#ede9fe"
          iconColor="#7c3aed"
          title="Inventory"
          subtitle={`${stats.medicines} medicines · 4 low stock`}
          onPress={() => router.push('/(pharmacy)/(tabs)/inventory')}
        />

        <NavCard
          icon="calendar-outline"
          iconBg="#fff3e0"
          iconColor="#f97316"
          title="Reservations"
          subtitle={`${stats.pending} pending · 5 accepted today`}
          onPress={() => router.push('/(pharmacy)/(tabs)/reservations')}
        />

        <NavCard
          icon="settings-outline"
          iconBg="#e6f7f1"
          iconColor={GREEN}
          title="Pharmacy Profile"
          subtitle="Open 8 AM – 10 PM"
          onPress={() => router.push('/(pharmacy)/(tabs)/profile')}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

function NavCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.navCard} onPress={onPress}>
      <View style={[styles.navIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.navCardText}>
        <Text style={styles.navCardTitle}>{title}</Text>
        <Text style={styles.navCardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 40,
  },

  // ── Hero ──
  hero: {
    backgroundColor: GREEN,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 0,
    marginBottom: 0,
    overflow: 'hidden',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroLeft: {
    flex: 1,
  },
  welcomeBack: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  pharmName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 4,
  },
  statNum: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // Wave
  wave: {
    height: 28,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 16,
  },

  // ── Action Buttons ──
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 14,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Nav Cards ──
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  navIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  navCardText: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  navCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
});
