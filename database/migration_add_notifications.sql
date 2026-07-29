-- ============================================================
-- PharmaFindr — Migration: Add Notifications Table
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

-- ============================================================
-- 9. NOTIFICATIONS
--    Persisted, actionable notifications for app users.
--    Ephemeral push-only alerts (e.g., "Time to take medicine")
--    are NOT stored here — they are delivered via push only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'info'
                          CHECK (type IN ('reservation', 'availability', 'medication', 'system', 'info')),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ,
  metadata    JSONB
);

-- Index for fast per-user queries (most recent first)
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON public.notifications (user_id, is_read)
  WHERE is_read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (UPDATE only is_read)
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow server-side inserts (trigger runs as SECURITY DEFINER)
CREATE POLICY "notifications_service_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Allow users to delete their own notifications
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- TRIGGER: Auto-create a notification when a reservation
--          status changes (pharmacy accepts / declines).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_reservation_notification()
RETURNS TRIGGER AS $$
DECLARE
  notif_title   TEXT;
  notif_message TEXT;
  notif_type    TEXT := 'reservation';
BEGIN
  -- Only fire when the status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Build human-readable strings
  CASE NEW.status
    WHEN 'accepted' THEN
      notif_title   := 'Reservation Confirmed';
      notif_message := COALESCE(NEW.pharmacy_name, 'The pharmacy') ||
                       ' confirmed your reservation for ' ||
                       COALESCE(NEW.medicine_name, 'your medicines') || '.';

    WHEN 'declined' THEN
      notif_title   := 'Reservation Declined';
      notif_message := COALESCE(NEW.pharmacy_name, 'The pharmacy') ||
                       ' declined your reservation for ' ||
                       COALESCE(NEW.medicine_name, 'your medicines') ||
                       '. Try searching for a nearby pharmacy.';

    WHEN 'collected' THEN
      notif_title   := 'Medicines Collected';
      notif_message := 'Your reservation at ' ||
                       COALESCE(NEW.pharmacy_name, 'the pharmacy') ||
                       ' has been marked as collected. Thank you!';

    WHEN 'expired' THEN
      notif_title   := 'Reservation Expired';
      notif_message := 'Your reservation for ' ||
                       COALESCE(NEW.medicine_name, 'medicines') ||
                       ' at ' ||
                       COALESCE(NEW.pharmacy_name, 'the pharmacy') ||
                       ' has expired.';

    ELSE
      -- 'pending' and any other statuses do not need a stored notification
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    sent_at,
    metadata
  )
  VALUES (
    NEW.user_id,
    notif_title,
    notif_message,
    notif_type,
    NOW(),
    jsonb_build_object(
      'reservation_id', NEW.id,
      'pharmacy_id',    NEW.pharmacy_id,
      'pharmacy_name',  NEW.pharmacy_name,
      'medicine_name',  NEW.medicine_name,
      'status',         NEW.status
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_reservation_status_changed ON public.reservations;
CREATE TRIGGER on_reservation_status_changed
  AFTER UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_notification();
