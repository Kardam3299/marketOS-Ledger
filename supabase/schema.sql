-- ==============================================================================
-- MarketOS Ledger SaaS Schema Migration (Production Grade)
-- Foundation for the MarketOS Ecosystem (Ledger, POS, Inventory, CRM, Billing)
-- Execute this script in your Supabase SQL Editor.
-- This script is completely idempotent and safe to run multiple times.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. CORE TABLES (Multi-tenant Foundation)
-- ==============================================================================

-- 2A. Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    currency TEXT DEFAULT 'USD',
    -- JSONB for extensible settings for future modules (Billing, POS features, etc.)
    settings JSONB DEFAULT '{}'::jsonb,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2B. Profiles Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2C. Business Members Table (Employees)
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'manager', 'staff')) DEFAULT 'staff',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, profile_id)
);

-- 2D. Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('owner', 'manager', 'staff')) DEFAULT 'staff',
    token UUID NOT NULL DEFAULT uuid_generate_v4(),
    status TEXT DEFAULT 'pending', -- pending, accepted, expired, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- ==============================================================================
-- 3. TRANSACTIONS TABLE MIGRATION (Idempotent schema evolution)
-- ==============================================================================

-- Create transactions table if it doesn't exist (e.g. fresh install)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_mode TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add multi-tenant and audit columns to existing transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='business_id') THEN
        -- Using ON DELETE RESTRICT so business deletion doesn't erase accounting history
        ALTER TABLE public.transactions ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='created_by') THEN
        ALTER TABLE public.transactions ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_by') THEN
        ALTER TABLE public.transactions ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='is_deleted') THEN
        ALTER TABLE public.transactions ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='deleted_at') THEN
        ALTER TABLE public.transactions ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='deleted_by') THEN
        ALTER TABLE public.transactions ADD COLUMN deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;


-- ==============================================================================
-- 4. AUTOMATIC TRIGGERS
-- ==============================================================================

-- 4A. Auto Profile Creation Trigger (Supabase managed auth compatible)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4B. Updated_at Trigger for standard tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply generic updated_at to non-transaction tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['businesses', 'profiles', 'business_members', 'invitations'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
        EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
    END LOOP;
END $$;

-- 4C. Transaction specific audit trigger (Maintains updated_at AND updated_by)
CREATE OR REPLACE FUNCTION public.set_transaction_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_transaction_audit ON public.transactions;
CREATE TRIGGER set_transaction_audit 
    BEFORE UPDATE ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.set_transaction_audit_fields();


-- ==============================================================================
-- 5. INDEXES for Performance (Analytics, Reporting, Dashboards)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_business_members_profile_id ON public.business_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);


-- ==============================================================================
-- 6. HELPER FUNCTIONS FOR ROW LEVEL SECURITY & DATA FETCHING
-- ==============================================================================

-- Get user's role in a specific business
CREATE OR REPLACE FUNCTION get_user_role(target_business_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.business_members 
    WHERE profile_id = auth.uid() AND business_id = target_business_id AND status = 'active'
    LIMIT 1;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user belongs to a business
CREATE OR REPLACE FUNCTION is_business_member(target_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.business_members 
        WHERE profile_id = auth.uid() AND business_id = target_business_id AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Securely verify invitation without exposing the table to public SELECT
CREATE OR REPLACE FUNCTION public.verify_invitation(invite_token UUID)
RETURNS SETOF public.invitations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.invitations 
    WHERE token = invite_token 
      AND status = 'pending' 
      AND expires_at > NOW();
$$;


-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('businesses', 'profiles', 'business_members', 'invitations', 'transactions')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- A. Businesses Policies (Ignoring deleted)
-- ------------------------------------------------------------------------------
CREATE POLICY "Members view business" ON public.businesses 
    FOR SELECT USING (is_deleted = false AND is_business_member(id));

CREATE POLICY "Owners update business" ON public.businesses 
    FOR UPDATE USING (is_deleted = false AND get_user_role(id) = 'owner');

CREATE POLICY "Authenticated users can create business" ON public.businesses 
    FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- B. Profiles Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Members view co-worker profiles" ON public.profiles 
    FOR SELECT USING (
        id IN (
            SELECT profile_id FROM public.business_members 
            WHERE business_id IN (
                SELECT business_id FROM public.business_members WHERE profile_id = auth.uid()
            )
        ) OR id = auth.uid()
    );

CREATE POLICY "Users update own profile" ON public.profiles 
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users insert own profile" ON public.profiles 
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------------
-- C. Business Members Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Members view team" ON public.business_members 
    FOR SELECT USING (profile_id = auth.uid() OR is_business_member(business_id));

CREATE POLICY "Owners manage team" ON public.business_members 
    FOR ALL USING (get_user_role(business_id) = 'owner');

CREATE POLICY "Users can join business" ON public.business_members 
    FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());

-- ------------------------------------------------------------------------------
-- D. Invitations Policies (Public scanning blocked)
-- ------------------------------------------------------------------------------
CREATE POLICY "Members view active invitations" ON public.invitations 
    FOR SELECT USING (is_business_member(business_id));

CREATE POLICY "Owners manage invitations" ON public.invitations 
    FOR ALL USING (get_user_role(business_id) = 'owner');

-- Note: No public SELECT policy exists anymore. 
-- Public signup flows must use the verify_invitation RPC.

-- ------------------------------------------------------------------------------
-- E. Transactions Policies (Soft Delete Aware)
-- ------------------------------------------------------------------------------
CREATE POLICY "Members view transactions" ON public.transactions 
    FOR SELECT USING (is_deleted = false AND is_business_member(business_id));

CREATE POLICY "Staff insert transactions" ON public.transactions 
    FOR INSERT WITH CHECK (is_business_member(business_id));

CREATE POLICY "Role based transaction updates" ON public.transactions 
    FOR UPDATE USING (
        is_deleted = false AND
        is_business_member(business_id) AND (
            created_by = auth.uid() OR 
            get_user_role(business_id) IN ('owner', 'manager')
        )
    );

CREATE POLICY "Owners hard delete transactions" ON public.transactions 
    FOR DELETE USING (get_user_role(business_id) = 'owner');


-- ==============================================================================
-- 8. BACKWARD COMPATIBILITY & DATA MIGRATION
-- ==============================================================================

DO $$
DECLARE
    first_business_id UUID;
BEGIN
    -- Find the oldest business in the system
    SELECT id INTO first_business_id FROM public.businesses ORDER BY created_at ASC LIMIT 1;
    
    IF first_business_id IS NOT NULL THEN
        -- Link orphaned transactions to the oldest business safely
        UPDATE public.transactions 
        SET business_id = first_business_id 
        WHERE business_id IS NULL;
    END IF;
END $$;


-- ==============================================================================
-- 9. SQLITE COMPATIBILITY MIGRATION NOTES (Electron)
-- ==============================================================================
/*
To maintain sync compatibility, your Electron SQLite migration must execute:

ALTER TABLE transactions ADD COLUMN business_id TEXT;
ALTER TABLE transactions ADD COLUMN created_by TEXT;
ALTER TABLE transactions ADD COLUMN updated_by TEXT;
ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;
ALTER TABLE transactions ADD COLUMN deleted_by TEXT;

Make sure to map SQLite INTEGER 0/1 to PostgreSQL BOOLEAN false/true during sync.
Update your desktop database.cjs to set business_id on un-scoped rows to match the logged-in profile.
*/
  
-- ==============================================================================
-- 9. SETUP & INITIALIZATION RPCs
-- ==============================================================================

-- Check if system has an owner
CREATE OR REPLACE FUNCTION public.check_system_initialized()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(SELECT 1 FROM public.business_members WHERE role = 'owner');
$$;

-- Safely initialize the first business and owner
CREATE OR REPLACE FUNCTION public.initialize_system(biz_name TEXT, o_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_biz_id UUID;
    user_id UUID;
    user_email TEXT;
BEGIN
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF EXISTS(SELECT 1 FROM public.business_members WHERE role = 'owner') THEN
        RAISE EXCEPTION 'System is already initialized';
    END IF;

    SELECT email INTO user_email FROM public.profiles WHERE id = user_id;

    INSERT INTO public.businesses (business_name, owner_name, email)
    VALUES (biz_name, o_name, user_email)
    RETURNING id INTO new_biz_id;

    INSERT INTO public.business_members (business_id, profile_id, role, status)
    VALUES (new_biz_id, user_id, 'owner', 'active');
END;
$$;
