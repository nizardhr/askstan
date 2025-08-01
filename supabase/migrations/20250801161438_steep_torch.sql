/*
  # Mark test user as paid subscriber - Fixed

  1. Changes
    - Find user with email dahrabounizar@gmail.com
    - Create an active subscription record for testing
    - Use INSERT with proper conflict handling
    - Set subscription status to 'active' with valid period dates

  2. Security
    - Uses existing RLS policies
    - Only affects the specific test user

  3. Notes
    - This is for testing purposes to verify the paid user flow
    - Creates a mock subscription without actual Stripe integration
    - User will have access to dashboard and all paid features
    - Uses proper conflict handling without relying on unique constraints
*/

-- Create subscription for test user
DO $$
DECLARE
    user_profile_id uuid;
    existing_subscription_id uuid;
BEGIN
    -- Find the user profile by email
    SELECT id INTO user_profile_id
    FROM profiles
    WHERE email = 'dahrabounizar@gmail.com';

    -- If user exists, handle their subscription
    IF user_profile_id IS NOT NULL THEN
        -- Check if subscription already exists
        SELECT id INTO existing_subscription_id
        FROM subscriptions
        WHERE user_id = user_profile_id
        LIMIT 1;

        IF existing_subscription_id IS NOT NULL THEN
            -- Update existing subscription
            UPDATE subscriptions SET
                status = 'active',
                current_period_start = now(),
                current_period_end = now() + interval '30 days',
                updated_at = now()
            WHERE id = existing_subscription_id;
            
            RAISE NOTICE 'Updated existing subscription for user dahrabounizar@gmail.com';
        ELSE
            -- Create new subscription
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
            );
            
            RAISE NOTICE 'Created new subscription for user dahrabounizar@gmail.com';
        END IF;
    ELSE
        RAISE NOTICE 'User with email dahrabounizar@gmail.com not found';
    END IF;
END $$;