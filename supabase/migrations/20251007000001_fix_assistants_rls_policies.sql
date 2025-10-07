-- Migration: Fix Assistants RLS Policies
-- Description: Addresses 3 critical security vulnerabilities in assistants table RLS policies
-- Priority: CRITICAL (P0)
-- Created: 2025-10-07
-- Related: INT-30 Master-Detail Layout Implementation

-- ============================================================================
-- SECURITY ISSUE 1: Anonymous Read Access
-- Current policy "Enable read access for all users" allows unauthenticated
-- users to read ALL assistants, including prompts and configuration
-- ============================================================================

-- Drop the insecure anonymous read policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.assistants;

-- ============================================================================
-- SECURITY ISSUE 2: Permissive Update Policy
-- Current policy allows any authenticated user to update ANY assistant
-- This breaks multi-tenant isolation
-- ============================================================================

-- Drop the insecure permissive update policy
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.assistants;

-- ============================================================================
-- SECURITY ISSUE 3: Duplicate INSERT Policies
-- Multiple INSERT policies create confusion and potential security gaps
-- ============================================================================

-- Drop all existing INSERT policies to start fresh
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.assistants;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.assistants;

-- ============================================================================
-- SECURE RLS POLICIES
-- Enforce strict account-based isolation on all operations
-- ============================================================================

-- SELECT Policy: Account Isolation
-- Users can only read assistants that belong to their accounts
CREATE POLICY "Users can read their account assistants"
ON public.assistants
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- INSERT Policy: Account Isolation + Ownership
-- Users can only insert assistants into accounts they belong to
-- and must match the account_id
CREATE POLICY "Users can insert assistants to their accounts"
ON public.assistants
FOR INSERT
TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- UPDATE Policy: Account Isolation + Ownership
-- Users can only update assistants in their accounts
CREATE POLICY "Users can update their account assistants"
ON public.assistants
FOR UPDATE
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- DELETE Policy: Account Isolation + Ownership
-- Users can only delete assistants from their accounts
CREATE POLICY "Users can delete their account assistants"
ON public.assistants
FOR DELETE
TO authenticated
USING (
  account_id IN (
    SELECT account_id
    FROM basejump.account_user
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these queries to verify the policies are working correctly
-- ============================================================================

-- Verify all policies are in place
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'assistants';

-- Verify no anonymous access
-- Expected: Empty result when not authenticated
-- SELECT * FROM public.assistants;

-- Verify account isolation (run as authenticated user)
-- Expected: Only assistants from user's accounts
-- SELECT id, name, account_id FROM public.assistants;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- If this migration causes issues, run these commands to restore previous state
-- ============================================================================

/*
-- Rollback: Restore original (insecure) policies
DROP POLICY IF EXISTS "Users can read their account assistants" ON public.assistants;
DROP POLICY IF EXISTS "Users can insert assistants to their accounts" ON public.assistants;
DROP POLICY IF EXISTS "Users can update their account assistants" ON public.assistants;
DROP POLICY IF EXISTS "Users can delete their account assistants" ON public.assistants;

-- Re-enable original policies (WARNING: These are insecure!)
CREATE POLICY "Enable read access for all users" ON public.assistants FOR SELECT USING (true);
CREATE POLICY "Enable update for users based on user_id" ON public.assistants FOR UPDATE USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.assistants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
*/
