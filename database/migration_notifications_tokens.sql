-- ============================================================
-- PharmaFindr — Migration: Push Tokens Table & Notification Push Triggers
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

-- 1. PUSH TOKENS TABLE
--    Stores Expo push tokens mapped to user accounts for multi-device push delivery.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE,
  device_type  TEXT        DEFAULT 'mobile',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying tokens by user_id
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can select their own push tokens
CREATE POLICY "push_tokens_owner_select" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert/upsert their own push tokens
CREATE POLICY "push_tokens_owner_insert" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own push tokens
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own push tokens
CREATE POLICY "push_tokens_owner_delete" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);


-- 2. SUPABASE EDGE FUNCTION / WEBHOOK TRIGGER SPECIFICATION
--    Whenever a row is inserted into `public.notifications`, this function triggers
--    the push notification dispatcher to send the push alert to the user's Expo push tokens.

CREATE OR REPLACE FUNCTION public.notify_expo_push_on_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- This function acts as the trigger point for database change webhooks.
  -- Supabase Webhooks or Edge Functions listen to INSERT events on `public.notifications`
  -- and send Expo Push API requests to all active tokens in `public.push_tokens` where user_id = NEW.user_id.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_notification_created_push ON public.notifications;
CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_expo_push_on_notification();
