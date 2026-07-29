import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'reservation' | 'availability' | 'medication' | 'system' | 'info';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  sent_at: string | null;
  metadata: Record<string, any> | null;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  /** Active Supabase realtime channel — kept so we can unsubscribe cleanly */
  _channel: RealtimeChannel | null;

  /** Fetch the latest notifications for the signed-in user */
  fetchNotifications: (userId: string) => Promise<void>;
  /** Pull-to-refresh (sets refreshing instead of loading) */
  refreshNotifications: (userId: string) => Promise<void>;
  /** Mark a single notification as read */
  markRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllRead: (userId: string) => Promise<void>;
  /** Subscribe to real-time inserts so the badge updates live */
  subscribe: (userId: string) => void;
  /** Unsubscribe and clean up the channel */
  unsubscribe: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshing: false,
  _channel: null,

  // ── Fetch ─────────────────────────────────────────────────────────────────

  fetchNotifications: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const items = (data ?? []) as Notification[];
      set({
        notifications: items,
        unreadCount: items.filter((n) => !n.is_read).length,
      });
    } catch (e: any) {
      console.warn('[NotificationStore] fetchNotifications:', e.message);
    } finally {
      set({ loading: false });
    }
  },

  // ── Refresh (pull-to-refresh) ─────────────────────────────────────────────

  refreshNotifications: async (userId: string) => {
    set({ refreshing: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const items = (data ?? []) as Notification[];
      set({
        notifications: items,
        unreadCount: items.filter((n) => !n.is_read).length,
      });
    } catch (e: any) {
      console.warn('[NotificationStore] refreshNotifications:', e.message);
    } finally {
      set({ refreshing: false });
    }
  },

  // ── Mark single read ──────────────────────────────────────────────────────

  markRead: async (id: string) => {
    // Optimistic update
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.warn('[NotificationStore] markRead:', error.message);
    }
  },

  // ── Mark all read ─────────────────────────────────────────────────────────

  markAllRead: async (userId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.warn('[NotificationStore] markAllRead:', error.message);
    }
  },

  // ── Realtime subscription ─────────────────────────────────────────────────

  subscribe: (userId: string) => {
    // Avoid creating duplicate channels
    if (get()._channel) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          set((state) => ({
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));
        }
      )
      .subscribe();

    set({ _channel: channel });
  },

  unsubscribe: () => {
    const ch = get()._channel;
    if (ch) {
      supabase.removeChannel(ch);
      set({ _channel: null });
    }
  },
}));
