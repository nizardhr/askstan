/*
  # Mark test user as paid subscriber

  1. Changes
    - Find user with email dahrabounizar@gmail.com
    - Create an active subscription record for testing
    - Set subscription status to 'active' with valid period dates

  2. Security
    - Uses existing RLS policies
    - Only affects the specific test user

  3. Notes
    - This is for testing purposes to verify the paid user flow
    - Creates a mock subscription without actual Stripe integration
    - User will have access to dashboard and all paid features
*/

-- Create subscription for test user
DO $$
DECLARE
    user_profile_id uuid;
BEGIN
    -- Find the user profile by email
    SELECT id INTO user_profile_id
    FROM profiles
    WHERE email = 'dahrabounizar@gmail.com';

    -- If user exists, create/update their subscription
    IF user_profile_id IS NOT NULL THEN
        INSERT INTO subscriptions (
            user_id,
            stripe_customer_id,
            stripe_subscription_id,
            status,
            current_period_start,
            current_period_end,
            created_at,
            updated_at
        ) VALUES (
            user_profile_id,
            'cus_test_' || user_profile_id,
            'sub_test_' || user_profile_id,
            'active',
            now(),
            now() + interval '30 days',
            now(),
            now()
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
            status = 'active',
            current_period_start = now(),
            current_period_end = now() + interval '30 days',
            updated_at = now();

        RAISE NOTICE 'Successfully marked user dahrabounizar@gmail.com as paid subscriber';
    ELSE
        RAISE NOTICE 'User with email dahrabounizar@gmail.com not found';
    END IF;
END $$;