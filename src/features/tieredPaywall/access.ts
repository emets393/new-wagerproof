import catalog from './catalog.json';
import type { SubscriptionTier } from '../../../supabase/functions/shared/subscriptionTiers';

/** Marketing labels are separate from permanent billing IDs and URLs. */
export const tierTitle = (tier: SubscriptionTier) => catalog.plans.find(plan => plan.id === tier)!.title;

export { SUBSCRIPTION_TIERS, tierRank, includesTier, resolveSubscriptionTier, isTieredCustomer, tierRestricted } from '../../../supabase/functions/shared/subscriptionTiers';
export type { SubscriptionTier } from '../../../supabase/functions/shared/subscriptionTiers';
