import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import OtpInput, { type OtpInputHandle } from '@/components/ui/OtpInput';
import MapComponent from '@/components/MapComponent';
import { type KnownPharmacy, type RegisteredPharmacy } from '@/types/map';
import { sendArkeselOtp, verifyArkeselOtp, validateGhanaPhone } from '@/lib/arkeselSms';
import { useAuthStore, PHARMACY_PASS } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import * as Location from 'expo-location';
import { fetchAddressForCoords, fetchGoogleMapsPharmaciesForRegistration } from '@/lib/googlePlaces';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { toast } from '@/context/ToastContext';

const GREEN = COLORS.pharmacyPrimary;
const INPUT_BG = COLORS.surface;
const TEXT_PRIMARY = COLORS.textDark;
const LABEL_COLOR = COLORS.textMuted;
const PLACEHOLDER_COLOR = COLORS.textDim;

import { getFriendlyErrorMessage } from '@/lib/errorUtils';

function getFriendlyPharmacyErrorMessage(err: any, defaultMsg = 'Operation failed.'): string {
  const message = err?.message || String(err || '');
  if (/already registered|already exists|unique constraint|duplicate/i.test(message)) {
    return 'A pharmacy account already exists with these details. Please login instead.';
  }
  return getFriendlyErrorMessage(err, defaultMsg);
}

// ── Shared Hero header ────────────────────────────────────────────────────
function Hero({ step, onBack }: { step: 1 | 2 | 3 | 4; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const stepTitles = [
    'Pharmacy Details',
    'Select Location',
    'Phone Verification',
    'Confirm Verification Code',
  ];
  return (
    <>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={hero.safe}>
          <Pressable onPress={onBack} style={({ pressed }) => [hero.backBtn, pressed && { opacity: 0.5 }]}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
            <Text style={hero.backText}>Back</Text>
          </Pressable>
          <Text style={hero.stepText}>STEP {step} OF 4</Text>
          <Text style={hero.title}>{stepTitles[step - 1]}</Text>
          <Text style={hero.sub}>Join the PharmFindr verified pharmacy network</Text>
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
          <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={COLORS.white} />
        </Svg>
      </View>
    </>
  );
}

const hero = StyleSheet.create({
  safe: {
    paddingHorizontal: SPACING.xxl, paddingTop: SPACING.md, paddingBottom: SPACING.xl
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', padding: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: SPACING.md
  },
  backText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold', color: COLORS.white, marginLeft: 6
  },
  stepText: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', color: 'rgba(255,255,255,0.75)', letterSpacing: 1, marginBottom: 2
  },
  title: {
    fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 2
  },
  sub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.85)'
  },

});

// ── Shared Field Components ────────────────────────────────────────────────
function FieldLabel({ children }: { children: string }) {
  return <Text style={f.label}>{children}</Text>;
}

function InputRow({
  icon,
  placeholder,
  value,
  onChange,
  keyboard = 'default',
  returnKeyType = 'done',
  inputRef,
  onSubmitEditing,
}: {
  icon: any;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: any;
  returnKeyType?: any;
  inputRef?: any;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={f.row}>
      <Ionicons name={icon} size={16} color={PLACEHOLDER_COLOR} style={f.icon} />
      <TextInput
        ref={inputRef}
        style={f.input}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

function PrimaryBtn({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [btn.base, pressed && { opacity: 0.5 }, { backgroundColor: GREEN }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={btn.text}>{label}</Text>}
    </Pressable>
  );
}

const f = StyleSheet.create({
  label: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', color: LABEL_COLOR, letterSpacing: 0.5, marginBottom: SPACING.sm, textTransform: 'uppercase'
  },
  row: {
    backgroundColor: INPUT_BG, borderRadius: RADIUS.xl, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  icon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
    flex: 1, fontSize: FONT_SIZE.lg, color: TEXT_PRIMARY, height: '100%'
  },
});

const btn = StyleSheet.create({
  base: {
    height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xxl
  },
  text: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
});

// ══ STEP 1: Pharmacy Name, Email ══════════════════════════════════════════
function Step1Details({
  name,
  email,
  onNext,
  onBack,
}: {
  name: string;
  email: string;
  onNext: (name: string, email: string) => void;
  onBack: () => void;
}) {
  const [valName, setValName] = useState(name);
  const [valEmail, setValEmail] = useState(email);

  const handleNext = () => {
    if (!valName.trim()) {
      toast.error('Please enter your pharmacy business name.');
      return;
    }
    if (valEmail.trim() && !/\S+@\S+\.\S+/.test(valEmail.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    onNext(valName.trim(), valEmail.trim());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Hero step={1} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>Register your pharmacy to manage stock and connect with local customers.</Text>

          <FieldLabel>PHARMACY NAME</FieldLabel>
          <InputRow
            icon="business-outline"
            placeholder="e.g. HealthPlus Pharmacy"
            value={valName}
            onChange={(text) => setValName(text)}
            returnKeyType="next"
          />

          <View style={{ marginTop: 14 }}>
            <FieldLabel>CONTACT EMAIL (OPTIONAL)</FieldLabel>
            <InputRow
              icon="mail-outline"
              placeholder="pharmacy@example.com"
              value={valEmail}
              onChange={(text) => setValEmail(text)}
              keyboard="email-address"
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
          </View>

          <PrimaryBtn label="Continue to Map Setup" onPress={handleNext} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ══ STEP 2: Interactive Location Map Picker ══════════════════════════════
function Step2Location({
  pharmName,
  pharmAddress,
  onUpdatePharmDetails,
  onDone,
  onBack,
}: {
  pharmName: string;
  pharmAddress: string;
  onUpdatePharmDetails?: (name: string, address: string) => void;
  onDone: (pin: { latitude: number; longitude: number }, address: string, isFromKnownMap: boolean) => void;
  onBack: () => void;
}) {
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [valAddress, setValAddress] = useState(pharmAddress);
  const [isAddressFetching, setIsAddressFetching] = useState(false);
  const [selectedKnownPharmacy, setSelectedKnownPharmacy] = useState<KnownPharmacy | null>(null);
  const [knownPharmacies, setKnownPharmacies] = useState<KnownPharmacy[]>([]);
  const [registeredPharmacies, setRegisteredPharmacies] = useState<RegisteredPharmacy[]>([]);
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapDataLoading, setMapDataLoading] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPharmaciesForArea = async (lat: number, lon: number, radiusMeters = 10000) => {
    try {
      const gList = await fetchGoogleMapsPharmaciesForRegistration({ latitude: lat, longitude: lon }, radiusMeters);
      if (gList && gList.length > 0) {
        const regIds = new Set(registeredPharmacies.map((r) => r.id));
        const newKnown: KnownPharmacy[] = gList
          .filter((p) => !regIds.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
          }));

        setKnownPharmacies((prev) => {
          const existingIds = new Set(prev.map((k) => k.id));
          const toAdd = newKnown.filter((k) => !existingIds.has(k.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }
    } catch (e: any) {
      console.warn('Google Maps pharmacy fetch notice:', e.message);
    }
  };

  const handleRegionChangeComplete = (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      const radiusMeters = Math.min(Math.max((region.latitudeDelta || 0.05) * 111000 / 2, 5000), 50000);
      fetchPharmaciesForArea(region.latitude, region.longitude, radiusMeters);
    }, 400);
  };

  const updateAddressForPin = async (coords: { latitude: number; longitude: number }, knownAddr?: string) => {
    if (knownAddr && knownAddr !== 'Public Map Address' && knownAddr !== 'Address registered in database' && knownAddr !== 'Google Maps Location') {
      setValAddress(knownAddr);
      return;
    }
    setIsAddressFetching(true);
    try {
      const fetched = await fetchAddressForCoords(coords);
      if (fetched) {
        setValAddress(fetched);
      } else {
        const [geo] = await Location.reverseGeocodeAsync(coords);
        if (geo) {
          const parts = [geo.street || geo.name, geo.district || geo.subregion, geo.city, geo.region].filter(Boolean);
          const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
          if (uniqueParts.length > 0) setValAddress(uniqueParts.join(', '));
        }
      }
    } catch (e: any) {
      console.warn('Address reverse lookup notice:', e.message);
    } finally {
      setIsAddressFetching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setMapDataLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let centerLat = 5.6037;
        let centerLon = -0.187;

        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords && isMounted) {
            centerLat = loc.coords.latitude;
            centerLon = loc.coords.longitude;
            setInitialCoords({ latitude: centerLat, longitude: centerLon });
          }
        }

        // Fetch all registered PharmFindr pharmacies worldwide + Google Maps pharmacies for area
        const [gList, dbPharmacies] = await Promise.all([
          fetchGoogleMapsPharmaciesForRegistration({ latitude: centerLat, longitude: centerLon }, 10000),
          supabase
            .from('pharmacies')
            .select('id, name, latitude, longitude, address')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .limit(10000),
        ]);

        if (!isMounted) return;

        const regList: KnownPharmacy[] = (dbPharmacies.data || [])
          .filter((p: any) => p.latitude && p.longitude)
          .map((p: any) => ({
            id: p.id,
            name: p.name || 'Pharmacy',
            address: p.address || 'Registered on PharmFindr',
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
          }));
        setRegisteredPharmacies(regList);

        const regIds = new Set(regList.map((r) => r.id));
        const knownList: KnownPharmacy[] = (gList || [])
          .filter((p) => !regIds.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name || 'Pharmacy',
            address: p.address || 'Google Maps Location',
            latitude: p.latitude,
            longitude: p.longitude,
          }));
        setKnownPharmacies(knownList);
      } catch (e: any) {
        console.warn('Map initialization notice:', e.message);
      } finally {
        if (isMounted) setMapDataLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, []);

  const handleLocateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (loc?.coords) {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setPin(coords);
          setInitialCoords(coords);
          setSelectedKnownPharmacy(null);
          updateAddressForPin(coords);
          fetchPharmaciesForArea(coords.latitude, coords.longitude);
        }
      }
    } catch (e: any) {
      console.warn('GPS location error:', e.message);
    }
  };

  const handleSelectKnownPharmacy = (pharm: KnownPharmacy) => {
    setSelectedKnownPharmacy(pharm);
    const coords = { latitude: pharm.latitude, longitude: pharm.longitude };
    setPin(coords);
    updateAddressForPin(coords, pharm.address);
  };

  const handleConfirm = () => {
    if (!pin) {
      toast.error('Please select your pharmacy location on the map.');
      return;
    }
    if (!valAddress.trim()) {
      toast.error('Please verify or enter the physical address for your pharmacy.');
      return;
    }

    if (selectedKnownPharmacy) {
      const selectedName = selectedKnownPharmacy.name;
      const hasNameDiff = selectedName && selectedName !== pharmName && selectedName !== 'Public Pharmacy';

      if (hasNameDiff) {
        Alert.alert(
          'Use Selected Pharmacy Name?',
          `Do you want to use the business name "${selectedName}" from Google Maps?`,
          [
            {
              text: 'Keep My Name',
              style: 'cancel',
              onPress: () => onDone(pin, valAddress.trim(), !!selectedKnownPharmacy),
            },
            {
              text: 'Use Map Name',
              onPress: () => {
                onUpdatePharmDetails?.(selectedName, valAddress.trim());
                onDone(pin, valAddress.trim(), !!selectedKnownPharmacy);
              },
            },
          ],
          { cancelable: true }
        );
        return;
      }
    }

    onDone(pin, valAddress.trim(), !!selectedKnownPharmacy);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Hero step={2} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>
            Tap an existing pharmacy pin or tap anywhere on the map to set your location
          </Text>

          {/* Map Preview Card */}
          <View style={locStyles.mapCard}>
            <View style={locStyles.mapHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {mapDataLoading ? (
                  <ActivityIndicator size="small" color={GREEN} style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="location-outline" size={16} color={GREEN} style={{ marginRight: 4 }} />
                )}
                <Text style={locStyles.mapHeaderTitle}>Pick Location</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Pressable
                  style={locStyles.expandBtn}
                  onPress={handleLocateMe}
                >
                  <Ionicons name="locate-outline" size={14} color={GREEN} />
                  <Text style={locStyles.expandBtnText}>Current Location</Text>
                </Pressable>

                <Pressable
                  style={locStyles.expandBtn}
                  onPress={() => setIsMapExpanded(true)}
                >
                  <Ionicons name="expand-outline" size={14} color={GREEN} />
                  <Text style={locStyles.expandBtnText}>Expand Map</Text>
                </Pressable>
              </View>
            </View>

            <View style={locStyles.mapWrapper}>
              <MapComponent
                pin={pin}
                onPressMap={(coords) => {
                  setPin(coords);
                  setSelectedKnownPharmacy(null);
                  updateAddressForPin(coords);
                  fetchPharmaciesForArea(coords.latitude, coords.longitude);
                }}
                onSelectKnownPharmacy={(pharm) => {
                  handleSelectKnownPharmacy(pharm);
                }}
                onRegionChangeComplete={handleRegionChangeComplete}
                initialCoords={initialCoords}
                knownPharmacies={knownPharmacies}
                registeredPharmacies={registeredPharmacies}
                onExpand={() => setIsMapExpanded(true)}
              />
            </View>
          </View>

          {/* Editable Physical Address (Auto-fetched from Google Places / Map) */}
          <View style={{ marginTop: 18, marginBottom: SPACING.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
              <FieldLabel>PHARMACY PHYSICAL ADDRESS</FieldLabel>
              {isAddressFetching && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ActivityIndicator size="small" color={GREEN} />
                </View>
              )}
            </View>
            <InputRow
              icon="navigate-outline"
              placeholder="e.g. Ring Road Central, Accra"
              value={valAddress}
              onChange={(text) => {
                setValAddress(text);
              }}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
          </View>

          <PrimaryBtn label="Confirm Location & Continue" onPress={handleConfirm} />
        </View>
      </ScrollView>

      {/* Fullscreen Map Modal */}
      {isMapExpanded && (
        <View style={locStyles.fullMapModal}>
          <SafeAreaView edges={['top']} style={locStyles.fullMapHeader}>
            <Pressable style={locStyles.modalCloseBtn} onPress={() => setIsMapExpanded(false)}>
              <Ionicons name="close" size={20} color={COLORS.white} />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <Pressable style={[locStyles.modalDoneBtn, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={handleLocateMe}>
                <Ionicons name="locate" size={14} color={GREEN} />
                <Text style={locStyles.modalDoneText}>Current Location</Text>
              </Pressable>

              <Pressable style={locStyles.modalDoneBtn} onPress={() => setIsMapExpanded(false)}>
                <Text style={locStyles.modalDoneText}>Done</Text>
              </Pressable>
            </View>
          </SafeAreaView>

          <View style={{ flex: 1 }}>
            <MapComponent
              pin={pin}
              onPressMap={(coords) => {
                setPin(coords);
                setSelectedKnownPharmacy(null);
                updateAddressForPin(coords);
                fetchPharmaciesForArea(coords.latitude, coords.longitude);
              }}
              onSelectKnownPharmacy={handleSelectKnownPharmacy}
              onRegionChangeComplete={handleRegionChangeComplete}
              initialCoords={initialCoords}
              knownPharmacies={knownPharmacies}
              registeredPharmacies={registeredPharmacies}
            />
          </View>

          <SafeAreaView edges={['bottom']} style={locStyles.fullMapFooter}>
            <Text style={locStyles.footerAddress} numberOfLines={2}>
              {isAddressFetching
                ? '📍 Detecting address from Google Places...'
                : valAddress
                ? `📍 ${valAddress}`
                : selectedKnownPharmacy
                ? `📍 ${selectedKnownPharmacy.name}`
                : pin
                ? `📍 Custom Location Pin Selected`
                : 'Tap map location pin to select'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                btn.base,
                pressed && { opacity: 0.8 },
                { backgroundColor: GREEN, marginTop: SPACING.sm, height: 44 },
              ]}
              onPress={() => setIsMapExpanded(false)}
            >
              <Text style={btn.text}>Use Selected Location</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ══ STEP 3: Phone Number Input ════════════════════════════════════════════
function Step3Phone({
  phone,
  onNext,
  onBack,
}: {
  phone: string;
  onNext: (phone: string, formattedPhone: string) => void;
  onBack: () => void;
}) {
  const [valPhone, setValPhone] = useState(phone);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const validation = validateGhanaPhone(valPhone);
    if (!validation.valid || !validation.formatted) {
      toast.error(validation.error || 'Please enter a valid Ghana phone number.');
      return;
    }

    setLoading(true);

    try {
      const { data: existing, error: dbError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('phone', validation.formatted)
        .limit(1);

      if (!dbError && existing && existing.length > 0) {
        toast.error('A pharmacy account already exists with this phone number. Please login instead.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('Duplicate check warning:', e.message);
    }

    const result = await sendArkeselOtp(validation.formatted);
    setLoading(false);

    if (!result.success) {
      const isNetwork = /network|fetch|connect|timeout/i.test(result.error || '');
      const msg = isNetwork
        ? 'Failed to send OTP due to poor connectivity. Please check your internet.'
        : (result.error || 'Failed to send OTP code. Please try again.');
      toast.error(msg);
      return;
    }

    toast.success(`OTP sent via SMS to ${valPhone}!`);
    setTimeout(() => onNext(valPhone, validation.formatted!), 600);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Hero step={3} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>We will send a 6-digit verification code to verify ownership of this number.</Text>

          <FieldLabel>PHARMACY PHONE NUMBER</FieldLabel>
          <InputRow
            icon="call-outline"
            placeholder="0551234567 or +233..."
            value={valPhone}
            onChange={(text) => setValPhone(text)}
            keyboard="phone-pad"
            returnKeyType="done"
            onSubmitEditing={handleSend}
          />

          <PrimaryBtn label="Send Verification OTP" onPress={handleSend} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ══ STEP 4: OTP Verification & DB Insert ══════════════════════════════════
function Step4VerifyOTP({
  phone,
  formattedPhone,
  email,
  pharmName,
  pharmAddress,
  pin,
  isFromKnownMap,
  onDone,
  onBack,
}: {
  phone: string;
  formattedPhone: string;
  email: string;
  pharmName: string;
  pharmAddress: string;
  pin: { latitude: number; longitude: number };
  isFromKnownMap: boolean;
  onDone: (isVerified: boolean) => void;
  onBack: () => void;
}) {
  const { signUp } = useAuthStore();
  const otpRef = useRef<OtpInputHandle>(null);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    const result = await sendArkeselOtp(formattedPhone);
    if (!result.success) {
      const isNetwork = /network|fetch|connect|timeout/i.test(result.error || '');
      const msg = isNetwork
        ? 'Failed to resend OTP due to poor connectivity.'
        : (result.error || 'Failed to resend OTP. Please try again.');
      toast.error(msg);
    } else {
      toast.success('A new verification code has been sent to your phone.');
    }
  };

  const handleVerifyAndRegister = async (code: string) => {
    if (code.length < 6) {
      toast.error('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);

    const result = await verifyArkeselOtp(formattedPhone, code);

    if (!result.success) {
      setLoading(false);
      const msg = result.error || 'Invalid verification code.';
      toast.error(msg);
      otpRef.current?.shake();
      return;
    }

    otpRef.current?.showSuccess();

    try {
      // 1. Create auth user
      const user = await signUp(formattedPhone, email, PHARMACY_PASS, 'pharmacy', pharmName);
      if (!user) throw new Error('Failed to create account profile.');

      const cleanEmail = email.trim() || null;

      // 2. Check if pharmacy record exists
      const { data: existingPharm } = await supabase
        .from('pharmacies')
        .select('id')
        .or(`owner_id.eq.${user.id},phone.eq.${formattedPhone}`)
        .maybeSingle();

      const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      let targetPharmId = existingPharm?.id;

      // Pharmacies that selected an existing OSM pin are auto-verified;
      // those that dropped a custom pin require manual admin review.
      const shouldBeVerified = isFromKnownMap;

      if (existingPharm) {
        await supabase
          .from('pharmacies')
          .update({
            owner_id: user.id,
            name: pharmName,
            phone: formattedPhone,
            email: cleanEmail,
            address: pharmAddress,
            latitude: pin.latitude,
            longitude: pin.longitude,
            opening_time: '08:00',
            closing_time: '20:00',
            verified: shouldBeVerified,
          })
          .eq('id', existingPharm.id);
      } else {
        const { data: newPharm } = await supabase
          .from('pharmacies')
          .insert({
            owner_id: user.id,
            name: pharmName,
            phone: formattedPhone,
            email: cleanEmail,
            address: pharmAddress,
            latitude: pin.latitude,
            longitude: pin.longitude,
            opening_time: '08:00',
            closing_time: '20:00',
            verified: shouldBeVerified,
          })
          .select('id')
          .single();

        if (newPharm) targetPharmId = newPharm.id;
      }

      // Populate default operating hours into pharmacy_operating_hours table
      if (targetPharmId) {
        try {
          const defaultRows = DAYS_LIST.map((d) => ({
            pharmacy_id: targetPharmId,
            day_of_week: d,
            is_open: d !== 'Sunday',
            opening_time: '08:00',
            closing_time: '20:00',
          }));

          await supabase
            .from('pharmacy_operating_hours')
            .upsert(defaultRows, { onConflict: 'pharmacy_id,day_of_week' });
        } catch (e: any) {
          console.warn('Operating hours seed notice:', e.message);
        }
      }

      toast.success('Pharmacy registration successful! Welcome to PharmFindr.');
      setTimeout(() => onDone(shouldBeVerified), 600);
    } catch (e: any) {
      const msg = getFriendlyPharmacyErrorMessage(e, 'Failed to finalize pharmacy registration.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Hero step={4} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>
            We sent a 6-digit code to <Text style={{ fontFamily: 'Inter-Bold', color: TEXT_PRIMARY }}>{phone}</Text>.
          </Text>

          <OtpInput
            ref={otpRef}
            onChange={() => {}}
            onComplete={(code) => handleVerifyAndRegister(code)}
            onResend={handleResend}
            disabled={loading}
          />

          <PrimaryBtn label="Verify & Complete Setup" onPress={() => {}} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ══ STEP 5: Success Screen ═════════════════════════════════════════════════
function SuccessScreen({
  phone,
  email,
  pharmName,
  pharmAddress,
  isVerified,
  onGoToDashboard,
}: {
  phone: string;
  email: string;
  pharmName: string;
  pharmAddress: string;
  isVerified: boolean;
  onGoToDashboard: () => void;
}) {
  const { width } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={[hero.safe, { paddingBottom: SPACING.xxl }]}>
          <Text style={hero.title}>PharmFindr Network</Text>
          <Text style={hero.sub}>Registration Submitted Successfully</Text>
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
          <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill={COLORS.white} />
        </Svg>
      </View>

      <ScrollView contentContainerStyle={[s.form, { alignItems: 'center' }]}>
        <View style={succ.iconCircle}>
          <Ionicons
            name={isVerified ? 'checkmark-circle-outline' : 'time-outline'}
            size={52}
            color={isVerified ? COLORS.pharmacyTextDark : COLORS.pendingText}
          />
        </View>

        <Text style={succ.title}>
          {isVerified ? 'You\'re Live on PharmFindr! 🎉' : 'Registration Submitted!'}
        </Text>
        <Text style={succ.body}>
          {isVerified
            ? 'Your pharmacy has been verified and is now visible to patients. Head to your dashboard to add your inventory.'
            : 'Your pharmacy account has been created. Since you added a custom location, it will go live after a quick manual review (usually within 24 hours).'}
        </Text>

        <View style={succ.summaryBox}>
          <Text style={[f.label, { marginBottom: SPACING.md }]}>REGISTRATION SUMMARY</Text>
          <View style={succ.row}>
            <Text style={succ.rowKey}>Pharmacy Name</Text>
            <Text style={succ.rowVal}>{pharmName}</Text>
          </View>
          <View style={succ.row}>
            <Text style={succ.rowKey}>Email</Text>
            <Text style={succ.rowVal}>{email || '—'}</Text>
          </View>
          <View style={succ.row}>
            <Text style={succ.rowKey}>Phone</Text>
            <Text style={succ.rowVal}>{phone}</Text>
          </View>
          <View style={succ.row}>
            <Text style={succ.rowKey}>Physical Address</Text>
            <Text style={succ.rowVal} numberOfLines={1}>{pharmAddress}</Text>
          </View>
          <View style={succ.row}>
            <Text style={succ.rowKey}>Account Status</Text>
            <Text style={[succ.rowVal, { color: isVerified ? COLORS.pharmacyTextDark : COLORS.pendingText, fontFamily: 'Inter-Bold' }]}>
              {isVerified ? 'ACTIVE' : 'PENDING REVIEW'}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [btn.base, pressed && { opacity: 0.8 }, { backgroundColor: GREEN, width: '100%', marginTop: SPACING.xxl }]}
          onPress={onGoToDashboard}
        >
          <Text style={btn.text}>Go to Dashboard</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const succ = StyleSheet.create({
  iconCircle: {
    width: 80, height: 80, borderRadius: RADIUS.pill, backgroundColor: COLORS.pendingBg, borderWidth: 2, borderColor: COLORS.pendingBg, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl, marginTop: SPACING.md
  },
  title: {
    fontSize: FONT_SIZE.hero, fontFamily: 'Inter-Bold', color: TEXT_PRIMARY, marginBottom: SPACING.sm
  },
  body: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, color: LABEL_COLOR, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xxl, paddingHorizontal: SPACING.sm
  },
  summaryBox: {
    width: '100%', backgroundColor: COLORS.background, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10
  },
  rowKey: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, color: LABEL_COLOR
  },
  rowVal: {
    fontSize: FONT_SIZE.md, color: TEXT_PRIMARY, fontFamily: 'Inter-SemiBold'
  },

});

const locStyles = StyleSheet.create({
  mapCard: {
    borderRadius: RADIUS.xl, borderWidth: 1.5, borderColor: GREEN + '40', backgroundColor: COLORS.background, overflow: 'hidden', marginTop: 6
  },
  mapHeader: {
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.pharmacySecondary, borderBottomWidth: 1, borderBottomColor: GREEN
  },
  mapHeaderTitle: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold', color: TEXT_PRIMARY, flex: 1, marginLeft: 6
  },
  expandBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: SPACING.xs, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: GREEN + '40'
  },
  expandBtnText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Bold', color: GREEN
  },
  mapWrapper: {
    height: 220, width: '100%'
  },
  fullMapModal: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: COLORS.white
  },
  fullMapHeader: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 10
  },
  modalCloseBtn: {
    padding: 6, borderRadius: RADIUS.xl, backgroundColor: 'rgba(255,255,255,0.2)'
  },
  modalDoneBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.white
  },
  modalDoneText: {
    color: GREEN, fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },
  fullMapFooter: {
    backgroundColor: COLORS.white, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle
  },
  footerAddress: {
    fontSize: FONT_SIZE.md, color: TEXT_PRIMARY, fontFamily: 'Inter-SemiBold', marginBottom: SPACING.xs
  },

});

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1, backgroundColor: COLORS.white
  },
  form: {
    padding: SPACING.xxl, backgroundColor: COLORS.white
  },
  secSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, color: LABEL_COLOR, marginBottom: SPACING.xl, lineHeight: 18
  },
});

// ══ Main export: Orchestrates 4 registration steps + success ══════════════
export default function PharmacyRegister() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isFromKnownMap, setIsFromKnownMap] = useState(false);
  const [registrationVerified, setRegistrationVerified] = useState(false);

  const [pharmName, setPharmName] = useState('');
  const [email, setEmail] = useState('');
  const [pharmAddress, setPharmAddress] = useState('');

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);

  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');

  const goBack = () => {
    if (step === 1) router.back();
    else setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    return true;
  };

  useHardwareBack(goBack);

  if (step === 5) {
    return (
      <SuccessScreen
        phone={formattedPhone}
        email={email}
        pharmName={pharmName}
        pharmAddress={pharmAddress}
        isVerified={registrationVerified}
        onGoToDashboard={() => router.replace('/(pharmacy)/(tabs)/dashboard')}
      />
    );
  }

  if (step === 4) {
    return (
      <Step4VerifyOTP
        phone={phone}
        formattedPhone={formattedPhone}
        email={email}
        pharmName={pharmName}
        pharmAddress={pharmAddress}
        pin={pin!}
        isFromKnownMap={isFromKnownMap}
        onDone={(verified) => {
          setRegistrationVerified(verified);
          setStep(5);
        }}
        onBack={goBack}
      />
    );
  }

  if (step === 3) {
    return (
      <Step3Phone
        phone={phone}
        onNext={(raw, fmt) => {
          setPhone(raw);
          setFormattedPhone(fmt);
          setStep(4);
        }}
        onBack={goBack}
      />
    );
  }

  if (step === 2) {
    return (
      <Step2Location
        pharmName={pharmName}
        pharmAddress={pharmAddress}
        onUpdatePharmDetails={(n, a) => {
          setPharmName(n);
          setPharmAddress(a);
        }}
        onDone={(selectedPin, finalAddress, fromKnownMap) => {
          setPin(selectedPin);
          setPharmAddress(finalAddress);
          setIsFromKnownMap(fromKnownMap);
          setStep(3);
        }}
        onBack={goBack}
      />
    );
  }

  return (
    <Step1Details
      name={pharmName}
      email={email}
      onNext={(n, e) => {
        setPharmName(n);
        setEmail(e);
        setStep(2);
      }}
      onBack={goBack}
    />
  );
}
