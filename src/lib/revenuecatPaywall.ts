import type {
  Offering,
  Offerings,
  Package,
  Period,
  Price,
  Product,
} from '@revenuecat/purchases-js';

export const HARD_PAYWALL_OFFERING_IDENTIFIER = 'hardPaywall';

export const HARD_PAYWALL_PACKAGE_IDENTIFIERS = [
  'yearly_intro',
  '$rc_yearly_discount',
  '$rc_monthly',
] as const;

export type HardPaywallPackageIdentifier =
  (typeof HARD_PAYWALL_PACKAGE_IDENTIFIERS)[number];

export interface HardPaywallPlan {
  id: HardPaywallPackageIdentifier;
  title: string;
  priceLine: string;
  periodLine: string;
  renewalLine?: string;
  billingLine: string;
  savingsLabel?: string;
  badgeLabel?: 'RECOMMENDED' | 'MOST POPULAR';
  rcPackage: Package;
}

function productForPackage(pkg: Package | undefined): Product | null {
  return pkg?.webBillingProduct ?? null;
}

function isUsablePrice(price: Price | null | undefined): price is Price {
  return Boolean(
    price &&
      Number.isFinite(price.amountMicros) &&
      price.amountMicros >= 0 &&
      typeof price.currency === 'string' &&
      price.currency.length > 0
  );
}

function isUsablePeriod(period: Period | null | undefined): period is Period {
  return Boolean(
    period &&
      Number.isFinite(period.number) &&
      period.number > 0 &&
      typeof period.unit === 'string' &&
      period.unit.length > 0
  );
}

function isRenderablePackage(
  identifier: HardPaywallPackageIdentifier,
  pkg: Package | undefined
): pkg is Package {
  if (!pkg || pkg.identifier !== identifier) return false;

  const product = productForPackage(pkg);
  return Boolean(
    product &&
      isUsablePrice(product.price) &&
      isUsablePeriod(product.period)
  );
}

export function getHardPaywallOffering(offerings: Offerings | null): Offering | null {
  return offerings?.all?.[HARD_PAYWALL_OFFERING_IDENTIFIER] ?? null;
}

export function getHardPaywallPackages(offerings: Offerings | null): Package[] | null {
  const offering = getHardPaywallOffering(offerings);
  if (!offering) return null;

  const packages = HARD_PAYWALL_PACKAGE_IDENTIFIERS.map(
    (identifier) => offering.packagesById[identifier]
  );

  return packages.every((pkg, index) =>
    isRenderablePackage(HARD_PAYWALL_PACKAGE_IDENTIFIERS[index], pkg)
  )
    ? packages
    : null;
}

export function hasRenderableYearlyIntroOffer(
  packages: Package[] | null
): boolean {
  const yearlyIntroPackage = packages?.find(
    (pkg) => pkg.identifier === 'yearly_intro'
  );
  const intro = productForPackage(yearlyIntroPackage)?.introPricePhase;

  return Boolean(
    intro &&
      isUsablePrice(intro.price) &&
      isUsablePeriod(intro.period) &&
      Number.isFinite(intro.cycleCount)
  );
}

function formatPrice(price: Price): string {
  if (price.formattedPrice?.trim()) return price.formattedPrice;

  const amount = price.amountMicros / 1_000_000;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: price.currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${price.currency}`;
  }
}

function periodUnitLabel(period: Period, count = period.number): string {
  const unit = period.unit.toLowerCase();
  return count === 1 ? unit : `${unit}s`;
}

export function formatPeriod(period: Period): string {
  const number = new Intl.NumberFormat().format(period.number);
  return period.number === 1
    ? periodUnitLabel(period)
    : `${number} ${periodUnitLabel(period)}`;
}

function formatIntroDuration(period: Period, cycleCount: number): string {
  const cycles = cycleCount > 0 ? cycleCount : 1;
  const totalUnits = period.number * cycles;
  const formattedUnits = new Intl.NumberFormat().format(totalUnits);
  const duration =
    totalUnits === 1
      ? periodUnitLabel(period, totalUnits)
      : `${formattedUnits} ${periodUnitLabel(period, totalUnits)}`;
  return `the first ${duration}`;
}

function pricePerPeriod(price: Price, period: Period): string {
  return `${formatPrice(price)} per ${formatPeriod(period)}`;
}

interface AnnualizedPrice {
  amountMicros: number;
  currency: string;
}

function annualizedBasePrice(product: Product): AnnualizedPrice | null {
  const sdkAnnualPrice = product.defaultSubscriptionOption?.base.pricePerYear;
  if (isUsablePrice(sdkAnnualPrice) && sdkAnnualPrice.amountMicros > 0) {
    return {
      amountMicros: sdkAnnualPrice.amountMicros,
      currency: sdkAnnualPrice.currency,
    };
  }

  if (!isUsablePrice(product.price) || !isUsablePeriod(product.period)) return null;

  const periodNumber = product.period.number;
  const cyclesPerYear = {
    year: 1 / periodNumber,
    month: 12 / periodNumber,
    week: 52 / periodNumber,
    day: 365 / periodNumber,
  }[product.period.unit.toLowerCase()];

  if (!cyclesPerYear || !Number.isFinite(cyclesPerYear)) return null;

  return {
    amountMicros: product.price.amountMicros * cyclesPerYear,
    currency: product.price.currency,
  };
}

export function calculateAnnualSavingsPercentage(
  annualPackage: Package,
  monthlyPackage: Package
): number | null {
  const annualProduct = productForPackage(annualPackage);
  const monthlyProduct = productForPackage(monthlyPackage);
  if (!annualProduct || !monthlyProduct) return null;

  const annualPrice = annualizedBasePrice(annualProduct);
  const monthlyPrice = annualizedBasePrice(monthlyProduct);
  if (
    !annualPrice ||
    !monthlyPrice ||
    annualPrice.currency !== monthlyPrice.currency ||
    monthlyPrice.amountMicros <= 0 ||
    annualPrice.amountMicros >= monthlyPrice.amountMicros
  ) {
    return null;
  }

  return Math.round(
    ((monthlyPrice.amountMicros - annualPrice.amountMicros) /
      monthlyPrice.amountMicros) *
      100
  );
}

export function buildHardPaywallPlans(packages: Package[]): HardPaywallPlan[] {
  const byIdentifier = new Map(
    packages.map((pkg) => [pkg.identifier as HardPaywallPackageIdentifier, pkg])
  );
  const monthlyPackage = byIdentifier.get('$rc_monthly');
  if (!monthlyPackage) return [];

  return HARD_PAYWALL_PACKAGE_IDENTIFIERS.flatMap((identifier) => {
    const pkg = byIdentifier.get(identifier);
    if (!pkg || !isRenderablePackage(identifier, pkg)) return [];

    const product = productForPackage(pkg);
    if (!product || !product.period) return [];

    const baseBillingLine = pricePerPeriod(product.price, product.period);
    const savings =
      identifier === '$rc_monthly'
        ? null
        : calculateAnnualSavingsPercentage(pkg, monthlyPackage);
    const savingsLabel = savings == null ? undefined : `Save ${savings}% vs monthly`;
    const title = product.title?.trim() || 'WagerProof Pro';

    if (identifier === 'yearly_intro') {
      if (!hasRenderableYearlyIntroOffer([pkg])) return [];

      const intro = product.introPricePhase;
      if (!intro?.price || !intro.period) return [];

      const introDuration = formatIntroDuration(intro.period, intro.cycleCount);
      const introPrice = formatPrice(intro.price);
      return [
        {
          id: identifier,
          title,
          priceLine: introPrice,
          periodLine: `for ${introDuration}`,
          renewalLine: `then ${baseBillingLine}`,
          billingLine: `${introPrice} for ${introDuration}, then ${baseBillingLine}`,
          savingsLabel,
          rcPackage: pkg,
        },
      ];
    }

    return [
      {
        id: identifier,
        title,
        priceLine: formatPrice(product.price),
        periodLine: `per ${formatPeriod(product.period)}`,
        billingLine: baseBillingLine,
        savingsLabel,
        badgeLabel:
          identifier === '$rc_yearly_discount' ? 'MOST POPULAR' : undefined,
        rcPackage: pkg,
      },
    ];
  });
}
