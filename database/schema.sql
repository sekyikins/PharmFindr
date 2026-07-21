-- ============================================================
-- PharmaFindr — Full Database Setup
-- Paste this entire file into the Supabase SQL Editor and Run
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('patient', 'pharmacy')),
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 1B. PATIENT PROFILES (Personalization & Health Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id                  UUID           PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  age                 INTEGER,
  weight              DECIMAL(5,2),  -- in kg
  height              DECIMAL(5,2),  -- in cm
  gender              TEXT,
  allergies           TEXT[]         DEFAULT '{}',
  existing_conditions TEXT[]         DEFAULT '{}',
  current_medications TEXT[]         DEFAULT '{}',
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_profiles_select" ON public.patient_profiles FOR SELECT USING (true);
CREATE POLICY "patient_profiles_owner_all" ON public.patient_profiles FOR ALL USING (auth.uid() = id);

-- ============================================================
-- 1C. PHARMACY PROFILES (Business & License Details)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pharmacy_profiles (
  id                  UUID           PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_number      TEXT,
  owner_name          TEXT,
  business_email      TEXT,
  updated_at          TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.pharmacy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pharmacy_profiles_select" ON public.pharmacy_profiles FOR SELECT USING (true);
CREATE POLICY "pharmacy_profiles_owner_all" ON public.pharmacy_profiles FOR ALL USING (auth.uid() = id);

-- ============================================================
-- 2. PHARMACIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID            REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT            NOT NULL,
  phone           TEXT,
  address         TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  opening_time    TIME,
  closing_time    TIME,
  verified        BOOLEAN         DEFAULT FALSE,
  created_at      TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pharmacies_select" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "pharmacies_owner_all" ON public.pharmacies FOR ALL USING (auth.uid() = owner_id);

-- ============================================================
-- 3. MEDICINES (master catalogue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medicines (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  generic_name TEXT,
  strength     TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicines_select" ON public.medicines FOR SELECT USING (true);
CREATE POLICY "medicines_insert" ON public.medicines FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 4. INVENTORY (per-pharmacy stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
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
-- 5. PRESCRIPTIONS (scanned by patients)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url          TEXT,
  ocr_text           TEXT,
  ai_interpretation  JSONB,
  status             TEXT        DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_owner_all" ON public.prescriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 6. RESERVATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reservations (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           REFERENCES public.profiles(id) ON DELETE CASCADE,
  pharmacy_id    UUID           REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  medicine_name  TEXT,                      -- denormalized for quick display / notifications
  pharmacy_name  TEXT,                      -- denormalized for quick display / notifications
  medicines      JSONB          NOT NULL,   -- [{"name":"Amoxicillin","strength":"500mg","quantity":1,"price":12.00}]
  status         TEXT           DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'collected')),
  total_cost     DECIMAL(10,2)  DEFAULT 0.00,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_patient_all" ON public.reservations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "reservations_pharmacy_all" ON public.reservations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE public.pharmacies.id = public.reservations.pharmacy_id
      AND public.pharmacies.owner_id = auth.uid()
  )
);

-- Auto-update updated_at whenever a reservation row changes
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
-- 7. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_owner_all" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. TRIGGER — auto-create profile on sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');

  INSERT INTO public.profiles (id, role, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    user_role,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF user_role = 'patient' THEN
    INSERT INTO public.patient_profiles (id, age, weight, height, gender)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'age')::INTEGER,
      (NEW.raw_user_meta_data->>'weight')::DECIMAL,
      (NEW.raw_user_meta_data->>'height')::DECIMAL,
      NEW.raw_user_meta_data->>'gender'
    )
    ON CONFLICT (id) DO NOTHING;
  ELSIF user_role = 'pharmacy' THEN
    INSERT INTO public.pharmacy_profiles (id, owner_name, business_email)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
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
