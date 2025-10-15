import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Subscription plans configuration
export const subscriptionPlans = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Essential betting analysis tools',
    price_monthly: 29.99,
    price_yearly: 299.99,
    stripe_price_id_monthly: 'price_1ABC123DEF456GHI', // Replace with your actual Stripe price ID
    stripe_price_id_yearly: 'price_1ABC123DEF456GHJ', // Replace with your actual Stripe price ID
    features: [
      'Advanced trend analysis',
      'Custom pattern recognition', 
      'Historical data access',
      'Email support'
    ],
    trial_days: 14
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Professional betting analysis suite',
    price_monthly: 59.99,
    price_yearly: 599.99,
    stripe_price_id_monthly: 'price_1ABC123DEF456GHK', // Replace with your actual Stripe price ID
    stripe_price_id_yearly: 'price_1ABC123DEF456GHL', // Replace with your actual Stripe price ID
    features: [
      'Everything in Basic',
      'Real-time alerts',
      'API access',
      'Priority support',
      'Custom reports'
    ],
    trial_days: 14
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Complete betting analysis platform',
    price_monthly: 99.99,
    price_yearly: 999.99,
    stripe_price_id_monthly: 'price_1ABC123DEF456GHM', // Replace with your actual Stripe price ID
    stripe_price_id_yearly: 'price_1ABC123DEF456GHN', // Replace with your actual Stripe price ID
    features: [
      'Everything in Pro',
      'White-label options',
      'Custom integrations',
      'Dedicated support',
      'Advanced analytics'
    ],
    trial_days: 14
  }
];

// Create checkout session
export async function createCheckoutSession(planId: string, userId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
  const plan = subscriptionPlans.find(p => p.id === planId);
  if (!plan) throw new Error('Plan not found');

  const stripePriceId = billingCycle === 'monthly' 
    ? plan.stripe_price_id_monthly 
    : plan.stripe_price_id_yearly;

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: stripePriceId,
        userId: userId,
        trialDays: plan.trial_days,
        billingCycle
      }),
    });

    const { url } = await response.json();
    
    if (url) {
      // Redirect to Stripe checkout
      window.location.href = url;
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Create customer portal session
export async function createCustomerPortalSession(userId: string) {
  try {
    const response = await fetch('/api/create-customer-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId
      }),
    });

    const { url } = await response.json();
    
    if (url) {
      window.location.href = url;
    }
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw error;
  }
}
