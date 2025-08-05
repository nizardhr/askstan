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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json();
    
    console.log('Creating checkout session for:', { userId, planType, priceId, promoCode });

    if (!priceId || !userId || !planType) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: priceId, userId, or planType'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get user profile - create if doesn't exist
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.log('Creating missing profile for user:', userId);
      
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
        console.error('Failed to create profile:', createError);
        return new Response(JSON.stringify({
          error: 'Failed to create user profile'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
      
      profile = newProfile;
    }

    // Check if promo code gives 100% discount
    let is100PercentDiscount = false;
    let validatedPromoCode = null;

    if (promoCode && promotionCodeId) {
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.coupon.percent_off === 100) {
          is100PercentDiscount = true;
          validatedPromoCode = promotionCode;
          console.log('100% discount detected - will create free subscription');
        }
      } catch (promoError) {
        console.log('Promo code validation error:', promoError.message);
      }
    }

    // If 100% discount, create subscription directly without Stripe checkout
    if (is100PercentDiscount && validatedPromoCode) {
      console.log('Creating free subscription with 100% promo code');
      
      // Create a customer in Stripe (for future billing if needed)
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          userId: userId,
          source: 'free_promo_code'
        }
      });

      // Create subscription record in database
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          stripe_customer_id: customer.id,
          stripe_price_id: priceId,
          status: 'active',
          plan_type: planType,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (planType === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
          promo_code: promoCode,
          discount_percentage: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('Failed to create subscription:', subscriptionError);
        return new Response(JSON.stringify({
          error: 'Failed to create subscription'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }

      // Mark user onboarding as completed
      await supabase
        .from('user_profiles')
        .update({ 
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Create billing record for $0 payment
      await supabase
        .from('billing_history')
        .insert({
          user_id: userId,
          subscription_id: subscription.id,
          amount: 0,
          currency: currency_param || 'usd',
          status: 'paid',
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

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

      console.log('Free subscription created successfully');

      // Return success URL that goes directly to dashboard
      return new Response(JSON.stringify({
        url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?free_subscription=true`,
        sessionId: 'free_' + Date.now(),
        freeSubscription: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

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
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          sessionConfig.discounts = [{
            promotion_code: promotionCodeId
          }];
          sessionConfig.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promoCode = promoCode;
          console.log('Applied promo code:', promoCode);
        }
      } catch (promoError) {
        console.log('Promo code error (proceeding without discount):', promoError.message);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('Checkout session created:', session.id);

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error('Checkout session creation error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});