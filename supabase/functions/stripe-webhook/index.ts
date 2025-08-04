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
        
        if (session.customer && session.subscription && session.metadata?.userId) {
          const userId = session.metadata.userId
          const planType = session.metadata.planType || 'monthly'
          const promoCode = session.metadata.promoCode || null

          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

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

          // Create or update subscription with promo code data
          const { error } = await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              stripe_price_id: subscription.items.data[0]?.price.id,
              status: 'active',
              plan_type: planType,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              promo_code: promoCode,
              discount_amount: discountAmount,
              discount_percentage: discountPercentage,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id'
            })

          if (error) {
            console.error('Error creating subscription:', error)
          } else {
            console.log('Subscription created for user:', userId, 'with promo code:', promoCode)
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription && invoice.customer) {
          // Update subscription status
          const { error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)

          // Record billing event
          const { error: billingError } = await supabase
            .rpc('record_billing_event', {
              stripe_customer_id_param: invoice.customer as string,
              stripe_invoice_id_param: invoice.id,
              amount_param: invoice.amount_paid,
              currency_param: invoice.currency,
              status_param: 'paid',
              invoice_url_param: invoice.hosted_invoice_url,
              paid_at_param: new Date().toISOString()
            })

          if (subscriptionError) {
            console.error('Error updating subscription on payment:', subscriptionError)
          }
          if (billingError) {
            console.error('Error recording billing event:', billingError)
          }
          
          console.log('Invoice paid for subscription:', invoice.subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription && invoice.customer) {
          // Update subscription status
          const { error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)

          // Record billing event
          const { error: billingError } = await supabase
            .rpc('record_billing_event', {
              stripe_customer_id_param: invoice.customer as string,
              stripe_invoice_id_param: invoice.id,
              amount_param: invoice.amount_due,
              currency_param: invoice.currency,
              status_param: 'failed',
              invoice_url_param: invoice.hosted_invoice_url,
              paid_at_param: null
            })

          if (subscriptionError) {
            console.error('Error updating subscription on payment failure:', subscriptionError)
          }
          if (billingError) {
            console.error('Error recording billing failure:', billingError)
          }
          
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
                      subscription.status === 'unpaid' ? 'unpaid' :
                      subscription.status === 'incomplete' ? 'incomplete' :
                      subscription.status === 'incomplete_expired' ? 'incomplete_expired' : 'inactive'

        // Extract discount information if present
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

        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            discount_amount: discountAmount,
            discount_percentage: discountPercentage,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
        } else {
          console.log('Subscription updated:', subscription.id, 'Status:', status)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error canceling subscription:', error)
        } else {
          console.log('Subscription canceled:', subscription.id)
        }
        break
      }

      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          const { error } = await supabase
            .from('user_subscriptions')
            .update({
              status: 'incomplete',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription as string)

          if (error) {
            console.error('Error updating subscription for payment action required:', error)
          } else {
            console.log('Subscription requires payment action:', invoice.subscription)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
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