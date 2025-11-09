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

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Verifying Stripe session ${sessionId} for user ${user.id}`);

    // Retrieve the session from Stripe to verify it
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log(`Session status: ${session.status}, payment_status: ${session.payment_status}`);

    // Verify the session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      throw new Error('Session does not belong to this user');
    }

    // Check if payment was completed
    const isPaid = session.payment_status === 'paid' || session.status === 'complete';
    
    if (!isPaid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment not completed',
          status: session.payment_status 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get plan details
    const planId = session.metadata?.plan_id;
    if (!planId) {
      throw new Error('Plan ID not found in session metadata');
    }

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Subscription plan not found');
    }

    // Check if subscription already exists
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Subscription already exists',
          alreadyExists: true 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For subscriptions, get the subscription ID
    let stripeSubscriptionId = null;
    if (session.mode === 'subscription' && session.subscription) {
      stripeSubscriptionId = typeof session.subscription === 'string' 
        ? session.subscription 
        : session.subscription.id;
    }

    // Calculate renewal date (30 days from now)
    const renewDate = new Date();
    renewDate.setDate(renewDate.getDate() + 30);

    // Create subscription in database
    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: planId,
        status: 'active',
        renews_on: renewDate.toISOString(),
        stripe_subscription_id: stripeSubscriptionId,
      });

    if (insertError) {
      console.error('Error creating subscription:', insertError);
      throw new Error('Failed to create subscription');
    }

    // Add credits to user balance if plan includes credits
    if (plan.credits > 0) {
      const { error: creditsError } = await supabase
        .from('profiles')
        .update({ 
          credits_balance: supabase.raw(`credits_balance + ${plan.credits}`)
        })
        .eq('id', user.id);

      if (creditsError) {
        console.error('Error adding credits:', creditsError);
      }
    }

    console.log(`Subscription created successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Subscription activated successfully',
        plan: plan.name 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
