import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

    // Parse request body
    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json()

    if (!priceId || !userId || !planType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: priceId, userId, or planType' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('User profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
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
      success_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/subscribe`,
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
      payment_method_collection: 'if_required',
    }

    // Add promo code if provided and valid
    if (promoCode && promotionCodeId) {
      console.log('Applying promo code to checkout session:', promoCode, promotionCodeId)
      
      // Validate the promotion code exists in Stripe
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId)
        
        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          sessionConfig.discounts = [
            {
              promotion_code: promotionCodeId,
            },
          ]
          
          // Add promo code to metadata for tracking
          sessionConfig.metadata!.promoCode = promoCode
          sessionConfig.subscription_data!.metadata!.promoCode = promoCode
          sessionConfig.subscription_data!.metadata!.promotionCodeId = promotionCodeId
          
          console.log('Promo code applied successfully to checkout session')
        } else {
          console.warn('Promotion code validation failed:', promotionCode)
        }
      } catch (promoError) {
        console.error('Error validating promotion code for checkout:', promoError)
        // Continue without promo code if validation fails
      }
    }

    // Create Stripe checkout session
    console.log('Creating Stripe checkout session with config:', {
      customer_email: sessionConfig.customer_email,
      mode: sessionConfig.mode,
      has_discounts: !!sessionConfig.discounts,
      metadata: sessionConfig.metadata,
    })

    const session = await stripe.checkout.sessions.create(sessionConfig)

    console.log('Checkout session created successfully:', session.id)

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
        hasDiscount: !!sessionConfig.discounts,
        promoCode: promoCode || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Checkout session creation error:', err)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create checkout session. Please try again or contact support.',
        details: err.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})