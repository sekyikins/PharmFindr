-- ============================================================================
-- PharmFindr Generic-First Medicine Catalog Migration & Seed Script
-- Execute this script in your Supabase SQL Editor
-- ============================================================================

-- 0. Drop Legacy Foreign Key Constraint & Legacy Medicines Table safely
ALTER TABLE IF EXISTS public.inventory 
    DROP CONSTRAINT IF EXISTS inventory_medicine_id_fkey;

ALTER TABLE IF EXISTS public.inventory 
    ALTER COLUMN medicine_id DROP NOT NULL;

DROP TABLE IF EXISTS public.medicines CASCADE;


-- 1. Create Generic Medicines Catalog Table
CREATE TABLE IF NOT EXISTS public.generic_medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_name TEXT UNIQUE NOT NULL,
    description TEXT,
    atc_code TEXT,
    dosage_forms TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on generic_medicines
ALTER TABLE public.generic_medicines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running script to avoid duplicate policy errors
DROP POLICY IF EXISTS "Allow public read on generic_medicines" ON public.generic_medicines;
DROP POLICY IF EXISTS "Allow authenticated insert on generic_medicines" ON public.generic_medicines;

-- Allow public read access to generic_medicines
CREATE POLICY "Allow public read on generic_medicines"
    ON public.generic_medicines FOR SELECT
    USING (true);

-- Allow authenticated users to insert generic_medicines
CREATE POLICY "Allow authenticated insert on generic_medicines"
    ON public.generic_medicines FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');


-- 2. Create Medicine Products (Brands) Catalog Table
CREATE TABLE IF NOT EXISTS public.medicine_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generic_id UUID REFERENCES public.generic_medicines(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL DEFAULT 'Tablet',
    pack_size TEXT,
    manufacturer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_brand_generic_strength_form UNIQUE (brand_name, generic_id, strength, dosage_form)
);

-- Enable RLS on medicine_products
ALTER TABLE public.medicine_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on medicine_products" ON public.medicine_products;
DROP POLICY IF EXISTS "Allow authenticated insert on medicine_products" ON public.medicine_products;

-- Allow public read access to medicine_products
CREATE POLICY "Allow public read on medicine_products"
    ON public.medicine_products FOR SELECT
    USING (true);

-- Allow authenticated users to insert medicine_products
CREATE POLICY "Allow authenticated insert on medicine_products"
    ON public.medicine_products FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');


-- 3. Update Inventory Table Columns
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS medicine_product_id UUID REFERENCES public.medicine_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS generic_name TEXT,
    ADD COLUMN IF NOT EXISTS brand_name TEXT,
    ADD COLUMN IF NOT EXISTS dosage_form TEXT,
    ADD COLUMN IF NOT EXISTS manufacturer TEXT,
    ADD COLUMN IF NOT EXISTS batch_number TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date DATE;


-- 4. Seed Data: Generic Medicines
INSERT INTO public.generic_medicines (generic_name, description, dosage_forms)
VALUES 
    ('Paracetamol', 'Analgesic and antipyretic medication used to treat pain and fever.', ARRAY['Tablet', 'Syrup', 'Suspension', 'Suppository']),
    ('Amoxicillin', 'Penicillin antibiotic used to treat bacterial infections.', ARRAY['Capsule', 'Suspension', 'Tablet']),
    ('Amoxicillin / Clavulanic Acid', 'Broad-spectrum combination antibiotic.', ARRAY['Tablet', 'Suspension']),
    ('Metformin', 'Antidiabetic medication used to treat type 2 diabetes.', ARRAY['Tablet']),
    ('Ibuprofen', 'Nonsteroidal anti-inflammatory drug (NSAID) used for pain and inflammation.', ARRAY['Tablet', 'Capsule', 'Suspension', 'Gel']),
    ('Omeprazole', 'Proton pump inhibitor used to reduce stomach acid.', ARRAY['Capsule', 'Tablet']),
    ('Cetirizine', 'Antihistamine medication used to treat allergies.', ARRAY['Tablet', 'Syrup']),
    ('Diclofenac', 'Nonsteroidal anti-inflammatory drug (NSAID) for joint and muscle pain.', ARRAY['Tablet', 'Gel', 'Injection', 'Suppository']),
    ('Artemether / Lumefantrine', 'Antimalarial medication used to treat acute uncomplicated malaria.', ARRAY['Tablet', 'Suspension']),
    ('Lisinopril', 'ACE inhibitor used to treat high blood pressure and heart failure.', ARRAY['Tablet']),
    ('Amlodipine', 'Calcium channel blocker used for high blood pressure and angina.', ARRAY['Tablet']),
    ('Ciprofloxacin', 'Fluoroquinolone antibiotic for severe bacterial infections.', ARRAY['Tablet', 'Eye Drop', 'Infusion'])
ON CONFLICT (generic_name) DO NOTHING;


-- 5. Seed Data: Medicine Products (Brands)
WITH g AS (
    SELECT id, generic_name FROM public.generic_medicines
)
INSERT INTO public.medicine_products (generic_id, brand_name, strength, dosage_form, manufacturer)
VALUES
    -- Paracetamol Brands
    ((SELECT id FROM g WHERE generic_name = 'Paracetamol'), 'Panadol', '500 mg', 'Tablet', 'GSK'),
    ((SELECT id FROM g WHERE generic_name = 'Paracetamol'), 'Pacimol', '500 mg', 'Tablet', 'Kinapharma'),
    ((SELECT id FROM g WHERE generic_name = 'Paracetamol'), 'Doliprane', '500 mg', 'Tablet', 'Sanofi'),
    ((SELECT id FROM g WHERE generic_name = 'Paracetamol'), 'Kina Paracetamol Syrup', '125 mg/5ml', 'Syrup', 'Kinapharma'),

    -- Amoxicillin Brands
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin'), 'Amoxil', '500 mg', 'Capsule', 'GSK'),
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin'), 'Moxicap', '500 mg', 'Capsule', 'Ernest Chemists'),
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin'), 'Ranmoxy', '250 mg/5ml', 'Suspension', 'Ranbaxy'),

    -- Amoxicillin / Clavulanate Brands
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin / Clavulanic Acid'), 'Augmentin', '625 mg', 'Tablet', 'GSK'),
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin / Clavulanic Acid'), 'Augmentin', '1000 mg', 'Tablet', 'GSK'),
    ((SELECT id FROM g WHERE generic_name = 'Amoxicillin / Clavulanic Acid'), 'Clavulin', '375 mg', 'Tablet', 'GSK'),

    -- Metformin Brands
    ((SELECT id FROM g WHERE generic_name = 'Metformin'), 'Glucophage', '500 mg', 'Tablet', 'Merck'),
    ((SELECT id FROM g WHERE generic_name = 'Metformin'), 'Glucophage XR', '1000 mg', 'Tablet', 'Merck'),

    -- Ibuprofen Brands
    ((SELECT id FROM g WHERE generic_name = 'Ibuprofen'), 'Nurofen', '400 mg', 'Tablet', 'Reckitt Benckiser'),
    ((SELECT id FROM g WHERE generic_name = 'Ibuprofen'), 'Brufen', '400 mg', 'Tablet', 'Abbott'),

    -- Artemether / Lumefantrine Brands
    ((SELECT id FROM g WHERE generic_name = 'Artemether / Lumefantrine'), 'Coartem', '20/120 mg', 'Tablet', 'Novartis'),
    ((SELECT id FROM g WHERE generic_name = 'Artemether / Lumefantrine'), 'Lumartem', '80/480 mg', 'Tablet', 'Cipla')
ON CONFLICT ON CONSTRAINT unique_brand_generic_strength_form DO NOTHING;
