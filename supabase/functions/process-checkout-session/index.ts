// supabase/functions/process-checkout-session/index.ts
// Updated with better error handling and database integration

import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe and Supabase
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the session ID from request
    const { sessionId } = await req.json()

    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    console.log('🔄 Processing checkout session:', sessionId)

    // Retrieve the checkout session from Stripe with expanded data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items']
    })

    if (!session) {
      throw new Error('Checkout session not found')
    }

    console.log('📋 Session details:', {
      id: session.id,
      payment_status: session.payment_status,
      customer: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscription: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      metadata: session.metadata
    })

    // Extract required data
    const userId = session.metadata?.userId
    const planType = session.metadata?.planType || 'monthly'
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

    if (!userId) {
      throw new Error('User ID not found in session metadata')
    }

    if (!customerId) {
      throw new Error('Customer ID not found in session')
    }

    // Check payment status
    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed:', session.payment_status)
      return new Response(JSON.stringify({
        success: false,
        message: 'Payment not completed',
        paymentStatus: session.payment_status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Process subscription if present
    if (subscriptionId) {
      console.log('💳 Processing subscription:', subscriptionId)

      // Get subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id

      // Use the database function to process checkout completion
      const { data: result, error } = await supabase
        .rpc('process_stripe_checkout_completion', {
          session_id_param: sessionId,
          user_id_param: userId,
          customer_id_param: customerId,
          subscription_id_param: subscriptionId,
          price_id_param: priceId,
          plan_type_param: planType,
          amount_total_param: session.amount_total,
          currency_param: session.currency || 'usd'
        })

      if (error) {
        console.error('❌ Database function error:', error)
        throw new Error(`Database processing failed: ${error.message}`)
      }

      if (!result?.success) {
        console.error('❌ Checkout processing failed:', result)
        throw new Error(result?.error || 'Unknown processing error')
      }

      console.log('✅ Subscription processed successfully:', result)
    } else {
      // Handle one-time payment (no subscription)
      console.log('💰 Processing one-time payment')
      
      // Still create/update user profile for one-time purchases
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.error('⚠️ Profile update error (non-critical):', profileError)
      }

      // Create billing record for one-time payment
      if (session.amount_total) {
        const { error: billingError } = await supabase
          .from('billing_history')
          .insert({
            user_id: userId,
            amount: session.amount_total,
            currency: session.currency || 'usd',
            status: 'paid',
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          })

        if (billingError) {
          console.error('⚠️ Billing record error (non-critical):', billingError)
        }
      }
    }

    console.log('🎉 Checkout session processing completed successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Checkout session processed successfully',
      sessionId: sessionId,
      subscriptionId: subscriptionId,
      customerId: customerId,
      userId: userId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 Error processing checkout session:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack || 'No stack trace available'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})