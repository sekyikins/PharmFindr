-- ============================================================
-- PharmFindr — Push Notification Migration (v4)
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rename notifications.body → notifications.message
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'body'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN body TO message;
  END IF;
END;
$$;

-- Ensure metadata column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'metadata'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 2. Allow service-role to INSERT into notifications + read push_tokens
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_service_insert" ON public.notifications;
CREATE POLICY "notifications_service_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "push_tokens_service_select" ON public.push_tokens;
CREATE POLICY "push_tokens_service_select" ON public.push_tokens
  FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 3. medicine_watchlist table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicine_watchlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  generic_name    TEXT,
  pharmacy_id     UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  pharmacy_name   TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_watchlist_user_id    ON public.medicine_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_watchlist_medicine    ON public.medicine_watchlist(LOWER(medicine_name));
CREATE INDEX IF NOT EXISTS idx_medicine_watchlist_pharmacy_id ON public.medicine_watchlist(pharmacy_id);

ALTER TABLE public.medicine_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_owner_all" ON public.medicine_watchlist;
CREATE POLICY "watchlist_owner_all" ON public.medicine_watchlist
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 4. Trigger: New reservation -> notify pharmacy owner
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_reservation_inserted ON public.reservations;
DROP FUNCTION IF EXISTS public.handle_reservation_inserted() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_reservation_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_pharmacy_owner_id UUID;
  v_med_summary       TEXT;
BEGIN
  SELECT owner_id INTO v_pharmacy_owner_id
  FROM public.pharmacies
  WHERE id = NEW.pharmacy_id;

  IF v_pharmacy_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_med_summary := COALESCE(NEW.medicine_name, 'a medicine');

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    v_pharmacy_owner_id,
    '📦 New Reservation Request',
    'A patient has requested ' || v_med_summary || '. Tap to review.',
    'reservation',
    jsonb_build_object(
      'reservation_id', NEW.id,
      'patient_user_id', NEW.user_id,
      'status', 'pending'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_reservation_inserted() FROM anon, authenticated;

CREATE TRIGGER on_reservation_inserted
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_inserted();

-- ------------------------------------------------------------
-- 5. Replace reservation status-change trigger (patient + pharmacy)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_reservation_status_changed ON public.reservations;
DROP FUNCTION IF EXISTS public.handle_reservation_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_reservation_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_pharmacy_owner_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Patient notification
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.user_id,
    CASE NEW.status
      WHEN 'accepted'  THEN '🎉 Reservation Accepted!'
      WHEN 'declined'  THEN 'Reservation Declined'
      WHEN 'collected' THEN '✅ Pickup Confirmed'
      WHEN 'expired'   THEN '⏰ Reservation Expired'
      WHEN 'cancelled' THEN 'Reservation Cancelled'
      ELSE 'Reservation Update'
    END,
    CASE NEW.status
      WHEN 'accepted'  THEN 'Your reservation at ' || COALESCE(NEW.pharmacy_name, 'the pharmacy') || ' has been accepted. Please collect within 24 hours.'
      WHEN 'declined'  THEN 'Your reservation at ' || COALESCE(NEW.pharmacy_name, 'the pharmacy') || ' was declined. Try searching for another pharmacy.'
      WHEN 'collected' THEN 'Thank you for picking up your reservation at ' || COALESCE(NEW.pharmacy_name, 'the pharmacy') || '.'
      WHEN 'expired'   THEN 'Your reservation at ' || COALESCE(NEW.pharmacy_name, 'the pharmacy') || ' has expired.'
      WHEN 'cancelled' THEN 'Your reservation has been cancelled.'
      ELSE 'Your reservation status changed to ' || NEW.status || '.'
    END,
    'reservation',
    jsonb_build_object(
      'reservation_id', NEW.id,
      'status', NEW.status,
      'pharmacy_name', NEW.pharmacy_name
    )
  );

  -- Pharmacy notification (patient cancelled)
  IF NEW.status = 'cancelled' AND NEW.pharmacy_id IS NOT NULL THEN
    SELECT owner_id INTO v_pharmacy_owner_id
    FROM public.pharmacies WHERE id = NEW.pharmacy_id;

    IF v_pharmacy_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        v_pharmacy_owner_id,
        '❌ Reservation Cancelled',
        'A patient cancelled their reservation for ' || COALESCE(NEW.medicine_name, 'a medicine') || '.',
        'reservation',
        jsonb_build_object(
          'reservation_id', NEW.id,
          'status', 'cancelled',
          'patient_user_id', NEW.user_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_reservation_notification() FROM anon, authenticated;

CREATE TRIGGER on_reservation_status_changed
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_notification();

-- ------------------------------------------------------------
-- 6. Trigger: Prescription inserted -> notify patient
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_prescription_inserted ON public.prescriptions;
DROP FUNCTION IF EXISTS public.handle_prescription_inserted() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_prescription_inserted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      '📷 Prescription Analysed',
      'Your prescription has been processed. Tap to view the extracted medicines.',
      'prescription',
      jsonb_build_object('prescription_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_prescription_inserted() FROM anon, authenticated;

CREATE TRIGGER on_prescription_inserted
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_prescription_inserted();

-- ------------------------------------------------------------
-- 7. Trigger: Inventory restocked -> notify watchlist users
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_inventory_restocked ON public.inventory;
DROP FUNCTION IF EXISTS public.handle_inventory_restocked() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_inventory_restocked()
RETURNS TRIGGER AS $$
DECLARE
  v_watcher    RECORD;
  v_pharm_name TEXT;
BEGIN
  IF (OLD.quantity = 0 OR OLD.quantity IS NULL) AND NEW.quantity > 0 THEN
    SELECT name INTO v_pharm_name FROM public.pharmacies WHERE id = NEW.pharmacy_id;

    FOR v_watcher IN
      SELECT DISTINCT user_id FROM public.medicine_watchlist
      WHERE is_active = TRUE
        AND LOWER(medicine_name) = LOWER(NEW.medicine_name)
        AND (pharmacy_id = NEW.pharmacy_id OR pharmacy_id IS NULL)
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        v_watcher.user_id,
        '🏥 Medicine Back in Stock',
        NEW.medicine_name || COALESCE(' (' || NEW.strength || ')', '') ||
          ' is now available at ' || COALESCE(v_pharm_name, 'a nearby pharmacy') || '.',
        'availability',
        jsonb_build_object(
          'medicine_name', NEW.medicine_name,
          'pharmacy_id', NEW.pharmacy_id,
          'pharmacy_name', v_pharm_name,
          'inventory_id', NEW.id
        )
      );

      UPDATE public.medicine_watchlist
        SET notified_at = NOW(), is_active = FALSE
      WHERE user_id = v_watcher.user_id
        AND LOWER(medicine_name) = LOWER(NEW.medicine_name)
        AND (pharmacy_id = NEW.pharmacy_id OR pharmacy_id IS NULL);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_inventory_restocked() FROM anon, authenticated;

CREATE TRIGGER on_inventory_restocked
  AFTER UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_restocked();
