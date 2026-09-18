/** Shared by web and edge functions. The existing entitlement is the highest
 * tier, regardless of its product ID, introductory price, or billing store. */
export const SUBSCRIPTION_TIERS = ['standard', 'premium', 'pro'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];
export const tierRank = (tier: SubscriptionTier | null | undefined) => tier ? SUBSCRIPTION_TIERS.indexOf(tier) : -1;
export const includesTier = (tier: SubscriptionTier | null | undefined, minimum: SubscriptionTier) => tierRank(tier) >= tierRank(minimum);
export const entitlementID = (tier: SubscriptionTier) => `WagerProof ${tier[0].toUpperCase()}${tier.slice(1)}`;
export function resolveSubscriptionTier(activeIDs: string[]): SubscriptionTier | null {
  return [...SUBSCRIPTION_TIERS].reverse().find(tier => activeIDs.includes(entitlementID(tier))) ?? null;
}
export function isTieredCustomer(entitlementIDs: string[], productIDs: string[] = []): boolean {
  return entitlementIDs.includes(entitlementID('standard')) || entitlementIDs.includes(entitlementID('premium'))
    || productIDs.some(id => id.startsWith('com.wagerproof.mobile.tiers.') || id.startsWith('wp_tiers_'));
}
export function tierRestricted(tier: SubscriptionTier | null, enrolled: boolean, minimum: SubscriptionTier): boolean {
  return enrolled && !includesTier(tier, minimum);
}

export interface RestEntitlement {
  is_active?: boolean;
  expires_date?: string | null;
  product_identifier?: string;
  grace_period_expires_date?: string | null;
}
export function resolveRestSubscription(
  entitlements: Record<string, RestEntitlement> = {}, now = Date.now(),
  subscriptions: Record<string, RestEntitlement> = {},
) {
  entitlements = Object.fromEntries(Object.entries(entitlements).map(([id, value]) => {
    const grace = value.grace_period_expires_date ?? subscriptions[value.product_identifier ?? '']?.grace_period_expires_date;
    // RevenueCat's subscription object can carry a grace period after the
    // normal expiration. Cancellation alone never revokes a paid period.
    return [id, grace && Date.parse(grace) > now && value.is_active !== false
      ? { ...value, expires_date: grace } : value];
  }));
  const activeIDs = Object.entries(entitlements).filter(([, value]) =>
    typeof value.is_active === 'boolean' ? value.is_active
      : !value.expires_date || Date.parse(value.expires_date) > now
  ).map(([id]) => id);
  const tier = resolveSubscriptionTier(activeIDs);
  return {
    tier,
    isTieredCustomer: isTieredCustomer(Object.keys(entitlements), [...Object.values(entitlements).map(e => e.product_identifier ?? ''), ...Object.keys(subscriptions)]),
    entitlement: tier ? entitlements[entitlementID(tier)] : null,
  };
}
