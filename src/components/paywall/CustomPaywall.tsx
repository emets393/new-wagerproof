/**
 * Custom paywall — web remake of the iOS CustomPaywallView. RevenueCat Web
 * is used for offerings/prices/purchases only; the UI is fully custom:
 * brand header, swipeable feature carousel, side-by-side plan cards
 * (yearly-first with a SAVE badge), branded CTA and Restore/Terms/Privacy
 * footer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { PackageType, type Package } from '@revenuecat/purchases-js';
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

function productOf(pkg: Package | undefined) {
  return pkg?.webBillingProduct ?? pkg?.rcBillingProduct;
}

function trialDurationOf(pkg: Package | undefined): string | null {
  if (!pkg) return null;
  const product = productOf(pkg);
  const trial = product?.freeTrialPhase ?? product?.defaultSubscriptionOption?.trial;
  if (!trial) return null;
  return formatIsoDuration(trial.periodDuration ?? null);
}

function hasFreeTrial(pkg: Package | undefined): boolean {
  return Boolean(trialDurationOf(pkg));
}

/** Pay-up-front intro (e.g. $19.99 first month) when RC exposes introPrice. */
function payUpFrontIntro(pkg: Package | undefined) {
  const product = productOf(pkg);
  return product?.introPricePhase ?? product?.defaultSubscriptionOption?.introPrice ?? null;
}

function priceAmount(pkg: Package | undefined): number | undefined {
  return productOf(pkg)?.currentPrice?.amount ?? productOf(pkg)?.price?.amount;
}

function priceFormatted(pkg: Package | undefined): string | undefined {
  return productOf(pkg)?.currentPrice?.formattedPrice ?? productOf(pkg)?.price?.formattedPrice;
}

const INTRO_PACKAGE_ID = 'yearly_intro';

type EntryOffer = 'monthly' | 'intro_annual';

function resolveEntryOffer(offering: { metadata?: Record<string, unknown> } | null): EntryOffer {
  const raw = offering?.metadata?.entry_offer;
  return raw === 'intro_annual' ? 'intro_annual' : 'monthly';
}

export function CustomPaywall({ personalization = {}, onDismiss, onPurchased, className }: CustomPaywallProps) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOffering, purchase, offeringsLoading, refreshOfferings } = useRevenueCatWeb();
  const { syncPurchasesManually, hasProAccess, refreshCustomerInfo } = useRevenueCat();
  const { isSaleActive } = useSaleMode();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

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

  // ── Plans (iOS CustomPaywallView package resolution) ───────────────────────
  const plans = useMemo((): PlanInfo[] => {
    if (!currentOffering) return [];
    const all = currentOffering.availablePackages ?? [];
    const byId = (id: string) => all.find((p) => p.identifier === id || p.identifier.toLowerCase() === id.toLowerCase());
    const find = (predicate: (id: string) => boolean) => all.find((p) => predicate(p.identifier.toLowerCase()));

    const regularMonthly =
      currentOffering.monthly ??
      byId('$rc_monthly') ??
      find((id) => id.includes('month') && !id.includes('discount') && id !== INTRO_PACKAGE_ID);
    const discountMonthly = byId('$rc_monthly_discount') ?? find((id) => id.includes('month') && id.includes('discount'));
    const monthlyPkg = (isSaleActive ? discountMonthly : undefined) ?? regularMonthly ?? discountMonthly;

    const introPkg = byId(INTRO_PACKAGE_ID);

    // Prefer non-trial annual ($rc_yearly_discount) — never use yearly_intro here.
    const annualCandidates = all.filter((p) => {
      const id = p.identifier.toLowerCase();
      if (id === INTRO_PACKAGE_ID) return false;
      return (
        p.packageType === PackageType.Annual ||
        id === '$rc_yearly_discount' ||
        id === '$rc_annual' ||
        ((id.includes('year') || id.includes('annual')) && !id.includes('intro'))
      );
    });
    const preferredDiscount = annualCandidates.find(
      (p) => p.identifier === '$rc_yearly_discount' && !hasFreeTrial(p)
    );
    const anyNonTrialAnnual = annualCandidates.find((p) => !hasFreeTrial(p));
    const saleDiscountYearly = find((id) => (id.includes('year') || id.includes('annual')) && id.includes('discount'));
    const regularYearly =
      preferredDiscount ??
      anyNonTrialAnnual ??
      currentOffering.annual ??
      byId('$rc_annual') ??
      find((id) => (id.includes('year') || id.includes('annual')) && !id.includes('discount') && id !== INTRO_PACKAGE_ID);
    const yearlyPkg = (isSaleActive ? saleDiscountYearly : undefined) ?? regularYearly;

    const entryOffer = resolveEntryOffer(currentOffering);
    // Web RC already filters offers the customer is entitled to; if intro is
    // missing/ineligible we fall back to monthly like iOS.
    const entryPkg =
      entryOffer === 'intro_annual' && introPkg && payUpFrontIntro(introPkg) ? introPkg : monthlyPkg;
    const entryIsIntro = entryPkg?.identifier === INTRO_PACKAGE_ID || entryPkg?.identifier.toLowerCase() === INTRO_PACKAGE_ID;

    const result: PlanInfo[] = [];
    const monthlyAmount = priceAmount(monthlyPkg);
    const yearlyAmount = priceAmount(yearlyPkg);

    if (yearlyPkg) {
      const yearlyPrice = priceFormatted(yearlyPkg) ?? 'N/A';
      const perMonth = yearlyAmount ? `$${(yearlyAmount / 100 / 12).toFixed(2)}` : null;
      const regularYearlyAmount = priceAmount(regularYearly);
      const strikethrough =
        isSaleActive && yearlyPkg !== regularYearly && regularYearlyAmount && yearlyAmount && regularYearlyAmount > yearlyAmount
          ? priceFormatted(regularYearly)
          : undefined;
      // Headline yearly prefers non-trial; only show trial copy if it somehow has one.
      const trial = trialDurationOf(yearlyPkg);
      const savePct =
        monthlyAmount && yearlyAmount && monthlyAmount * 12 > yearlyAmount
          ? Math.round(((monthlyAmount * 12 - yearlyAmount) / (monthlyAmount * 12)) * 100)
          : null;
      result.push({
        id: 'yearly',
        title: 'Yearly',
        priceLine: yearlyPrice,
        subLine: perMonth
          ? `${perMonth}/mo${savePct != null ? ` • Save ${savePct}%` : ''}`
          : 'Billed once a year',
        strikethroughPrice: strikethrough ?? undefined,
        badge: savePct != null ? `SAVE ${savePct}%` : undefined,
        trialLabel: trial ?? undefined,
        billingLine: trial ? `${trial} free, then ${yearlyPrice} per year` : `${yearlyPrice} per year`,
        rcPackage: yearlyPkg,
      });
    }

    if (entryPkg) {
      const intro = payUpFrontIntro(entryPkg);
      const basePrice = priceFormatted(entryPkg) ?? 'N/A';
      const trial = !intro ? trialDurationOf(entryPkg) : null;
      const regularMonthlyAmount = priceAmount(regularMonthly);
      const entryAmount = priceAmount(entryPkg);
      const strikethrough =
        !entryIsIntro &&
        isSaleActive &&
        entryPkg !== regularMonthly &&
        regularMonthlyAmount &&
        entryAmount &&
        regularMonthlyAmount > entryAmount
          ? priceFormatted(regularMonthly)
          : undefined;

      if (intro && entryIsIntro) {
        const introPrice = intro.price?.formattedPrice ?? priceFormatted(entryPkg) ?? 'N/A';
        result.push({
          id: 'monthly',
          title: '1st Month',
          priceLine: introPrice,
          subLine: `then ${basePrice}/year`,
          badge: 'INTRO OFFER',
          trialLabel: undefined,
          billingLine: `${introPrice} for your first month, then ${basePrice} per year`,
          rcPackage: entryPkg,
        });
      } else {
        result.push({
          id: 'monthly',
          title: 'Monthly',
          priceLine: basePrice,
          subLine: 'per month',
          strikethroughPrice: strikethrough ?? undefined,
          badge: trial ? `${trial.replace(/-/g, ' ').toUpperCase()} FREE` : undefined,
          trialLabel: trial ?? undefined,
          billingLine: trial ? `${trial} free, then ${basePrice} per month` : `${basePrice} per month`,
          rcPackage: entryPkg,
        });
      }
    }

    return result;
  }, [currentOffering, isSaleActive]);

  const selected = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const ctaTitle = selected?.trialLabel ? 'Continue for $0.00' : 'Continue';
  const ctaSubtitle = selected?.billingLine ?? '';

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
            <p className="text-xs text-white/55">We couldn't load the Monthly or non-trial Yearly plan.</p>
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
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {plans.map((plan) => {
                const isSelected = selected?.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={cn(
                      'relative flex flex-col items-center rounded-[17px] px-2 py-3 text-center transition-all',
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
                    {plan.badge && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-0.5 font-mono text-[9px] font-black tracking-[0.04em] text-black shadow-[0_2px_5px_rgba(245,158,11,0.35)]">
                        {plan.badge}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white sm:text-[15px]">
                      {plan.title}
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-1.5">
                      {plan.strikethroughPrice && (
                        <span className="text-xs font-semibold text-white/35 line-through decoration-white/50">
                          {plan.strikethroughPrice}
                        </span>
                      )}
                      <span className="text-[19px] font-bold text-white sm:text-[22px]">{plan.priceLine}</span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 text-[10.5px] font-medium sm:text-xs',
                        plan.id === 'yearly' || plan.badge === 'INTRO OFFER' ? 'text-[#22C55E]' : 'text-white/50'
                      )}
                    >
                      {plan.subLine}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white/55">
              <Check className="h-3.5 w-3.5 text-[#22C55E]" />
              No commitment - Cancel anytime
            </p>

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
                      <span className="text-[10.5px] font-semibold text-[#04120A]/75">{ctaSubtitle}</span>
                    )}
                  </span>
                  <ChevronRight className="absolute right-5 h-4 w-4 text-[#04120A]/80" />
                </>
              )}
            </motion.button>
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
