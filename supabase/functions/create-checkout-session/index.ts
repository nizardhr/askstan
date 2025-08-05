import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    console.log('🚀 [create-checkout-session] Function started');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json();
    console.log('📋 [create-checkout-session] Request data:', { priceId, userId, planType, promoCode });

    if (!priceId || !userId || !planType) {
      console.error('❌ [create-checkout-session] Missing required parameters');
      return new Response(JSON.stringify({
        error: 'Missing required parameters: priceId, userId, or planType'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Fetch user email from Supabase
    console.log('👤 [create-checkout-session] Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ [create-checkout-session] User profile not found:', profileError);
      return new Response(JSON.stringify({
        error: 'User profile not found. Please try signing out and back in.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    console.log('✅ [create-checkout-session] User profile found:', profile.email);

    // Check if promo code gives 100% discount
    let is100PercentDiscount = false;
    if (promoCode && promotionCodeId) {
      try {
        console.log('🎫 [create-checkout-session] Checking promo code for 100% discount...');
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.coupon.percent_off === 100) {
          is100PercentDiscount = true;
          console.log('🎉 [create-checkout-session] 100% discount detected!');
        }
      } catch (err) {
        console.log('⚠️ [create-checkout-session] Error checking promo code:', err.message);
      }
    }

    // Handle 100% discount - create subscription directly
    if (is100PercentDiscount) {
      console.log('🆓 [create-checkout-session] Creating free subscription...');
      
      // Create customer in Stripe (for future billing if needed)
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { userId, planType, promoCode }
      });

      console.log('👤 [create-checkout-session] Stripe customer created:', customer.id);

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

      console.log('💾 [create-checkout-session] Creating subscription in database...');
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .upsert(subscriptionData, { onConflict: 'user_id' })
        .select()
        .single();

      if (subscriptionError) {
        console.error('❌ [create-checkout-session] Error creating free subscription:', subscriptionError);
        throw new Error('Failed to create free subscription');
      }

      console.log('✅ [create-checkout-session] Free subscription created:', subscription.id);

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

      console.log('🎉 [create-checkout-session] Free subscription setup complete');

      // Return direct redirect to dashboard with free subscription flag
      return new Response(JSON.stringify({
        url: null,
        sessionId: null,
        isFreeSubscription: true,
        subscription: subscription
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Regular paid checkout process
    console.log('💳 [create-checkout-session] Creating paid checkout session...');
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
          console.log('🎫 [create-checkout-session] Applied promo code:', promoCode);
        }
      } catch (err) {
        console.log('⚠️ [create-checkout-session] Error applying promo code, proceeding without discount:', err.message);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    console.log('✅ [create-checkout-session] Stripe checkout session created:', session.id);

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
    console.error('💥 [create-checkout-session] Error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});