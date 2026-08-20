-- ============================================================
-- PharmFindr — Complete Master Database Schema & Setup (v3)
-- Single-file setup for fresh or cloned Supabase projects.
-- Copy and run this ENTIRE file in the Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONS & SETUP
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Safe cleanup for fresh initialization
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_reservation_updated ON public.reservations;
DROP TRIGGER IF EXISTS on_reservation_status_changed ON public.reservations;
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reservation_updated() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reservation_notification() CASCADE;
DROP FUNCTION IF EXISTS public.handle_chat_message_consultation_update() CASCADE;
DROP FUNCTION IF EXISTS public.notify_expo_push_on_notification() CASCADE;

-- ------------------------------------------------------------
-- 1. USER ROLES (Authentication Role Lookup)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role  TEXT NOT NULL CHECK (role IN ('user', 'pharmacy', 'both'))
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_roles_owner_write" ON public.user_roles;
CREATE POLICY "user_roles_owner_write" ON public.user_roles
  FOR ALL USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_roles_service_insert" ON public.user_roles;
CREATE POLICY "user_roles_service_insert" ON public.user_roles
  FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------
-- 2. APP USERS (Patients & Mobile App Profiles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  phone                TEXT,
  avatar_url           TEXT,
  age                  INTEGER,
  weight               DECIMAL(5,2),
  height               DECIMAL(5,2),
  gender               TEXT,
  allergies            TEXT[] DEFAULT '{}',
  existing_conditions  TEXT[] DEFAULT '{}',
  current_medications  TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select" ON public.app_users;
CREATE POLICY "app_users_select" ON public.app_users FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "app_users_owner_all" ON public.app_users;
CREATE POLICY "app_users_owner_all" ON public.app_users
  FOR ALL USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 3. PHARMACIES (Partner Retail Pharmacies)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  opening_time    TIME,
  closing_time    TIME,
  operating_hours JSONB,
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_owner_id ON public.pharmacies(owner_id);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacies_public_read" ON public.pharmacies;
CREATE POLICY "pharmacies_public_read" ON public.pharmacies FOR SELECT USING (true);

DROP POLICY IF EXISTS "pharmacies_owner_all" ON public.pharmacies;
CREATE POLICY "pharmacies_owner_all" ON public.pharmacies
  FOR ALL USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 3b. PHARMACY OPERATING HOURS (Day-by-day Weekly Schedules)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_operating_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id   UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  day_of_week   TEXT NOT NULL,
  is_open       BOOLEAN DEFAULT TRUE,
  opening_time  TIME DEFAULT '08:00',
  closing_time  TIME DEFAULT '20:00',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pharmacy_day UNIQUE(pharmacy_id, day_of_week)
);

ALTER TABLE public.pharmacy_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_operating_hours_public_read" ON public.pharmacy_operating_hours;
CREATE POLICY "pharmacy_operating_hours_public_read" ON public.pharmacy_operating_hours FOR SELECT USING (true);

DROP POLICY IF EXISTS "pharmacy_operating_hours_owner_all" ON public.pharmacy_operating_hours;
CREATE POLICY "pharmacy_operating_hours_owner_all" ON public.pharmacy_operating_hours
  FOR ALL USING (pharmacy_id IN (SELECT id FROM public.pharmacies WHERE owner_id = (SELECT auth.uid())));

-- ------------------------------------------------------------
-- 4. GENERIC MEDICINES & BRANDED PRODUCTS (Drug Catalogue)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generic_medicines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name            TEXT UNIQUE NOT NULL,
  therapeutic_category    TEXT,
  description             TEXT,
  mechanism_of_action     TEXT,
  pregnancy_category      TEXT,
  fda_approved            BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.generic_medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on generic_medicines" ON public.generic_medicines;
CREATE POLICY "Allow public read on generic_medicines" ON public.generic_medicines FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.medicine_products (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_id              UUID REFERENCES public.generic_medicines(id) ON DELETE CASCADE,
  brand_name              TEXT NOT NULL,
  form                    TEXT,
  strength                TEXT,
  pack_size               TEXT,
  manufacturer            TEXT,
  is_prescription_required BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_products_generic_id ON public.medicine_products(generic_id);

ALTER TABLE public.medicine_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on medicine_products" ON public.medicine_products;
CREATE POLICY "Allow public read on medicine_products" ON public.medicine_products FOR SELECT USING (true);

-- Legacy medicines alias table compatibility
CREATE TABLE IF NOT EXISTS public.medicines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  generic_name TEXT,
  strength     TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medicines_select" ON public.medicines;
CREATE POLICY "medicines_select" ON public.medicines FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 5. INVENTORY (Per-Pharmacy Stock)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id               UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id               UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_product_id       UUID REFERENCES public.medicine_products(id) ON DELETE SET NULL,
  medicine_name             TEXT NOT NULL,
  generic_name              TEXT,
  strength                  TEXT,
  batch_number              TEXT,
  expiry_date               DATE,
  is_prescription_required   BOOLEAN DEFAULT FALSE,
  quantity                  INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price                     DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0.00),
  last_updated              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy_id ON public.inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_product_id ON public.inventory(medicine_product_id);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_public_read" ON public.inventory;
CREATE POLICY "inventory_public_read" ON public.inventory FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_owner_all" ON public.inventory;
CREATE POLICY "inventory_owner_all" ON public.inventory FOR ALL USING (
  pharmacy_id IN (
    SELECT id FROM public.pharmacies WHERE owner_id = (SELECT auth.uid())
  )
);

-- ------------------------------------------------------------
-- 6. PRESCRIPTIONS (Scanned & Uploaded Prescriptions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url          TEXT,
  ocr_text           TEXT,
  ai_interpretation  JSONB,
  status             TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON public.prescriptions(user_id);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions_owner_all" ON public.prescriptions;
CREATE POLICY "prescriptions_owner_all" ON public.prescriptions
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 7. RESERVATIONS (Medicine Holds at Pharmacies)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id    UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  medicine_name  TEXT,
  pharmacy_name  TEXT,
  medicines      JSONB NOT NULL,
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'collected', 'cancelled')),
  total_cost     DECIMAL(10,2) DEFAULT 0.00,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_pharmacy_id ON public.reservations(pharmacy_id);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_user_all" ON public.reservations;
CREATE POLICY "reservations_user_all" ON public.reservations
  FOR ALL USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reservations_pharmacy_all" ON public.reservations;
CREATE POLICY "reservations_pharmacy_all" ON public.reservations FOR ALL USING (
  pharmacy_id IN (
    SELECT id FROM public.pharmacies WHERE owner_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.handle_reservation_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_reservation_updated
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_updated();

-- ------------------------------------------------------------
-- 8. CONSULTATIONS & CHAT MESSAGES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'prescription' CHECK (type IN ('general', 'prescription', 'topic')),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  image_url       TEXT,
  medicines       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_prescription_id ON public.consultations(prescription_id);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultations_owner_all" ON public.consultations;
CREATE POLICY "consultations_owner_all" ON public.consultations
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_owner_all" ON public.chat_messages;
CREATE POLICY "chat_messages_owner_all" ON public.chat_messages
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 9. NOTIFICATIONS & EXPO PUSH TOKENS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'general',
  data        JSONB DEFAULT '{}'::jsonb,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  device_type  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_owner_select" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_select" ON public.push_tokens
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "push_tokens_owner_insert" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_insert" ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update" ON public.push_tokens
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_delete" ON public.push_tokens
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 10. AUDIT LOGS & USER FEEDBACK
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  resource_name  TEXT,
  ip_address     TEXT,
  details        JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE TABLE IF NOT EXISTS public.feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  rating          INTEGER DEFAULT 5,
  subject         TEXT,
  message         TEXT NOT NULL,
  attachment_url  TEXT,
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public feedback inserts" ON public.feedback;
CREATE POLICY "Allow public feedback inserts" ON public.feedback
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------
-- 11. AUTOMATED TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------

-- Trigger: New Auth User Initialization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  IF user_role = 'patient' THEN
    user_role := 'user';
  END IF;

  INSERT INTO public.user_roles (id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  IF user_role IN ('user', 'both') THEN
    INSERT INTO public.app_users (id, full_name, phone)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Reservation Status Notification Generator
CREATE OR REPLACE FUNCTION public.handle_reservation_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      NEW.user_id,
      CASE NEW.status
        WHEN 'accepted' THEN 'Reservation Accepted! 🎉'
        WHEN 'declined' THEN 'Reservation Declined'
        WHEN 'collected' THEN 'Reservation Collected'
        WHEN 'expired' THEN 'Reservation Expired'
        ELSE 'Reservation Status Updated'
      END,
      CASE NEW.status
        WHEN 'accepted' THEN 'Your reservation at ' || COALESCE(NEW.pharmacy_name, 'pharmacy') || ' was accepted.'
        WHEN 'declined' THEN 'Your reservation at ' || COALESCE(NEW.pharmacy_name, 'pharmacy') || ' was declined.'
        WHEN 'collected' THEN 'Thank you for picking up your reservation.'
        WHEN 'expired' THEN 'Your reservation window has elapsed.'
        ELSE 'Status changed to ' || NEW.status
      END,
      'reservation',
      jsonb_build_object('reservation_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_reservation_status_changed
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_notification();

-- Trigger: Consultation Timestamp Update
CREATE OR REPLACE FUNCTION public.handle_chat_message_consultation_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.consultations
  SET updated_at = NOW()
  WHERE id = NEW.consultation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_chat_message_consultation_update();

-- Revoke public execution on internal security definer trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_reservation_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_reservation_updated() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_chat_message_consultation_update() FROM anon, authenticated;

-- ------------------------------------------------------------
-- 12. STORAGE BUCKET CONFIGURATION (Avatars & Prescriptions)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Avatars Storage RLS Policies
DROP POLICY IF EXISTS "Allow public reads on avatars storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow public inserts on avatars storage" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_insert" ON storage.objects;
CREATE POLICY "avatars_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_update" ON storage.objects;
CREATE POLICY "avatars_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_delete" ON storage.objects;
CREATE POLICY "avatars_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

-- Prescriptions Storage RLS Policies
DROP POLICY IF EXISTS "Allow public reads on prescriptions storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow public inserts on prescriptions storage" ON storage.objects;
DROP POLICY IF EXISTS "prescriptions_public_select" ON storage.objects;
CREATE POLICY "prescriptions_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'prescriptions');

DROP POLICY IF EXISTS "prescriptions_public_insert" ON storage.objects;
CREATE POLICY "prescriptions_public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prescriptions');

-- ------------------------------------------------------------
-- 13. PHARMACY OPERATING HOURS (7-Day Weekly Schedule)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  is_open BOOLEAN DEFAULT true,
  opening_time TIME DEFAULT '08:00:00'::TIME,
  closing_time TIME DEFAULT '20:00:00'::TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pharmacy_day UNIQUE (pharmacy_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_operating_hours_pharmacy ON public.pharmacy_operating_hours(pharmacy_id);

ALTER TABLE public.pharmacy_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_operating_hours_public_read" ON public.pharmacy_operating_hours;
CREATE POLICY "pharmacy_operating_hours_public_read"
  ON public.pharmacy_operating_hours
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pharmacy_operating_hours_owner_all" ON public.pharmacy_operating_hours;
CREATE POLICY "pharmacy_operating_hours_owner_all"
  ON public.pharmacy_operating_hours
  FOR ALL
  USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE owner_id = auth.uid()
    )
  );

-- Trigger: Automatically seed default 7-day schedule when a new pharmacy is created
CREATE OR REPLACE FUNCTION public.handle_new_pharmacy_operating_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.pharmacy_operating_hours (pharmacy_id, day_of_week, is_open, opening_time, closing_time)
  VALUES
    (NEW.id, 'Monday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Tuesday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Wednesday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Thursday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Friday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Saturday', true, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time)),
    (NEW.id, 'Sunday', false, COALESCE(NEW.opening_time, '08:00:00'::time), COALESCE(NEW.closing_time, '20:00:00'::time))
  ON CONFLICT (pharmacy_id, day_of_week) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_pharmacy_operating_hours ON public.pharmacies;
CREATE TRIGGER trg_seed_pharmacy_operating_hours
  AFTER INSERT ON public.pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_pharmacy_operating_hours();

-- ------------------------------------------------------------
-- 12. GENERIC MEDICINES (Active Molecules & Clinical Entities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generic_medicines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name       TEXT NOT NULL,
  description        TEXT,
  category           TEXT,
  how_to_take        TEXT,
  side_effects       TEXT,
  warnings           TEXT,
  storage_conditions TEXT,
  contraindications  TEXT,
  dosage_forms       TEXT[],
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generic_medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generic_medicines_public_read" ON public.generic_medicines;
CREATE POLICY "generic_medicines_public_read" ON public.generic_medicines
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "generic_medicines_auth_insert" ON public.generic_medicines;
CREATE POLICY "generic_medicines_auth_insert" ON public.generic_medicines
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_generic_medicines_name ON public.generic_medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_generic_medicines_category ON public.generic_medicines(category);

-- ------------------------------------------------------------
-- 13. MEDICINE PRODUCTS (Commercial Brand Preparations)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicine_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_id   UUID REFERENCES public.generic_medicines(id) ON DELETE SET NULL,
  brand_name   TEXT NOT NULL,
  strength     TEXT NOT NULL,
  dosage_form  TEXT NOT NULL,
  pack_size    TEXT,
  manufacturer TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.medicine_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicine_products_public_read" ON public.medicine_products;
CREATE POLICY "medicine_products_public_read" ON public.medicine_products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "medicine_products_auth_insert" ON public.medicine_products;
CREATE POLICY "medicine_products_auth_insert" ON public.medicine_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_medicine_products_brand ON public.medicine_products(brand_name);
CREATE INDEX IF NOT EXISTS idx_medicine_products_generic_id ON public.medicine_products(generic_id);

-- ------------------------------------------------------------
-- 14. SECURE ACCOUNT DELETION (Self-Service User Cleanup)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Cascade cleanup public tables
  DELETE FROM public.app_users WHERE id = v_user_id;
  DELETE FROM public.user_roles WHERE id = v_user_id;
  DELETE FROM public.prescriptions WHERE user_id = v_user_id;
  DELETE FROM public.reservations WHERE user_id = v_user_id;
  DELETE FROM public.notifications WHERE user_id = v_user_id;
  DELETE FROM public.pharmacies WHERE owner_id = v_user_id;

  -- 2. Remove authenticated user record
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- 15. CHECK USER EMAIL EXISTS (Account verification for reset password)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_email_exists(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(TRIM(check_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_email_exists(TEXT) TO anon, authenticated;



