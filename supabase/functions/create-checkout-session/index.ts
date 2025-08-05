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

    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json();

    if (!priceId || !userId || !planType) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: priceId, userId, or planType'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('Creating checkout session for user:', userId, 'plan:', planType);

    // Fetch user email from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('User profile not found:', profileError);
      return new Response(JSON.stringify({
        error: 'User profile not found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Check if promo code gives 100% discount
    let is100PercentDiscount = false;
    if (promoCode && promotionCodeId) {
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.coupon.percent_off === 100) {
          is100PercentDiscount = true;
          console.log('100% discount detected, creating free subscription');
        }
      } catch (err) {
        console.log('Error checking promo code:', err.message);
      }
    }

    // Handle 100% discount - create subscription directly
    if (is100PercentDiscount) {
      console.log('Creating free subscription for 100% promo code');
      
      // Create customer in Stripe (for future billing if needed)
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { userId, planType, promoCode }
      });

      // Create subscription record directly in database
      const subscriptionData = {
        user_id: userId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: null, // No Stripe subscription for free accounts
        stripe_price_id: priceId,
        status: 'active',
        plan_type: planType,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (planType === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)).toISOString(),
        promo_code: promoCode,
        discount_percentage: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .upsert(subscriptionData, { onConflict: 'user_id' })
        .select()
        .single();

      if (subscriptionError) {
        console.error('Error creating free subscription:', subscriptionError);
        throw new Error('Failed to create free subscription');
      }

      // Mark onboarding as completed
      await supabase
        .from('user_profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Record promo code usage
      await supabase
        .from('promo_code_usage')
        .insert({
          user_id: userId,
          subscription_id: subscription.id,
          promo_code: promoCode,
          stripe_promotion_code_id: promotionCodeId,
          discount_type: 'percentage',
          discount_value: 100,
          applied_at: new Date().toISOString(),
          metadata: { free_subscription: true }
        });

      console.log('Free subscription created successfully');

      // Return direct redirect to dashboard with free subscription flag
      return new Response(JSON.stringify({
        url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?free_subscription=true`,
        sessionId: null,
        isFreeSubscription: true,
        subscription: subscription
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Regular paid checkout process
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer_email: profile.email,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/subscribe`,
      metadata: {
        userId,
        planType
      },
      subscription_data: {
        metadata: {
          userId,
          planType
        }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'if_required'
    };

    // Add promo code if provided
    if (promoCode && promotionCodeId) {
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          sessionConfig.discounts = [{
            promotion_code: promotionCodeId
          }];
          sessionConfig.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promotionCodeId = promotionCodeId;
          console.log('Applied promo code:', promoCode);
        }
      } catch (err) {
        console.log('Error applying promo code, proceeding without discount:', err.message);
      }
    }

    console.log('Creating Stripe checkout session');
    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Checkout session created:', session.id);

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      hasDiscount: !!sessionConfig.discounts,
      promoCode: promoCode || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});