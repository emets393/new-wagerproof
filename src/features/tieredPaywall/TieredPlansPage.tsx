import { includesTier, resolveSubscriptionTier } from './access';
import { useEffect, useState, type CSSProperties } from 'react';
import type { Offering } from '@revenuecat/purchases-js';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Lock, BarChart3, X, Activity, ChartNoAxesCombined, MessageCircle, Zap, UserRound, Layers3, ListChecks, BrainCircuit, BadgeCheck, Trophy, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { supabase } from '@/integrations/supabase/client';
import { getTieredCheckoutOffering, isUserCancelledPurchaseError } from '@/services/revenuecatWeb';
import catalog from './catalog.json';
import { verifiedTierPackage } from './billing';
import { checkoutOrigin } from './placements';
import './tiered-paywall.css';

// The dedicated web placement and verified product prices control availability.
// Existing subscribers retain their current access and cannot buy a duplicate plan.
export const TIERED_CHECKOUT_ENABLED = true;
export const webCents = (plan: typeof catalog.plans[number], yearly: boolean) => yearly ? plan.webYearlyCents : plan.webMonthlyCents;
const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const featureIcons = { games: Activity, predictions: ChartNoAxesCombined, markets: BarChart3,
  discord: MessageCircle, outliers: Zap, props: UserRound, parlays: Layers3,
  cheats: ListChecks, agents: BrainCircuit, picks: BadgeCheck, leaderboard: Trophy };
function featureIcon(id: string) {
  const Icon = featureIcons[id as keyof typeof featureIcons] ?? BarChart3;
  return <Icon size={23} />;
}

// US App Store snapshot verified 2026-09-14. The rating count is deliberately not
// shown; excerpts come from WagerProof's own listing. Refresh before launch.
const APP_STORE_RATING = 4.7;
const APP_STORE_REVIEWS = [
  { quote: 'So much information to help you make better decisions.', author: 'EveeD525' },
  { quote: 'it takes complicated data and makes it easy to read', author: 'SpaceGuy4' },
];
function StarRow({ size, fill = 1, label }: { size: number; fill?: number; label: string }) {
  const row = [0, 1, 2, 3, 4].map(index => <Star key={index} size={size} />);
  return <span className="tiered-stars" style={{ '--fill': `${fill * 100}%` } as CSSProperties} role="img" aria-label={label}>
    <span className="tiered-stars-base">{row}</span><span className="tiered-stars-fill" aria-hidden="true">{row}</span>
  </span>;
}

export default function TieredPlansPage() {
  const [params, setParams] = useSearchParams();
  const minimumIndex = Math.max(0, catalog.plans.findIndex(plan => plan.id === params.get('minimum')));
  const selected = catalog.plans.findIndex(plan => plan.id === params.get('tier'));
  const tier = catalog.plans[Math.max(minimumIndex, selected < 0 ? 2 : selected)];
  const yearly = params.get('period') === 'yearly';
  const tierIndex = catalog.plans.indexOf(tier);
  const { user, signIn, signOut } = useAuth();
  const { loading: accountLoading, hasProAccess, purchase, refreshCustomerInfo } = useRevenueCat();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const origin = checkoutOrigin(params.get('origin'));
  const [placement, setPlacement] = useState<{ userID: string; origin: string; offering: Offering | null; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const currentPlacement = placement?.userID === user?.id && placement?.origin === origin ? placement : null;
  const offering = currentPlacement?.offering ?? undefined;
  useEffect(() => {
    let cancelled = false;
    setPlacement(null);
    if (!TIERED_CHECKOUT_ENABLED || !user || accountLoading || hasProAccess) return;
    getTieredCheckoutOffering(user.id, origin).then(
      offering => { if (!cancelled) setPlacement({ userID: user.id, origin, offering }); },
      () => { if (!cancelled) setPlacement({ userID: user.id, origin, offering: null, error: 'Subscription options could not be loaded. Please try again.' }); },
    );
    return () => { cancelled = true; };
  }, [user?.id, origin, accountLoading, hasProAccess, retry]);
  // Never let a stale/misconfigured catalog charge a different amount from the
  // six advertised USD prices. Other currencies need their own discount mapping.
  const pkg = verifiedTierPackage(offering, tier.id, yearly);
  const ready = TIERED_CHECKOUT_ENABLED && pkg !== undefined;
  const covered = (feature: typeof catalog.features[number]) => catalog.plans.findIndex(plan => plan.id === feature.tier) <= tierIndex;

  function select(id: string, annual = yearly) {
    setParams({ tier: id, period: annual ? 'yearly' : 'monthly', origin, ...(params.get('minimum') ? { minimum: params.get('minimum')! } : {}) }, { replace: true });
    setMessage('');
  }
  async function signInWithProvider(provider: 'google' | 'apple') {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/plans/tiers${window.location.search}` },
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in could not be started. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!TIERED_CHECKOUT_ENABLED) { setMessage('This is a preview of our new plans. Checkout is not open yet.'); return; }
    if (!user) { setShowLogin(true); return; }
    if (hasProAccess) { setMessage('Your account already has full WagerProof access.'); return; }
    if (!ready || !pkg || busy) { setMessage('This plan is temporarily unavailable. Please try again later.'); return; }
    setBusy(true);
    try {
      // Re-resolve for this signed-in account at checkout, including rule changes
      // since page load. Never purchase a package from the global catalog.
      const latest = await getTieredCheckoutOffering(user.id, origin);
      const checkoutPackage = verifiedTierPackage(latest ?? undefined, tier.id, yearly);
      if (!checkoutPackage) {
        setPlacement({ userID: user.id, origin, offering: latest });
        setMessage('This plan is no longer available. Please reload your subscription options.');
        return;
      }
      const result = await purchase(checkoutPackage);
      if (includesTier(resolveSubscriptionTier(Object.keys(result.customerInfo.entitlements.active)), tier.id as 'standard' | 'premium' | 'pro')) {
        await refreshCustomerInfo();
        setMessage('Your subscription is active. Return to WagerProof on your phone to continue.');
      } else setMessage('Your payment is processing. Refresh your subscription status before trying again.');
    } catch (error) {
      if (!isUserCancelledPurchaseError(error)) setMessage(error instanceof Error ? error.message : 'Checkout could not be completed.');
    } finally { setBusy(false); }
  }

  const optionsUnavailable = TIERED_CHECKOUT_ENABLED && (!user || accountLoading || hasProAccess || !ready);

  return <main className="tiered-paywall">
    <Helmet><title>Choose your plan | WagerProof</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="tiered-shell">
      <div className="tiered-layout" data-unavailable={optionsUnavailable}>
      <section className="tiered-options" aria-label="Choose a subscription">
      <header className="tiered-header">
        <nav><Link to="/">WAGERPROOF</Link><Link to="/" aria-label="Close plans"><X size={20} /></Link></nav>
        <h1>Choose your plan</h1>
        <div className="tiered-period"><button onClick={() => select(tier.id, false)} disabled={busy}>Monthly</button><button role="switch" aria-checked={yearly} aria-label="Yearly billing" onClick={() => select(tier.id, !yearly)} disabled={busy} className="tiered-switch"><span /></button><button onClick={() => select(tier.id, true)} disabled={busy}>Yearly</button></div>
      </header>
      {optionsUnavailable ? <section className="tiered-features" role="status">
        <h2>{hasProAccess ? 'You have full access' : 'Subscription options'}</h2>
        <p>{hasProAccess ? 'Your account already includes all WagerProof features.' : !user ? 'Sign in with your WagerProof account to see available plans.' : accountLoading || !currentPlacement ? 'Loading your subscription options…' : currentPlacement.error || 'These plans are not available for your account right now.'}</p>
        {!accountLoading && user && !hasProAccess && <button disabled={busy} onClick={() => setRetry(value => value + 1)}>Retry</button>}
        <Link to="/">Return to WagerProof</Link>
      </section> :
      <div className="tiered-prices" role="radiogroup" aria-label="Subscription tier">
        {catalog.plans.slice(minimumIndex).map(plan => <button key={plan.id} role="radio" aria-checked={tier.id === plan.id} disabled={busy} onClick={() => select(plan.id)} className={`tiered-price ${tier.id === plan.id ? 'selected' : ''}`}>
          <span className="tiered-radio">{tier.id === plan.id && <Check size={19} />}</span>
          <span className="tiered-plan-name"><strong>{plan.title} {yearly ? 'Yearly' : 'Monthly'}</strong><small>{yearly ? `${usd(Math.round(webCents(plan, true) / 12))}/month` : 'Monthly billing'}</small></span>
          <span className="tiered-amount">
            {yearly && plan.id !== 'standard' && <span className="tiered-plan-tag" aria-label={`Save ${Math.round((1 - plan.webYearlyCents / (plan.webMonthlyCents * 12)) * 100)}% compared with 12 monthly payments`}>Save {Math.round((1 - plan.webYearlyCents / (plan.webMonthlyCents * 12)) * 100)}%</span>}
            {!yearly && plan.id === 'pro' && <span className="tiered-plan-tag">Most popular</span>}
            <strong>{usd(webCents(plan, yearly))}</strong>
            <del>{usd(yearly ? plan.yearlyCents : plan.monthlyCents)}</del>
          </span>
        </button>)}
      </div>}
    <div className="tiered-checkout"><div>
      {message && <p role="status" className="tiered-message">{message}</p>}
      <button onClick={checkout} disabled={busy || (TIERED_CHECKOUT_ENABLED && !!user && (accountLoading || hasProAccess || !ready))}>{busy ? 'Processing…' : 'Continue'}</button>
      {(!TIERED_CHECKOUT_ENABLED || ready) && <p>{usd(webCents(tier, yearly))} / {yearly ? 'year' : 'month'} · 30% off the in-app price</p>}
    </div></div>
      </section>
      {!optionsUnavailable && <div className="tiered-details" role="region" aria-label="Plan features and benefits" tabIndex={0}>
      <section className="tiered-features"><h2>What do I get?</h2>
        {[...catalog.features.filter(covered), ...catalog.features.filter(feature => !covered(feature))].map(feature => <div key={feature.id} className={`tiered-feature ${covered(feature) ? 'included' : 'locked'}`} data-included={covered(feature)}>
          <span className="tiered-feature-icon">{featureIcon(feature.id)}</span><div><h3>{!covered(feature) && <Lock size={14} />}{feature.title}{!covered(feature) && <span className="tiered-badge">{catalog.plans.find(plan => plan.id === feature.tier)?.title}</span>}</h3><p>{feature.detail}</p></div>
        </div>)}
      </section>
      <section className="tiered-membership"><img src="/paywall/tiered-bolt.png" alt="" /><small>WAGERPROOF</small><h2>{tier.title}</h2><p>{['Know the game. Follow the market.', 'Find your edge with deeper research.', 'Your strategies. Your team of AI agents.'][tierIndex]}</p><div className="tiered-meter">{catalog.plans.map((plan, index) => <span key={plan.id} data-active={index <= tierIndex} />)}</div><small>{catalog.features.filter(covered).length} features included</small></section>
      <section className="tiered-reviews">
        <div className="tiered-rating">
          <StarRow size={21} fill={APP_STORE_RATING / 5} label={`${APP_STORE_RATING} out of 5 stars`} />
          <h2>{APP_STORE_RATING}<small>out of 5</small></h2>
          <p>App Store rating</p>
        </div>
        <div className="tiered-review-cards">{APP_STORE_REVIEWS.map(review => <figure key={review.author}>
          <blockquote>“{review.quote}”</blockquote>
          <figcaption><span className="tiered-review-avatar" aria-hidden="true">{review.author[0]}</span><strong>{review.author}</strong><StarRow size={12} label="5 out of 5 stars" /></figcaption>
        </figure>)}</div>
        <a href="https://apps.apple.com/us/app/id6757089957?see-all=reviews">Read reviews on the App Store</a>
      </section>
      </div>}
      </div>
      <footer className="tiered-legal">
        {user && <><button disabled={busy} onClick={async () => { await refreshCustomerInfo(); setMessage('Subscription status refreshed.'); }}>Refresh subscription</button><button disabled={busy} onClick={() => signOut()}>Sign out</button></>}
        <div><Link to="/terms-and-conditions">Terms of Use</Link><Link to="/privacy-policy">Privacy Policy</Link></div>
        <p>Subscriptions renew automatically. Cancel before your next renewal through your billing portal. Prices are in USD; applicable taxes appear at checkout.</p>
        <p>© {new Date().getFullYear()} WagerProof. All rights reserved.</p>
      </footer>
    </div>
    {showLogin && <div className="tiered-login" role="dialog" aria-modal="true" aria-labelledby="tiered-login-title"><form onSubmit={async event => { event.preventDefault(); setBusy(true); try { const result = await signIn(email, password); if (result.error) setMessage(result.error.message); else setShowLogin(false); } finally { setBusy(false); } }}><h2 id="tiered-login-title">Sign in to WagerProof</h2><p>Use the same account as your mobile app.</p><button type="button" disabled={busy} onClick={() => void signInWithProvider('google')}>Continue with Google</button><button type="button" disabled={busy} onClick={() => void signInWithProvider('apple')}>Continue with Apple</button><label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{message && <p role="alert">{message}</p>}<button disabled={busy}>Sign in</button><button type="button" onClick={() => setShowLogin(false)}>Cancel</button></form></div>}
  </main>;
}
