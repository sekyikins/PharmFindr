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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { COLORS,  FONT_SIZE, RADIUS, SPACING  } from '@/styles/theme';
import { Header, HeaderIconBtn } from '@/components/ui/Header';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '@/constants/legal';
import { useHardwareBack } from '@/hooks/useHardwareBack';

interface FaqItem {
  id: string;
  category: 'Reservations' | 'Prescriptions' | 'Pharmacies' | 'Account';
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    id: 'f1',
    category: 'Reservations',
    q: 'How do I search and reserve medicines near me?',
    a: 'Use the Search tab or Scan Prescription button to find medicines at nearby registered pharmacies. Select your pharmacy and tap "Reserve Medicine" to hold your prescription items.',
  },
  {
    id: 'f2',
    category: 'Prescriptions',
    q: 'How does AI Prescription scanning work?',
    a: 'Take a clear photo of your handwritten or printed prescription using the Scan tab. Our Gemini AI automatically extracts medicine names, dosages, and searches local pharmacy inventory.',
  },
  {
    id: 'f3',
    category: 'Pharmacies',
    q: 'Are all listed pharmacies verified on PharmFindr?',
    a: 'Yes, all partner pharmacies undergo strict licensing checks with official healthcare regulatory authorities before inventory listing.',
  },
  {
    id: 'f4',
    category: 'Reservations',
    q: 'What should I do if my reservation is delayed?',
    a: 'You can check real-time status updates in your Reservations tab or call the pharmacy directly using the phone button on their details page.',
  },
  {
    id: 'f5',
    category: 'Account',
    q: 'How do I turn on Face ID or Fingerprint login?',
    a: 'Go to Profile > Edit Account > Security & Privacy, and toggle on Biometric Lock. Ensure Face ID or fingerprint is enabled in your device settings.',
  },
  {
    id: 'f6',
    category: 'Account',
    q: 'What happens if I lose internet connection?',
    a: 'PharmFindr has built-in offline resilience. Your saved medicines and recent searches remain accessible, and any profile changes automatically sync once internet connection is restored.',
  },
];

const FAQ_CATEGORIES = ['All', 'Reservations', 'Prescriptions', 'Pharmacies', 'Account'];

export default function HelpAndFeedback() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();

  useHardwareBack(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(patient)/(tabs)/profile');
    }
    return true;
  });

  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // App Info Modal State
  const [appInfoVisible, setAppInfoVisible] = useState(false);

  // Terms & Privacy Modal State
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  const filteredFaqs = FAQS.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const q = faqSearchQuery.trim().toLowerCase();
    const matchesSearch = !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleContactSupportPhone = () => {
    Linking.openURL('tel:+233556590885').catch(() => {
      Alert.alert('Contact Support', 'Call support at +233 556 590 885.');
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title="Help & Support"
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/(patient)/(tabs)/profile'))}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── 2. FAQ HELP CENTER ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.textDim }]}>FREQUENTLY ASKED QUESTIONS</Text>
        </View>

        {/* FAQ Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Search FAQs..."
            placeholderTextColor={theme.textMuted}
            value={faqSearchQuery}
            onChangeText={setFaqSearchQuery}
          />
          {faqSearchQuery.length > 0 && (
            <Pressable onPress={() => setFaqSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {/* FAQ Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {FAQ_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isSelected
                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                    : { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, { color: isSelected ? COLORS.white : theme.text.primary }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FAQ Accordion List */}
        <View style={[styles.faqCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isOpen = expandedFaq === faq.id;
              return (
                <View
                  key={faq.id}
                  style={[
                    styles.faqItem,
                    idx < filteredFaqs.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.faqHeader, pressed && { opacity: 0.6 }]}
                    onPress={() => setExpandedFaq(isOpen ? null : faq.id)}
                  >
                    <Text style={[styles.faqQuestion, { color: theme.text.primary }]}>{faq.q}</Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textDim} />
                  </Pressable>
                  {isOpen && <Text style={[styles.faqAnswer, { color: theme.textMuted }]}>{faq.a}</Text>}
                </View>
              );
            })
          ) : (
            <View style={{ padding: SPACING.xxl, alignItems: 'center' }}>
              <Ionicons name="help-circle-outline" size={36} color={theme.textDim} style={{ marginBottom: SPACING.sm }} />
              <Text style={[styles.noFaqText, { color: theme.textMuted }]}>
                No FAQs matched "{faqSearchQuery}". Try adjusting your search term.
              </Text>
            </View>
          )}
        </View>

        {/* ── 3. DIRECT CONTACT SUPPORT ── */}
        <Text style={[styles.sectionHeading, { color: theme.textDim, marginTop: SPACING.xxl }]}>DIRECT SUPPORT</Text>
        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
            onPress={handleContactSupportPhone}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: theme.patientSecondary }]}>
              <Ionicons name="call-outline" size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: theme.text.primary }]}>Support Phone & WhatsApp</Text>
              <Text style={[styles.menuSub, { color: theme.textMuted }]}>Available Mon–Sat, 8:00 AM – 8:00 PM</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        </View>

        {/* ── 4. LEGAL & APP INFO ── */}
        <Text style={[styles.sectionHeading, { color: theme.textDim, marginTop: SPACING.xxl }]}>LEGAL & APP INFO</Text>
        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
            onPress={() => setLegalModalType('terms')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
            </View>
            <Text style={[styles.menuTitle, { flex: 1, color: theme.text.primary }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
            onPress={() => setLegalModalType('privacy')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textMuted} />
            </View>
            <Text style={[styles.menuTitle, { flex: 1, color: theme.text.primary }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
            onPress={() => setAppInfoVisible(true)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="information-circle-outline" size={18} color={primaryColor} />
            </View>
            <Text style={[styles.menuTitle, { flex: 1, color: theme.text.primary }]}>App Info & Version</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        </View>

        {/* Send Feedback Card */}
          <Pressable
            style={({ pressed }) => [
              styles.hubCard,
              { backgroundColor: theme.patientSecondary, borderColor: primaryColor },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.push('/(patient)/send-feedback')}
          >
            <View style={[styles.hubIconCircle, { backgroundColor: primaryColor }]}>
              <Ionicons name="chatbubbles" size={22} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubTitle, { color: theme.text.primary }]}>Send Feedback</Text>
              <Text style={[styles.hubSub, { color: theme.textMuted }]}>
                Share your ideas, feature requests, or report bugs
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={primaryColor} />
          </Pressable>
      </ScrollView>

      {/* ══ APP INFO MODAL ══ */}
      <Modal visible={appInfoVisible} transparent animationType="fade" onRequestClose={() => setAppInfoVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAppInfoVisible(false)}>
          <Pressable style={[styles.appInfoCard, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.appInfoContent}>
              <Image source={require('@/assets/images/icon.png')} style={styles.appInfoLogo} resizeMode="contain" />
              <Text style={[styles.appInfoTitle, { color: theme.text.primary }]}>PharmFindr</Text>
              <Text style={[styles.appInfoVersion, { color: primaryColor }]}>Version 1.0.0 (Build 100)</Text>

              <Text style={[styles.appInfoDesc, { color: theme.textMuted }]}>
                Connecting patients with verified local pharmacies instantly. Search medicines, reserve stock, and scan prescriptions seamlessly.
              </Text>
              <Text style={[styles.appInfoCopyright, { color: theme.textDim }]}>
                © 2026 PharmFindr Inc. All rights reserved.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, { backgroundColor: primaryColor }, pressed && { opacity: 0.7 }]}
                onPress={() => setAppInfoVisible(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══ TERMS / PRIVACY MODAL ══ */}
      <Modal visible={legalModalType !== null} transparent animationType="slide" onRequestClose={() => setLegalModalType(null)}>
        <SafeAreaView style={[styles.legalModalContainer, { backgroundColor: theme.background }]}>
          <Header
            title={legalModalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            right={<HeaderIconBtn name="close" onPress={() => setLegalModalType(null)} />}
          />
          <ScrollView contentContainerStyle={{ padding: SPACING.xl }} showsVerticalScrollIndicator={false}>
            {legalModalType && (
              <View style={{ gap: 18 }}>
                <View style={[styles.legalMetaCard, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                  <Ionicons
                    name={legalModalType === 'terms' ? 'document-text' : 'shield-checkmark'}
                    size={24}
                    color={primaryColor}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.legalMetaTitle, { color: theme.text.primary }]}>
                      {legalModalType === 'terms' ? 'PharmFindr Terms of Service' : 'PharmFindr Patient Privacy Policy'}
                    </Text>
                    <Text style={[styles.legalMetaSub, { color: theme.textMuted }]}>
                      Version {legalModalType === 'terms' ? TERMS_OF_SERVICE.version : PRIVACY_POLICY.version} · Updated{' '}
                      {legalModalType === 'terms' ? TERMS_OF_SERVICE.lastUpdated : PRIVACY_POLICY.lastUpdated}
                    </Text>
                  </View>
                </View>

                {(legalModalType === 'terms' ? TERMS_OF_SERVICE.sections : PRIVACY_POLICY.sections).map((sec) => (
                  <View key={sec.id} style={[styles.legalSectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.legalSectionTitle, { color: theme.text.primary }]}>{sec.title}</Text>
                    <Text style={[styles.legalSectionContent, { color: theme.textMuted }]}>{sec.content}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md
  },

  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: 10,
    borderWidth: 1,
    gap: 14
  },
  hubIconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center'
  },
  hubTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  hubSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginTop: 2, lineHeight: 16
  },

  sectionHeading: {
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm
  },
  sectionHeaderRow: {
    marginBottom: SPACING.xs
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 44,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    marginBottom: 10
  },
  searchInput: {
    fontFamily: 'Inter-Regular',
     flex: 1, fontSize: FONT_SIZE.md
  },

  categoryScroll: {
    gap: SPACING.sm, marginBottom: 14
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  categoryChipText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold'
  },

  faqCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden'
  },
  faqItem: {
    padding: SPACING.lg
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md
  },
  faqQuestion: {
    flex: 1, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  faqAnswer: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginTop: SPACING.sm, lineHeight: 19
  },
  noFaqText: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, textAlign: 'center'
  },

  menuCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    gap: SPACING.md
  },
  menuIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold'
  },
  menuSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginTop: 1
  },
  rowDivider: {
    height: 1, marginLeft: 62
  },

  // App Info Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl
  },
  appInfoCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl
  },
  appInfoContent: {
    alignItems: 'center'
  },
  appInfoLogo: {
    width: 64, height: 64, marginBottom: SPACING.md
  },
  appInfoTitle: {
    fontSize: FONT_SIZE.title, fontFamily: 'Inter-Bold'
  },
  appInfoVersion: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold', marginTop: 2, marginBottom: SPACING.md
  },
  appInfoDesc: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, textAlign: 'center', lineHeight: 18, marginBottom: SPACING.lg
  },
  appInfoCopyright: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginBottom: SPACING.xl
  },
  modalCloseBtn: {
    width: '100%',
    height: 44,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCloseBtnText: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },

  legalModalContainer: {
    flex: 1
  },
  legalMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1
  },
  legalMetaTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  legalMetaSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginTop: 2
  },
  legalSectionCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1
  },
  legalSectionTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold', marginBottom: SPACING.sm
  },
  legalSectionContent: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, lineHeight: 20
  },

});
