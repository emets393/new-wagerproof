import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { subscriptionPlans, createCheckoutSession, createCustomerPortalSession } from '../lib/stripe';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, isAuthenticated } = useAuth0();
  const { subscriptionStatus, refreshSubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  if (!isOpen) return null;

  const handleStartTrial = async (planId: string) => {
    if (!isAuthenticated || !user) return;
    
    setIsProcessing(true);
    try {
      await createCheckoutSession(planId, user.sub!, billingCycle);
    } catch (error) {
      console.error('Error starting trial:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'basic':
        return <Zap className="h-6 w-6 text-blue-500" />;
      case 'pro':
        return <Crown className="h-6 w-6 text-purple-500" />;
      case 'enterprise':
        return <Crown className="h-6 w-6 text-gold-500" />;
      default:
        return <Star className="h-6 w-6 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Choose Your Plan
            </h2>
            <p className="text-gray-600 text-lg">
              Start your 14-day free trial today. No credit card required.
            </p>
            
            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center mt-4">
              <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="mx-3 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                Yearly
              </span>
              {billingCycle === 'yearly' && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Save 17%
                </span>
              )}
            </div>
          </div>

          {/* Current Status */}
          {subscriptionStatus && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">
                    Current Plan: {subscriptionStatus.plan_name}
                  </h3>
                  <p className="text-blue-700">
                    {subscriptionStatus.status === 'trial' 
                      ? `${subscriptionStatus.trial_days_remaining} days remaining in trial`
                      : 'Active subscription'
                    }
                  </p>
                </div>
                <Badge variant={subscriptionStatus.is_active ? 'default' : 'secondary'}>
                  {subscriptionStatus.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {subscriptionPlans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative cursor-pointer transition-all duration-200 ${
                  plan.name === 'Pro' 
                    ? 'ring-2 ring-purple-500 shadow-lg' 
                    : 'hover:shadow-md'
                }`}
              >
                {plan.name === 'Pro' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-500 text-white">Most Popular</Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-2">
                    {getPlanIcon(plan.name)}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly}
                    </div>
                    <div className="text-gray-600">
                      per {billingCycle === 'monthly' ? 'month' : 'year'}
                    </div>
                    {billingCycle === 'yearly' && (
                      <div className="text-sm text-green-600 mt-1">
                        Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)}/year
                      </div>
                    )}
                  </div>
                  
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full"
                    variant={plan.name === 'Pro' ? 'default' : 'outline'}
                    onClick={() => handleStartTrial(plan.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      'Processing...'
                    ) : (
                      `Start ${plan.trial_days}-Day Trial`
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500">
            <p>All plans include a 14-day free trial</p>
            <p>Cancel anytime. No hidden fees.</p>
          </div>

          {/* Close Button */}
          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subscription Status Component
export function SubscriptionStatus() {
  const { subscriptionStatus, loading } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!subscriptionStatus) return null;

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={subscriptionStatus.is_active ? 'default' : 'secondary'}>
        {subscriptionStatus.plan_name}
      </Badge>
      {subscriptionStatus.status === 'trial' && (
        <span className="text-sm text-orange-600">
          {subscriptionStatus.trial_days_remaining} days left
        </span>
      )}
    </div>
  );
}

// Feature Access Gate Component
interface FeatureGateProps {
  featureName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ featureName, children, fallback }: FeatureGateProps) {
  const { checkFeatureAccess } = useSubscription();
  
  if (checkFeatureAccess(featureName)) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}