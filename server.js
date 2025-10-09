// This is a simple Express server for handling Stripe webhooks and checkout sessions
// You'll need to deploy this separately or use a service like Vercel/Netlify

import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

app.use(cors());
app.use(express.json());

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId, trialDays, billingCycle } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          userId: userId,
          billingCycle: billingCycle,
        },
      },
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      customer_email: req.body.email, // Optional: pre-fill email
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create customer portal session
app.post('/api/create-customer-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;

    // Find customer by userId metadata
    const customers = await stripe.customers.list({
      limit: 1,
    });

    const customer = customers.data.find(c => c.metadata.userId === userId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.FRONTEND_URL}/account`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

// Stripe webhook handler
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(deletedSubscription);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Helper functions
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.subscription_data?.metadata?.userId;
  const billingCycle = session.subscription_data?.metadata?.billingCycle;
  
  if (userId) {
    // Update user metadata in Auth0
    await updateAuth0UserMetadata(userId, {
      status: 'active',
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      billing_cycle: billingCycle,
      is_active: true,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  
  if (userId) {
    await updateAuth0UserMetadata(userId, {
      status: subscription.status === 'active' ? 'active' : 'cancelled',
      subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      is_active: subscription.status === 'active',
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  
  if (userId) {
    await updateAuth0UserMetadata(userId, {
      status: 'cancelled',
      is_active: false,
    });
  }
}

async function updateAuth0UserMetadata(userId: string, metadata: any) {
  // This would update the user's metadata in Auth0
  // You'll need to implement this using Auth0 Management API
  console.log('Updating user metadata:', userId, metadata);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
