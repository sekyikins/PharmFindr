import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  BackHandler,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useChatStore, type Consultation } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { FormattedMarkdown } from '@/components/ui/FormattedMarkdown';

const SUGGESTION_CHIPS = [
  'What is this medicine for?',
  'Explain my prescription.',
  'Find this medicine nearby.',
  'Can I take this after food?',
  'What if I miss a dose?',
];

export default function AIChat() {
  const router = useRouter();
  const { theme, primaryColor } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const {
    consultations,
    activeConsultation,
    messages,
    loading,
    fetchConsultations,
    selectConsultation,
    getOrCreateGeneralConsultation,
    createConsultation,
    sendMessage,
    clearCurrentConsultation,
    deleteConsultation,
  } = useChatStore();

  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const MIN_HEIGHT = 44;
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [showBannerDetails, setShowBannerDetails] = useState(true);

  const slideAnim = useRef(new Animated.Value(-320)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const userId = user?.id;

  // Initialize consultations & select active thread
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      await fetchConsultations(userId);
      if (!activeConsultation) {
        const general = await getOrCreateGeneralConsultation(userId);
        await selectConsultation(userId, general.id);
      }
    };
    init();
  }, [userId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Sidebar animations
  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -320, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  // Hardware Back button
  useEffect(() => {
    if (!sidebarOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSidebar();
      return true;
    });
    return () => subscription.remove();
  }, [sidebarOpen]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSidebarOpen(false);
        slideAnim.setValue(-320);
        overlayOpacity.setValue(0);
      };
    }, [])
  );

  const handleSend = useCallback(
    (text?: string) => {
      const msgText = (text ?? inputText).trim();
      if (!msgText || loading) return;
      setInputText('');
      setInputHeight(MIN_HEIGHT);
      sendMessage(userId, msgText);
    },
    [inputText, loading, userId, sendMessage]
  );

  const handleSelectConsultation = async (consultationId: string) => {
    closeSidebar();
    if (userId) {
      await selectConsultation(userId, consultationId);
    }
  };

  const handleCreateTopicConsultation = async () => {
    if (!newTopicTitle.trim() || !userId) return;
    const title = `💊 ${newTopicTitle.trim()}`;
    setNewTopicTitle('');
    setShowNewConsultModal(false);
    closeSidebar();

    const created = await createConsultation(userId, {
      title,
      type: 'topic',
    });
    await selectConsultation(userId, created.id);

    // Initial message
    sendMessage(userId, `I would like to start a consultation about: ${newTopicTitle.trim()}. Please explain what I should know.`);
  };

  const handleClearCurrentThread = () => {
    closeSidebar();
    Alert.alert(
      'Clear Thread History',
      'Are you sure you want to clear messages in this consultation?',
      [
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearCurrentConsultation(userId),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteConsultationItem = (cId: string, title: string) => {
    Alert.alert(
      'Delete Consultation',
      `Delete "${title}" and all its messages?`,
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (userId) deleteConsultation(userId, cId);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      {cancelable: true}
    );
  };

  const isGeneral = !activeConsultation || activeConsultation.type === 'general';
  const hasMedicines = activeConsultation?.medicines && activeConsultation.medicines.length > 0;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const prescriptionConsultations = consultations.filter((c) => c.type !== 'general');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Sidebar Drawer ── */}
      {sidebarOpen && (
        <>
          <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
            <Pressable style={{ flex: 1 }} onPress={closeSidebar} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sidebar,
              {
                backgroundColor: theme.card,
                borderRightColor: theme.border,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: theme.text.primary }]}>Consultations</Text>
              <Pressable onPress={closeSidebar} style={({ pressed }) => [pressed && { opacity: 0.5 }, { padding: 4 }]}>
                <Ionicons name="close" size={22} color={theme.textDim} />
              </Pressable>
            </View>

            <View style={styles.sidebarBody}>
              {/* Start New Consultation Button */}
              <Pressable
                style={({ pressed }) => [pressed && { opacity: 0.5 }, styles.newChatBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  closeSidebar();
                  setShowNewConsultModal(true);
                }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.newChatText}>Start New Consultation</Text>
              </Pressable>

              {/* 1. General Assistant */}
                <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: 16 }]}>
                  GENERAL ASSISTANT
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.chatItem,
                    pressed && { opacity: 0.5 },
                    isGeneral && { backgroundColor: theme.patientSecondary, borderColor: theme.patient.primary, borderWidth: 1 },
                  ]}
                  onPress={async () => {
                    if (userId) {
                      const gen = await getOrCreateGeneralConsultation(userId);
                      handleSelectConsultation(gen.id);
                    }
                  }}
                >
                  <Ionicons name="chatbubbles-outline" size={18} color={primaryColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chatItemText, { color: theme.text.primary, fontWeight: isGeneral ? '700' : '500' }]}>
                      General Assistant
                    </Text>
                    <Text style={[styles.chatItemSub, { color: theme.textDim }]}>Everyday health questions</Text>
                  </View>
                </Pressable>

                {/* 2. Prescription Consultations */}
                <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: 10 }]}>
                  PRESCRIPTION CONSULTATIONS
                </Text>

              <ScrollView showsVerticalScrollIndicator={false}>             
                {prescriptionConsultations.length === 0 ? (
                  <Text style={[styles.emptySectionText, { color: theme.textDim }]}>
                    No prescription consultations yet. Scan a prescription to start one!
                  </Text>
                ) : (
                  prescriptionConsultations.map((item) => {
                    const isSelected = activeConsultation?.id === item.id;
                    return (
                      <View key={item.id} style={styles.consultationRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.chatItem,
                            { flex: 1 },
                            pressed && { opacity: 0.5 },
                            isSelected && { backgroundColor: theme.patientSecondary + '66' },
                          ]}
                          onPress={() => handleSelectConsultation(item.id)}
                        >
                          <Ionicons
                            name={item.type === 'prescription' ? 'receipt-outline' : 'medkit-outline'}
                            size={18}
                            color={primaryColor}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.chatItemText,
                                { color: theme.text.primary, fontWeight: isSelected ? '700' : '500' },
                              ]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text style={[styles.chatItemSub, { color: theme.textDim }]}>
                              {new Date(item.updated_at || item.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteConsultationItem(item.id, item.title)}
                          style={({ pressed }) => [pressed && { opacity: 0.5 }, { padding: 8 }]}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.error} />
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                <Pressable style={({ pressed }) => [styles.chatItem, pressed && { opacity: 0.5 }]} onPress={handleClearCurrentThread}>
                  <Ionicons name="trash-outline" size={18} color={theme.error} />
                  <Text style={[styles.chatItemText, { color: theme.error }]}>Clear Current Thread</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {/* ── Top Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.surfaceSecondary }]}
          onPress={openSidebar}
        >
          <Ionicons name="menu" size={22} color={theme.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {activeConsultation?.title || 'PharmFindr AI'}
          </Text>
          <View style={styles.badgeRow}>
            <Text style={[styles.onlineText, { color: theme.success }]}>● Online</Text>
            <View style={[styles.typePill, { backgroundColor: isGeneral ? theme.surfaceSecondary : theme.patientSecondary }]}>
              <Text style={[styles.typePillText, { color: isGeneral ? theme.textDim : primaryColor }]}>
                {isGeneral ? 'General Chat' : 'Consultation'}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => setShowNewConsultModal(true)}
        >
          <Ionicons name="add" size={20} color={theme.text.primary} />
        </Pressable>
      </View>

      {/* ── Active Consultation Prescription Context Banner ── */}
      {!isGeneral && hasMedicines && (
        <View style={[styles.prescriptionBanner, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Pressable
            style={styles.bannerHeader}
            onPress={() => setShowBannerDetails((v) => !v)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Ionicons name="medkit" size={18} color={primaryColor} />
              <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>
                Prescription Medicines ({activeConsultation?.medicines?.length || 0})
              </Text>
            </View>
            <Ionicons name={showBannerDetails ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textDim} />
          </Pressable>

          {showBannerDetails && (
            <View style={styles.bannerContent}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.medsRow}>
                {activeConsultation?.medicines?.map((med: any, idx: number) => (
                  <View key={idx} style={[styles.medPill, { backgroundColor: theme.patientSecondary, borderColor: primaryColor + '40' }]}>
                    <Text style={[styles.medPillText, { color: primaryColor }]}>
                      {med.name} {med.strength || ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.bannerActions}>
                <Pressable
                  style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.5 }, { backgroundColor: primaryColor }]}
                  onPress={() => {
                    const searchMed = activeConsultation?.medicines?.[0]?.name || '';
                    router.push({ pathname: '/(patient)/pharmacies', params: { query: searchMed } });
                  }}
                >
                  <Ionicons name="location-outline" size={14} color="#fff" />
                  <Text style={styles.bannerBtnText}>Find Pharmacies</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.bannerBtnOutline, pressed && { opacity: 0.5 }, { borderColor: theme.border }]}
                  onPress={() => router.push('/(patient)/reservations-history')}
                >
                  <Ionicons name="bag-handle-outline" size={14} color={theme.text.primary} />
                  <Text style={[styles.bannerBtnOutlineText, { color: theme.text.primary }]}>Reservations</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Main Chat Area ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 + insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && !loading && (
            <View style={{ alignItems: "center", justifyContent: "center", height: 400 }}>
              <View style={[styles.bubble, { backgroundColor: theme.card }]}>
                <Text style={[styles.bubbleTextAI, { color: theme.text.primary }]}>
                  {isGeneral
                    ? `Hello ${firstName}! 👋`
                    : `Welcome to your consultation for ${activeConsultation?.title}. How can I assist you with these medicines?`}
                </Text>
              </View>
            </View>
          )}

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.msgRow,
                msg.role === 'user' ? styles.msgRowUser : styles.msgRowAI,
              ]}
            >
              {msg.role === 'user' ? (
                <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: primaryColor }]}>
                  <Text style={styles.bubbleTextUser}>{msg.content}</Text>
                </View>
              ) : (
                <View style={[styles.bubbleAIContainer, { backgroundColor: theme.card }]}>
                  <FormattedMarkdown content={msg.content} />
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={[styles.msgRow, styles.msgRowAI]}>
              <View style={[styles.aiAvatarSmall, { backgroundColor: primaryColor }]}>
                <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
              </View>
              <View style={{ backgroundColor: theme.card }}>
                <ActivityIndicator size="small" color={primaryColor} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips */}
        {messages.length === 0 && (
          <ScrollView
            horizontal
            style={{ maxHeight: 44 }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {SUGGESTION_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.5 }, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleSend(chip)}
              >
                <Text style={[styles.chipText, { color: theme.text.primary }]}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input Bar */}
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSecondary,
                color: theme.text.primary,
                height: Math.max(MIN_HEIGHT, inputHeight),
              },
            ]}
            placeholder={isGeneral ? 'Ask general health question...' : 'Ask about your prescription...'}
            placeholderTextColor={theme.textDim}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onContentSizeChange={(e) => setInputHeight(Math.min(120, e.nativeEvent.contentSize.height))}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.5 },
              { backgroundColor: inputText.trim() ? primaryColor : theme.surfaceSecondary },
            ]}
            disabled={!inputText.trim() || loading}
            onPress={() => handleSend()}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? '#fff' : theme.textDim}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Start New Consultation Modal ── */}
      <Modal visible={showNewConsultModal} transparent animationType="fade" onRequestClose={() => setShowNewConsultModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewConsultModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Start a New Consultation</Text>
            <Text style={[styles.modalSub, { color: theme.textDim }]}>
              Organize your AI chat around a prescription or specific health topic.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.modalOption, pressed && { opacity: 0.5 }, { backgroundColor: theme.patientSecondary, borderColor: theme.patient.primary, borderWidth: 1 }]}
              onPress={() => {
                setShowNewConsultModal(false);
                router.push('/(patient)/scan');
              }}
            >
              <Ionicons name="camera-outline" size={22} color={primaryColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.text.primary }]}>Scan a Prescription</Text>
                <Text style={[styles.optionSub, { color: theme.textDim }]}>Auto-create consultation from scan</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.patient.primary} />
            </Pressable>

            <View style={{ marginVertical: 12 }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>OR ENTER A TOPIC NAME</Text>
              <TextInput
                style={[styles.topicInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
                placeholder="e.g. Headache Questions, BP Meds..."
                placeholderTextColor={theme.textDim}
                value={newTopicTitle}
                onChangeText={setNewTopicTitle}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.5 }, { borderColor: theme.border }]}
                onPress={() => setShowNewConsultModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.5 },
                  { backgroundColor: newTopicTitle.trim() ? primaryColor : theme.surfaceSecondary },
                ]}
                disabled={!newTopicTitle.trim()}
                onPress={handleCreateTopicConsultation}
              >
                <Text style={styles.modalConfirmText}>Start Consultation</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 90,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 300,
    zIndex: 100,
    borderRightWidth: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sidebarTitle: { fontSize: 18, fontWeight: '700' },
  sidebarBody: { flex: 1, padding: 16 },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    marginBottom: 12,
  },
  newChatText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sidebarSection: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  emptySectionText: { fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
  consultationRow: { flexDirection: 'row', alignItems: 'center' },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
    marginVertical: 2,
  },
  chatItemText: { fontSize: 14, fontWeight: '500' },
  chatItemSub: { fontSize: 11 },

  // Top Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineText: { fontSize: 10, fontWeight: '600' },
  typePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  typePillText: { fontSize: 9, fontWeight: '600' },

  // Prescription Banner
  prescriptionBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: 13, fontWeight: '700' },
  bannerContent: { marginTop: 8 },
  medsRow: { gap: 6, paddingBottom: 8 },
  medPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  medPillText: { fontSize: 11, fontWeight: '600' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bannerBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerBtnOutlineText: { fontSize: 12, fontWeight: '600' },

  // Chat Area
  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 12 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 6 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  aiAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAIContainer: {
    maxWidth: '100%',
    borderRadius: 16,
    padding: 16,
  },
  bubbleTextUser: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTextAI: { fontSize: 14, lineHeight: 20 },
  chipsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionTitle: { fontSize: 14, fontWeight: '700' },
  optionSub: { fontSize: 11 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  topicInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});