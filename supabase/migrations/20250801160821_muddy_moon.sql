/*
  # Disable email confirmation for user signups

  1. Changes
    - Disable email confirmation requirement for new signups
    - Confirm any existing unconfirmed users
    - Allow immediate access after registration

  2. Security
    - Maintains password-based authentication security
    - Users can access platform immediately after signup
    - Reduces onboarding friction

  3. Notes
    - This fixes the "Email not confirmed" error during login
    - Users will be able to sign in immediately after creating an account
    - Uses the correct approach for Supabase auth configuration
*/

-- Confirm any existing users who might be stuck in unconfirmed state
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL 
   OR confirmed_at IS NULL;

-- Create a function to auto-confirm users on signup
CREATE OR REPLACE FUNCTION auto_confirm_user()
RETURNS trigger AS $$
BEGIN
  -- Auto-confirm the user immediately
  NEW.email_confirmed_at = now();
  NEW.confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;

-- Create trigger to auto-confirm users on signup
CREATE TRIGGER auto_confirm_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_confirm_user() TO service_role;
GRANT EXECUTE ON FUNCTION auto_confirm_user() TO anon;
GRANT EXECUTE ON FUNCTION auto_confirm_user() TO authenticated;