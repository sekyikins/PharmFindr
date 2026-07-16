/**
 * Pharmacy Registration - 4-step wizard
 * Step 1: Phone number
 * Step 2: OTP verification
 * Step 3: Pharmacy details (email + name)
 * Step 4: Location (map pin)
 */
import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import MapView, { Marker } from 'react-native-maps';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

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
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <Text style={hero.title}>Register Pharmacy</Text>
          <Text style={hero.sub}>Join the PharmFindr network</Text>
          <StepBar current={step} />
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={36} viewBox={`0 0 ${width} 36`}>
          <Path d={`M0,0 Q${width/2},45 ${width},0 L${width},36 L0,36 Z`} fill="#ffffff" />
        </Svg>
      </View>
    </>
  );
}
const hero = StyleSheet.create({
  safe: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  back: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
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
    <Pressable style={[btn.base, { backgroundColor: color }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={btn.text}>{label}</Text>}
    </Pressable>
  );
}
const btn = StyleSheet.create({
  base: { height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

// ══ STEP 1: Phone Number ══════════════════════════════════════════════════
function Step1Phone({ onNext, onBack }: { onNext: (phone: string) => void; onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSend = async () => {
    if (!phone.trim()) { setErr('Please enter your phone number.'); return; }
    setLoading(true);
    setErr(null);
    // In production: send real OTP via SMS. For now advance immediately.
    setTimeout(() => { setLoading(false); onNext(phone.trim()); }, 600);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Hero step={1} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Enter your phone number</Text>
        <Text style={s.secSub}>We'll send an OTP to verify your number.</Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}
        <FieldLabel>PHONE NUMBER</FieldLabel>
        <InputRow icon="call-outline" placeholder="+233" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <PrimaryBtn label="Send OTP Code" onPress={handleSend} loading={loading} />
      </View>
    </ScrollView>
  );
}

// ══ STEP 2: OTP Verification ══════════════════════════════════════════════
function Step2Verify({ phone, onNext, onBack }: { phone: string; onNext: () => void; onBack: () => void }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleChange = (val: string, idx: number) => {
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleVerify = () => {
    const otp = code.join('');
    if (otp.length < 6) { setErr('Please enter the 6-digit code.'); return; }
    setLoading(true);
    setErr(null);
    // In production: verify OTP with server. For now advance immediately.
    setTimeout(() => { setLoading(false); onNext(); }, 600);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Hero step={2} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Verify your number</Text>
        <Text style={s.secSub}>Enter the 6-digit code sent to{' '}
          <Text style={{ fontWeight: '700', color: TEXT_PRIMARY }}>{phone}</Text>
        </Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}

        {/* OTP boxes */}
        <View style={otp.row}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r; }}
              style={[otp.box, digit ? otp.boxFilled : {}]}
              value={digit}
              onChangeText={v => handleChange(v, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <PrimaryBtn label="Verify & Continue" onPress={handleVerify} loading={loading} />

        <Pressable style={{ alignItems: 'center', marginTop: 20 }} onPress={onBack}>
          <Text style={{ color: LABEL_COLOR, fontSize: 14, fontWeight: '500' }}>← Change Number</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
const otp = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 12 },
  box: { width: 46, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: INPUT_BG, fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY },
  boxFilled: { borderColor: GREEN },
});

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
    <ScrollView contentContainerStyle={s.scroll}>
      <Hero step={3} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Pharmacy details</Text>
        <Text style={s.secSub}>Tell us a bit about your pharmacy.</Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}
        <FieldLabel>EMAIL ADDRESS</FieldLabel>
        <InputRow icon="mail-outline" placeholder="pharmacy@example.com" value={email} onChange={setEmail} keyboard="email-address" />
        <FieldLabel children="PHARMACY NAME" />
        <View style={{ marginTop: 16 }} />
        <InputRow icon="shield-checkmark-outline" placeholder="e.g. City Care Pharmacy" value={pharmName} onChange={setPharmName} />
        <PrimaryBtn label="Continue" onPress={handleContinue} loading={loading} />
      </View>
    </ScrollView>
  );
}

// ══ STEP 4: Location ══════════════════════════════════════════════════════
function Step4Location({ phone, email, pharmName, onDone, onBack }: {
  phone: string; email: string; pharmName: string;
  onDone: () => void; onBack: () => void;
}) {
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { loginMock } = useAuthStore();

  const handleConfirm = async () => {
    setLoading(true);
    setErr(null);
    try {
      // Mock successful registration and login
      loginMock(phone, 'pharmacy', pharmName);
      onDone();
    } catch (e: any) {
      setErr('Failed to register pharmacy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Hero step={4} onBack={onBack} />
      <View style={s.form}>
        <Text style={s.secTitle}>Select your location</Text>
        <Text style={s.secSub}>Tap a pharmacy pin to claim it, or tap the map to drop your own pin.</Text>
        {err && <View style={s.errBox}><Text style={s.errText}>{err}</Text></View>}
        {/* Search */}
        <View style={map.searchRow}>
          <Ionicons name="search-outline" size={16} color={PLACEHOLDER_COLOR} style={{ marginRight: 10 }} />
          <TextInput
            style={[f.input, { height: '100%' }]}
            placeholder="Search address or pharmacy name..."
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {/* Legend */}
        <View style={map.legend}>
          <View style={[map.dot, { backgroundColor: GREEN }]} />
          <Text style={map.legendText}>Known pharmacy</Text>
          <View style={[map.dot, { backgroundColor: '#2563eb', marginLeft: 16 }]} />
          <Text style={map.legendText}>Custom pin</Text>
        </View>
        {/* Map */}
        <View style={map.container}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{ latitude: 5.6037, longitude: -0.187, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            onPress={e => setPin(e.nativeEvent.coordinate)}
          >
            {pin && (
              <Marker coordinate={pin} pinColor="#2563eb" title="Custom Location" />
            )}
          </MapView>
        </View>
        {/* Selected location card */}
        {pin && (
          <View style={map.card}>
            <View style={[map.cardIcon, { backgroundColor: GREEN + '22' }]}>
              <Ionicons name="location" size={20} color={GREEN} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={map.cardTitle}>{pharmName}</Text>
              <Text style={map.cardSub}>
                Coordinates {Math.round(pin.latitude)}, {Math.round(pin.longitude)} · Pin dropped on map
              </Text>
            </View>
            <Pressable onPress={() => setPin(null)}>
              <Ionicons name="close-circle" size={22} color={PLACEHOLDER_COLOR} />
            </Pressable>
          </View>
        )}
        <PrimaryBtn label="Confirm Location" onPress={handleConfirm} loading={loading} />
      </View>
    </View>
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
function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: GREEN }}>
        <SafeAreaView edges={['top']} style={[hero.safe, { paddingBottom: 24 }]}>
          <Text style={hero.title}>Register Pharmacy</Text>
          <Text style={hero.sub}>Join the PharmFindr network</Text>
        </SafeAreaView>
      </View>
      <View style={{ backgroundColor: GREEN }}>
        <Svg width={width} height={36} viewBox={`0 0 ${width} 36`}>
          <Path d={`M0,0 Q${width/2},45 ${width},0 L${width},36 L0,36 Z`} fill="#ffffff" />
        </Svg>
      </View>
      <View style={[s.form, { alignItems: 'center' }]}>
        <View style={succ.iconCircle}>
          <Ionicons name="checkmark-circle" size={52} color={GREEN} />
        </View>
        <Text style={succ.title}>You're All Set!</Text>
        <Text style={succ.body}>
          Your pharmacy has been registered on PharmFindr. Our team will verify it within 24 hours.
        </Text>
        <View style={succ.summaryBox}>
          <Text style={[f.label, { marginBottom: 12 }]}>REGISTRATION SUMMARY</Text>
          {[['Phone', '+1'], ['Email', 'k'], ['Pharmacy Name', 'k'], ['Location', '45 Wellness Blvd'], ['Status', 'Pending Verification']].map(([k, v]) => (
            <View key={k} style={succ.row}>
              <Text style={succ.rowKey}>{k}</Text>
              <Text style={[succ.rowVal, k === 'Status' && { color: '#f59e0b', fontWeight: '600' }]}>{v}</Text>
            </View>
          ))}
        </View>
        <Pressable style={[btn.base, { backgroundColor: GREEN, width: '100%', marginTop: 24 }]} onPress={onDone}>
          <Text style={btn.text}>Go to Dashboard</Text>
        </Pressable>
        <Text style={{ fontSize: 12, color: LABEL_COLOR, marginTop: 12 }}>You can log in once your account is verified.</Text>
      </View>
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
  form: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, backgroundColor: '#ffffff' },
  secTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6 },
  secSub: { fontSize: 13, color: LABEL_COLOR, marginBottom: 20, lineHeight: 18 },
  errBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#ef4444', borderRadius: 12, padding: 12, marginBottom: 16 },
  errText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
});

// ══ Main export: Orchestrates wizard steps ════════════════════════════════
export default function PharmacyRegister() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pharmName, setPharmName] = useState('');

  const goBack = () => {
    if (step === 1) router.back();
    else setStep(prev => (prev - 1) as 1 | 2 | 3 | 4);
  };

  if (step === 5) return <SuccessScreen onDone={() => router.replace('/(pharmacy)/(tabs)/dashboard')} />;
  if (step === 4) return (
    <Step4Location phone={phone} email={email} pharmName={pharmName}
      onDone={() => setStep(5)} onBack={goBack} />
  );
  if (step === 3) return (
    <Step3Details
      onNext={(e, n) => { setEmail(e); setPharmName(n); setStep(4); }}
      onBack={goBack} />
  );
  if (step === 2) return (
    <Step2Verify phone={phone} onNext={() => setStep(3)} onBack={goBack} />
  );
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#fff' }}>
      <Step1Phone onNext={(p) => { setPhone(p); setStep(2); }} onBack={goBack} />
    </KeyboardAvoidingView>
  );
}
