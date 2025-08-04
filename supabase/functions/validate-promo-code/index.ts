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
    // Initialize Stripe with the secret key
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    // Parse request body
    const { promoCode } = await req.json()

    if (!promoCode || typeof promoCode !== 'string') {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Promo code is required and must be a string' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Validate the promotion code with Stripe
    console.log('Validating promo code:', promoCode)
    
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode.trim().toUpperCase(),
      active: true,
      limit: 1,
    })

    if (promotionCodes.data.length === 0) {
      console.log('Promo code not found:', promoCode)
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

    // Check if the promotion code is still active
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

    // Check if coupon is valid
    if (!coupon.valid) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'This promo code is no longer valid' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Calculate discount description
    let discountDescription = '';
    if (coupon.percent_off) {
      discountDescription = `${coupon.percent_off}% off`;
    } else if (coupon.amount_off) {
      const amount = coupon.amount_off / 100;
      discountDescription = `$${amount} off`;
    }

    // Add duration information
    if (coupon.duration === 'once') {
      discountDescription += ' (one-time)';
    } else if (coupon.duration === 'repeating') {
      discountDescription += ` (for ${coupon.duration_in_months} months)`;
    } else if (coupon.duration === 'forever') {
      discountDescription += ' (forever)';
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
        duration: coupon.duration,
        duration_in_months: coupon.duration_in_months,
      },
      description: discountDescription,
      name: coupon.name || discountDescription,
      max_redemptions: promotionCode.max_redemptions,
      times_redeemed: promotionCode.times_redeemed,
      expires_at: promotionCode.expires_at,
    }

    console.log('Valid promo code found:', discountInfo)

    return new Response(
      JSON.stringify(discountInfo),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err) {
    console.error('Promo code validation error:', err)
    
    // Return a user-friendly error message
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Unable to validate promo code at this time. Please try again or contact support.' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})