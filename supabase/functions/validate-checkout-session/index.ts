import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or userId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

    if (!session.subscription || typeof session.subscription === 'string') {
      return new Response(JSON.stringify({ error: 'Subscription not found in session' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const subscription = session.subscription;

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return new Response(JSON.stringify({ error: 'Subscription is not active' }), { status: 402, headers: { 'Content-Type': 'application/json' } });
    }

    // Update user's subscription status in Supabase
    const { error } = await supabase
      .from('user_profiles')
      .update({ subscription_status: subscription.status, stripe_subscription_id: subscription.id })
      .eq('id', userId);

    if (error) {
      console.error('Supabase update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update user profile' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, subscriptionStatus: subscription.status }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Error validating checkout session:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
