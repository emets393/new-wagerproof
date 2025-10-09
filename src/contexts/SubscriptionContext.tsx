import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

interface SubscriptionStatus {
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_end_date?: string;
  subscription_end_date?: string;
  plan_name?: string;
  is_active: boolean;
  trial_days_remaining?: number;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  checkFeatureAccess: (featureName: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get subscription status from user metadata
  const fetchSubscriptionStatus = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get subscription data from user metadata
      const subscriptionData = user['https://wagerproof.com/subscription'] || {};
      
      // If no subscription data exists, create a trial
      if (!subscriptionData.status) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);
        
        const trialData = {
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
          plan_name: 'Free Trial',
          is_active: true,
          trial_days_remaining: 14
        };

        // Update user metadata with trial data
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: 'https://wagerproof.com/api'
          }
        });

        await fetch(`https://dev-pherrg5rkpegcwkl.us.auth0.com/api/v2/users/${user.sub}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: {
              subscription: trialData
            }
          })
        });

        setSubscriptionStatus(trialData);
      } else {
        // Check if trial has expired
        const now = new Date();
        const trialEnd = new Date(subscriptionData.trial_end_date);
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        const isActive = subscriptionData.status === 'active' || 
                       (subscriptionData.status === 'trial' && daysRemaining > 0);

        setSubscriptionStatus({
          ...subscriptionData,
          is_active: isActive,
          trial_days_remaining: Math.max(0, daysRemaining)
        });
      }
    } catch (err) {
      console.error('Error fetching subscription status:', err);
      setError('Failed to fetch subscription status');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has access to a feature
  const checkFeatureAccess = (featureName: string): boolean => {
    if (!subscriptionStatus) return false;
    return subscriptionStatus.is_active;
  };

  // Refresh subscription data
  const refreshSubscription = async () => {
    await fetchSubscriptionStatus();
  };

  // Load data when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscriptionStatus();
    } else {
      setSubscriptionStatus(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.sub]);

  const value: SubscriptionContextType = {
    subscriptionStatus,
    loading,
    error,
    refreshSubscription,
    checkFeatureAccess
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}