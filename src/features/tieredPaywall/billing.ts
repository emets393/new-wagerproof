import type { Offering } from '@revenuecat/purchases-js';
import catalog from './catalog.json';

export function verifiedTierPackage(offering: Offering | undefined, tierID: string, yearly: boolean) {
  if (offering?.identifier !== catalog.offeringID || offering.metadata?.tiered_web_ready !== true) return undefined;
  const tier = catalog.plans.find(plan => plan.id === tierID);
  if (!tier) return undefined;
  const identifier = `${tierID}_${yearly ? 'yearly' : 'monthly'}`;
  const cents = yearly ? tier.webYearlyCents : tier.webMonthlyCents;
  return offering.availablePackages.find(pkg =>
    pkg.identifier === identifier &&
    pkg.webBillingProduct.identifier === `wp_tiers_${identifier}_web` &&
    pkg.webBillingProduct.price.currency === 'USD' &&
    pkg.webBillingProduct.price.amountMicros === cents * 10_000,
  );
}
