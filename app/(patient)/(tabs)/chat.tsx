import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, Message } from '@/store/chatStore';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/ui/Header';

const SUGGESTED_PROMPTS = [
  'Amoxicillin 500mg dosage?',
  'Paracetamol side effects?',
  'How to store antibiotics?',
];

export default function Chat() {
  const { user } = useAuthStore();
  const { messages, loading, error, fetchMessages, sendMessage, clearChat } = useChatStore();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = colors[isDark ? 'dark' : 'light'];

  const [inputVal, setInputVal] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (user) {
      fetchMessages(user.id);
    }
  }, [user]);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const text = inputVal;
    setInputVal('');
    sendMessage(user?.id, text);
  };

  const handleSuggest = (promptText: string) => {
    sendMessage(user?.id, promptText);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[
        styles.msgBubbleWrapper, 
        isUser ? styles.msgRight : styles.msgLeft
      ]}>
        <View style={[
          styles.msgBubble,
          { 
            backgroundColor: isUser ? theme.patient.primary : theme.surface,
            borderColor: isUser ? 'transparent' : theme.border,
            borderWidth: isDark ? 0 : 1,
          }
        ]}>
          <Text style={[
            styles.msgText, 
            { color: isUser ? '#ffffff' : theme.text.primary }
          ]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header 
        title="AI Health Assistant" 
        rightElement={
          <Pressable onPress={clearChat} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color={theme.patient.primary} />
          </Pressable>
        }
      />

      {/* Suggested Prompts on top if empty */}
      {messages.length === 0 && (
        <View style={styles.suggestedContainer}>
          <Text style={[styles.suggestTitle, { color: theme.text.secondary }]}>
            How can I help you today?
          </Text>
          <View style={styles.suggestPills}>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <Pressable 
                key={i} 
                style={[styles.suggestPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => handleSuggest(p)}
              >
                <Text style={[styles.suggestText, { color: theme.patient.primary }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.typingContainer}>
          <ActivityIndicator size="small" color={theme.patient.primary} />
          <Text style={[styles.typingText, { color: theme.text.muted }]}>Gemini is typing...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { color: theme.text.primary }]}
            placeholder="Ask about prescription details..."
            placeholderTextColor={theme.text.muted}
            value={inputVal}
            onChangeText={setInputVal}
            onSubmitEditing={handleSend}
          />
          <Pressable 
            style={[styles.sendBtn, { backgroundColor: theme.patient.primary }]}
            onPress={handleSend}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearBtn: {
    padding: 8,
  },
  suggestedContainer: {
    padding: 24,
    alignItems: 'center',
  },
  suggestTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  suggestPills: {
    width: '100%',
    gap: 12,
  },
  suggestPill: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  suggestText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  msgBubbleWrapper: {
    width: '100%',
    marginVertical: 4,
    flexDirection: 'row',
  },
  msgRight: {
    justifyContent: 'flex-end',
  },
  msgLeft: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 12,
  },
  errorContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    paddingHorizontal: 16,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
