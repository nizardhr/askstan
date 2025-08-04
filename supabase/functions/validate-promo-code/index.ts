import Stripe from 'npm:stripe@18.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io/subscribe',  // Restrict to your domain
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
    console.log('Initializing Stripe client...')
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    })

    console.log('Parsing request body...')
    const { promoCode } = await req.json()
    console.log('Received promo code:', promoCode)

    if (!promoCode || typeof promoCode !== 'string') {
      console.error('Promo code is missing or invalid:', promoCode)
      return new Response(
        JSON.stringify({ valid: false, error: 'Promo code is required and must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('Looking up promo code in Stripe...')
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode.trim().toUpperCase(),
      active: true,
      limit: 1,
    })

    if (promotionCodes.data.length === 0) {
      console.warn('Promo code not found or inactive:', promoCode)
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or expired promo code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const promotionCode = promotionCodes.data[0]
    const coupon = promotionCode.coupon

    console.log('Promo code found:', promotionCode)
    console.log('Associated coupon:', coupon)

    // Additional validation checks
    if (!promotionCode.active) {
      console.warn('Promo code is inactive:', promotionCode.id)
      return new Response(
        JSON.stringify({ valid: false, error: 'This promo code is no longer active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (promotionCode.max_redemptions && promotionCode.times_redeemed >= promotionCode.max_redemptions) {
      console.warn('Promo code has reached usage limit:', promotionCode.id)
      return new Response(
        JSON.stringify({ valid: false, error: 'This promo code has reached its usage limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (promotionCode.expires_at && new Date(promotionCode.expires_at * 1000) < new Date()) {
      console.warn('Promo code has expired:', promotionCode.id)
      return new Response(
        JSON.stringify({ valid: false, error: 'This promo code has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!coupon.valid) {
      console.warn('Coupon is invalid:', coupon.id)
      return new Response(
        JSON.stringify({ valid: false, error: 'This promo code is no longer valid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Build discount description
    let discountDescription = ''
    if (coupon.percent_off) {
      discountDescription = `${coupon.percent_off}% off`
    } else if (coupon.amount_off) {
      const amount = coupon.amount_off / 100
      discountDescription = `$${amount} off`
    }

    // Append duration info
    if (coupon.duration === 'once') {
      discountDescription += ' (one-time)'
    } else if (coupon.duration === 'repeating') {
      discountDescription += ` (for ${coupon.duration_in_months} months)`
    } else if (coupon.duration === 'forever') {
      discountDescription += ' (forever)'
    }

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

    console.log('Valid promo code details:', discountInfo)

    return new Response(
      JSON.stringify(discountInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('An error occurred during promo code validation:', err)
    return new Response(
      JSON.stringify({ valid: false, error: 'Unable to validate promo code at this time. Please try again later.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
