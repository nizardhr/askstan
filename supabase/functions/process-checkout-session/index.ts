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

    const { sessionId } = await req.json();
    console.log('🔄 Processing checkout session:', sessionId);

    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Session ID is required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items']
    });

    console.log('📋 Session details:', {
      id: session.id,
      payment_status: session.payment_status,
      customer: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscription: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      amount_total: session.amount_total,
      metadata: session.metadata
    });

    // Extract required data
    const userId = session.metadata?.userId;
    const planType = session.metadata?.planType || 'monthly';
    const promoCode = session.metadata?.promoCode || null;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!userId) {
      throw new Error('User ID not found in session metadata');
    }

    if (!customerId) {
      throw new Error('Customer ID not found in session');
    }

    // Check payment status
    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed:', session.payment_status);
      return new Response(JSON.stringify({
        success: false,
        message: 'Payment not completed',
        paymentStatus: session.payment_status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Process subscription if present
    if (subscriptionId) {
      console.log('💳 Processing subscription:', subscriptionId);

      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;

      // Calculate period end based on plan type
      const periodEnd = planType === 'yearly' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
        console.error('❌ Subscription creation error:', subscriptionError);
        throw new Error(`Failed to create subscription: ${subscriptionError.message}`);
      }

      console.log('✅ Subscription created/updated:', subscriptionData.id);

      // Mark user onboarding as completed
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error('⚠️ Profile update error (non-critical):', profileError);
      }

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
        console.error('⚠️ Billing record error (non-critical):', billingError);
      }

      // Record promo code usage if applicable
      if (promoCode) {
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
          console.error('⚠️ Promo code usage error (non-critical):', promoError);
        }
      }

      console.log('🎉 Checkout session processing completed successfully');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Checkout session processed successfully',
      sessionId: sessionId,
      subscriptionId: subscriptionId,
      customerId: customerId,
      userId: userId,
      subscriptionStatus: 'active'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('💥 Error processing checkout session:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack || 'No stack trace available'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});