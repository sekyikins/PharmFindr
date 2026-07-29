-- ============================================================
-- PharmaFindr — Migration: Add Consultations Table & Link Chat
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

-- ============================================================
-- 10. CONSULTATIONS TABLE
--     Organizes AI chats around specific prescriptions or health topics.
--     type = 'general'      → Default persistent general assistant
--     type = 'prescription' → Tied to a scanned/entered prescription
--     type = 'topic'        → Specific health topic consultation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'prescription'
                              CHECK (type IN ('general', 'prescription', 'topic')),
  prescription_id UUID        REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  image_url       TEXT,
  medicines       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user consultation lists (most recent first)
CREATE INDEX IF NOT EXISTS consultations_user_id_updated_at_idx
  ON public.consultations (user_id, updated_at DESC);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- RLS: Users only access their own consultations
CREATE POLICY "consultations_owner_all" ON public.consultations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service/trigger insert policy
CREATE POLICY "consultations_service_insert" ON public.consultations
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- 11. LINK CHAT_MESSAGES TO CONSULTATIONS
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chat_messages_consultation_id_created_at_idx
  ON public.chat_messages (consultation_id, created_at ASC);

-- Trigger to auto-update consultations.updated_at when a message is added
CREATE OR REPLACE FUNCTION public.handle_chat_message_consultation_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.consultation_id IS NOT NULL THEN
    UPDATE public.consultations
    SET updated_at = NOW()
    WHERE id = NEW.consultation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_chat_message_consultation_update();
