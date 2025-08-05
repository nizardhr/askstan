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
    console.log('🔄 [process-checkout-session] Function started');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { sessionId, userId } = await req.json();
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

    // Retrieve the checkout session from Stripe
    console.log('📞 [process-checkout-session] Retrieving Stripe session...');
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    console.log('📊 [process-checkout-session] Session details:', {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      customer: session.customer ? 'present' : 'missing',
      subscription: session.subscription ? 'present' : 'missing',
      amount_total: session.amount_total
    });

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      console.error('❌ [process-checkout-session] Payment not completed:', session.payment_status);
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment not completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402
      });
    }

    // Get subscription details
    let subscriptionId = null;
    let priceId = null;
    let planType = session.metadata?.planType || 'monthly';

    if (session.subscription && typeof session.subscription === 'object') {
      subscriptionId = session.subscription.id;
      priceId = session.subscription.items.data[0]?.price.id;
      console.log('💳 [process-checkout-session] Subscription details:', { subscriptionId, priceId });
    }

    // Call database function to process checkout completion
    console.log('💾 [process-checkout-session] Calling database function...');
    const { data: result, error: dbError } = await supabase
      .rpc('process_checkout_completion', {
        session_id_param: sessionId,
        user_id_param: userId,
        customer_id_param: session.customer as string,
        subscription_id_param: subscriptionId,
        price_id_param: priceId,
        plan_type_param: planType,
        amount_total_param: session.amount_total || 0,
        promo_code_param: session.metadata?.promoCode || null
      });

    if (dbError) {
      console.error('❌ [process-checkout-session] Database function error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('✅ [process-checkout-session] Database function result:', result);

    if (result && result.success) {
      console.log('🎉 [process-checkout-session] Subscription activated successfully');
      return new Response(JSON.stringify({
        success: true,
        subscription: result,
        planType: planType,
        status: 'active',
        freeSubscription: (session.amount_total || 0) === 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      throw new Error(result?.error || 'Failed to activate subscription');
    }

  } catch (err: any) {
    console.error('💥 [process-checkout-session] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Failed to process checkout session'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});