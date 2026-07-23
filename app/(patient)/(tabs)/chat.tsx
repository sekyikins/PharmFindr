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
  Keyboard,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeContext } from '@/hooks/useThemeContext';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

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
  const { messages, loading, fetchMessages, sendMessage, clearChat } = useChatStore();
  const scrollRef = useRef<ScrollView>(null);

  const [inputText, setInputText] = useState('');
  const MIN_HEIGHT = 44;
  const MAX_HEIGHT = 120;
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(-320)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Load chat history from Supabase
  useEffect(() => {
    if (user?.id) {
      fetchMessages(user.id);
    } else {
      clearChat();
    }
  }, [user?.id]);

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const openSidebar = () => {
    setSidebarOpen(true);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -320,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarOpen(false));
  };

  // Close sidebar on hardware Back button press
  useEffect(() => {
    if (!sidebarOpen) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSidebar();
      return true; // Prevent default back navigation
    });

    return () => subscription.remove();
  }, [sidebarOpen]);

  // Close sidebar when navigating away or switching tabs
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
      sendMessage(user?.id, msgText);
    },
    [inputText, loading, user?.id, sendMessage]
  );

  const hasUserMessages = messages.some((m) => m.role === 'user');
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const handleNewChat = () => {
    closeSidebar();
    clearChat();
  };

  const handleSidebarPrompt = (promptText: string) => {
    closeSidebar();
    handleSend(promptText);
  };

  const handleClearHistory = () => {
    closeSidebar();
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all your AI chat messages?',
      [
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            clearChat();
            if (user?.id) {
              await supabase.from('chat_messages').delete().eq('user_id', user.id);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {sidebarOpen && (
        <>
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.backdrop,
              {
                opacity: overlayOpacity,
              },
            ]}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={closeSidebar}
            />
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
              <Text style={[styles.sidebarTitle, { color: theme.text.primary }]}>
                PharmFindr AI
              </Text>
              <Pressable onPress={closeSidebar} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={theme.textDim} />
              </Pressable>
            </View>

            <View style={styles.sidebarBody}>
            <Pressable
              style={[styles.newChatBtn, { backgroundColor: primaryColor }]}
              onPress={handleNewChat}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.newChatText}>New Chat</Text>
            </Pressable>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: 16 }]}>
                QUICK ACCESS
              </Text>

              <Pressable
                style={styles.chatItem}
                onPress={() => {
                  closeSidebar();
                  router.push('/(patient)/scan');
                }}
              >
                <Ionicons name="camera-outline" size={18} color={primaryColor} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Scan Prescription
                </Text>
              </Pressable>

              <Pressable
                style={styles.chatItem}
                onPress={() => {
                  closeSidebar();
                  router.push('/(patient)/health-profile');
                }}
              >
                <Ionicons name="fitness-outline" size={18} color={primaryColor} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Health Parameters
                </Text>
              </Pressable>

              <Pressable
                style={styles.chatItem}
                onPress={() => {
                  closeSidebar();
                  router.push('/(patient)/prescription-history');
                }}
              >
                <Ionicons name="receipt-outline" size={18} color={primaryColor} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Prescription History
                </Text>
              </Pressable>

              <Text style={[styles.sidebarSection, { color: theme.textDim, marginTop: 16 }]}>
                SAMPLE PROMPTS
              </Text>

              <Pressable
                style={styles.chatItem}
                onPress={() => handleSidebarPrompt('What is general dietary and lifestyle advice for managing diabetes?')}
              >
                <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Diabetes Advice
                </Text>
              </Pressable>

              <Pressable
                style={styles.chatItem}
                onPress={() => handleSidebarPrompt('Can I take ibuprofen on an empty stomach?')}
              >
                <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Can I take ibuprofen?
                </Text>
              </Pressable>

              <Pressable
                style={styles.chatItem}
                onPress={() => handleSidebarPrompt('What is Amoxicillin used for and what are common side effects?')}
              >
                <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  What is Amoxicillin?
                </Text>
              </Pressable>

              <Pressable
                style={styles.chatItem}
                onPress={() => handleSidebarPrompt('Can you explain how to safely check for drug-drug interactions?')}
              >
                <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
                <Text style={[styles.chatItemText, { color: theme.text.primary }]}>
                  Drug Interaction Guide
                </Text>
              </Pressable>

              <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                <Pressable style={styles.chatItem} onPress={handleClearHistory}>
                  <Ionicons name="trash-outline" size={18} color={theme.error} />
                  <Text style={[styles.chatItemText, { color: theme.error }]}>
                    Clear Chat History
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
            </View>
          </Animated.View>
        </>
      )}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={[styles.menuBtn, { backgroundColor: theme.surfaceSecondary }]}
          onPress={openSidebar}
        >
          <Ionicons name="menu" size={22} color={theme.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={[styles.aiAvatar, { backgroundColor: primaryColor }]}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>PharmFindr AI</Text>
            <Text style={[styles.onlineText, { color: theme.success }]}>● Online</Text>
          </View>
        </View>

        <View style={[styles.newBadge, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.newBadgeText, { color: theme.text.primary }]}>AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          {/* Greeting message if no history */}
          {messages.length === 0 && !loading && (
            <View style={[styles.msgRow, styles.msgRowAI]}>
              <View style={[styles.aiAvatarSmall, { backgroundColor: primaryColor }]}>
                <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.card }]}>
                <Text style={[styles.bubbleTextAI, { color: theme.text.primary }]}>
                  Hello {firstName}! I'm your PharmFindr AI assistant. How can I help you today? 👋
                </Text>
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
              {msg.role === 'assistant' && (
                <View style={[styles.aiAvatarSmall, { backgroundColor: primaryColor }]}>
                  <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  msg.role === 'user'
                    ? [styles.bubbleUser, { backgroundColor: primaryColor }]
                    : [styles.bubbleAI, { backgroundColor: theme.card, shadowColor: theme.border }],
                ]}
              >
                <Text
                  style={
                    msg.role === 'user'
                      ? styles.bubbleTextUser
                      : [styles.bubbleTextAI, { color: theme.text.primary }]
                  }
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing indicator */}
          {loading && (
            <View style={[styles.msgRow, styles.msgRowAI]}>
              <View style={[styles.aiAvatarSmall, { backgroundColor: primaryColor }]}>
                <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.card }]}>
                <ActivityIndicator size="small" color={primaryColor} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion chips (show when no messages yet) */}
        {!hasUserMessages && (
          <ScrollView
            horizontal
            style={{ maxHeight: 44 }}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {SUGGESTION_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => handleSend(chip)}
              >
                <Text style={[styles.chipText, { color: theme.text.primary }]}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input Row */}
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: theme.card,
              borderTopColor: theme.border,
              paddingBottom: isKeyboardVisible ? 12 : insets.bottom > 0 ? insets.bottom : 12,
              paddingTop: 10,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                height: inputHeight,
                backgroundColor: theme.surfaceSecondary,
                color: theme.text.primary,
              },
            ]}
            placeholder="Ask about your medications..."
            placeholderTextColor={theme.textDim}
            value={inputText}
            multiline
            blurOnSubmit={false}
            textAlignVertical="top"
            onChangeText={(text) => {
              setInputText(text);
              if (text === '') setInputHeight(MIN_HEIGHT);
            }}
            onContentSizeChange={(event) => {
              const h = event.nativeEvent.contentSize.height;
              setInputHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h)));
            }}
          />

          <Pressable
            style={[
              styles.sendBtn,
              {
                backgroundColor: primaryColor,
                opacity: inputText.trim() && !loading ? 1 : 0.5,
              },
            ]}
            onPress={() => handleSend()}
            disabled={loading}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 5,
  },

  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    borderRightWidth: 1,
    zIndex: 6,
  },

  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: "#E1E1E1",
    borderBottomWidth: 1,
    padding: 18,
  },

  sidebarBody: {
    padding: 18,
  },

  sidebarTitle: {
    fontSize: 20,
    fontWeight: "700",
    paddingVertical: 8,
  },

  newChatBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  newChatText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  sidebarSection: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
  },

  chatItemText: {
    flex: 1,
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  aiAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  onlineText: {
    fontSize: 11,
    fontWeight: '500',
  },

  newBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  messageList: { flex: 1 },

  messageContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  msgRowAI: { justifyContent: 'flex-start' },

  msgRowUser: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 14,
  },

  bubbleAI: {
    borderBottomLeftRadius: 4,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#d1d1d1ff",
  },

  bubbleUser: {
    borderBottomRightRadius: 4,
  },

  bubbleTextAI: {
    fontSize: 14,
    lineHeight: 20,
  },

  bubbleTextUser: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },

  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },

  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  chipText: {
    fontSize: 13,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    gap: 10,
  },

  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});