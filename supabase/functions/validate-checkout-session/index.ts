import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { sessionId, userId } = await req.json();
    console.log('Validating session:', { sessionId, userId });

    if (!sessionId || !userId) {
      console.error('Missing parameters:', { sessionId, userId });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing sessionId or userId' 
        }), 
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Retrieve the checkout session from Stripe
    console.log('Retrieving Stripe session...');
    const session = await stripe.checkout.sessions.retrieve(sessionId, { 
      expand: ['subscription', 'customer'] 
    });

    console.log('Stripe session retrieved:', {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      subscription: session.subscription ? 'present' : 'missing'
    });

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment not completed' 
        }), 
        { 
          status: 402, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Check if we have a subscription
    if (!session.subscription || typeof session.subscription === 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Subscription not found in session' 
        }), 
        { 
          status: 404, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const subscription = session.subscription;
    console.log('Subscription status:', subscription.status);

    // Verify subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Subscription is ${subscription.status}, not active` 
        }), 
        { 
          status: 402, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Update user's subscription status in Supabase
    console.log('Updating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Supabase profile update error (non-critical):', profileError);
      // Don't fail the whole request for profile update errors
    }

    // Also create/update subscription record
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id,
        status: subscription.status,
        plan_type: session.metadata?.planType || 'monthly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        promo_code: session.metadata?.promoCode || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) {
      console.error('Subscription record error (non-critical):', subscriptionError);
      // Don't fail the whole request for subscription errors
    }

    console.log('Session validation successful!');
    return new Response(
      JSON.stringify({ 
        success: true, 
        subscriptionStatus: subscription.status,
        customerId: session.customer,
        subscriptionId: subscription.id
      }), 
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (err: any) {
    console.error('Error validating checkout session:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal Server Error', 
        details: err.message 
      }), 
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});