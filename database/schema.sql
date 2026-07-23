-- ============================================================
-- PharmaFindr — Full Database Setup (v2)
-- Paste this entire file into the Supabase SQL Editor and Run.
--
-- Changes from v1:
--   • Dropped:  profiles, patient_profiles, pharmacy_profiles
--   • Added:    user_roles  (lightweight role lookup — 1 query on login)
--   • Added:    app_users   (general users — identity + health data merged)
--   • pharmacies.owner_id, prescriptions.user_id, reservations.user_id,
--     chat_messages.user_id now reference auth.users(id) directly.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 0. CLEAN UP PREVIOUS SCHEMA (safe to run on fresh DB)
-- ============================================================

-- Drop dependent tables first (FK order)
DROP TABLE IF EXISTS public.chat_messages      CASCADE;
DROP TABLE IF EXISTS public.reservations       CASCADE;
DROP TABLE IF EXISTS public.prescriptions      CASCADE;
DROP TABLE IF EXISTS public.inventory          CASCADE;
DROP TABLE IF EXISTS public.medicines          CASCADE;
DROP TABLE IF EXISTS public.pharmacies         CASCADE;
DROP TABLE IF EXISTS public.pharmacy_profiles  CASCADE;
DROP TABLE IF EXISTS public.patient_profiles   CASCADE;
DROP TABLE IF EXISTS public.app_users          CASCADE;
DROP TABLE IF EXISTS public.user_roles         CASCADE;
DROP TABLE IF EXISTS public.profiles           CASCADE;

-- Drop old trigger + function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- 1. USER_ROLES  (single table for fast role detection)
--    One row per auth.users account.
--    role = 'user'     → general app user (drug searcher, etc.)
--    role = 'pharmacy' → registered pharmacy account
-- ============================================================
CREATE TABLE public.user_roles (
  id    UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role  TEXT  NOT NULL CHECK (role IN ('user', 'pharmacy', 'both'))
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read roles (needed for routing)
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);
-- Only the owner can insert/update their own row
CREATE POLICY "user_roles_owner_write" ON public.user_roles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- Also allow the trigger (SECURITY DEFINER) to insert on sign-up
CREATE POLICY "user_roles_service_insert" ON public.user_roles
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 2. APP_USERS  (identity + health data for 'user' role accounts)
--    Replaces both profiles (for users) and patient_profiles.
--    Pharmacy accounts do NOT get a row here.
-- ============================================================
CREATE TABLE public.app_users (
  id                   UUID           PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  phone                TEXT,
  avatar_url           TEXT,
  -- Health / personalisation data (formerly patient_profiles)
  age                  INTEGER,
  weight               DECIMAL(5,2),  -- kg
  height               DECIMAL(5,2),  -- cm
  gender               TEXT,
  allergies            TEXT[]         DEFAULT '{}',
  existing_conditions  TEXT[]         DEFAULT '{}',
  current_medications  TEXT[]         DEFAULT '{}',
  created_at           TIMESTAMPTZ    DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_users_select" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "app_users_owner_all" ON public.app_users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "app_users_service_insert" ON public.app_users
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 3. PHARMACIES
-- ============================================================
CREATE TABLE public.pharmacies (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID             REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT             NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  opening_time    TIME,
  closing_time    TIME,
  verified        BOOLEAN          DEFAULT FALSE,
  created_at      TIMESTAMPTZ      DEFAULT NOW()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pharmacies_select" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "pharmacies_owner_all" ON public.pharmacies
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
-- Allow authenticated inserts (registration)
CREATE POLICY "pharmacies_auth_insert" ON public.pharmacies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 4. MEDICINES (master catalogue)
-- ============================================================
CREATE TABLE public.medicines (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  generic_name TEXT,
  strength     TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicines_select" ON public.medicines FOR SELECT USING (true);
CREATE POLICY "medicines_insert" ON public.medicines
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 5. INVENTORY (per-pharmacy stock)
-- ============================================================
CREATE TABLE public.inventory (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id   UUID           REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medicine_id   UUID           REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name TEXT           NOT NULL,
  generic_name  TEXT,
  strength      TEXT,
  quantity      INTEGER        NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price         DECIMAL(10,2)  NOT NULL DEFAULT 0.00 CHECK (price >= 0.00),
  last_updated  TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "inventory_owner_all" ON public.inventory FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE public.pharmacies.id = public.inventory.pharmacy_id
      AND public.pharmacies.owner_id = auth.uid()
  )
);

-- ============================================================
-- 6. PRESCRIPTIONS (scanned by app users)
-- ============================================================
CREATE TABLE public.prescriptions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url          TEXT,
  ocr_text           TEXT,
  ai_interpretation  JSONB,
  status             TEXT        DEFAULT 'completed'
                                 CHECK (status IN ('pending', 'completed', 'failed')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_owner_all" ON public.prescriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 7. RESERVATIONS
-- ============================================================
CREATE TABLE public.reservations (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id    UUID           REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  medicine_name  TEXT,
  pharmacy_name  TEXT,
  medicines      JSONB          NOT NULL,
  status         TEXT           DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'collected')),
  total_cost     DECIMAL(10,2)  DEFAULT 0.00,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_user_all" ON public.reservations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "reservations_pharmacy_all" ON public.reservations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE public.pharmacies.id = public.reservations.pharmacy_id
      AND public.pharmacies.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.handle_reservation_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_reservation_updated ON public.reservations;
CREATE TRIGGER on_reservation_updated
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_updated();

-- ============================================================
-- 8. CHAT MESSAGES
-- ============================================================
CREATE TABLE public.chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_owner_all" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 9. TRIGGER — auto-populate on sign-up
--    Always creates a user_roles row.
--    For 'user' role: also creates an app_users row.
--    For 'pharmacy' role: pharmacy row is created by the registration
--    wizard after OTP verification (Step 4 of pharmacy-register flow).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  -- Normalise legacy 'patient' value to 'user'
  IF user_role = 'patient' THEN
    user_role := 'user';
  END IF;

  -- Always create role record
  INSERT INTO public.user_roles (id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- Create app_users row for 'user' and 'both' roles
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 10. DATA MIGRATION (if upgrading from v1 schema)
--     Copies user-role rows from old profiles table if it still
--     exists. Safe to run even if profiles was already dropped.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Migrate general users (role = 'patient' or 'user') → app_users
    INSERT INTO public.app_users (id, full_name, phone, avatar_url, created_at)
    SELECT id, full_name, phone, avatar_url, created_at
    FROM public.profiles
    WHERE role IN ('patient', 'user')
    ON CONFLICT (id) DO NOTHING;

    -- Migrate role records → user_roles
    INSERT INTO public.user_roles (id, role)
    SELECT id, CASE WHEN role = 'patient' THEN 'user' ELSE role END
    FROM public.profiles
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
