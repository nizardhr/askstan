import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      throw new Error('Missing signature or webhook secret')
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log('Received webhook event:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Processing checkout session:', session.id)
        
        if (session.customer && session.subscription && session.metadata?.userId) {
          const userId = session.metadata.userId
          const planType = session.metadata.planType || 'monthly'
          const promoCode = session.metadata.promoCode || null

          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price.id

          // Extract discount information if promo code was used
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

          // Create or update subscription
          const { error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              stripe_price_id: priceId,
              status: 'active',
              plan_type: planType,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              promo_code: promoCode,
              discount_amount: discountAmount,
              discount_percentage: discountPercentage,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id'
            })

          if (subscriptionError) {
            console.error('Error creating subscription:', subscriptionError)
          } else {
            console.log('Subscription created successfully for user:', userId)
            
            // Mark user onboarding as completed
            await supabase
              .from('user_profiles')
              .update({ 
                onboarding_completed: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
          }

          // Record billing event
          await supabase
            .from('billing_history')
            .insert({
              user_id: userId,
              amount: session.amount_total || 0,
              currency: session.currency || 'usd',
              status: 'paid',
              paid_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            })
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription && invoice.customer) {
          // Update subscription status
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)

          console.log('Invoice paid for subscription:', invoice.subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)

          console.log('Payment failed for subscription:', invoice.subscription)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        const status = subscription.status === 'active' ? 'active' : 
                      subscription.status === 'trialing' ? 'trialing' :
                      subscription.status === 'past_due' ? 'past_due' :
                      subscription.status === 'canceled' ? 'canceled' :
                      subscription.status === 'unpaid' ? 'unpaid' : 'inactive'

        await supabase
          .from('user_subscriptions')
          .update({
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log('Subscription updated:', subscription.id, 'Status:', status)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log('Subscription canceled:', subscription.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})