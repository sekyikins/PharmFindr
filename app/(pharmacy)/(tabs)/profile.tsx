import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

const GREEN = '#10b981';

// Dummy pharmacy profile data
const DUMMY_PROFILE = {
  pharmacyName: 'City Care Pharmacy',
  address: '12 Health Avenue, Downtown',
  phone: '+1 555-0101',
  openingTime: '8:00 AM',
  closingTime: '10:00 PM',
};

export default function PharmacyProfile() {
  const router = useRouter();
  const { signOut } = useAuthStore();

  const [pharmacyName, setPharmacyName] = useState(DUMMY_PROFILE.pharmacyName);
  const [address, setAddress] = useState(DUMMY_PROFILE.address);
  const [phone, setPhone] = useState(DUMMY_PROFILE.phone);
  const [openingTime, setOpeningTime] = useState(DUMMY_PROFILE.openingTime);
  const [closingTime, setClosingTime] = useState(DUMMY_PROFILE.closingTime);

  const handleSave = () => {
    Alert.alert('Saved', 'Pharmacy profile updated successfully!');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
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
        <Text style={styles.headerTitle}>Pharmacy Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Avatar / Icon ── */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Ionicons name="shield-checkmark-outline" size={28} color={GREEN} />
          </View>
        </View>

        {/* ── Fields ── */}
        <ProfileField
          label="PHARMACY NAME"
          value={pharmacyName}
          onChange={setPharmacyName}
          placeholder="City Care Pharmacy"
        />
        <ProfileField
          label="ADDRESS"
          value={address}
          onChange={setAddress}
          placeholder="12 Health Avenue, Downtown"
        />
        <ProfileField
          label="PHONE NUMBER"
          value={phone}
          onChange={setPhone}
          placeholder="+1 555-0101"
          keyboardType="phone-pad"
        />
        <ProfileField
          label="OPENING TIME"
          value={openingTime}
          onChange={setOpeningTime}
          placeholder="8:00 AM"
        />
        <ProfileField
          label="CLOSING TIME"
          value={closingTime}
          onChange={setClosingTime}
          placeholder="10:00 PM"
        />

        {/* ── Save Button ── */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>

        {/* ── Sign Out ── */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.inputRow}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType || 'default'}
        />
        <Ionicons name="pencil-outline" size={14} color="#94a3b8" />
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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

  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },

  // ── Avatar ──
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Save Button ──
  saveBtn: {
    backgroundColor: GREEN,
    height: 52,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Sign Out ──
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});
