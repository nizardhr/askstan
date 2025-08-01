/*
  # Disable email confirmation requirement - Final Fix

  1. Changes
    - Update only email_confirmed_at column (confirmed_at is generated)
    - Create trigger to auto-confirm users on signup
    - Handle existing unconfirmed users properly

  2. Security
    - Maintains password-based authentication security
    - Users can access platform immediately after signup
    - Reduces onboarding friction

  3. Notes
    - This fixes the "Email not confirmed" error during login
    - Uses only updatable columns in auth.users table
    - Avoids touching generated columns like confirmed_at
*/

-- Update existing users who might be stuck in unconfirmed state
-- Only update email_confirmed_at as confirmed_at is a generated column
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Create a function to auto-confirm users on signup
CREATE OR REPLACE FUNCTION auto_confirm_user_email()
RETURNS trigger AS $$
BEGIN
  -- Auto-confirm the user's email immediately
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_confirm_user_email_trigger ON auth.users;

-- Create trigger to auto-confirm users on signup
CREATE TRIGGER auto_confirm_user_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_confirm_user_email() TO service_role;
GRANT EXECUTE ON FUNCTION auto_confirm_user_email() TO anon;
GRANT EXECUTE ON FUNCTION auto_confirm_user_email() TO authenticated;