/**
 * Custom paywall — web remake of the iOS CustomPaywallView. RevenueCat Web
 * is used for offerings/prices/purchases only; the UI is fully custom:
 * brand header, swipeable feature carousel, side-by-side plan cards
 * (yearly-first with a SAVE badge), branded CTA and Restore/Terms/Privacy
 * footer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { Package } from '@revenuecat/purchases-js';
import { cn } from '@/lib/utils';
import debug from '@/utils/debug';
import { useToast } from '@/hooks/use-toast';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useSaleMode } from '@/hooks/useSaleMode';
import {
  getPaywallFeaturePages,
  type PaywallPersonalization,
} from '@/components/paywall/CustomPaywallFeaturePages';

export interface CustomPaywallProps {
  personalization?: PaywallPersonalization;
  /** Shown as "Not right now" when provided (freemium bypass). */
  onDismiss?: () => void;
  /** Called after a successful purchase (defaults to navigating to /agents). */
  onPurchased?: () => void;
  className?: string;
}

type PlanId = 'yearly' | 'monthly';

interface PlanInfo {
  id: PlanId;
  title: string;
  priceLine: string;
  subLine: string;
  strikethroughPrice?: string;
  badge?: string;
  trialLabel?: string;
  billingLine: string;
  rcPackage: Package;
}

/** "P7D" → "7-day", "P1W" → "1-week", "P1M" → "1-month". */
function formatIsoDuration(duration: string | undefined | null): string | null {
  if (!duration) return null;
  const match = /^P(\d+)([DWMY])$/i.exec(duration);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[match[2].toUpperCase() as 'D' | 'W' | 'M' | 'Y'];
  return `${count}-${unit}`;
}

function trialDurationOf(pkg: Package | undefined): string | null {
  if (!pkg) return null;
  const product = pkg.rcBillingProduct as any;
  const trial = product?.defaultSubscriptionOption?.trial;
  if (!trial) return null;
  return formatIsoDuration(trial.periodDuration ?? null);
}

function priceAmount(pkg: Package | undefined): number | undefined {
  return pkg?.rcBillingProduct?.currentPrice?.amount;
}

function priceFormatted(pkg: Package | undefined): string | undefined {
  return pkg?.rcBillingProduct?.currentPrice?.formattedPrice;
}

export function CustomPaywall({ personalization = {}, onDismiss, onPurchased, className }: CustomPaywallProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOffering, purchase, offeringsLoading, refreshOfferings } = useRevenueCatWeb();
  const { syncPurchasesManually, hasProAccess, refreshCustomerInfo } = useRevenueCat();
  const { isSaleActive } = useSaleMode();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // ── Feature carousel ───────────────────────────────────────────────────────
  const pages = useMemo(() => getPaywallFeaturePages(personalization), [personalization]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const interactedRef = useRef(false);

  const scrollToPage = useCallback((index: number) => {
    const container = carouselRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;
    const onScroll = () => {
      const page = Math.round(container.scrollLeft / container.clientWidth);
      setActivePage(Math.max(0, Math.min(pages.length - 1, page)));
    };
    const markInteracted = () => {
      interactedRef.current = true;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('pointerdown', markInteracted);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('pointerdown', markInteracted);
    };
  }, [pages.length]);

  // Gentle auto-advance until the user touches the carousel.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (interactedRef.current) return;
      const container = carouselRef.current;
      if (!container) return;
      const page = Math.round(container.scrollLeft / container.clientWidth);
      scrollToPage((page + 1) % pages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pages.length, scrollToPage]);

  // ── Plans ──────────────────────────────────────────────────────────────────
  const plans = useMemo((): PlanInfo[] => {
    if (!currentOffering) return [];
    const all = currentOffering.availablePackages ?? [];
    const find = (predicate: (id: string) => boolean) => all.find((p: Package) => predicate(p.identifier.toLowerCase()));

    const regularMonthly =
      currentOffering.monthly ??
      find((id) => id === '$rc_monthly' || (id.includes('month') && !id.includes('discount')));
    const regularYearly =
      currentOffering.annual ??
      find((id) => id === '$rc_annual' || ((id.includes('year') || id.includes('annual')) && !id.includes('discount')));
    const discountMonthly = find((id) => id.includes('month') && id.includes('discount'));
    const discountYearly = find((id) => (id.includes('year') || id.includes('annual')) && id.includes('discount'));

    const monthlyPkg = (isSaleActive ? discountMonthly : undefined) ?? regularMonthly;
    const yearlyPkg = (isSaleActive ? discountYearly : undefined) ?? regularYearly;

    const result: PlanInfo[] = [];

    const monthlyAmount = priceAmount(monthlyPkg);
    const yearlyAmount = priceAmount(yearlyPkg);

    if (yearlyPkg) {
      const yearlyPrice = priceFormatted(yearlyPkg) ?? 'N/A';
      const perMonth = yearlyAmount ? `$${(yearlyAmount / 100 / 12).toFixed(2)}` : null;
      // SAVE % vs paying monthly for 12 months (falls back to sale strikethrough).
      let badge: string | undefined;
      if (monthlyAmount && yearlyAmount && monthlyAmount * 12 > yearlyAmount) {
        badge = `SAVE ${Math.round(((monthlyAmount * 12 - yearlyAmount) / (monthlyAmount * 12)) * 100)}%`;
      }
      const regularYearlyAmount = priceAmount(regularYearly);
      const strikethrough =
        isSaleActive && yearlyPkg !== regularYearly && regularYearlyAmount && yearlyAmount && regularYearlyAmount > yearlyAmount
          ? priceFormatted(regularYearly)
          : undefined;
      const trial = trialDurationOf(yearlyPkg);
      result.push({
        id: 'yearly',
        title: 'Yearly',
        priceLine: yearlyPrice,
        subLine: perMonth ? `${perMonth} / month` : 'Billed once a year',
        strikethroughPrice: strikethrough ?? undefined,
        badge,
        trialLabel: trial ?? undefined,
        billingLine: trial ? `${trial} free trial, then ${yearlyPrice} per year` : `${yearlyPrice} per year`,
        rcPackage: yearlyPkg,
      });
    }

    if (monthlyPkg) {
      const monthlyPrice = priceFormatted(monthlyPkg) ?? 'N/A';
      const regularMonthlyAmount = priceAmount(regularMonthly);
      const strikethrough =
        isSaleActive && monthlyPkg !== regularMonthly && regularMonthlyAmount && monthlyAmount && regularMonthlyAmount > monthlyAmount
          ? priceFormatted(regularMonthly)
          : undefined;
      const trial = trialDurationOf(monthlyPkg);
      result.push({
        id: 'monthly',
        title: 'Monthly',
        priceLine: monthlyPrice,
        subLine: 'per month',
        strikethroughPrice: strikethrough ?? undefined,
        trialLabel: trial ?? undefined,
        billingLine: trial ? `${trial} free trial, then ${monthlyPrice} per month` : `${monthlyPrice} per month`,
        rcPackage: monthlyPkg,
      });
    }

    return result;
  }, [currentOffering, isSaleActive]);

  const selected = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const ctaTitle = selected?.trialLabel ? 'Continue for $0.00' : 'Continue';

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePurchased = useCallback(() => {
    if (onPurchased) onPurchased();
    else navigate('/agents');
  }, [onPurchased, navigate]);

  const handlePurchase = async () => {
    if (!selected) return;
    try {
      setPurchasing(true);
      debug.log('💳 CustomPaywall purchasing:', selected.rcPackage.identifier);
      await purchase(selected.rcPackage);
      toast({ title: 'Welcome to WagerProof Pro!', description: 'Your subscription is active.' });
      handlePurchased();
    } catch (error: any) {
      if (error?.message === 'USER_CANCELLED' || error?.errorCode === 1) {
        debug.log('Purchase cancelled by user');
        return;
      }
      debug.error('Purchase error:', error);
      toast({
        title: 'Purchase failed',
        description: error?.message || 'Unable to complete purchase. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      await syncPurchasesManually();
      await refreshCustomerInfo();
      if (hasProAccess) {
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
    <div className={cn('mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-6 pt-4 sm:px-6', className)}>
      {/* Brand header */}
      <div className="mb-4 flex items-center gap-2">
        <p className="text-2xl font-extrabold tracking-tight text-white">
          Wager<span className="text-green-400">Proof</span>
        </p>
        <span className="rounded-md bg-green-500 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-black">PRO</span>
      </div>

      {/* Feature carousel */}
      <div
        ref={carouselRef}
        className="flex w-full snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {pages.map((page, index) => (
          <div key={index} className="w-full shrink-0 snap-center px-1 py-2">
            {page}
          </div>
        ))}
      </div>
      <div className="mb-5 mt-3 flex gap-1.5">
        {pages.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Feature page ${index + 1}`}
            onClick={() => {
              interactedRef.current = true;
              scrollToPage(index);
            }}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: index === activePage ? 20 : 6,
              background: index === activePage ? 'white' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>

      {/* Plans */}
      {offeringsLoading ? (
        <div className="flex w-full flex-col items-center gap-3 py-8">
          <Loader2 className="h-7 w-7 animate-spin text-white/70" />
          <p className="text-sm text-white/60">Loading plans...</p>
        </div>
      ) : offeringsUnavailable ? (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-6 text-center">
          <p className="text-sm text-white/75">We couldn't load subscription options.</p>
          <button
            type="button"
            onClick={() => refreshOfferings()}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
          >
            Retry
          </button>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="text-sm text-white/50 underline hover:text-white/80">
              Continue without subscription
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid w-full grid-cols-2 gap-3">
            {plans.map((plan) => {
              const isSelected = selected?.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    'relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all',
                    isSelected
                      ? 'border-green-400 bg-green-400/10 ring-2 ring-green-400'
                      : 'border-white/15 bg-white/5 hover:bg-white/10'
                  )}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-black text-black">
                      {plan.badge}
                    </span>
                  )}
                  <p className="text-sm font-bold text-white">{plan.title}</p>
                  {plan.strikethroughPrice && (
                    <p className="text-xs text-white/40 line-through">{plan.strikethroughPrice}</p>
                  )}
                  <p className="mt-1 text-xl font-extrabold text-white">{plan.priceLine}</p>
                  <p className="text-xs text-white/55">{plan.subLine}</p>
                  {plan.trialLabel && (
                    <p className="mt-1.5 rounded-md bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
                      {plan.trialLabel} free trial
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs font-semibold text-white/55">No commitment - Cancel anytime</p>

          <motion.button
            type="button"
            onClick={handlePurchase}
            disabled={purchasing || !selected}
            whileTap={{ scale: 0.98 }}
            className="mt-3 w-full rounded-2xl bg-green-500 py-4 text-base font-extrabold text-black transition-colors hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          >
            {purchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              ctaTitle
            )}
          </motion.button>
          {selected && <p className="mt-2 text-xs text-white/50">{selected.billingLine}</p>}
        </>
      )}

      {/* Not right now (freemium bypass) */}
      {onDismiss && !offeringsUnavailable && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 text-sm font-semibold text-white/45 transition-colors hover:text-white/80"
        >
          Not right now
        </button>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center gap-2 text-xs text-white/40">
        <button type="button" onClick={handleRestore} disabled={restoring} className="hover:text-white/70">
          {restoring ? 'Restoring...' : 'Restore'}
        </button>
        <span>·</span>
        <Link to="/terms-and-conditions" className="hover:text-white/70">
          Terms
        </Link>
        <span>·</span>
        <Link to="/privacy-policy" className="hover:text-white/70">
          Privacy
        </Link>
      </div>
    </div>
  );
}

export type { PaywallPersonalization };
