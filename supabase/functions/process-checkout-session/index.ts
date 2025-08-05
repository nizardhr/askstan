import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

Deno.serve(async (req) => {
  console.log('🚀 process-checkout-session function called')
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled')
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    console.log('🔧 Initializing Stripe and Supabase clients...')
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    console.log('📥 Parsing request body...')
    const { sessionId, userId } = await req.json()

    console.log('📋 Request data:', { sessionId, userId })

    if (!sessionId || !userId) {
      console.error('❌ Missing required parameters')
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing sessionId or userId'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    console.log('🔍 Retrieving checkout session from Stripe...')
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items']
    })

    console.log('📊 Stripe session details:', {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      customer: session.customer ? 'present' : 'missing',
      subscription: session.subscription ? 'present' : 'missing'
    })

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      console.error('❌ Payment not completed:', session.payment_status)
      return new Response(JSON.stringify({
        success: false,
        error: `Payment not completed. Status: ${session.payment_status}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402
      })
    }

    // Extract subscription details
    let subscriptionId = null
    let priceId = null
    let planType = 'monthly'
    let currentPeriodStart = null
    let currentPeriodEnd = null

    if (session.subscription && typeof session.subscription === 'object') {
      const subscription = session.subscription as Stripe.Subscription
      subscriptionId = subscription.id
      priceId = subscription.items.data[0]?.price.id
      currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString()
      currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
      
      // Determine plan type from price interval
      const priceInterval = subscription.items.data[0]?.price.recurring?.interval
      planType = priceInterval === 'year' ? 'yearly' : 'monthly'
    } else {
      // For one-time payments or free subscriptions
      planType = session.metadata?.planType || 'monthly'
      priceId = session.metadata?.priceId
    }

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const promoCode = session.metadata?.promoCode || null

    console.log('💾 Calling database function to activate subscription...')
    setProcessingStep('Updating your account...')

    // Call the database function to process checkout completion
    const { data: result, error: dbError } = await supabase
      .rpc('process_checkout_completion', {
        session_id_param: sessionId,
        user_id_param: userId,
        customer_id_param: customerId,
        subscription_id_param: subscriptionId,
        price_id_param: priceId,
        plan_type_param: planType,
        amount_total_param: session.amount_total || 0,
        promo_code_param: promoCode
      })

    console.log('🗄️ Database function result:', { result, dbError })

    if (dbError) {
      console.error('❌ Database function error:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }

    if (!result || !result.success) {
      console.error('❌ Database function returned failure:', result)
      throw new Error(result?.error || 'Failed to activate subscription in database')
    }

    console.log('✅ Subscription activated successfully!')
    setProcessingStep('Success! Preparing your dashboard...')

    return new Response(JSON.stringify({
      success: true,
      subscription: result,
      message: 'Subscription activated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('💥 Error in process-checkout-session:', err)
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// Handle the actual processing in the page component
export const processCheckoutInPage = async (sessionId: string, userId: string) => {
  try {
    console.log('🔄 Processing checkout session:', sessionId, 'for user:', userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    console.log('🔑 Auth session found, calling process-checkout-session...');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          sessionId,
          userId
        }),
      }
    );

    console.log('📡 Edge function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge function error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Process checkout session result:', result);

    return result;
  } catch (err: any) {
    console.error('💥 Error processing checkout session:', err);
    throw err;
  }
};