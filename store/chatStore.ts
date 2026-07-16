import { create } from 'zustand';
import { askGemini } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  fetchMessages: (userId: string) => Promise<void>;
  sendMessage: (userId: string | undefined, content: string) => Promise<void>;
  clearChat: () => void;
}

const SYSTEM_INSTRUCTION = `You are PharmFindr's AI Health Assistant, a professional and helpful medical chat assistant.
Your goal is to help patients understand prescriptions, explain medicine purposes, dosage, frequency, precautions, and possible side effects.
Also, guide them to search for nearby pharmacies or make medicine reservations within the app.
Always keep in mind:
- Explain clearly but always add a disclaimer that you are an AI assistant and they should consult a pharmacist/doctor.
- Help correct spelling errors or clarify handwritten notes scanned by OCR.
- Keep answers concise and patient-friendly. Use bullet points for readability.`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,

  fetchMessages: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const mapped: Message[] = (data || []).map(msg => ({
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        created_at: msg.created_at,
      }));

      set({ messages: mapped, loading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch messages', loading: false });
    }
  },

  sendMessage: async (userId, content) => {
    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: null,
    }));

    // If logged in, save user message to Supabase
    if (userId) {
      try {
        await supabase.from('chat_messages').insert({
          user_id: userId,
          role: 'user',
          content,
        });
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    try {
      // Get conversation history formatted for Gemini
      const conversationHistory = get().messages
        .filter(m => m.id !== userMsg.id) // Exclude current unsaved user message to avoid duplicate
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Call Gemini API
      const reply = await askGemini(content, conversationHistory, SYSTEM_INSTRUCTION);
      
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };

      set(state => ({
        messages: [...state.messages, assistantMsg],
        loading: false,
      }));

      // If logged in, save assistant message to Supabase
      if (userId) {
        try {
          await supabase.from('chat_messages').insert({
            user_id: userId,
            role: 'assistant',
            content: reply,
          });
        } catch (err) {
          console.error('Failed to save assistant message:', err);
        }
      }
    } catch (e: any) {
      set({ 
        error: e.message || 'Failed to generate response from Gemini', 
        loading: false 
      });
    }
  },

  clearChat: () => {
    set({ messages: [], error: null });
  },
}));
