/*
  # Disable email confirmation requirement

  1. Changes
    - Disable email confirmation for new user signups
    - Allow users to sign in immediately after registration
    - Update auth settings to skip email verification

  2. Security
    - Maintains password-based authentication security
    - Users can access the platform immediately after signup
    - Reduces friction in the onboarding process

  3. Notes
    - This removes the email confirmation step from the signup flow
    - Users will be able to sign in immediately after creating an account
    - Subscription verification will still be enforced separately
*/

-- Disable email confirmation requirement
UPDATE auth.config 
SET email_confirm = false 
WHERE true;

-- Alternative approach using auth settings
INSERT INTO auth.config (parameter, value) 
VALUES ('MAILER_AUTOCONFIRM', 'true')
ON CONFLICT (parameter) 
DO UPDATE SET value = 'true';

-- Ensure existing users who might be stuck in unconfirmed state are confirmed
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now()
WHERE email_confirmed_at IS NULL 
  AND confirmed_at IS NULL;