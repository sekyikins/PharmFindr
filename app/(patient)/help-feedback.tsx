import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
import { Header, HeaderIconBtn } from '@/components/ui/Header';

const FAQS = [
  {
    q: 'How do I search and reserve medicines near me?',
    a: 'Use the Search tab or Scan Prescription button to find medicines at nearby pharmacies. Tap on a pharmacy result and select "Reserve Medicine".',
  },
  {
    q: 'How does AI Prescription scanning work?',
    a: 'Take a clear photo of your written prescription using the Scan tab. Our Gemini AI automatically extracts medicine names, dosages, and search results.',
  },
  {
    q: 'Are the pharmacies on PharmFindr verified?',
    a: 'Yes, all partner pharmacies undergo strict verification and license check before listing inventory.',
  },
  {
    q: 'What should I do if my reservation is delayed?',
    a: 'You can check reservation updates in the Notifications tab or contact the pharmacy directly using their phone number listed on the pharmacy details page.',
  },
];

export default function HelpAndFeedback() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState<'General' | 'Bug Report' | 'Feature Request'>('General');
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // App Info Modal State
  const [appInfoVisible, setAppInfoVisible] = useState(false);

  // Terms & Privacy Modal State
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) {
      Alert.alert('Validation Error', 'Please write a message before submitting.');
      return;
    }
    setSubmittingFeedback(true);
    setTimeout(() => {
      setSubmittingFeedback(false);
      setFeedbackText('');
      Alert.alert('Thank You! 🙏', 'Your feedback has been sent to the PharmFindr support team.');
    }, 600);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ── */}
      <Header title="Help & Feedback" showBack onBack={() => router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/profile')} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. HELP CENTER (FAQS) ── */}
        <View>
          <View style={styles.cardTitleRow}>
            <Ionicons name="help-buoy-outline" size={22} color={primaryColor} />
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Help Center & FAQs</Text>
          </View>

          {FAQS.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <View key={idx} style={[styles.faqItem, { borderBottomColor: theme.border }]}>
                <Pressable
                  style={({pressed})=>[styles.faqHeader, pressed && {opacity: 0.5}]}
                  onPress={() => setExpandedFaq(isOpen ? null : idx)}
                >
                  <Text style={[styles.faqQuestion, { color: theme.text.primary }]}>{faq.q}</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textDim} />
                </Pressable>
                {isOpen && (
                  <Text style={[styles.faqAnswer, { color: theme.textMuted }]}>{faq.a}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── 2. SEND FEEDBACK ── */}
        <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderRadius: RADIUS.lg, marginTop: 10, padding: SPACING.md }}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="chatbox-ellipses-outline" size={22} color={primaryColor} />
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Send Feedback</Text>
          </View>
          <Text style={[styles.cardSub, { color: theme.textMuted }]}>
            We'd love to hear your thoughts, feature ideas, or bug reports!
          </Text>

          {/* Category Pills */}
          <View style={styles.categoryRow}>
            {(['General', 'Bug Report', 'Feature Request'] as const).map((cat) => {
              const active = feedbackCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={({pressed})=>[
                    styles.catPill, pressed && { opacity: 0.5 },
                    {
                      backgroundColor: active ? primaryColor : theme.surfaceSecondary,
                      borderColor: active ? primaryColor : theme.border,
                    },
                  ]}
                  onPress={() => setFeedbackCategory(cat)}
                >
                  <Text style={[styles.catPillText, { color: active ? '#ffffff' : theme.text.primary }]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[styles.feedbackInput, { backgroundColor: theme.surface, color: theme.text.primary, borderColor: theme.border }]}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Type your message here..."
            placeholderTextColor={theme.textDim}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Pressable
            style={({pressed})=>[styles.submitBtn, pressed && {opacity: 0.5}, { backgroundColor: primaryColor }]}
            onPress={handleSendFeedback}
            disabled={submittingFeedback}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>{submittingFeedback ? 'Sending...' : 'Send Feedback'}</Text>
          </Pressable>
        </View>

        {/* ── 3. LEGAL & APP INFO MENU ── */}
        <View style={{ marginTop: 16, paddingVertical: 0 }}>
          <Pressable style={({pressed})=>[styles.menuRow, pressed && { opacity: 0.5 }]} onPress={() => setLegalModalType('terms')}>
            <View style={styles.menuRowLeft}>
              <Ionicons name="document-text-outline" size={20} color={theme.textMuted} />
              <Text style={[styles.menuRowText, { color: theme.text.primary }]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

          <Pressable style={({pressed})=>[styles.menuRow, pressed && { opacity: 0.5 }]} onPress={() => setLegalModalType('privacy')}>
            <View style={styles.menuRowLeft}>
              <Ionicons name="shield-outline" size={20} color={theme.textMuted} />
              <Text style={[styles.menuRowText, { color: theme.text.primary }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

          <Pressable style={({pressed})=>[styles.menuRow, pressed && { opacity: 0.5 }]} onPress={() => setAppInfoVisible(true)}>
            <View style={styles.menuRowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={primaryColor} />
              <Text style={[styles.menuRowText, { color: theme.text.primary }]}>App Info</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        </View>
      </ScrollView>

      {/* ══ APP INFO MODAL (Centered display) ══ */}
      <Modal visible={appInfoVisible} transparent animationType="fade" onRequestClose={() => setAppInfoVisible(false)}>
        <Pressable style={[styles.modalOverlay]} onPress={() => setAppInfoVisible(false)}>
          <Pressable style={[styles.appInfoCard, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.appInfoContent}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.appInfoLogo}
                resizeMode="contain"
              />
              <Text style={[styles.appInfoTitle, { color: theme.text.primary }]}>PharmFindr</Text>
              <Text style={[styles.appInfoVersion, { color: primaryColor }]}>Version 1.0.0 (Build 100)</Text>

              <Text style={[styles.appInfoDesc, { color: theme.textMuted }]}>
                Connecting patients with verified local pharmacies instantly. Search medicines, and scan prescriptions seamlessly.
              </Text>
              <Text style={[styles.appInfoCopyright, { color: theme.textDim }]}>
                © 2026 PharmFindr Inc. All rights reserved.
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══ TERMS / PRIVACY MODAL ══ */}
      <Modal visible={legalModalType !== null} transparent animationType="slide" onRequestClose={() => setLegalModalType(null)}>
        <SafeAreaView style={[styles.legalModalContainer, { backgroundColor: theme.background }]}>
          <Header
            title={legalModalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            right={
              <HeaderIconBtn
                name="close"
                onPress={() => setLegalModalType(null)}
              />
            }
          />
          <ScrollView contentContainerStyle={{ padding: 10 }}>
            <Text style={[styles.legalText, { color: theme.text.primary }]}>
              {legalModalType === 'terms'
                ? `Welcome to PharmFindr.\n\n1. Acceptance of Terms\nBy accessing or using PharmFindr, you agree to comply with and be bound by these Terms of Service.\n\n2. Service Overview\nPharmFindr acts as an instant discovery and reservation platform connecting users with licensed pharmacies. We do not sell pharmaceuticals directly.\n\n3. Patient Responsibilities\nYou are responsible for verifying your prescription requirements with a licensed healthcare provider.`
                : `PharmFindr Privacy Policy\n\n1. Information We Collect\nWe collect personal data such as your name, phone number, and location coordinates to facilitate pharmacy lookup and reservation services.\n\n2. Health & Safety Data\nPersonal health profile information (e.g. allergies, conditions) is encrypted and strictly used for safety warnings during medicine searches.\n\n3. Data Security\nWe do not share your private medical data with unverified third parties.`}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 0,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: FONT_SIZE.md,
    marginBottom: 14,
  },

  // FAQs
  faqItem: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    paddingRight: 10,
  },
  faqAnswer: {
    fontSize: FONT_SIZE.md,
    marginTop: 8,
    lineHeight: 20,
    borderTopWidth: 1,
    
  },

  // Feedback
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  feedbackInput: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 12,
    fontSize: FONT_SIZE.lg,
    height: 100,
    marginBottom: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: RADIUS.pill,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },

  // Menu Rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
  },

  // App Info Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  appInfoCard: {
    width: '88%',
    borderRadius: RADIUS.xl,
    padding: 24,
    elevation: 10,
  },
  appInfoContent: {
    alignItems: 'center',
  },
  appInfoLogo: {
    width: 90,
    height: 90,
    marginBottom: 16,
  },
  appInfoTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: 16,
  },
  appInfoDesc: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  appInfoCopyright: {
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    marginBottom: 20,
  },
  appInfoCloseBtn: {
    width: '100%',
    height: 46,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appInfoCloseText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },

  // Legal Modal
  legalModalContainer: {
    flex: 1,
  },
  legalText: {
    fontSize: FONT_SIZE.lg,
    lineHeight: 24,
  },
});
