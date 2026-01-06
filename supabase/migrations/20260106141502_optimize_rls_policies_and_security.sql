/*
  # Optimize RLS Policies and Security

  ## Overview
  This migration optimizes Row Level Security (RLS) policies for better performance
  and fixes security issues identified in the database.

  ## Changes

  ### 1. RLS Policy Optimization
  All RLS policies are updated to use `(select auth.uid())` instead of `auth.uid()`.
  This prevents the function from being re-evaluated for each row, significantly
  improving query performance at scale.

  **Tables affected:**
  - `user_preferences`
  - `custom_word_lists`
  - `stories`

  ### 2. Function Security Fix
  The `update_updated_at_column()` function is updated with:
  - Explicit search_path to prevent security vulnerabilities
  - SECURITY DEFINER to ensure consistent execution context

  ### 3. Index Cleanup
  - Remove `idx_stories_user_id` as it's redundant with the composite index
    `idx_stories_created_at` which already includes user_id as the first column

  ## Security Impact
  - Improved RLS query performance (evaluates auth function once per query vs per row)
  - Fixed mutable search_path security vulnerability
  - No functional changes to access control

  ## Performance Impact
  - Significantly faster queries on tables with RLS policies
  - Reduced database CPU usage for authenticated queries
  - Better scalability for large datasets

  ## Notes
  1. Auth connection strategy and leaked password protection cannot be fixed via migration
     - Auth connection strategy: Configure in Supabase Dashboard → Settings → Database
     - Password protection: Configure in Supabase Dashboard → Authentication → Policies
  2. All policies maintain the same access control logic
  3. Existing data and user access patterns are unchanged
*/

-- ============================================================================
-- 1. DROP EXISTING RLS POLICIES
-- ============================================================================

-- Drop policies for user_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

-- Drop policies for custom_word_lists
DROP POLICY IF EXISTS "Users can view own word lists" ON custom_word_lists;
DROP POLICY IF EXISTS "Users can insert own word lists" ON custom_word_lists;
DROP POLICY IF EXISTS "Users can update own word lists" ON custom_word_lists;
DROP POLICY IF EXISTS "Users can delete own word lists" ON custom_word_lists;

-- Drop policies for stories
DROP POLICY IF EXISTS "Users can view own stories" ON stories;
DROP POLICY IF EXISTS "Users can insert own stories" ON stories;
DROP POLICY IF EXISTS "Users can update own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON stories;

-- ============================================================================
-- 2. RECREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- Policies for user_preferences (optimized)
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Policies for custom_word_lists (optimized)
CREATE POLICY "Users can view own word lists"
  ON custom_word_lists FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own word lists"
  ON custom_word_lists FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own word lists"
  ON custom_word_lists FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own word lists"
  ON custom_word_lists FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Policies for stories (optimized)
CREATE POLICY "Users can view own stories"
  ON stories FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own stories"
  ON stories FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own stories"
  ON stories FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. FIX FUNCTION SECURITY
-- ============================================================================

-- Drop the function and its dependent triggers using CASCADE
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Recreate the function with proper security settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the triggers
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_word_lists_updated_at
  BEFORE UPDATE ON custom_word_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. REMOVE UNUSED INDEX
-- ============================================================================

-- Remove idx_stories_user_id as it's redundant with idx_stories_created_at
-- which already has user_id as the first column
DROP INDEX IF EXISTS idx_stories_user_id;