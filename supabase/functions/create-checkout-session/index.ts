import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18.4.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://askstan.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    // Handle CORS preflight request
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia'
    });
    const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const { priceId, userId, planType, promoCode, promotionCodeId } = await req.json();
    if (!priceId || !userId || !planType) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: priceId, userId, or planType'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Fetch user email from Supabase
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('email').eq('id', userId).single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({
        error: 'User profile not found'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    // Build checkout session config
    const sessionConfig = {
      customer_email: profile.email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_APP_URL') || 'https://askstan.io'}/subscribe`,
      metadata: {
        userId,
        planType
      },
      subscription_data: {
        metadata: {
          userId,
          planType
        }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'if_required'
    };
    // Promo Code Logic
    if (promoCode && promotionCodeId) {
      try {
        const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promotionCode.active && promotionCode.code.toUpperCase() === promoCode.toUpperCase()) {
          sessionConfig.discounts = [
            {
              promotion_code: promotionCodeId
            }
          ];
          sessionConfig.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promoCode = promoCode;
          sessionConfig.subscription_data.metadata.promotionCodeId = promotionCodeId;
        }
      } catch  {
      // Fail silently on promo code errors — proceed without discount
      }
    }
    const session = await stripe.checkout.sessions.create(sessionConfig);
    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      hasDiscount: !!sessionConfig.discounts,
      promoCode: promoCode || null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session.',
      details: err.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
