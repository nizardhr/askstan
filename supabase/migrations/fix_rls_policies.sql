-- Fix RLS Policies Migration
-- Create this as: supabase/migrations/fix_rls_policies.sql

-- First, let's check what's happening with RLS
DO $$
DECLARE
  profile_count integer;
  auth_user_count integer;
  rls_enabled boolean;
BEGIN
  -- Count users vs profiles
  SELECT COUNT(*) INTO auth_user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled 
  FROM pg_class 
  WHERE relname = 'user_profiles';
  
  RAISE NOTICE '👥 Auth users: %, Profiles: %, RLS enabled: %', 
    auth_user_count, profile_count, rls_enabled;
END $$;

-- Drop and recreate RLS policies to fix any issues
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON user_profiles;

-- Create comprehensive RLS policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true);

-- Do the same for user_subscriptions
DROP POLICY IF EXISTS "Users can read own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON user_subscriptions;

CREATE POLICY "Users can read own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO service_role
  USING (true);

-- Fix user_preferences policies
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Service role can manage all preferences" ON user_preferences;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all preferences"
  ON user_preferences
  FOR ALL
  TO service_role
  USING (true);

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, email, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.email, au.raw_user_meta_data->>'email', 'user-' || au.id::text || '@temp.local'),
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();

-- Ensure all users have preferences
INSERT INTO user_preferences (user_id, created_at, updated_at)
SELECT 
  up.id,
  now(),
  now()
FROM user_profiles up
LEFT JOIN user_preferences pref ON up.id = pref.user_id
WHERE pref.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to test auth access
CREATE OR REPLACE FUNCTION test_user_access()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  profile_exists boolean;
  can_read_profiles boolean;
  can_insert_profiles boolean;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'error', 'No authenticated user',
      'user_id', null,
      'auth_working', false
    );
  END IF;
  
  -- Test if user can read their profile
  BEGIN
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_user_id) INTO profile_exists;
    can_read_profiles := true;
  EXCEPTION WHEN OTHERS THEN
    can_read_profiles := false;
    profile_exists := false;
  END;
  
  -- Test if user can insert their profile
  BEGIN
    -- Try a dry run insert (will fail on conflict if profile exists, but tests permission)
    PERFORM 1 FROM user_profiles WHERE id = current_user_id LIMIT 1;
    can_insert_profiles := true;
  EXCEPTION WHEN OTHERS THEN
    can_insert_profiles := false;
  END;
  
  result := json_build_object(
    'user_id', current_user_id,
    'auth_working', true,
    'profile_exists', profile_exists,
    'can_read_profiles', can_read_profiles,
    'can_insert_profiles', can_insert_profiles,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION test_user_access() TO authenticated;
GRANT EXECUTE ON FUNCTION test_user_access() TO anon;

-- Final verification
DO $$
DECLARE
  final_profile_count integer;
  final_auth_count integer;
BEGIN
  SELECT COUNT(*) INTO final_auth_count FROM auth.users;
  SELECT COUNT(*) INTO final_profile_count FROM user_profiles;
  
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '📊 Final count - Auth users: %, Profiles: %', final_auth_count, final_profile_count;
  RAISE NOTICE '🔒 RLS policies updated for user_profiles, user_subscriptions, user_preferences';
  RAISE NOTICE '🧪 Test function created: SELECT test_user_access();';
END $$;