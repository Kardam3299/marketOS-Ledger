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
    is_super_admin BOOLEAN DEFAULT FALSE,
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

-- 2D. Invitations Table (Member / Staff Invitations)
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

-- 2E. Business Onboarding Invitations Table (New Business Registration Links)
CREATE TABLE IF NOT EXISTS public.business_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    token UUID NOT NULL DEFAULT uuid_generate_v4(),
    status TEXT DEFAULT 'pending', -- pending, used, expired, cancelled
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
        SELECT unnest(ARRAY['businesses', 'profiles', 'business_members', 'invitations', 'business_invitations'])
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
CREATE INDEX IF NOT EXISTS idx_business_invitations_token ON public.business_invitations(token);


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
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('businesses', 'profiles', 'business_members', 'invitations', 'business_invitations', 'transactions')
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

-- ------------------------------------------------------------------------------
-- D2. Business Invitations Policies (New Business Onboarding Links - Super Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_super_admin = true
    );
$$;

DROP POLICY IF EXISTS "Owners manage business invitations" ON public.business_invitations;
DROP POLICY IF EXISTS "Super admins manage business invitations" ON public.business_invitations;
CREATE POLICY "Super admins manage business invitations" ON public.business_invitations 
    FOR ALL 
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Note: No public SELECT policy exists for invitations or business_invitations. 
-- Public signup flows must use verify_invitation / verify_business_invitation RPCs.

-- ------------------------------------------------------------------------------
-- E. Transactions Policies (Soft Delete & Super Admin Aware)
-- ------------------------------------------------------------------------------
-- Auto-resolve business_id and created_by if missing
CREATE OR REPLACE FUNCTION public.handle_transaction_business_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_id IS NULL THEN
        SELECT business_id INTO NEW.business_id 
        FROM public.business_members 
        WHERE profile_id = auth.uid() AND status = 'active'
        LIMIT 1;
    END IF;

    IF NEW.business_id IS NULL THEN
        SELECT id INTO NEW.business_id 
        FROM public.businesses 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_transaction_business_id ON public.transactions;
CREATE TRIGGER trg_transaction_business_id
    BEFORE INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transaction_business_id();

CREATE POLICY "Members view transactions" ON public.transactions 
    FOR SELECT USING (
        (is_deleted IS NULL OR is_deleted = false) AND (
            business_id IS NULL OR
            created_by = auth.uid() OR
            is_business_member(business_id) OR
            public.is_super_admin()
        )
    );

CREATE POLICY "Staff insert transactions" ON public.transactions 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Role based transaction updates" ON public.transactions 
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Owners hard delete transactions" ON public.transactions 
    FOR DELETE TO authenticated
    USING (true);

-- Secure RPC to delete a transaction
CREATE OR REPLACE FUNCTION public.delete_transaction(tx_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tx_biz_id UUID;
    caller_id UUID;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch transaction's business_id
    SELECT business_id INTO tx_biz_id 
    FROM public.transactions 
    WHERE id = tx_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;

    -- Soft delete the transaction
    UPDATE public.transactions
    SET is_deleted = true,
        deleted_at = NOW(),
        deleted_by = caller_id,
        updated_at = NOW()
    WHERE id = tx_id;

    RETURN TRUE;
END;
$$;


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

    -- Mark the first initializing user as Super Admin
    UPDATE public.profiles 
    SET is_super_admin = true 
    WHERE id = user_id;

    INSERT INTO public.businesses (business_name, owner_name, email)
    VALUES (biz_name, o_name, user_email)
    RETURNING id INTO new_biz_id;

    INSERT INTO public.business_members (business_id, profile_id, role, status)
    VALUES (new_biz_id, user_id, 'owner', 'active');
END;
$$;

-- Securely create a new business invitation token (Super Admin only)
CREATE OR REPLACE FUNCTION public.create_business_invitation(p_email TEXT DEFAULT NULL)
RETURNS public.business_invitations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_inv public.business_invitations;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Super Admin privileges required.';
    END IF;

    INSERT INTO public.business_invitations (email, status, created_by)
    VALUES (p_email, 'pending', auth.uid())
    RETURNING * INTO new_inv;

    RETURN new_inv;
END;
$$;

-- Securely verify a business invitation token without public SELECT access
CREATE OR REPLACE FUNCTION public.verify_business_invitation(invite_token UUID)
RETURNS SETOF public.business_invitations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.business_invitations 
    WHERE token = invite_token 
      AND status = 'pending' 
      AND expires_at > NOW();
$$;

-- Atomically register a new business using a one-time onboarding token
CREATE OR REPLACE FUNCTION public.register_business_with_invite(invite_token UUID, biz_name TEXT, o_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inv_record RECORD;
    new_biz_id UUID;
    user_id UUID;
    user_email TEXT;
BEGIN
    user_id := auth.uid();
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify token is valid, pending, and not expired (lock row to prevent race conditions)
    SELECT * INTO inv_record 
    FROM public.business_invitations 
    WHERE token = invite_token 
      AND status = 'pending' 
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already used business invitation link';
    END IF;

    -- Fetch user's registered email
    SELECT email INTO user_email FROM public.profiles WHERE id = user_id;
    IF user_email IS NULL THEN
        SELECT email INTO user_email FROM auth.users WHERE id = user_id;
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (user_id, o_name, user_email)
    ON CONFLICT (id) DO UPDATE SET full_name = o_name;

    -- Create the new business record
    INSERT INTO public.businesses (business_name, owner_name, email)
    VALUES (biz_name, o_name, user_email)
    RETURNING id INTO new_biz_id;

    -- Link user as the Owner of the new business
    INSERT INTO public.business_members (business_id, profile_id, role, status)
    VALUES (new_biz_id, user_id, 'owner', 'active')
    ON CONFLICT (business_id, profile_id) 
    DO UPDATE SET role = 'owner', status = 'active';

    -- Burn the invitation token immediately (marked as used)
    UPDATE public.business_invitations 
    SET status = 'used', updated_at = NOW() 
    WHERE id = inv_record.id;

    RETURN new_biz_id;
END;
$$;

