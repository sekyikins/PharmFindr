import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  ActivityIndicator, ScrollView, Platform, Dimensions, Animated} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import MapComponent, { type KnownPharmacy, type RegisteredPharmacy } from '@/components/MapComponent';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { getCurrentLocation } from '@/lib/location';
import { searchNearbyPharmacies } from '@/lib/osm';
import { validateGhanaPhone, sendArkeselOtp, verifyArkeselOtp } from '@/lib/arkeselSms';
import { PHARMACY_PASS } from '@/lib/authConstants';
import OtpInput, { type OtpInputHandle } from '@/components/ui/OtpInput';

const GREEN = '#10b981';
const INPUT_BG = '#f8fafc';
const LABEL_COLOR = '#62748e';
const PLACEHOLDER_COLOR = '#90a1b9';
const TEXT_PRIMARY = '#1d293d';
const { width } = Dimensions.get('window');

// ── Step progress bar component ──────────────────────────────────────────
function StepBar({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ['Phone', 'Verify', 'Details', 'Location'];
  return (
    <View style={sb.row}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={label}>
            <View style={sb.stepCol}>
              <View style={[sb.circle, done ? sb.done : active ? sb.active : sb.pending]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[sb.num, active ? sb.numActive : sb.numPending]}>{idx}</Text>
                }
              </View>
              <Text style={[sb.label, active && sb.labelActive]}>{label}</Text>
            </View>
            {i < 3 && (
              <View style={[sb.line, idx < current && sb.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12 },
  stepCol: { alignItems: 'center', width: 40 },
  circle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  done: { backgroundColor: GREEN },
  active: { backgroundColor: GREEN },
  pending: { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  num: { fontSize: 11, fontWeight: '700' },
  numActive: { color: '#fff' },
  numPending: { color: 'rgba(255,255,255,0.7)' },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  labelActive: { color: '#fff', fontWeight: '700' },
  line: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 11 },
  lineDone: { backgroundColor: '#fff' },
});

// ── Hero wrapper shared across all steps ─────────────────────────────────
function Hero({ step, onBack }: { step: 1|2|3|4; onBack: () => void }) {
  return (
    <>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={hero.safe}>
          <Pressable onPress={onBack} style={hero.back}>
            <Ionicons name='arrow-back' size={20} color="#fff" />
            <Text style={hero.backText}>Back to Login</Text>
          </Pressable>
          <Text style={hero.title}>Register Pharmacy</Text>
          <Text style={hero.sub}>Join the PharmFindr network</Text>
          <StepBar current={step} />
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
          <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill="#ffffff" />
        </Svg>
      </View>
    </>
  );
}
const hero = StyleSheet.create({
  safe: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  back: { flexDirection: "row", padding: 10, alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom:8 },
  backText: { fontSize: 14, fontWeight: '600', color: '#fff', marginLeft: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 2 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
});

// ── Field helpers ─────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: string }) {
  return <Text style={f.label}>{children}</Text>;
}
function InputRow({ icon, placeholder, value, onChange, secure, keyboard }: {
  icon: keyof typeof Ionicons.glyphMap; placeholder: string; value: string;
  onChange: (v: string) => void; secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={f.row}>
      <Ionicons name={icon} size={16} color={PLACEHOLDER_COLOR} style={{ marginRight: 10 }} />
      <TextInput
        style={f.input}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}
const f = StyleSheet.create({
  label: { fontSize: 10, fontWeight: '700', color: LABEL_COLOR, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  row: { backgroundColor: INPUT_BG, borderRadius: 16, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
  input: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, height: '100%' },
});

function PrimaryBtn({ label, onPress, loading, color = GREEN }: {
  label: string; onPress: () => void; loading?: boolean; color?: string;
}) {
  return (
    <Pressable style={({pressed})=>[btn.base, { backgroundColor: color }, pressed && { opacity: 0.5 }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={btn.text}>{label}</Text>}
    </Pressable>
  );
}
const btn = StyleSheet.create({
  base: { height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
});



// ══ STEP 1: Phone Number ══════════════════════════════════════════════════
function Step1Phone({ onNext, onBack }: { onNext: (phone: string, formatted: string) => void; onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSend = async () => {
    const raw = phone.trim();
    if (!raw) { setErr('Please enter your phone number.'); return; }

    // Step 1: Validate Ghana phone format (free — no credits spent)
    const validation = validateGhanaPhone(raw);
    if (!validation.valid) {
      setErr(validation.error || 'Invalid phone number.');
      return;
    }

    setLoading(true);
    setErr(null);
    setSuccessMsg(null);

    // Step 2: Check pharmacies table — phone is stored there, not in profiles
    try {
      const { data: existing, error: dbError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('phone', validation.formatted)
        .limit(1);

      if (!dbError && existing && existing.length > 0) {
        setErr('A pharmacy account already exists with this number. Please login instead.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.warn('Duplicate check failed (non-blocking):', e.message);
    }

    // Step 3: Send OTP via Arkesel's managed OTP service (costs credit)
    const result = await sendArkeselOtp(validation.formatted);
    setLoading(false);

    if (!result.success) {
      setErr(result.error || 'Failed to send OTP. Please try again.');
      return;
    }

    setSuccessMsg(`OTP sent to ${raw}!`);
    // Small delay so the success message is visible before navigating
    setTimeout(() => onNext(raw, validation.formatted), 600);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
      <Hero step={1} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Enter your phone number</Text>
        <Text style={s.secSub}>We'll send a 6-digit OTP code to verify your phone number.</Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}
        {successMsg && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 8 }} />
            <Text style={s.successText}>{successMsg}</Text>
          </View>
        )}
        <FieldLabel>PHONE NUMBER</FieldLabel>
        <InputRow icon="call-outline" placeholder="0551234567 or +233..." value={phone} onChange={setPhone} keyboard="phone-pad" />
        <PrimaryBtn label="Send OTP via SMS" onPress={handleSend} loading={loading} />
      </View>
    </ScrollView>
  );
}

// ══ STEP 2: OTP Verification ══════════════════════════════════════════════
function Step2Verify({ phone, formattedPhone, onNext, onBack }: {
  phone: string; formattedPhone: string; onNext: () => void; onBack: () => void;
}) {
  const otpRef = useRef<OtpInputHandle>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleResend = async () => {
    setErr(null);
    const result = await sendArkeselOtp(formattedPhone);
    if (!result.success) {
      setErr(result.error || 'Failed to resend OTP. Please try again.');
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length < 6) { setErr('Please enter the 6-digit code.'); return; }
    setLoading(true);
    setErr(null);

    // Verify with Arkesel's server-side OTP service
    const result = await verifyArkeselOtp(formattedPhone, code);
    setLoading(false);

    if (result.success) {
      otpRef.current?.showSuccess();
      // Brief pause so success state is visible before advancing
      setTimeout(onNext, 600);
    } else {
      setErr(result.error || 'Invalid verification code.');
      otpRef.current?.shake();
    }
  };

  const handleComplete = (code: string) => {
    setPendingCode(code);
    handleVerify(code);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
      <Hero step={2} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Verify your number</Text>
        <Text style={s.secSub}>Enter the 6-digit OTP code sent via Arkesel SMS to{' '}
          <Text style={{ fontWeight: '700', color: TEXT_PRIMARY }}>{phone}</Text>
        </Text>
        <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
          <Text style={{ color: '#047857', fontSize: 13, flex: 1 }}>OTP sent successfully to {phone}.</Text>
        </View>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}

        {/* OTP Input Component */}
        <OtpInput
          ref={otpRef}
          accentColor={GREEN}
          onComplete={handleComplete}
          onResend={handleResend}
          disabled={loading}
        />

        <PrimaryBtn
          label="Verify & Continue"
          onPress={() => handleVerify(pendingCode)}
          loading={loading}
        />

        <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
          <Pressable style={({ pressed }) => [
              pressed && { opacity: 0.5 },
              {
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
            onPress={onBack}
          >
            <Ionicons name='chevron-back' size={18} color={LABEL_COLOR} />
            <Text style={{ color: LABEL_COLOR, fontSize: 13, fontWeight: '500' }}>Change Number</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// ══ STEP 3: Pharmacy Details ══════════════════════════════════════════════
function Step3Details({ onNext, onBack }: { onNext: (email: string, name: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [pharmName, setPharmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleContinue = () => {
    if (!email.trim() || !pharmName.trim()) { setErr('Please fill in all fields.'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); onNext(email.trim(), pharmName.trim()); }, 300);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}>
      <Hero step={3} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Pharmacy details</Text>
        <Text style={s.secSub}>Tell us a bit about your pharmacy.</Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}
        <FieldLabel children="EMAIL ADDRESS" />
        <InputRow icon="mail-outline" placeholder="pharmacy@example.com" value={email} onChange={setEmail} keyboard="email-address" />
        <View style={{ marginBottom: 16 }} />
        <FieldLabel children="PHARMACY NAME" />
        <InputRow icon="shield-checkmark-outline" placeholder="e.g. City Care Pharmacy" value={pharmName} onChange={setPharmName} />
        <PrimaryBtn label="Continue" onPress={handleContinue} loading={loading} />
      </View>
    </ScrollView>
  );
}

// ══ STEP 4: Location ══════════════════════════════════════════════════════
function Step4Location({ phone, formattedPhone, email, pharmName, onDone, onBack }: {
  phone: string; formattedPhone: string; email: string; pharmName: string;
  onDone: (locationAddr: string) => void; onBack: () => void;
}) {
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedKnownPharmacy, setSelectedKnownPharmacy] = useState<KnownPharmacy | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // OSM pharmacies not yet in PharmaFindr (green pins)
  const [knownPharmacies, setKnownPharmacies] = useState<KnownPharmacy[]>([]);
  // Already registered in PharmaFindr (brown pins — not selectable)
  const [registeredPharmacies, setRegisteredPharmacies] = useState<RegisteredPharmacy[]>([]);
  const [mapDataLoading, setMapDataLoading] = useState(true);

  const { signUp } = useAuthStore();

  useEffect(() => {
    async function loadMapData() {
      setMapDataLoading(true);
      try {
        const coords = await getCurrentLocation();
        setInitialCoords(coords);
        setPin(coords);

        // 1. Fetch all registered Supabase pharmacies
        const { data: regPharms } = await supabase
          .from('pharmacies')
          .select('id, name, latitude, longitude');

        const registered: RegisteredPharmacy[] = (regPharms ?? []).filter(
          (p: any) => p.latitude != null && p.longitude != null
        ).map((p: any) => ({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
        }));
        setRegisteredPharmacies(registered);

        // Build a set of registered positions for fast lookup
        const registeredKeys = new Set(
          registered.map(p => `${Math.round(p.latitude * 1000)},${Math.round(p.longitude * 1000)}`)
        );

        // 2. Fetch OSM pharmacies nearby
        const osmPharms = await searchNearbyPharmacies(coords, 5000);

        // 3. Filter out any that are already registered (approximate match)
        const unregistered: KnownPharmacy[] = osmPharms
          .filter(p => !registeredKeys.has(
            `${Math.round(p.latitude * 1000)},${Math.round(p.longitude * 1000)}`
          ))
          .map(p => ({
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
          }));

        setKnownPharmacies(unregistered);
      } catch (e: any) {
        console.warn('Could not load map data:', e.message);
        // Still allow the map to render without pharmacy pins
      } finally {
        setMapDataLoading(false);
      }
    }
    loadMapData();
  }, []);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const handleSelectKnownPharmacy = (pharm: KnownPharmacy) => {
    setSelectedKnownPharmacy(pharm);
    setPin({ latitude: pharm.latitude, longitude: pharm.longitude });
    setAddress(pharm.name);
  };

  const handleConfirm = async () => {
    if (!pin) {
      setErr('Please select a location on the map.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const user = await signUp(formattedPhone, email, PHARMACY_PASS, 'pharmacy', pharmName);
      if (!user) throw new Error('Registration failed.');

      const locationAddr = (selectedKnownPharmacy?.name ?? address.trim()) || 'Custom location on map';

      const { error } = await supabase.from('pharmacies').upsert({
        owner_id: user.id,
        name: pharmName,
        phone: formattedPhone,
        email: email.trim() || null,
        address: locationAddr,
        latitude: pin.latitude,
        longitude: pin.longitude,
        verified: false,
      }, { onConflict: 'owner_id' });

      if (error) {
        console.warn('Pharmacy insert warning:', error.message);
      }

      onDone(locationAddr);
    } catch (e: any) {
      setErr(e.message || 'Failed to register pharmacy.');
    } finally {
      setLoading(false);
    }
  };

  const displayName = selectedKnownPharmacy
    ? selectedKnownPharmacy.name
    : pin
    ? pharmName
    : null;

  const displayType = selectedKnownPharmacy ? 'Claimed pharmacy location' : 'Custom pin location';

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
    >
      <Hero step={4} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Select your location</Text>
        <Text style={s.secSub}>
          Tap a{' '}<Text style={{ color: '#10b981', fontWeight: '700' }}>green pin</Text>{' '}to claim a recognised pharmacy,
          or tap the map to drop a{' '}<Text style={{ color: '#2563eb', fontWeight: '700' }}>custom pin</Text>.
          {' '}Expand the map for easier selection.
        </Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}

        {/* Address search */}
        <View style={map.searchRow}>
          <Ionicons name="search-outline" size={16} color={PLACEHOLDER_COLOR} style={{ marginRight: 10 }} />
          <TextInput
            style={[f.input, { height: '100%' }]}
            placeholder="Address or landmark (optional)"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Legend */}
        <View style={map.legend}>
          <View style={[map.dot, { backgroundColor: '#10b981' }]} />
          <Text style={map.legendText}>Available</Text>
          <View style={[map.dot, { backgroundColor: '#92400e', marginLeft: 14 }]} />
          <Text style={map.legendText}>Registered</Text>
          <View style={[map.dot, { backgroundColor: '#2563eb', marginLeft: 14 }]} />
          <Text style={map.legendText}>Custom pin</Text>
        </View>

        {/* Map */}
        <View style={map.container}>
          {mapDataLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
              <ActivityIndicator color={GREEN} />
              <Text style={{ marginTop: 8, color: '#62748e', fontSize: 12 }}>Loading map data...</Text>
            </View>
          ) : (
            <MapComponent
              pin={pin}
              onPressMap={(coord) => {
                setPin(coord);
                setSelectedKnownPharmacy(null);
                setAddress('');
              }}
              onSelectKnownPharmacy={handleSelectKnownPharmacy}
              initialCoords={initialCoords}
              setScrollEnabled={setScrollEnabled}
              knownPharmacies={knownPharmacies}
              registeredPharmacies={registeredPharmacies}
            />
          )}
        </View>

        {/* Selected location card */}
        {displayName && (
          <View style={[map.card, selectedKnownPharmacy ? { borderColor: '#10b981' + '66' } : { borderColor: '#2563eb44' }]}>
            <View style={[map.cardIcon, { backgroundColor: (selectedKnownPharmacy ? '#10b981' : '#2563eb') + '22' }]}>
              <Ionicons name="location" size={20} color={selectedKnownPharmacy ? '#10b981' : '#2563eb'} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={map.cardTitle}>{displayName}</Text>
              <Text style={map.cardSub}>{displayType}</Text>
            </View>
            <Pressable 
              style={({ pressed }) => [
                pressed && { opacity: 0.5 },
              ]}
              onPress={() => { setPin(null); setSelectedKnownPharmacy(null); setAddress(''); }}>
              <Ionicons name="close-circle" size={22} color={PLACEHOLDER_COLOR} />
            </Pressable>
          </View>
        )}

        <PrimaryBtn label="Confirm Location" onPress={handleConfirm} loading={loading} />
      </View>
    </ScrollView>
  );
}
const map = StyleSheet.create({
  searchRow: { backgroundColor: INPUT_BG, borderRadius: 16, height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: LABEL_COLOR, marginLeft: 6 },
  container: { height: 240, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  card: { backgroundColor: INPUT_BG, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: GREEN + '44' },
  cardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  cardSub: { fontSize: 12, color: LABEL_COLOR, marginTop: 2 },
});

// ══ Success Screen ════════════════════════════════════════════════════════
function SuccessScreen({
  phone, email, pharmName, locationAddr, onGoToLogin, onGoToDashboard,
}: {
  phone: string;
  email: string;
  pharmName: string;
  locationAddr: string;
  onGoToLogin: () => void;
  onGoToDashboard: () => void;
}) {
  // Since email confirmation is disabled, the user is verified immediately.
  // Poll the Supabase session to confirm the account is active.
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // Check immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setVerified(true);
    });

    // Also poll every 2 seconds for up to 30 seconds in case of slight delay
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setVerified(true);
        clearInterval(interval);
      }
      if (attempts >= 15) clearInterval(interval); // stop after ~30s
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const summaryRows: [string, string][] = [
    ['Phone', phone],
    ['Email', email || '—'],
    ['Pharmacy Name', pharmName],
    ['Location', locationAddr],
    ['Status', verified ? 'Verified ✓' : 'Pending Verification'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={[hero.safe, { paddingBottom: 24 }]}>
          <Text style={hero.title}>Register Pharmacy</Text>
          <Text style={hero.sub}>Join the PharmFindr network</Text>
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
          <Path d={`M0,20 Q${width / 2},0 ${width},20 L${width},20 L0,20 Z`} fill="#ffffff" />
        </Svg>
      </View>
      <ScrollView contentContainerStyle={[s.form, { alignItems: 'center' }]}>
        <View style={succ.iconCircle}>
          <Ionicons name="checkmark-circle" size={52} color={GREEN} />
        </View>
        <Text style={succ.title}>You're All Set!</Text>
        <Text style={succ.body}>
          Your pharmacy has been registered on PharmFindr.
          {verified
            ? ' Your account is active — you can go to your dashboard now.'
            : ' Our team will verify it shortly.'}
        </Text>

        <View style={succ.summaryBox}>
          <Text style={[f.label, { marginBottom: 12 }]}>REGISTRATION SUMMARY</Text>
          {summaryRows.map(([k, v]) => (
            <View key={k} style={succ.row}>
              <Text style={succ.rowKey}>{k}</Text>
              <Text style={[
                succ.rowVal,
                k === 'Status' && { color: verified ? '#10b981' : '#f59e0b', fontWeight: '600' },
              ]}>{v}</Text>
            </View>
          ))}
        </View>

        {verified ? (
          <Pressable
            style={({pressed})=>[btn.base, pressed && { opacity: 0.5 }, { backgroundColor: GREEN, width: '100%', marginTop: 24 }]}
            onPress={onGoToDashboard}
          >
            <Text style={btn.text}>Go to Dashboard</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({pressed})=>[btn.base, pressed && { opacity: 0.5 }, { backgroundColor: GREEN, width: '100%', marginTop: 24 }]}
              onPress={onGoToLogin}
            >
              <Text style={btn.text}>Go to Login</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
              <ActivityIndicator size="small" color={GREEN} />
              <Text style={{ fontSize: 12, color: LABEL_COLOR }}>
                Waiting for account activation...
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const succ = StyleSheet.create({
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN + '18', justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 12 },
  body: { fontSize: 13, color: LABEL_COLOR, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  summaryBox: { width: '100%', backgroundColor: GREEN + '0f', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: GREEN + '30' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rowKey: { fontSize: 13, color: LABEL_COLOR },
  rowVal: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '500' },
});

// ── Shared form styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: '#ffffff' },
  form: { padding: 24, backgroundColor: '#ffffff' },
  secTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6 },
  secSub: { fontSize: 13, color: LABEL_COLOR, marginBottom: 20, lineHeight: 18 },
  errBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#ef4444', borderRadius: 12, padding: 12, marginBottom: 16 },
  errText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  successBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  successText: { color: '#047857', fontSize: 13, flex: 1 },
});

// ══ Main export: Orchestrates wizard steps ════════════════════════════════
export default function PharmacyRegister() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pharmName, setPharmName] = useState('');
  const [locationAddr, setLocationAddr] = useState('');

  const goBack = () => {
    if (step === 1) router.back();
    else setStep(prev => (prev - 1) as 1 | 2 | 3 | 4);
  };

  if (step === 5) return (
    <SuccessScreen
      phone={formattedPhone}
      email={email}
      pharmName={pharmName}
      locationAddr={locationAddr}
      onGoToLogin={() => router.replace({ pathname: '/(auth)/login', params: { initialRole: 'pharmacy' } })}
      onGoToDashboard={() => router.replace('/(pharmacy)/(tabs)/dashboard')}
    />
  );
  if (step === 4) return (
    <Step4Location phone={phone} formattedPhone={formattedPhone} email={email} pharmName={pharmName}
      onDone={(addr) => { setLocationAddr(addr); setStep(5); }} onBack={goBack} />
  );
  if (step === 3) return (
    <Step3Details
      onNext={(e, n) => { setEmail(e); setPharmName(n); setStep(4); }}
      onBack={goBack} />
  );
  if (step === 2) return (
    <Step2Verify
      phone={phone}
      formattedPhone={formattedPhone}
      onNext={() => setStep(3)}
      onBack={goBack}
    />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Step1Phone
        onNext={(p, formatted) => {
          setPhone(p);
          setFormattedPhone(formatted);
          setStep(2);
        }}
        onBack={goBack}
      />
    </View>
  );
}
