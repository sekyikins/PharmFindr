import { COLORS, FONT_SIZE, RADIUS, SPACING } from '@/styles/theme';
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
  Alert,
  ActivityIndicator,
  BackHandler,
  Modal,
  Share,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useChatStore, type Consultation } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useNetworkStore } from '@/store/networkStore';
import { FormattedMarkdown } from '@/components/ui/FormattedMarkdown';
import { toast } from '@/context/ToastContext';
import KeyboardAwareContainer from '@/components/ui/KeyboardAwareContainer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82);

const FEATURED_PROMPTS = [
  {
    icon: 'medkit-outline',
    color: COLORS.pharmacyPrimary,
    title: 'Explain My Prescription',
    desc: 'Understand purpose & dosages of scanned medicines',
    prompt: 'Can you explain the usage and guidelines for my prescribed medicines?',
  },
  {
    icon: 'shield-checkmark-outline',
    color: COLORS.error,
    title: 'Check Safety & Interactions',
    desc: 'Avoid dangerous drug-drug interactions',
    prompt: 'Check if there are any known interactions or contraindications for my current medicines.',
  },
  {
    icon: 'location-outline',
    color: COLORS.info,
    title: 'Find Nearby Pharmacies',
    desc: 'Check inventory at verified pharmacies',
    prompt: 'Help me find nearby pharmacies that have my medicine in stock.',
  },
  {
    icon: 'time-outline',
    color: COLORS.purple,
    title: 'Dosage & Schedule Tips',
    desc: 'Best times and meal guidelines for taking meds',
    prompt: 'What is the best daily schedule and meal timing for taking my medications?',
  },
];

let hasShownClinicalToastSession = false;

export default function AIChat() {
  const router = useRouter();
  const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>();
  const { theme, primaryColor } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { user, profile, appUser } = useAuthStore();
  const {
    consultations,
    activeConsultation,
    messages,
    loading,
    loadingHistory,
    fetchConsultations,
    selectConsultation,
    getOrCreateGeneralConsultation,
    createConsultation,
    sendMessage,
    clearGeneralAssistantChats,
    deleteConsultation,
  } = useChatStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const MIN_HEIGHT = 44;
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [showBannerDetails, setShowBannerDetails] = useState(true);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const sidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = slideAnim.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const openSidebar = useCallback((velocity?: number) => {
    setSidebarOpen(true);
    setIsDragging(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      velocity: velocity ?? 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeSidebar = useCallback((velocity?: number) => {
    setIsDragging(false);
    Animated.spring(slideAnim, {
      toValue: -SIDEBAR_WIDTH,
      velocity: velocity ?? 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start(() => {
      setSidebarOpen(false);
    });
  }, [slideAnim]);

  // Swipe-to-open and swipe-to-close pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;

        if (!sidebarOpenRef.current) {
          // Swipe right anywhere on the screen to slide open sidebar
          return isHorizontal && dx > 15;
        } else {
          // Swipe left anywhere to slide closed sidebar
          return isHorizontal && dx < -15;
        }
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        if (!sidebarOpenRef.current) {
          // Dragging open from closed: dx is positive
          const newX = Math.min(0, -SIDEBAR_WIDTH + Math.max(0, dx));
          slideAnim.setValue(newX);
        } else {
          // Dragging closed from open: dx is negative
          const newX = Math.min(0, Math.max(-SIDEBAR_WIDTH, dx));
          slideAnim.setValue(newX);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        if (!sidebarOpenRef.current) {
          if (dx > SIDEBAR_WIDTH * 0.25 || vx > 0.35) {
            openSidebar(vx);
          } else {
            closeSidebar(vx);
          }
        } else {
          if (dx < -SIDEBAR_WIDTH * 0.25 || vx < -0.35) {
            closeSidebar(vx);
          } else {
            openSidebar(vx);
          }
        }
      },
      onPanResponderTerminate: () => {
        if (sidebarOpenRef.current) {
          openSidebar();
        } else {
          closeSidebar();
        }
      },
    })
  ).current;

  const userId = user?.id;

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setInputText(initialQuery);
    }
  }, [initialQuery]);

  // Initialize consultations & select active thread
  useEffect(() => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    let isMounted = true;
    const init = async () => {
      setIsInitializing(true);
      try {
        await fetchConsultations(userId);
        if (!activeConsultation) {
          const general = await getOrCreateGeneralConsultation(userId);
          await selectConsultation(userId, general.id);
        }
      } catch (e: any) {
        console.warn('Chat init note:', e.message);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Toast prompt for completely empty health profile (only if zero parameters filled & shown once per app session)
  useEffect(() => {
    if (!appUser || hasShownClinicalToastSession) return;

    const hasAnyHealthData = Boolean(
      appUser.age ||
      appUser.weight ||
      appUser.height ||
      (appUser.gender && appUser.gender !== 'Prefer not to say') ||
      (appUser.allergies && appUser.allergies.length > 0) ||
      (appUser.existing_conditions && appUser.existing_conditions.length > 0) ||
      (appUser.current_medications && appUser.current_medications.length > 0)
    );

    // Suppress toast if even a single field is filled in health parameters
    if (!hasAnyHealthData) {
      hasShownClinicalToastSession = true;
      const timer = setTimeout(() => {
        toast.clinical(
          'Complete your Health Profile (Age, Weight, Allergies) for customized AI safety alerts.',
          undefined,
          undefined,
          'Clinical Safety Alert'
        );
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [appUser]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Hardware Back button
  useEffect(() => {
    if (!sidebarOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSidebar();
      return true;
    });
    return () => subscription.remove();
  }, [sidebarOpen, closeSidebar]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSidebarOpen(false);
        setIsDragging(false);
        slideAnim.setValue(-SIDEBAR_WIDTH);
      };
    }, [slideAnim])
  );

  const handleSend = useCallback(
    (text?: string) => {
      const msgText = (text ?? inputText).trim();
      if (!msgText || loading) return;

      if (!useNetworkStore.getState().isConnected) {
        useNetworkStore.getState().triggerOfflineNotice();
      }

      setInputText('');
      setInputHeight(MIN_HEIGHT);
      sendMessage(userId, msgText);
    },
    [inputText, loading, userId, sendMessage]
  );

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await Share.share({ message: content });
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

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

    sendMessage(userId, `I would like to start a consultation about: ${newTopicTitle.trim()}. Please explain what I should know.`);
  };

  const handleClearAssistantChats = () => {
    closeSidebar();
    Alert.alert(
      'Clear Assistant Chats',
      'Are you sure you want to clear your chat history with the General AI Assistant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearGeneralAssistantChats(userId);
            if (userId) {
              const gen = await getOrCreateGeneralConsultation(userId);
              await selectConsultation(userId, gen.id);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteConsultationItem = (cId: string, title: string) => {
    Alert.alert(
      'Delete Consultation',
      `Delete "${title}" and all its messages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (userId) deleteConsultation(userId, cId);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const isGeneral = !activeConsultation || activeConsultation.type === 'general';
  const hasMedicines = activeConsultation?.medicines && activeConsultation.medicines.length > 0;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const prescriptionConsultations = consultations.filter((c) => c.type !== 'general');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']} {...panResponder.panHandlers}>
      {/* ── Sidebar Backdrop ── */}
      <Animated.View
        pointerEvents={sidebarOpen ? 'auto' : 'none'}
        style={[
          styles.backdrop,
          {
            opacity: overlayOpacity,
          },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => closeSidebar()} />
      </Animated.View>

      {/* ── Sidebar Drawer ── */}
      <Animated.View
        pointerEvents={sidebarOpen || isDragging ? 'auto' : 'none'}
        style={[
          styles.sidebar,
          {
            width: SIDEBAR_WIDTH,
            backgroundColor: theme.card,
            borderRightColor: theme.border,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Sidebar Header */}
        <View style={[styles.sidebarHeader, { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.border }]}>
            <Text style={[styles.sidebarTitle, { color: theme.text.primary }]}>Consultations</Text>
            <Text style={[styles.sidebarSub, { color: theme.textDim }]}>Clinical AI Chat Threads</Text>
        </View>

        <View style={styles.sidebarBody}>
          {/* Start New Consultation Button */}
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.8 }, styles.newChatBtn, { backgroundColor: primaryColor }]}
            onPress={() => {
              closeSidebar();
              setShowNewConsultModal(true);
            }}
          >
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={styles.newChatText}>Start New Consultation</Text>
          </Pressable>

          {/* 1. General Assistant */}
          <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: 14 }]}>ACTIVE ASSISTANT</Text>

          <Pressable
            style={({ pressed }) => [
              styles.chatItem,
              pressed && { opacity: 0.5 },
              isGeneral && { backgroundColor: theme.patientSecondary, borderColor: primaryColor + '40', borderWidth: 1 },
            ]}
            onPress={async () => {
              if (userId) {
                const gen = await getOrCreateGeneralConsultation(userId);
                handleSelectConsultation(gen.id);
              }
            }}
          >
            <View style={[styles.chatIconBox, { backgroundColor: primaryColor + '18' }]}>
              <Ionicons name="sparkles" size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chatItemText, { color: theme.text.primary, fontFamily: isGeneral ? 'Inter-Bold' : 'Inter-Medium' }]}>
                General AI Assistant
              </Text>
              <Text style={[styles.chatItemSub, { color: theme.textDim }]}>Everyday health &amp; medicine questions</Text>
            </View>
          </Pressable>

          {/* 2. Prescription Consultations */}
          <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: SPACING.lg }]}>PAST CONSULTATIONS</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {prescriptionConsultations.length === 0 ? (
              <View style={styles.emptyDrawerBox}>
                <Ionicons name="chatbubbles-outline" size={28} color={theme.textDim} />
                <Text style={[styles.emptySectionText, { color: theme.textDim }]}>
                  No saved consultations yet. Scan a prescription or start a topic consultation above!
                </Text>
              </View>
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
                        isSelected && { backgroundColor: theme.patientSecondary, borderWidth: 1, borderColor: primaryColor + '40' },
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
                            { color: theme.text.primary, fontFamily: isSelected ? 'Inter-Bold' : 'Inter-Medium' },
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
                      style={({ pressed }) => [pressed && { opacity: 0.5 }, { padding: SPACING.sm }]}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: SPACING.sm }}>
            <Pressable style={({ pressed }) => [styles.chatItem, pressed && { opacity: 0.5 }]} onPress={handleClearAssistantChats}>
              <Ionicons name="trash-outline" size={18} color={theme.error} />
              <Text style={[styles.chatItemText, { color: theme.error }]}>Clear Assistant Chats</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ── Top Header ── */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.5 }, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => openSidebar()}
        >
          <Ionicons name="menu" size={22} color={theme.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {activeConsultation?.title || 'PharmFindr AI'}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.onlineDot} />
            <Text style={[styles.onlineText, { color: COLORS.pharmacyPrimary }]}>Clinical AI</Text>
            <View style={[styles.typePill, { backgroundColor: isGeneral ? theme.surfaceSecondary : primaryColor + '18' }]}>
              <Text style={[styles.typePillText, { color: isGeneral ? theme.textDim : primaryColor }]}>
                {isGeneral ? 'General' : 'Consultation'}
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
          <Pressable style={styles.bannerHeader} onPress={() => setShowBannerDetails((v) => !v)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
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
                  <View key={idx} style={[styles.medPill, { backgroundColor: primaryColor + '12', borderColor: primaryColor + '30' }]}>
                    <Ionicons name="medical" size={12} color={primaryColor} />
                    <Text style={[styles.medPillText, { color: primaryColor }]}>
                      {med.name} {med.strength || ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.bannerActions}>
                <Pressable
                  style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.7 }, { backgroundColor: primaryColor }]}
                  onPress={() => {
                    const searchMed = activeConsultation?.medicines?.[0]?.name || '';
                    router.push({ pathname: '/(patient)/pharmacies', params: { query: searchMed } });
                  }}
                >
                  <Ionicons name="location-outline" size={14} color={COLORS.white} />
                  <Text style={styles.bannerBtnText}>Find Nearby Pharmacies</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Main Chat Area ── */}
      <KeyboardAwareContainer
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {(isInitializing || loadingHistory) && messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {/* Welcome Hero Card when thread is fresh/empty */}
            {messages.length === 0 && !loading && (
              <View style={styles.welcomeHeroContainer}>
                <View style={[styles.welcomeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={[styles.welcomeIconCircle, { backgroundColor: primaryColor + '15' }]}>
                    <Ionicons name="sparkles" size={26} color={primaryColor} />
                  </View>
                  <Text style={[styles.welcomeTitle, { color: theme.text.primary }]}>
                    {isGeneral ? `Hello ${firstName}! 👋` : activeConsultation?.title}
                  </Text>
                  <Text style={[styles.welcomeSubText, { color: theme.textMuted }]}>
                    I'm your clinical AI assistant. Ask me about medicine usage, side effects, dosages, or search for nearby pharmacy availability.
                  </Text>

                  <View style={styles.featuredGrid}>
                    {FEATURED_PROMPTS.map((promptItem) => (
                      <Pressable
                        key={promptItem.title}
                        style={({ pressed }) => [
                          styles.featuredCard,
                          { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => handleSend(promptItem.prompt)}
                      >
                        <View style={[styles.promptIconBox, { backgroundColor: promptItem.color + '15' }]}>
                          <Ionicons name={promptItem.icon as any} size={18} color={promptItem.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.promptTitle, { color: theme.text.primary }]}>{promptItem.title}</Text>
                          <Text style={[styles.promptDesc, { color: theme.textMuted }]}>{promptItem.desc}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

          {/* Messages */}
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
                <View style={styles.aiBubbleWrapper}>
                  <View style={[styles.aiHeaderRow]}>
                    <View style={[styles.aiBadgeCircle, { backgroundColor: primaryColor + '18' }]}>
                      <Ionicons name="sparkles" size={13} color={primaryColor} />
                    </View>
                    <Text style={[styles.aiBadgeName, { color: theme.textMuted }]}>PharmFindr AI</Text>
                  </View>

                  <View style={[styles.bubbleAIContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <FormattedMarkdown content={msg.content} />

                    {/* Copy & Actions Toolbar */}
                    <View style={styles.msgToolbar}>
                      <Pressable
                        style={({ pressed }) => [styles.toolbarBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => handleCopyMessage(msg.id, msg.content)}
                      >
                        <Ionicons
                          name={copiedMsgId === msg.id ? 'checkmark' : 'copy-outline'}
                          size={13}
                          color={copiedMsgId === msg.id ? COLORS.pharmacyPrimary : theme.textDim}
                        />
                        <Text style={[styles.toolbarBtnText, { color: copiedMsgId === msg.id ? COLORS.pharmacyPrimary : theme.textDim }]}>
                          {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Animated Loading Indicator */}
          {loading && (
            <View style={[styles.msgRow, styles.msgRowAI]}>
              <View style={[styles.aiBadgeCircle, { backgroundColor: primaryColor + '18' }]}>
                <Ionicons name="sparkles" size={13} color={primaryColor} />
              </View>
              <View style={[styles.loadingBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={[styles.loadingText, { color: theme.textDim }]}>Analyzing...</Text>
              </View>
            </View>
          )}
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
                borderColor: theme.border,
                height: Math.max(MIN_HEIGHT, inputHeight),
              },
            ]}
            placeholder={isGeneral ? 'Ask health or meds question...' : 'Ask about prescription...'}
            placeholderTextColor={theme.textDim}
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="send"
            blurOnSubmit={true}
            onSubmitEditing={() => handleSend()}
            onContentSizeChange={(e) => setInputHeight(Math.min(120, e.nativeEvent.contentSize.height))}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.7 },
              { backgroundColor: inputText.trim() ? primaryColor : theme.surfaceSecondary },
            ]}
            disabled={!inputText.trim() || loading}
            onPress={() => handleSend()}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim() ? COLORS.white : theme.textDim}
            />
          </Pressable>
        </View>
      </KeyboardAwareContainer>

      {/* ── Start New Consultation Modal ── */}
      <Modal visible={showNewConsultModal} transparent animationType="fade" onRequestClose={() => setShowNewConsultModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewConsultModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Start New Consultation</Text>
            <Text style={[styles.modalSub, { color: theme.textDim }]}>
              Organize your AI chat around a prescription scan or specific medical topic.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.modalOption,
                pressed && { opacity: 0.7 },
                { backgroundColor: primaryColor + '12', borderColor: primaryColor + '40', borderWidth: 1 },
              ]}
              onPress={() => {
                setShowNewConsultModal(false);
                router.push('/(patient)/scan');
              }}
            >
              <Ionicons name="camera-outline" size={22} color={primaryColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.text.primary }]}>Scan a Prescription</Text>
                <Text style={[styles.optionSub, { color: theme.textDim }]}>Auto-create consultation from Rx image scan</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={primaryColor} />
            </Pressable>

            <View style={{ marginVertical: SPACING.md }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>OR ENTER A SPECIFIC HEALTH TOPIC</Text>
              <TextInput
                style={[styles.topicInput, { backgroundColor: theme.surfaceSecondary, color: theme.text.primary, borderColor: theme.border }]}
                placeholder="e.g. Hypertension Meds, Allergy Questions..."
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
                  pressed && { opacity: 0.7 },
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
  container: {
    flex: 1
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 90,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  sidebarHeader: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1
  },
  sidebarTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: 'Inter-Bold'
  },
  sidebarSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm
  }, 
  sidebarBody: {
    flex: 1, padding: SPACING.lg, paddingBottom: SPACING.sm
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 44,
    borderRadius: RADIUS.xxl,
    marginBottom: SPACING.sm
  },
  newChatText: {
    color: COLORS.white, fontFamily: 'Inter-Bold', fontSize: FONT_SIZE.lg
  },
  sidebarSection: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', letterSpacing: 0.8, marginBottom: SPACING.sm
  },
  emptyDrawerBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  emptySectionText: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.md, textAlign: 'center', lineHeight: 16
  },
  consultationRow: {
    flexDirection: 'row', alignItems: 'center'
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginVertical: 3
  },
  chatIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chatItemText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold'
  },
  chatItemSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FONT_SIZE.sm, marginTop: SPACING.xs
  },

  // Top Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerCenter: {
    alignItems: 'center', flex: 1, paddingHorizontal: SPACING.sm
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold', textAlign: 'center'
  },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs
  },
  onlineDot: {
    width: 6, height: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.pharmacyPrimary
  },
  onlineText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold'
  },
  typePill: {
    paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm
  },
  typePillText: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold'
  },

  // Prescription Banner
  prescriptionBanner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1
  },
  bannerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  bannerTitle: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },
  bannerContent: {
    marginTop: SPACING.sm
  },
  medsRow: {
    gap: SPACING.xs, paddingBottom: SPACING.sm
  },
  medPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1
  },
  medPillText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold'
  },
  bannerActions: {
    flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs
  },
  bannerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill
  },
  bannerBtnText: {
    color: COLORS.white, fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },
  bannerBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1
  },
  bannerBtnOutlineText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-SemiBold'
  },

  // Chat Area
  messageList: {
    flex: 1
  },
  messageContent: {
    padding: SPACING.lg, paddingBottom: 0, gap: SPACING.md
  },
  msgRow: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm
  },
  msgRowUser: {
    justifyContent: 'flex-end'
  },
  msgRowAI: {
    justifyContent: 'flex-start'
  },

  welcomeHeroContainer: {
    paddingVertical: 10
  },
  welcomeCard: {
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1,
    alignItems: 'center'
  },
  welcomeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  welcomeTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: 'Inter-Bold', textAlign: 'center', marginBottom: 6
  },
  welcomeSubText: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, textAlign: 'center', lineHeight: 18, marginBottom: 18
  },

  featuredGrid: {
    width: '100%', gap: 10
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1
  },
  promptIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center'
  },
  promptTitle: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Bold'
  },
  promptDesc: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginTop: 1
  },

  aiBubbleWrapper: {
    width: '100%', gap: SPACING.xs
  },
  aiHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2
  },
  aiBadgeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center'
  },
  aiBadgeName: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-Bold'
  },

  bubble: {
    maxWidth: '82%',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 11
  },
  bubbleUser: {
    borderBottomRightRadius: 4
  },
  bubbleAIContainer: {
    maxWidth: '100%',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1
  },
  bubbleTextUser: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, lineHeight: 20, fontFamily: 'Inter-Medium'
  },

  msgToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)'
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs
  },
  toolbarBtnText: {
    fontSize: FONT_SIZE.sm, fontFamily: 'Inter-SemiBold'
  },

  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.xl,
    borderWidth: 1
  },
  loadingText: {
    fontSize: FONT_SIZE.md, fontFamily: 'Inter-Medium'
  },

  missingProfileBanner: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm
  },
  input: {
    fontFamily: 'Inter-Regular',
    
    flex: 1,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: FONT_SIZE.lg
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl
  },
  modalCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1
  },
  modalTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: 'Inter-Bold', marginBottom: SPACING.xs
  },
  modalSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.md, marginBottom: SPACING.lg, lineHeight: 18
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm
  },
  optionTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-Bold'
  },
  optionSub: {
    fontFamily: 'Inter-Regular',
     fontSize: FONT_SIZE.sm, marginTop: 1
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs, fontFamily: 'Inter-Bold', letterSpacing: 0.8, marginBottom: SPACING.xs
  },
  topicInput: {
    fontFamily: 'Inter-Regular',
    
    height: 44,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.lg,
    borderWidth: 1
  },
  modalBtnRow: {
    flexDirection: 'row', gap: 10, marginTop: SPACING.md
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  modalCancelText: {
    fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold'
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalConfirmText: {
    color: COLORS.white, fontSize: FONT_SIZE.lg, fontFamily: 'Inter-SemiBold'
  },

});