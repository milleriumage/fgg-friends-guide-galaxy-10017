// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { type, packageId, planId } = await req.json();

    console.log(`Creating Stripe checkout for user ${user.id}, type: ${type}, packageId: ${packageId}, planId: ${planId}`);

    let sessionParams: Stripe.Checkout.SessionCreateParams;

    if (type === 'credit_package') {
      // Get credit package details
      const { data: pkg, error: pkgError } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError || !pkg) {
        throw new Error('Credit package not found');
      }

      sessionParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${pkg.credits} Credits`,
                description: pkg.bonus > 0 ? `Includes ${pkg.bonus} bonus credits!` : undefined,
              },
              unit_amount: Math.round(pkg.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.get('origin') || 'http://localhost:8080'}/?payment=success`,
        cancel_url: `${req.headers.get('origin') || 'http://localhost:8080'}/?payment=cancelled`,
        metadata: {
          user_id: user.id,
          credits: (pkg.credits + pkg.bonus).toString(),
          type: 'credit_purchase',
        },
      };
    } else if (type === 'subscription') {
      // Get subscription plan details
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        throw new Error('Subscription plan not found');
      }

      if (!plan.stripe_product_id) {
        throw new Error('Stripe product ID not configured for this plan');
      }

      // Get or create Stripe price
      const prices = await stripe.prices.list({
        product: plan.stripe_product_id,
        active: true,
      });

      let priceId = prices.data[0]?.id;

      if (!priceId) {
        // Create price if it doesn't exist
        const price = await stripe.prices.create({
          product: plan.stripe_product_id,
          unit_amount: Math.round(plan.price * 100),
          currency: plan.currency.toLowerCase(),
          recurring: { interval: 'month' },
        });
        priceId = price.id;
      }

      sessionParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.get('origin') || 'http://localhost:8080'}/?subscription=success`,
        cancel_url: `${req.headers.get('origin') || 'http://localhost:8080'}/?subscription=cancelled`,
        metadata: {
          user_id: user.id,
          plan_id: planId,
          credits: plan.credits.toString(),
          type: 'subscription',
        },
      };
    } else {
      throw new Error('Invalid type');
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Stripe session created: ${session.id}`);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error creating Stripe checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
