-- ============================================================
-- PharmaFindr — Migration: Push Tokens Table & Modern Edge Function Trigger
-- Paste into Supabase SQL Editor and Run. (Idempotent & Safe to Re-run)
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
DROP POLICY IF EXISTS "push_tokens_owner_select" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_select" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert/upsert their own push tokens
DROP POLICY IF EXISTS "push_tokens_owner_insert" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_insert" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own push tokens
DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own push tokens
DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_delete" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);


-- 2. ENABLE PG_NET EXTENSION
--    Allows Postgres triggers to make async HTTP requests directly to Edge Functions.
CREATE EXTENSION IF NOT EXISTS pg_net;


-- 3. POSTGRES TRIGGER FOR EDGE FUNCTION DISPATCH
--    Whenever a row is inserted into `public.notifications`, this function triggers
--    the `push-notifier` Supabase Edge Function via `net.http_post`.

CREATE OR REPLACE FUNCTION public.notify_expo_push_on_notification()
RETURNS TRIGGER AS $$
DECLARE
  -- Replace with your Supabase Project URL and Service Role Key if triggering via pg_net
  supabase_url     TEXT := 'https://YOUR_PROJECT_REF.supabase.co';
  service_role_key TEXT := 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
BEGIN
  -- Asynchronously post notification payload to push-notifier Edge Function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/push-notifier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_notification_created_push ON public.notifications;
CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_expo_push_on_notification();
