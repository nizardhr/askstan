import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

Deno.serve(async (req) => {
  console.log('🚀 [process-checkout-session] Function invoked');
  console.log('📋 [process-checkout-session] Request method:', req.method);
  console.log('📋 [process-checkout-session] Request headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('✅ [process-checkout-session] Handling CORS preflight');
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔧 [process-checkout-session] Initializing Stripe and Supabase...');
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    console.log('📥 [process-checkout-session] Parsing request body...');
    const requestBody = await req.json();
    const { sessionId, userId } = requestBody;
    
    console.log('📋 [process-checkout-session] Request data:', { sessionId, userId });

    if (!sessionId || !userId) {
      console.error('❌ [process-checkout-session] Missing required parameters');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing sessionId or userId'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('🔍 [process-checkout-session] Retrieving Stripe session...');
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items']
    });

    console.log('📋 [process-checkout-session] Stripe session details:', {
      id: session.id,
      payment_status: session.payment_status,
      customer: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscription: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      amount_total: session.amount_total,
      metadata: session.metadata
    });

    // Validate payment was successful
    if (session.payment_status !== 'paid') {
      console.error('❌ [process-checkout-session] Payment not completed:', session.payment_status);
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment not completed',
        paymentStatus: session.payment_status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Extract data from session
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const planType = session.metadata?.planType || 'monthly';
    const promoCode = session.metadata?.promoCode || null;

    if (!customerId) {
      throw new Error('Customer ID not found in session');
    }

    console.log('💳 [process-checkout-session] Processing subscription activation...');

    // Get subscription details if it exists
    let stripeSubscription = null;
    let priceId = null;

    if (subscriptionId) {
      console.log('📋 [process-checkout-session] Fetching subscription details from Stripe...');
      stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      priceId = stripeSubscription.items.data[0]?.price.id;
      console.log('📋 [process-checkout-session] Subscription details:', {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        priceId: priceId
      });
    }

    // Calculate period end based on plan type
    const periodEnd = planType === 'yearly' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    console.log('💾 [process-checkout-session] Creating/updating subscription in database...');

    // Create or update subscription in database
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        status: 'active',
        plan_type: planType,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        promo_code: promoCode,
        discount_percentage: session.amount_total === 0 ? 100 : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('❌ [process-checkout-session] Subscription creation error:', subscriptionError);
      throw new Error(`Failed to create subscription: ${subscriptionError.message}`);
    }

    console.log('✅ [process-checkout-session] Subscription created/updated:', subscriptionData.id);

    console.log('👤 [process-checkout-session] Updating user profile...');
    // Mark user onboarding as completed
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('⚠️ [process-checkout-session] Profile update error (non-critical):', profileError);
    } else {
      console.log('✅ [process-checkout-session] Profile updated successfully');
    }

    console.log('💰 [process-checkout-session] Creating billing record...');
    // Create billing record
    const { error: billingError } = await supabase
      .from('billing_history')
      .insert({
        user_id: userId,
        subscription_id: subscriptionData.id,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'paid',
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (billingError) {
      console.error('⚠️ [process-checkout-session] Billing record error (non-critical):', billingError);
    } else {
      console.log('✅ [process-checkout-session] Billing record created');
    }

    // Record promo code usage if applicable
    if (promoCode) {
      console.log('🏷️ [process-checkout-session] Recording promo code usage...');
      const { error: promoError } = await supabase
        .from('promo_code_usage')
        .insert({
          user_id: userId,
          subscription_id: subscriptionData.id,
          promo_code: promoCode,
          discount_type: session.amount_total === 0 ? 'percentage' : 'amount',
          discount_value: session.amount_total === 0 ? 100 : 0,
          discount_amount_cents: 0,
          currency: 'usd',
          metadata: {
            session_id: sessionId,
            free_subscription: session.amount_total === 0
          },
          applied_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (promoError) {
        console.error('⚠️ [process-checkout-session] Promo code usage error (non-critical):', promoError);
      } else {
        console.log('✅ [process-checkout-session] Promo code usage recorded');
      }
    }

    console.log('🎉 [process-checkout-session] Checkout session processing completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: 'Checkout session processed successfully',
      data: {
        sessionId: sessionId,
        subscriptionId: subscriptionData.id,
        customerId: customerId,
        userId: userId,
        subscriptionStatus: 'active',
        planType: planType,
        amountPaid: session.amount_total || 0,
        promoCode: promoCode
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('💥 [process-checkout-session] Critical error:', error);
    console.error('💥 [process-checkout-session] Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack || 'No stack trace available'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});