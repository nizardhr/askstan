import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json()

    if (!priceId || !userId || !planType) {
      throw new Error('Missing required parameters: priceId, userId, or planType')
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    // Prepare checkout session configuration
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer_email: profile.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:5173'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:5173'}/subscribe`,
      metadata: {
        userId: userId,
        planType: planType,
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planType: planType,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_creation: 'always',
    }

    // Add promo code if provided
    if (promoCode && promotionCodeId) {
      sessionConfig.discounts = [
        {
          promotion_code: promotionCodeId,
        },
      ]
      
      // Add promo code to metadata for tracking
      sessionConfig.metadata!.promoCode = promoCode
      sessionConfig.subscription_data!.metadata!.promoCode = promoCode
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Checkout session error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})