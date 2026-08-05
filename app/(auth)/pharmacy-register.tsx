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
import MapComponent, { type KnownPharmacy } from '@/components/MapComponent';
import { sendArkeselOtp, verifyArkeselOtp, validateGhanaPhone } from '@/lib/arkeselSms';
import { useAuthStore } from '@/store/authStore';
import { PHARMACY_PASS } from '@/lib/authConstants';
import { supabase } from '@/lib/supabase';
import { COLORS,  RADIUS  } from '@/styles/theme';
import * as Location from 'expo-location';
import { searchNearbyPharmacies } from '@/lib/osm';

const GREEN = '#10b981';
const INPUT_BG = '#f8fafc';
const TEXT_PRIMARY = '#0f172a';
const LABEL_COLOR = '#64748b';
const PLACEHOLDER_COLOR = '#94a3b8';

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
            <Text style={hero.backText}>Back To Login</Text>
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
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', padding: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 12
  },
  backText: {
    fontSize: 13, fontFamily: 'Inter-SemiBold', color: COLORS.white, marginLeft: 6
  },
  stepText: {
    fontSize: 10, fontFamily: 'Inter-Bold', color: 'rgba(255,255,255,0.75)', letterSpacing: 1, marginBottom: 2
  },
  title: {
    fontSize: 24, fontFamily: 'Inter-Bold', color: COLORS.white, marginBottom: 2
  },
  sub: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: 'rgba(255,255,255,0.85)'
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
    fontSize: 10, fontFamily: 'Inter-Bold', color: LABEL_COLOR, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase'
  },
  row: {
    backgroundColor: INPUT_BG, borderRadius: 16, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  icon: {
    marginRight: 10
  },
  input: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: 14, color: TEXT_PRIMARY, height: '100%'
  },

});

const btn = StyleSheet.create({
  base: {
    height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 24
  },
  text: {
    color: COLORS.white, fontSize: 15, fontFamily: 'Inter-Bold'
  },

});

// ══ STEP 1: Details (Name + Email + Physical Address) ═══════════
function Step1Details({
  email,
  pharmName,
  pharmAddress,
  onNext,
  onBack,
}: {
  email: string;
  pharmName: string;
  pharmAddress: string;
  onNext: (e: string, n: string, a: string) => void;
  onBack: () => void;
}) {
  const [valEmail, setValEmail] = useState(email);
  const [valName, setValName] = useState(pharmName);
  const [valAddress, setValAddress] = useState(pharmAddress);
  const [err, setErr] = useState<string | null>(null);

  const pharmNameRef = useRef<TextInput>(null);
  const pharmAddrRef = useRef<TextInput>(null);

  const handleContinue = () => {
    if (!valEmail.trim() || !valName.trim() || !valAddress.trim()) {
      setErr('Please fill in your pharmacy email, registered name, and physical address.');
      return;
    }
    if (!valEmail.includes('@')) {
      setErr('Please enter a valid email address.');
      return;
    }
    onNext(valEmail.trim(), valName.trim(), valAddress.trim());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Hero step={1} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>Enter your pharmacy email, registered name, and physical address.</Text>

          {err && (
            <View style={s.errBox}>
              <Text style={s.errText}>{err}</Text>
            </View>
          )}

          <FieldLabel>PHARMACY EMAIL ADDRESS</FieldLabel>
          <InputRow
            icon="mail-outline"
            placeholder="pharmacy@example.com"
            value={valEmail}
            onChange={setValEmail}
            keyboard="email-address"
            returnKeyType="next"
            onSubmitEditing={() => pharmNameRef.current?.focus()}
          />

          <View style={{ marginBottom: 16 }} />

          <FieldLabel>PHARMACY NAME</FieldLabel>
          <InputRow
            inputRef={pharmNameRef}
            icon="shield-checkmark-outline"
            placeholder="e.g. City Care Pharmacy"
            value={valName}
            onChange={setValName}
            returnKeyType="next"
            onSubmitEditing={() => pharmAddrRef.current?.focus()}
          />

          <View style={{ marginBottom: 16 }} />

          <FieldLabel>PHARMACY PHYSICAL ADDRESS</FieldLabel>
          <InputRow
            inputRef={pharmAddrRef}
            icon="navigate-outline"
            placeholder="e.g. Ring Road Central, Accra"
            value={valAddress}
            onChange={setValAddress}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />

          <PrimaryBtn label="Continue to Map Location" onPress={handleContinue} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ══ STEP 2: Location Map Selection ════════════════════════════════════════
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
  onDone: (pin: { latitude: number; longitude: number }) => void;
  onBack: () => void;
}) {
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedKnownPharmacy, setSelectedKnownPharmacy] = useState<KnownPharmacy | null>(null);
  const [knownPharmacies, setKnownPharmacies] = useState<KnownPharmacy[]>([]);
  const [registeredPharmacies, setRegisteredPharmacies] = useState<KnownPharmacy[]>([]);
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mapDataLoading, setMapDataLoading] = useState(true);

  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    async function loadLocationAndMapData() {
      setMapDataLoading(true);
      try {
        let currentLat = 5.6037;
        let currentLon = -0.187;

        // 1. Request device GPS foreground location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            currentLat = loc.coords.latitude;
            currentLon = loc.coords.longitude;
            const devicePin = { latitude: currentLat, longitude: currentLon };
            setInitialCoords(devicePin);
            setPin(devicePin);
          }
        }

        const userCoords = { latitude: currentLat, longitude: currentLon };
        if (!initialCoords) {
          setInitialCoords(userCoords);
        }

        // 2. Stream pharmacies via shared lib/osm service
        await searchNearbyPharmacies(userCoords, 5000, (pharm) => {
          const item = {
            id: pharm.id,
            name: pharm.name,
            address: pharm.address,
            latitude: pharm.latitude,
            longitude: pharm.longitude,
          };
          if (pharm.isRegistered) {
            setRegisteredPharmacies((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
          } else {
            setKnownPharmacies((prev) => (prev.some((p) => p.id === item.id) ? prev : [...prev, item]));
          }
        });
      } catch (e: any) {
        console.warn('Could not load map data:', e.message);
      } finally {
        setMapDataLoading(false);
      }
    }
    loadLocationAndMapData();
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
        }
      }
    } catch (e: any) {
      console.warn('GPS location error:', e.message);
    }
  };

  const handleSelectKnownPharmacy = (pharm: KnownPharmacy) => {
    setSelectedKnownPharmacy(pharm);
    setPin({ latitude: pharm.latitude, longitude: pharm.longitude });
  };

  const handleConfirm = () => {
    if (!pin) {
      setErr('Please select your pharmacy location on the map.');
      return;
    }

    if (selectedKnownPharmacy) {
      const selectedName = selectedKnownPharmacy.name;
      const selectedAddr = selectedKnownPharmacy.address;

      const hasNameDiff = selectedName && selectedName !== pharmName;
      const hasAddrDiff = selectedAddr && selectedAddr !== pharmAddress && selectedAddr !== 'Public Map Address';

      if (hasNameDiff || hasAddrDiff) {
        const newName = selectedName || pharmName;
        const newAddr = (selectedAddr && selectedAddr !== 'Public Map Address') ? selectedAddr : pharmAddress;

        let msg = `Your current details:\n• Name: ${pharmName}\n• Address: ${pharmAddress}\n\nSelected map details:\n• Name: ${selectedName}`;
        if (selectedAddr && selectedAddr !== 'Public Map Address') {
          msg += `\n• Address: ${selectedAddr}`;
        }
        msg += `\n\nDo you want to update your pharmacy details with the map information?`;

        Alert.alert(
          'Use Selected Pharmacy Details?',
          msg,
          [
            {
              text: 'Keep Current Details',
              style: 'cancel',
              onPress: () => onDone(pin),
            },
            {
              text: 'Override Details',
              onPress: () => {
                onUpdatePharmDetails?.(newName, newAddr);
                onDone(pin);
              },
            },
          ],
          { cancelable: true }
        );
        return;
      }
    }

    onDone(pin);
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
            Tap an existing green pharmacy pin or tap anywhere on the Google Map to drop a custom location marker.
          </Text>

          {err && (
            <View style={s.errBox}>
              <Text style={s.errText}>{err}</Text>
            </View>
          )}

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
                  <Text style={locStyles.expandBtnText}>Use Current Location</Text>
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
                }}
                onSelectKnownPharmacy={handleSelectKnownPharmacy}
                initialCoords={initialCoords}
                knownPharmacies={knownPharmacies}
                registeredPharmacies={registeredPharmacies}
                onExpand={() => setIsMapExpanded(true)}
              />
            </View>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable style={[locStyles.modalDoneBtn, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={handleLocateMe}>
                <Ionicons name="locate" size={14} color={GREEN} />
                <Text style={locStyles.modalDoneText}>Use Current Location</Text>
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
              }}
              onSelectKnownPharmacy={handleSelectKnownPharmacy}
              initialCoords={initialCoords}
              knownPharmacies={knownPharmacies}
              registeredPharmacies={registeredPharmacies}
            />
          </View>

          <SafeAreaView edges={['bottom']} style={locStyles.fullMapFooter}>
            <Text style={locStyles.footerAddress} numberOfLines={1}>
              {selectedKnownPharmacy
                ? `📍 ${selectedKnownPharmacy.name}${selectedKnownPharmacy.address ? ` — ${selectedKnownPharmacy.address}` : ''}`
                : pin
                ? `📍 Custom Location Pin Selected`
                : 'Tap map location pin to select'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                btn.base,
                pressed && { opacity: 0.8 },
                { backgroundColor: GREEN, marginTop: 8, height: 44 },
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
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSend = async () => {
    setErr(null);
    setSuccessMsg(null);

    const validation = validateGhanaPhone(valPhone);
    if (!validation.valid || !validation.formatted) {
      setErr(validation.error || 'Please enter a valid Ghana phone number.');
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
        setErr('A pharmacy account already exists with this phone number. Please login instead.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('Duplicate check warning:', e.message);
    }

    const result = await sendArkeselOtp(validation.formatted);
    setLoading(false);

    if (!result.success) {
      setErr(result.error || 'Failed to send OTP code. Please try again.');
      return;
    }

    setSuccessMsg(`OTP sent via SMS to ${valPhone}!`);
    setTimeout(() => onNext(valPhone, validation.formatted!), 600);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Hero step={3} onBack={onBack} />
        <View style={s.form}>
          <Text style={s.secSub}>We will send a 6-digit verification code to verify ownership of this number.</Text>

          {err && (
            <View style={s.errBox}>
              <Text style={s.errText}>{err}</Text>
            </View>
          )}

          {successMsg && (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 8 }} />
              <Text style={s.successText}>{successMsg}</Text>
            </View>
          )}

          <FieldLabel>PHARMACY PHONE NUMBER</FieldLabel>
          <InputRow
            icon="call-outline"
            placeholder="0551234567 or +233..."
            value={valPhone}
            onChange={setValPhone}
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
  onDone,
  onBack,
}: {
  phone: string;
  formattedPhone: string;
  email: string;
  pharmName: string;
  pharmAddress: string;
  pin: { latitude: number; longitude: number };
  onDone: () => void;
  onBack: () => void;
}) {
  const { signUp } = useAuthStore();
  const otpRef = useRef<OtpInputHandle>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleResend = async () => {
    setErr(null);
    const result = await sendArkeselOtp(formattedPhone);
    if (!result.success) {
      setErr(result.error || 'Failed to resend OTP. Please try again.');
    }
  };

  const handleVerifyAndRegister = async (code: string) => {
    if (code.length < 6) {
      setErr('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setErr(null);

    const result = await verifyArkeselOtp(formattedPhone, code);

    if (!result.success) {
      setLoading(false);
      setErr(result.error || 'Invalid verification code.');
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
            verified: false,
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
            verified: false,
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

      setTimeout(onDone, 600);
    } catch (e: any) {
      setErr(e.message || 'Failed to finalize pharmacy registration.');
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

          {err && (
            <View style={s.errBox}>
              <Text style={s.errText}>{err}</Text>
            </View>
          )}

          <OtpInput
            ref={otpRef}
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
  onGoToDashboard,
}: {
  phone: string;
  email: string;
  pharmName: string;
  pharmAddress: string;
  onGoToDashboard: () => void;
}) {
  const { width } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={[hero.safe, { paddingBottom: 24 }]}>
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
          <Ionicons name="time-outline" size={52} color="#b45309" />
        </View>

        <Text style={succ.title}>Registration Submitted!</Text>
        <Text style={succ.body}>
          Your pharmacy account has been registered on PharmFindr. License verification is currently pending review.
        </Text>

        <View style={succ.summaryBox}>
          <Text style={[f.label, { marginBottom: 12 }]}>REGISTRATION SUMMARY</Text>
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
            <Text style={[succ.rowVal, { color: '#b45309', fontFamily: 'Inter-Bold' }]}>PENDING REVIEW</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [btn.base, pressed && { opacity: 0.8 }, { backgroundColor: GREEN, width: '100%', marginTop: 24 }]}
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
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fffbeb', borderWidth: 2, borderColor: COLORS.pendingBg, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 12
  },
  title: {
    fontSize: 22, fontFamily: 'Inter-Bold', color: TEXT_PRIMARY, marginBottom: 8
  },
  body: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: LABEL_COLOR, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 8
  },
  summaryBox: {
    width: '100%', backgroundColor: COLORS.background, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.borderSubtle
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10
  },
  rowKey: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: LABEL_COLOR
  },
  rowVal: {
    fontSize: 13, color: TEXT_PRIMARY, fontFamily: 'Inter-SemiBold'
  },

});

const locStyles = StyleSheet.create({
  mapCard: {
    borderRadius: RADIUS.xl, borderWidth: 1.5, borderColor: GREEN + '40', backgroundColor: COLORS.background, overflow: 'hidden', marginTop: 6
  },
  mapHeader: {
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#ecfdf5', borderBottomWidth: 1, borderBottomColor: GREEN
  },
  mapHeaderTitle: {
    fontSize: 12, fontFamily: 'Inter-Bold', color: TEXT_PRIMARY, flex: 1, marginLeft: 6
  },
  expandBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: GREEN + '40'
  },
  expandBtnText: {
    fontSize: 11, fontFamily: 'Inter-Bold', color: GREEN
  },
  mapWrapper: {
    height: 220, width: '100%'
  },
  fullMapModal: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: COLORS.white
  },
  fullMapHeader: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10
  },
  modalCloseBtn: {
    padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)'
  },
  modalTitle: {
    color: COLORS.white, fontSize: 16, fontFamily: 'Inter-Bold'
  },
  modalDoneBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.white
  },
  modalDoneText: {
    color: GREEN, fontSize: 12, fontFamily: 'Inter-Bold'
  },
  fullMapFooter: {
    backgroundColor: COLORS.white, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle
  },
  footerAddress: {
    fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'Inter-SemiBold', marginBottom: 4
  },

});

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1, backgroundColor: COLORS.white
  },
  form: {
    padding: 24, backgroundColor: COLORS.white
  },
  secSub: {
    fontFamily: 'Inter-Regular',
     fontSize: 13, color: LABEL_COLOR, marginBottom: 20, lineHeight: 18
  },
  errBox: {
    backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: COLORS.error, borderRadius: 12, padding: 12, marginBottom: 16
  },
  errText: {
    fontFamily: 'Inter-Regular',
     color: COLORS.error, fontSize: 13, textAlign: 'center'
  },
  successBox: {
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: COLORS.pharmacyPrimary, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center'
  },
  successText: {
    fontFamily: 'Inter-Regular',
     color: COLORS.pharmacyTextDark, fontSize: 13, flex: 1
  },

});

// ══ Main export: Orchestrates 4 registration steps + success ══════════════
export default function PharmacyRegister() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [pharmName, setPharmName] = useState('');
  const [email, setEmail] = useState('');
  const [pharmAddress, setPharmAddress] = useState('');

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);

  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');

  const goBack = () => {
    if (step === 1) router.back();
    else setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
  };

  if (step === 5) {
    return (
      <SuccessScreen
        phone={formattedPhone}
        email={email}
        pharmName={pharmName}
        pharmAddress={pharmAddress}
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
        onDone={() => setStep(5)}
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
        onDone={(selectedPin) => {
          setPin(selectedPin);
          setStep(3);
        }}
        onBack={goBack}
      />
    );
  }

  return (
    <Step1Details
      email={email}
      pharmName={pharmName}
      pharmAddress={pharmAddress}
      onNext={(e, n, a) => {
        setEmail(e);
        setPharmName(n);
        setPharmAddress(a);
        setStep(2);
      }}
      onBack={goBack}
    />
  );
}
