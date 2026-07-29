/**
 * Custom paywall — web remake of the iOS CustomPaywallView. RevenueCat Web
 * is used for offerings/prices/purchases only; the UI is fully custom:
 * brand header, swipeable feature carousel, the approved hardPaywall
 * packages (with the intro plan eligibility-gated), branded CTA and
 * Restore/Terms/Privacy footer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  LogIn,
  X,
} from 'lucide-react';
import type { Package } from '@revenuecat/purchases-js';
import { cn } from '@/lib/utils';
import debug from '@/utils/debug';
import { useToast } from '@/hooks/use-toast';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPaywallFeaturePages,
  type PaywallPersonalization,
} from '@/components/paywall/CustomPaywallFeaturePages';
import {
  buildHardPaywallPlans,
  type HardPaywallPackageIdentifier,
} from '@/lib/revenuecatPaywall';
import { isUserCancelledPurchaseError } from '@/services/revenuecatWeb';
import { trackEvent } from '@/lib/mixpanel';
import { trackInitiateCheckout, trackPaywallView } from '@/lib/metaPixel';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/lib/routes';

export interface CustomPaywallProps {
  personalization?: PaywallPersonalization;
  /** Shown as "Not right now" when provided (freemium bypass). */
  onDismiss?: () => void;
  /** Called after a successful purchase (defaults to navigating to /agents). */
  onPurchased?: () => void;
  /** Where this paywall was shown from — reported to Mixpanel and Meta. */
  source?: string;
  className?: string;
}

function productOf(pkg: Package | undefined) {
  return pkg?.webBillingProduct;
}

function initialPriceOf(pkg: Package | undefined) {
  const product = productOf(pkg);
  return product?.introPricePhase?.price ?? product?.price;
}

function priceCurrency(pkg: Package | undefined): string {
  return initialPriceOf(pkg)?.currency ?? '';
}

/**
 * Meta expects a decimal price (14.99), but RevenueCat Web exposes minor units
 * — `amountMicros` (14990000) and `amount` in cents (1499). Sending the raw
 * value would inflate reported revenue 100x–1,000,000x and wreck value-based
 * bidding, so convert explicitly and prefer micros when the SDK provides it.
 */
function priceForAds(pkg: Package | undefined): number {
  const amountMicros = initialPriceOf(pkg)?.amountMicros;
  return typeof amountMicros === 'number' ? amountMicros / 1_000_000 : 0;
}

export function CustomPaywall(props: CustomPaywallProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid h-full min-h-64 place-items-center px-6 text-center">
        <div className="space-y-3">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-white/70" />
          <p className="text-sm text-white/60">Checking your WagerProof account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid h-full min-h-64 place-items-center px-6 text-center">
        <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-white/[0.055] p-7">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#22C55E]/15">
            <LogIn className="h-5 w-5 text-[#22C55E]" />
          </div>
          <h2 className="mt-4 text-xl font-black text-white">Sign in to continue</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            WagerProof only shows subscription plans after your account identity is verified.
          </p>
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-6 h-12 w-full rounded-2xl bg-[#22C55E] text-sm font-black text-[#04120A] hover:bg-[#45D474]"
          >
            Sign in to view plans
          </button>
        </div>
      </div>
    );
  }

  return <AuthenticatedCustomPaywall {...props} />;
}

function AuthenticatedCustomPaywall({
  personalization = {},
  onDismiss,
  onPurchased,
  source = 'unknown',
  className,
}: CustomPaywallProps) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    hardPaywallPackages,
    purchase,
    offeringsLoading,
    refreshOfferings,
  } = useRevenueCatWeb();
  const { syncPurchasesManually } = useRevenueCat();

  const [selectedPlan, setSelectedPlan] =
    useState<HardPaywallPackageIdentifier>('yearly_intro');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [redemptionUrl, setRedemptionUrl] = useState<string | null>(null);

  // ── Feature carousel ───────────────────────────────────────────────────────
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const interactedRef = useRef(false);
  const pages = useMemo(
    () => getPaywallFeaturePages(personalization, activePage),
    [personalization, activePage]
  );

  const scrollToPage = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = carouselRef.current;
    if (!container) return;
    const width = container.clientWidth || 1;
    container.scrollTo({ left: index * width, behavior });
    setActivePage(index);
  }, []);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    const onScroll = () => {
      const width = container.clientWidth || 1;
      const page = Math.round(container.scrollLeft / width);
      setActivePage(Math.max(0, Math.min(pages.length - 1, page)));
    };

    // Desktop drag-to-swipe (trackpads already scroll; mouse users need this).
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        interactedRef.current = true;
        return;
      }
      dragging = true;
      interactedRef.current = true;
      startX = event.clientX;
      startScroll = container.scrollLeft;
      container.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      container.scrollLeft = startScroll - (event.clientX - startX);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      const width = container.clientWidth || 1;
      const page = Math.round(container.scrollLeft / width);
      scrollToPage(Math.max(0, Math.min(pages.length - 1, page)));
    };
    const onWheel = () => {
      interactedRef.current = true;
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
    };
  }, [pages.length, scrollToPage]);

  // Auto-advance until the user interacts (web convenience; pause after touch/drag/dot).
  useEffect(() => {
    if (pages.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (interactedRef.current) return;
      const next = (activePage + 1) % pages.length;
      scrollToPage(next);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [pages.length, activePage, scrollToPage]);

  // ── Plans: approved hardPaywall packages in order; hide ineligible intro ───
  const plans = useMemo(
    () => buildHardPaywallPlans(hardPaywallPackages ?? []),
    [hardPaywallPackages]
  );

  const selected = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const ctaTitle = 'Continue';
  const ctaSubtitle = selected?.billingLine ?? '';

  // ── Impression tracking ────────────────────────────────────────────────────
  // Wait for plans to resolve before reporting the view: Meta's ViewContent
  // carries the headline price, and firing during the offerings fetch would
  // send a $0 value signal that drags down value-optimized bidding.
  const trackedViewRef = useRef(false);
  useEffect(() => {
    if (trackedViewRef.current || plans.length === 0) return;
    trackedViewRef.current = true;

    const headline = plans.find((p) => p.id === 'yearly_intro') ?? plans[0];
    trackEvent('Paywall Viewed', {
      source,
      plans: plans.map((p) => p.id).join(','),
    });
    trackPaywallView(source, priceForAds(headline.rcPackage), priceCurrency(headline.rcPackage));
  }, [plans, source]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePurchased = useCallback(() => {
    if (onPurchased) onPurchased();
    else navigate(DEFAULT_AUTHENTICATED_ROUTE);
  }, [onPurchased, navigate]);

  const handlePurchase = async () => {
    if (!selected) return;
    const productId = productOf(selected.rcPackage)?.identifier ?? selected.rcPackage.identifier;
    const value = priceForAds(selected.rcPackage);
    const currency = priceCurrency(selected.rcPackage);

    try {
      setPurchasing(true);
      setPurchaseError(null);
      setRedemptionUrl(null);
      debug.log('💳 CustomPaywall purchasing:', selected.rcPackage.identifier);
      trackEvent('Paywall Checkout Started', { source, plan: selected.id, product_id: productId });
      // Fires before the payment sheet resolves so an abandoned checkout still
      // registers as intent — that is the whole reason this event exists.
      trackInitiateCheckout(productId, value, currency);

      const result = await purchase(selected.rcPackage);

      if (result.redemptionInfo?.redeemUrl) {
        setRedemptionUrl(result.redemptionInfo.redeemUrl);
        trackEvent('Paywall Redemption Required', {
          source,
          plan: selected.id,
          product_id: productId,
        });
        return;
      }

      if (!result.hasProEntitlement) {
        throw new Error(
          'Your payment completed, but WagerProof Pro could not be verified. Please retry or contact support.'
        );
      }

      trackEvent('Subscription Purchased', {
        source,
        plan: selected.id,
        product_id: productId,
        value,
        currency,
        has_intro_offer: selected.id === 'yearly_intro',
      });
      // No Meta Subscribe/StartTrial here on purpose — RevenueCat's Facebook
      // integration reports the conversion server-side. Firing it from the
      // browser too would double-count it, since the two events share no
      // `event_id` for Meta to deduplicate on.

      toast({ title: 'Welcome to WagerProof Pro!', description: 'Your subscription is active.' });
      handlePurchased();
    } catch (error: unknown) {
      if (isUserCancelledPurchaseError(error)) {
        debug.log('Purchase cancelled by user');
        trackEvent('Paywall Purchase Cancelled', { source, plan: selected.id });
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to complete purchase. Please try again.';
      debug.error('Purchase error:', error);
      trackEvent('Paywall Purchase Failed', {
        source,
        plan: selected.id,
        error: message,
      });
      setPurchaseError(message);
      toast({
        title: 'Purchase failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const restored = await syncPurchasesManually();
      if (restored) {
        toast({ title: 'Purchases restored', description: 'Your Pro subscription is active.' });
        handlePurchased();
      } else {
        toast({ title: 'No active subscription found', description: 'Nothing to restore on this account.' });
      }
    } catch (error: any) {
      toast({ title: 'Restore failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  const offeringsUnavailable = !offeringsLoading && plans.length === 0;

  return (
    <div
      className={cn(
        'relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-7 pt-2 sm:px-6 sm:pb-9',
        className
      )}
    >
      {/* Top bar */}
      <div className="mx-auto mb-1 flex h-11 w-full max-w-xl items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-black tracking-tight text-white/92">
            Wager<span className="text-[#22C55E]">Proof</span>
          </p>
          <span className="rounded-full bg-[#22C55E] px-1.5 py-0.5 font-mono text-[9px] font-black tracking-[0.07em] text-black">
            PRO
          </span>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      {/* Feature carousel — swipeable + auto-advance until interaction */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={carouselRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="WagerProof Pro features"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            interactedRef.current = true;
            const delta = event.key === 'ArrowRight' ? 1 : -1;
            scrollToPage(Math.max(0, Math.min(pages.length - 1, activePage + delta)));
          }}
          className="flex h-full w-full touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {pages.map((page, index) => (
            <div
              key={index}
              aria-hidden={index !== activePage}
              className="box-border h-full w-full min-w-full shrink-0 snap-center px-0.5"
            >
              {page}
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous feature"
          disabled={activePage === 0}
          onClick={() => {
            interactedRef.current = true;
            scrollToPage(activePage - 1);
          }}
          className="absolute left-0 top-1/2 z-20 grid h-11 w-11 -translate-x-1/3 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0 sm:-translate-x-1/2"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Next feature"
          disabled={activePage === pages.length - 1}
          onClick={() => {
            interactedRef.current = true;
            scrollToPage(activePage + 1);
          }}
          className="absolute right-0 top-1/2 z-20 grid h-11 w-11 translate-x-1/3 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0 sm:translate-x-1/2"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Pill page indicators (iOS: selected = accent capsule) */}
      <div className="flex h-9 items-center justify-center gap-1.5">
        {pages.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to feature page ${index + 1}`}
            aria-current={index === activePage ? 'true' : undefined}
            onClick={() => {
              interactedRef.current = true;
              scrollToPage(index);
            }}
            className="rounded-full transition-all duration-300"
            style={{
              width: index === activePage ? 18 : 6,
              height: 6,
              background: index === activePage ? '#22C55E' : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </div>

      {/* Plans + CTA */}
      <div className="mx-auto w-full max-w-xl shrink-0 pt-1">
        {offeringsLoading ? (
          <div className="flex w-full flex-col items-center gap-3 py-6">
            <Loader2 className="h-7 w-7 animate-spin text-white/70" />
            <p className="text-sm text-white/60">Loading plans...</p>
          </div>
        ) : offeringsUnavailable ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.055] p-5 text-center">
            <p className="text-sm font-bold text-white">Subscription options unavailable</p>
            <p className="text-xs text-white/55">
              We couldn't load all three WagerProof Pro plans for your currency.
            </p>
            <button
              type="button"
              onClick={() => refreshOfferings()}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
            >
              Retry
            </button>
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="text-sm font-bold text-black bg-[#22C55E] rounded-[15px] w-full h-12">
                Continue without subscription
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                'mx-auto grid w-full grid-cols-1 gap-2.5 pt-2',
                plans.length === 2
                  ? 'min-[520px]:max-w-[380px] min-[520px]:grid-cols-2'
                  : 'min-[520px]:grid-cols-3'
              )}
            >
              {plans.map((plan) => {
                const isSelected = selected?.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setPurchaseError(null);
                      setRedemptionUrl(null);
                    }}
                    className={cn(
                      'relative flex min-h-[112px] flex-col items-center justify-center rounded-[17px] px-2 py-3 text-center transition-all',
                      isSelected
                        ? 'bg-white/12 shadow-[0_5px_12px_rgba(34,197,94,0.20)]'
                        : 'bg-white/[0.045] hover:bg-white/[0.07]'
                    )}
                    style={{
                      boxShadow: isSelected ? undefined : undefined,
                      outline: isSelected ? '2px solid #22C55E' : '1px solid rgba(255,255,255,0.12)',
                      outlineOffset: 0,
                    }}
                  >
                    {plan.badgeLabel && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#22C55E] px-2.5 py-0.5 font-mono text-[9px] font-black tracking-[0.04em] text-[#04120A] shadow-[0_2px_5px_rgba(34,197,94,0.35)]">
                        {plan.badgeLabel}
                      </span>
                    )}
                    <span className="line-clamp-1 flex items-center gap-1.5 text-[12px] font-semibold text-white sm:text-[13px]">
                      {plan.title}
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-[19px] font-bold text-white sm:text-[21px]">
                        {plan.priceLine}
                      </span>
                    </span>
                    <span className="mt-0.5 text-[10.5px] font-medium text-white/60">
                      {plan.periodLine}
                    </span>
                    {plan.renewalLine && (
                      <span className="mt-0.5 text-[10px] font-semibold text-[#22C55E]">
                        {plan.renewalLine}
                      </span>
                    )}
                    {plan.savingsLabel && (
                      <span className="mt-1 text-[9.5px] font-black uppercase tracking-[0.03em] text-amber-400">
                        {plan.savingsLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white/55">
              <Check className="h-3.5 w-3.5 text-[#22C55E]" />
              No commitment - Cancel anytime
            </p>

            {purchaseError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-xs font-semibold leading-5 text-red-100"
              >
                {purchaseError}
              </div>
            )}

            {redemptionUrl ? (
              <a
                href={redemptionUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#22C55E] text-[17px] font-black text-[#04120A] shadow-[0_6px_18px_rgba(34,197,94,0.45)]"
              >
                Redeem purchase
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <motion.button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing || !selected}
                whileTap={{ scale: 0.97 }}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        boxShadow: [
                          '0 6px 18px rgba(34,197,94,0.32)',
                          '0 8px 25px rgba(34,197,94,0.52)',
                          '0 6px 18px rgba(34,197,94,0.32)',
                        ],
                      }
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-[60px] w-full items-center justify-center overflow-hidden rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(90deg, #22C55E 0%, #8EF0B6 50%, #F59E0B 100%)',
                  boxShadow: '0 6px 18px rgba(34,197,94,0.45)',
                }}
              >
                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-[1px]"
                    initial={{ x: -180 }}
                    animate={{ x: 720 }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                  />
                )}
                {purchasing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#04120A]" />
                ) : (
                  <>
                    <span className="flex flex-col items-center px-10">
                      <span className="text-[18px] font-bold text-[#04120A]">{ctaTitle}</span>
                      {ctaSubtitle && (
                        <span className="text-[10.5px] font-semibold text-[#04120A]/75">
                          {ctaSubtitle}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="absolute right-5 h-4 w-4 text-[#04120A]/80" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-center gap-3.5 text-xs font-semibold text-white/50">
          <button type="button" onClick={handleRestore} disabled={restoring} className="hover:text-white/80">
            {restoring ? 'Restoring...' : 'Restore'}
          </button>
          <span className="text-white/25">·</span>
          <Link to="/terms-and-conditions" className="hover:text-white/80">
            Terms
          </Link>
          <span className="text-white/25">·</span>
          <Link to="/privacy-policy" className="hover:text-white/80">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}

export type { PaywallPersonalization };
