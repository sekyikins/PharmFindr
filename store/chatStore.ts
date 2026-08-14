import { create } from 'zustand';
import { askGemini } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { buildDynamicSystemInstruction } from '@/lib/userClinicalContext';

export interface Consultation {
  id: string;
  user_id: string;
  title: string;
  type: 'general' | 'prescription' | 'topic';
  prescription_id?: string | null;
  image_url?: string | null;
  medicines?: any[] | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  consultation_id?: string | null;
}

interface ChatState {
  consultations: Consultation[];
  activeConsultation: Consultation | null;
  messages: Message[];
  loading: boolean;
  loadingHistory: boolean;
  error: string | null;

  fetchConsultations: (userId: string) => Promise<void>;
  selectConsultation: (userId: string, consultationId: string) => Promise<void>;
  getOrCreateGeneralConsultation: (userId: string) => Promise<Consultation>;
  createConsultation: (
    userId: string,
    data: {
      title: string;
      type: 'general' | 'prescription' | 'topic';
      prescription_id?: string;
      image_url?: string;
      medicines?: any[];
    }
  ) => Promise<Consultation>;
  sendMessage: (userId: string | undefined, content: string) => Promise<void>;
  clearCurrentConsultation: (userId?: string) => Promise<void>;
  clearGeneralAssistantChats: (userId?: string) => Promise<void>;
  deleteConsultation: (userId: string, consultationId: string) => Promise<void>;
}


export const useChatStore = create<ChatState>((set, get) => ({
  consultations: [],
  activeConsultation: null,
  messages: [],
  loading: false,
  loadingHistory: false,
  error: null,

  // ── Fetch all consultations for user ─────────────────────────────────────
  fetchConsultations: async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache')) return;
        throw error;
      }

      const items = (data || []) as Consultation[];
      set({ consultations: items });
    } catch (e: any) {
      if (!e.message?.includes('schema cache')) {
        console.warn('fetchConsultations note:', e.message);
      }
    }
  },

  // ── Ensure a "General Assistant" consultation exists for user ────────────
  getOrCreateGeneralConsultation: async (userId: string) => {
    try {
      const { data: existing, error: selErr } = await supabase
        .from('consultations')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'general')
        .single();

      if (existing) {
        return existing as Consultation;
      }

      if (selErr && (selErr.code === '42P01' || selErr.message?.includes('schema cache'))) {
        throw selErr;
      }

      // Create initial General Assistant consultation
      const { data: created, error: createErr } = await supabase
        .from('consultations')
        .insert({
          user_id: userId,
          title: 'General Assistant',
          type: 'general',
        })
        .select('*')
        .single();

      if (createErr) throw createErr;
      return created as Consultation;
    } catch (e: any) {
      // Memory fallback if DB table not migrated yet
      return {
        id: 'general-temp',
        user_id: userId || 'guest',
        title: 'General Assistant',
        type: 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  // ── Select / load a specific consultation ────────────────────────────────
  selectConsultation: async (userId: string, consultationId: string) => {
    set({ loadingHistory: true, error: null });
    try {
      let target = get().consultations.find((c) => c.id === consultationId);

      if (!target && userId && consultationId !== 'general-temp') {
        const { data } = await supabase
          .from('consultations')
          .select('*')
          .eq('id', consultationId)
          .single();
        if (data) target = data as Consultation;
      }

      if (!target && userId) {
        target = await get().getOrCreateGeneralConsultation(userId);
      }

      set({ activeConsultation: target ?? null });

      // Load messages for this consultation
      if (userId && target && target.id !== 'general-temp') {
        let query = supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', userId);

        if (target.type === 'general') {
          // For General Chat, include messages matching consultation_id OR null consultation_id (legacy general chat)
          query = query.or(`consultation_id.eq.${target.id},consultation_id.is.null`);
        } else {
          query = query.eq('consultation_id', target.id);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (!error && data) {
          const mapped: Message[] = data.map((msg) => ({
            id: msg.id,
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
            created_at: msg.created_at,
            consultation_id: msg.consultation_id,
          }));
          set({ messages: mapped, loadingHistory: false, loading: false });
          return;
        }
      }

      set({ messages: [], loadingHistory: false, loading: false });
    } catch (e: any) {
      set({ loadingHistory: false, loading: false });
    }
  },

  // ── Create a new consultation ───────────────────────────────────────────
  createConsultation: async (userId, data) => {
    set({ loading: true });
    try {
      const { data: created, error } = await supabase
        .from('consultations')
        .insert({
          user_id: userId,
          title: data.title,
          type: data.type,
          prescription_id: data.prescription_id ?? null,
          image_url: data.image_url ?? null,
          medicines: data.medicines ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;

      const newConsultation = created as Consultation;
      set((state) => ({
        consultations: [newConsultation, ...state.consultations],
        activeConsultation: newConsultation,
        messages: [],
        loading: false,
      }));

      return newConsultation;
    } catch (e: any) {
      const fallback: Consultation = {
        id: `temp-${Date.now()}`,
        user_id: userId,
        title: data.title,
        type: data.type,
        prescription_id: data.prescription_id,
        image_url: data.image_url,
        medicines: data.medicines,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        consultations: [fallback, ...state.consultations],
        activeConsultation: fallback,
        messages: [],
        loading: false,
      }));
      return fallback;
    }
  },

  // ── Send message inside active consultation ──────────────────────────────
  sendMessage: async (userId, content) => {
    let active = get().activeConsultation;

    if (!active && userId) {
      active = await get().getOrCreateGeneralConsultation(userId);
      set({ activeConsultation: active });
    }

    const consultationId = active?.id;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      consultation_id: consultationId,
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: null,
    }));

    if (userId && consultationId && !consultationId.startsWith('temp')) {
      try {
        await supabase.from('chat_messages').insert({
          user_id: userId,
          consultation_id: consultationId,
          role: 'user',
          content,
        });
      } catch (err) {
        try {
          await supabase.from('chat_messages').insert({
            user_id: userId,
            role: 'user',
            content,
          });
        } catch (_) {}
      }
    }

    try {
      const customSystemInstruction = await buildDynamicSystemInstruction(active?.medicines || undefined);

      const conversationHistory = get()
        .messages.filter((m) => m.id !== userMsg.id)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const reply = await askGemini(content, conversationHistory, customSystemInstruction);

      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
        consultation_id: consultationId,
      };

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        loading: false,
      }));

      if (userId && consultationId && !consultationId.startsWith('temp')) {
        try {
          await supabase.from('chat_messages').insert({
            user_id: userId,
            consultation_id: consultationId,
            role: 'assistant',
            content: reply,
          });
        } catch (err) {
          try {
            await supabase.from('chat_messages').insert({
              user_id: userId,
              role: 'assistant',
              content: reply,
            });
          } catch (_) {}
        }
      }
    } catch (e: any) {
      set({
        error: e.message || 'Failed to generate response from Gemini',
        loading: false,
      });
    }
  },

  // ── Clear current consultation messages ─────────────────────────────────
  clearCurrentConsultation: async (userId) => {
    const active = get().activeConsultation;
    set({ messages: [], error: null });

    if (userId) {
      try {
        if (active?.type === 'general') {
          // General Assistant: Delete both consultation_id matching and legacy null consultation_id messages
          await supabase
            .from('chat_messages')
            .delete()
            .eq('user_id', userId)
            .or(`consultation_id.eq.${active.id},consultation_id.is.null`);
        } else if (active?.id && !active.id.startsWith('temp')) {
          await supabase
            .from('chat_messages')
            .delete()
            .eq('consultation_id', active.id);
        }
      } catch (err) {
        console.error('Failed to clear consultation messages:', err);
      }
    }
  },

  // ── Clear general assistant messages ONLY (Does NOT touch consultations) ─
  clearGeneralAssistantChats: async (userId) => {
    const active = get().activeConsultation;

    // If currently viewing General Assistant, clear active message list in UI
    if (!active || active.type === 'general') {
      set({ messages: [], error: null });
    }

    if (userId) {
      try {
        const gen = await get().getOrCreateGeneralConsultation(userId);
        await supabase
          .from('chat_messages')
          .delete()
          .eq('user_id', userId)
          .or(`consultation_id.eq.${gen.id},consultation_id.is.null`);
      } catch (err) {
        console.error('Failed to clear general assistant chats:', err);
      }
    } else {
      set({ messages: [], error: null });
    }
  },

  // ── Delete a consultation ────────────────────────────────────────────────
  deleteConsultation: async (userId, consultationId) => {
    set((state) => {
      const filtered = state.consultations.filter((c) => c.id !== consultationId);
      const isDeletingActive = state.activeConsultation?.id === consultationId;
      return {
        consultations: filtered,
        activeConsultation: isDeletingActive ? filtered[0] ?? null : state.activeConsultation,
        messages: isDeletingActive ? [] : state.messages,
      };
    });

    if (userId && !consultationId.startsWith('temp')) {
      try {
        await supabase.from('consultations').delete().eq('id', consultationId);
      } catch (err) {
        console.error('Failed to delete consultation:', err);
      }
    }
  },
}));
