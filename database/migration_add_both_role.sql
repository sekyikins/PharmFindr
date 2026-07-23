-- ============================================================
-- PharmaFindr — Migration: Add 'both' role + clean seed
-- Paste into Supabase SQL Editor and Run BEFORE running seed.mjs
-- ============================================================

-- 1. Drop old CHECK constraint and replace with one that includes 'both'
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('user', 'pharmacy', 'both'));

-- 2. Update trigger to create app_users row for 'both' role too
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

  -- Create app_users row for 'user' AND 'both' roles
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
