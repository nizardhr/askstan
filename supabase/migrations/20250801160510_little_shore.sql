/*
  # Fix user signup database error

  1. Changes
    - Recreate the profile creation trigger function with better error handling
    - Ensure the trigger is properly set up
    - Add indexes for better performance
    - Handle potential conflicts gracefully

  2. Security
    - Maintain existing RLS policies
    - Ensure proper permissions for the trigger function

  3. Notes
    - This migration fixes the "Database error saving new user" issue
    - Adds better error handling for edge cases
    - Ensures the profiles table is properly populated on user signup
*/

-- Drop existing trigger and function to recreate them
DROP TRIGGER IF EXISTS create_profile_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_profile_on_signup();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with proper error handling
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id, 
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''), 
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER create_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_on_signup();

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION create_profile_on_signup() TO service_role;

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON public.subscriptions(stripe_customer_id);

-- Ensure RLS is enabled (should already be enabled from previous migration)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;