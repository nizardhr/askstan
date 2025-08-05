import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const { sessionId, userId } = await req.json()

    if (!sessionId || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing sessionId or userId'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    console.log('Processing checkout session:', sessionId, 'for user:', userId)

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    })

    console.log('Retrieved session:', session.id, 'Status:', session.payment_status)

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({
        error: 'Payment not completed',
        paymentStatus: session.payment_status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402
      })
    }

    if (!session.subscription || typeof session.subscription === 'string') {
      return new Response(JSON.stringify({
        error: 'No subscription found in session'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

    const subscription = session.subscription as Stripe.Subscription
    const customer = session.customer as Stripe.Customer

    console.log('Processing subscription:', subscription.id, 'Status:', subscription.status)

    // Extract metadata
    const planType = session.metadata?.planType || 'monthly'
    const promoCode = session.metadata?.promoCode || null

    // Extract discount information
    let discountAmount = null
    let discountPercentage = null

    if (subscription.discount) {
      const coupon = subscription.discount.coupon
      if (coupon.amount_off) {
        discountAmount = coupon.amount_off
      }
      if (coupon.percent_off) {
        discountPercentage = coupon.percent_off
      }
    }

    // Create or update subscription in database
    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id,
      status: subscription.status,
      plan_type: planType,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      promo_code: promoCode,
      discount_amount: discountAmount,
      discount_percentage: discountPercentage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('Creating subscription with data:', subscriptionData)

    const { data: createdSubscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError)
      return new Response(JSON.stringify({
        error: 'Failed to create subscription',
        details: subscriptionError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    console.log('Subscription created successfully:', createdSubscription)

    // Update user profile to mark onboarding as completed
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      // Don't fail the request for this, just log the error
    }

    // Create billing history record
    if (session.amount_total && session.amount_total > 0) {
      const { error: billingError } = await supabase
        .from('billing_history')
        .insert({
          user_id: userId,
          subscription_id: createdSubscription.id,
          stripe_invoice_id: null, // Will be updated by webhook later
          amount: session.amount_total,
          currency: session.currency || 'usd',
          status: 'paid',
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })

      if (billingError) {
        console.error('Error creating billing record:', billingError)
        // Don't fail the request for this, just log the error
      }
    }

    // Record promo code usage if applicable
    if (promoCode && session.metadata?.promotionCodeId) {
      const { error: promoError } = await supabase
        .from('promo_code_usage')
        .insert({
          user_id: userId,
          subscription_id: createdSubscription.id,
          promo_code: promoCode,
          stripe_promotion_code_id: session.metadata.promotionCodeId,
          discount_type: discountPercentage ? 'percentage' : 'amount',
          discount_value: discountPercentage || discountAmount || 0,
          applied_at: new Date().toISOString(),
          metadata: {
            checkout_session_id: sessionId,
            original_amount: session.amount_subtotal,
            final_amount: session.amount_total
          }
        })

      if (promoError) {
        console.error('Error recording promo code usage:', promoError)
        // Don't fail the request for this, just log the error
      }
    }

    return new Response(JSON.stringify({
      success: true,
      subscription: createdSubscription,
      message: 'Subscription activated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('Error processing checkout session:', err)
    return new Response(JSON.stringify({
      error: 'Failed to process checkout session',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})