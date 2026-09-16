import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { tierRestricted, tierTitle, type SubscriptionTier } from './access';

/** Additional gates apply only to the dedicated catalog's customers. */
export function TierAccessGate({ minimum, title, children }: { minimum: SubscriptionTier; title: string; children: ReactNode }) {
  const { subscriptionTier, isTieredCustomer, loading } = useRevenueCat();
  if (loading) return null;
  if (!tierRestricted(subscriptionTier, isTieredCustomer, minimum)) return <>{children}</>;
  const name = tierTitle(minimum);
  return <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
    <Lock className="h-7 w-7 text-primary" />
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="text-sm text-muted-foreground">Unlock this feature with WagerProof {name}.</p>
    <Link className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground" to={`/plans/tiers?tier=${minimum}&minimum=${minimum}`}>Explore {name}</Link>
  </section>;
}
