import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    const { promoCode } = await req.json()

    if (!promoCode) {
      throw new Error('Promo code is required')
    }

    // Validate the promotion code with Stripe
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode,
      active: true,
      limit: 1,
    })

    if (promotionCodes.data.length === 0) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid or expired promo code' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const promotionCode = promotionCodes.data[0]
    const coupon = promotionCode.coupon

    // Check if the promotion code is still valid
    if (!promotionCode.active) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'This promo code is no longer active' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Check usage limits
    if (promotionCode.max_redemptions && 
        promotionCode.times_redeemed >= promotionCode.max_redemptions) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'This promo code has reached its usage limit' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Check expiration
    if (promotionCode.expires_at && 
        new Date(promotionCode.expires_at * 1000) < new Date()) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'This promo code has expired' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Return valid promo code details
    const discountInfo = {
      valid: true,
      promotionCodeId: promotionCode.id,
      couponId: coupon.id,
      code: promotionCode.code,
      discount: {
        type: coupon.percent_off ? 'percentage' : 'amount',
        value: coupon.percent_off || (coupon.amount_off ? coupon.amount_off / 100 : 0),
        currency: coupon.currency,
      },
      description: coupon.name || `${coupon.percent_off ? coupon.percent_off + '% off' : '$' + (coupon.amount_off / 100) + ' off'}`,
    }

    return new Response(
      JSON.stringify(discountInfo),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Promo code validation error:', err)
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Failed to validate promo code. Please try again.' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})