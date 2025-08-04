import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io',  // Use your domain here
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request received.')
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    console.log('Initializing Stripe and Supabase clients...')
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    console.log('Parsing request body...')
    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json()
    console.log('Request parameters:', { priceId, userId, planType, promoCode, promotionCodeId })

    if (!priceId || !userId || !planType) {
      console.error('Missing parameters:', { priceId, userId, planType })
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: priceId, userId, or planType' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Fetching profile for userId: ${userId}`)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log('User profile found:', profile)

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer_email: profile.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/subscribe`,
      metadata: { userId, planType },
      subscription_data: { metadata: { userId, planType } },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_creation: 'always',
      payment_method_collection: 'if_required',
    }

    // Promo Code Logic
    if (promoCode && promotionCodeId) {
      console.log(`Promo code provided. Validating... Code: ${promoCode}, ID: ${promotionCodeId}`)
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId)

        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          console.log('Promo code validated. Applying discount to checkout session.')
          sessionConfig.discounts = [{ promotion_code: promotionCodeId }]

          sessionConfig.metadata.promoCode = promoCode
          sessionConfig.subscription_data!.metadata!.promoCode = promoCode
          sessionConfig.subscription_data!.metadata!.promotionCodeId = promotionCodeId
        } else {
          console.warn('Promotion code is invalid or inactive:', promotionCode)
        }
      } catch (promoError) {
        console.error('Error validating promotion code:', promoError)
        console.log('Proceeding without applying the promo code.')
      }
    } else {
      console.log('No promo code provided or missing promotionCodeId.')
    }

    console.log('Creating Stripe Checkout Session with config:', sessionConfig)
    const session = await stripe.checkout.sessions.create(sessionConfig)

    console.log('Checkout Session created successfully. Session ID:', session.id)

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
        hasDiscount: !!sessionConfig.discounts,
        promoCode: promoCode || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('An error occurred while creating the checkout session:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session.', details: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
