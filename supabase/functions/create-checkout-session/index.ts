import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

Deno.serve(async (req) => {
  console.log('🚀 [create-checkout-session] Function invoked');
  console.log('📋 [create-checkout-session] Request method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('✅ [create-checkout-session] Handling CORS preflight');
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔧 [create-checkout-session] Initializing Stripe and Supabase...');
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    console.log('📥 [create-checkout-session] Parsing request body...');
    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json();
    
    console.log('📋 [create-checkout-session] Request data:', { userId, planType, priceId, promoCode, promotionCodeId });

    if (!priceId || !userId || !planType) {
      console.error('❌ [create-checkout-session] Missing required parameters');
      return new Response(JSON.stringify({
        error: 'Missing required parameters: priceId, userId, or planType'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('👤 [create-checkout-session] Getting user profile...');
    // Get user profile - create if doesn't exist
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('❌ [create-checkout-session] Profile fetch error:', profileError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user profile'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!profile) {
      console.log('➕ [create-checkout-session] Creating missing profile for user:', userId);
      
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: `user-${userId}@temp.local`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('email')
        .single();

      if (createError) {
        console.error('❌ [create-checkout-session] Failed to create profile:', createError);
        return new Response(JSON.stringify({
          error: 'Failed to create user profile'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
      
      profile = newProfile;
      console.log('✅ [create-checkout-session] Profile created:', profile.email);
    } else {
      console.log('✅ [create-checkout-session] Profile found:', profile.email);
    }

    // Check if promo code gives 100% discount
    let is100PercentDiscount = false;
    let validatedPromoCode = null;

    if (promoCode && promotionCodeId) {
      console.log('🏷️ [create-checkout-session] Validating promo code:', promoCode);
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        console.log('🏷️ [create-checkout-session] Promo code details:', {
          id: promotionCode.id,
          code: promotionCode.code,
          active: promotionCode.active,
          percent_off: promotionCode.coupon.percent_off
        });
        
        if (promotionCode.active && promotionCode.coupon.percent_off === 100) {
          is100PercentDiscount = true;
          validatedPromoCode = promotionCode;
          console.log('💯 [create-checkout-session] 100% discount detected - creating free subscription');
        }
      } catch (promoError) {
        console.log('⚠️ [create-checkout-session] Promo code validation error:', promoError.message);
      }
    }

    // If 100% discount, create subscription directly without Stripe checkout
    if (is100PercentDiscount && validatedPromoCode) {
      console.log('🎁 [create-checkout-session] Creating free subscription with 100% promo code');
      
      // Create a customer in Stripe (for future billing if needed)
      console.log('👤 [create-checkout-session] Creating Stripe customer...');
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          userId: userId,
          source: 'free_promo_code'
        }
      });

      console.log('✅ [create-checkout-session] Stripe customer created:', customer.id);

      // Calculate period end
      const periodEnd = planType === 'yearly' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      console.log('💾 [create-checkout-session] Creating subscription in database...');
      // Create subscription record in database
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customer.id,
          stripe_price_id: priceId,
          status: 'active',
          plan_type: planType,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          promo_code: promoCode,
          discount_percentage: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('❌ [create-checkout-session] Failed to create subscription:', subscriptionError);
        return new Response(JSON.stringify({
          error: 'Failed to create subscription'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }

      console.log('✅ [create-checkout-session] Subscription created:', subscription.id);

      console.log('👤 [create-checkout-session] Marking onboarding as completed...');
      // Mark user onboarding as completed
      await supabase
        .from('user_profiles')
        .update({ 
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      console.log('💰 [create-checkout-session] Creating billing record...');
      // Create billing record for $0 payment
      await supabase
        .from('billing_history')
        .insert({
          user_id: userId,
          subscription_id: subscription.id,
          amount: 0,
          currency: 'usd',
          status: 'paid',
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      console.log('🏷️ [create-checkout-session] Recording promo code usage...');
      // Record promo code usage
      await supabase
        .from('promo_code_usage')
        .insert({
          user_id: userId,
          subscription_id: subscription.id,
          promo_code: promoCode,
          stripe_promotion_code_id: promotionCodeId,
          stripe_coupon_id: validatedPromoCode.coupon.id,
          discount_type: 'percentage',
          discount_value: 100,
          discount_amount_cents: 0,
          currency: 'usd',
          metadata: {
            free_subscription: true,
            checkout_bypassed: true
          },
          applied_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      console.log('🎉 [create-checkout-session] Free subscription created successfully');

      // Return success URL that goes directly to dashboard
      return new Response(JSON.stringify({
        url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?free_subscription=true`,
        sessionId: 'free_' + Date.now(),
        freeSubscription: true,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('💳 [create-checkout-session] Creating regular Stripe checkout session...');
    // Regular paid checkout flow
    const sessionConfig: any = {
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
      payment_method_collection: 'if_required' // This allows $0 checkouts
    };

    // Apply promo code if provided
    if (promoCode && promotionCodeId) {
      console.log('🏷️ [create-checkout-session] Applying promo code to checkout session...');
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          sessionConfig.discounts = [{
            promotion_code: promotionCodeId
          }];
          sessionConfig.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promoCode = promoCode;
          console.log('✅ [create-checkout-session] Applied promo code:', promoCode);
        }
      } catch (promoError) {
        console.log('⚠️ [create-checkout-session] Promo code error (proceeding without discount):', promoError.message);
      }
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('✅ [create-checkout-session] Checkout session created:', checkoutSession.id);

    return new Response(JSON.stringify({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error('💥 [create-checkout-session] Critical error:', err);
    console.error('💥 [create-checkout-session] Error stack:', err.stack);
    
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});