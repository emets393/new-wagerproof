import { describe, expect, it } from 'vitest';
import type {
  Offering,
  Offerings,
  Package,
  Period,
  Price,
  PricingPhase,
  Product,
} from '@revenuecat/purchases-js';
import {
  buildHardPaywallPlans,
  calculateAnnualSavingsPercentage,
  getHardPaywallPackages,
  HARD_PAYWALL_PACKAGE_IDENTIFIERS,
} from './revenuecatPaywall';

function price(
  amountMicros: number,
  formattedPrice: string,
  currency = 'USD'
): Price {
  return {
    amount: amountMicros / 10_000,
    amountMicros,
    currency,
    formattedPrice,
  };
}

function phase(
  phasePrice: Price,
  period: Period,
  cycleCount = 0,
  pricePerYear: Price | null = null
): PricingPhase {
  return {
    periodDuration: null,
    period,
    price: phasePrice,
    cycleCount,
    pricePerWeek: null,
    pricePerMonth: null,
    pricePerYear,
  };
}

interface PackageOptions {
  identifier: string;
  title: string;
  basePrice: Price;
  period: Period;
  annualizedPrice: Price;
  introPrice?: Price;
  introPeriod?: Period;
  introCycles?: number;
}

function makePackage(options: PackageOptions): Package {
  const base = phase(
    options.basePrice,
    options.period,
    0,
    options.annualizedPrice
  );
  const intro =
    options.introPrice && options.introPeriod
      ? phase(
          options.introPrice,
          options.introPeriod,
          options.introCycles ?? 1
        )
      : null;

  const product = {
    identifier: `product_${options.identifier}`,
    title: options.title,
    description: null,
    productType: 'subscription',
    price: options.basePrice,
    period: options.period,
    introPricePhase: intro,
    freeTrialPhase: null,
    defaultSubscriptionOption: {
      id: `option_${options.identifier}`,
      priceId: `price_${options.identifier}`,
      base,
      trial: null,
      introPrice: intro,
    },
  } as unknown as Product;

  return {
    identifier: options.identifier,
    webBillingProduct: product,
    rcBillingProduct: product,
    packageType: 'custom',
  } as unknown as Package;
}

const month: Period = { number: 1, unit: 'month' as Period['unit'] };
const year: Period = { number: 1, unit: 'year' as Period['unit'] };

function requiredPackages(currency = 'USD') {
  const monthlyAnnualized = price(480_000_000, '$480.00', currency);
  const yearlyAnnualized = price(99_000_000, '$99.00', currency);

  return [
    makePackage({
      identifier: 'yearly_intro',
      title: 'Intro Annual',
      basePrice: price(99_000_000, '$99.00', currency),
      period: year,
      annualizedPrice: yearlyAnnualized,
      introPrice: price(19_990_000, '$19.99', currency),
      introPeriod: month,
      introCycles: 1,
    }),
    makePackage({
      identifier: '$rc_yearly_discount',
      title: 'Annual',
      basePrice: price(99_000_000, '$99.00', currency),
      period: year,
      annualizedPrice: yearlyAnnualized,
    }),
    makePackage({
      identifier: '$rc_monthly',
      title: 'Monthly',
      basePrice: price(40_000_000, '$40.00', currency),
      period: month,
      annualizedPrice: monthlyAnnualized,
    }),
  ];
}

function offeringsFor(packages: Package[]): Offerings {
  const offering = {
    identifier: 'hardPaywall',
    serverDescription: 'test',
    metadata: null,
    packagesById: Object.fromEntries(
      packages.map((pkg) => [pkg.identifier, pkg])
    ),
    availablePackages: packages,
  } as unknown as Offering;

  return {
    current: null,
    all: {
      hardPaywall: offering,
      ignoredOffering: {
        ...offering,
        identifier: 'ignoredOffering',
      },
    },
  };
}

describe('RevenueCat hardPaywall package resolution', () => {
  it('returns exactly the three approved packages in the required order', () => {
    const packages = requiredPackages();
    const extra = makePackage({
      identifier: '$rc_lifetime',
      title: 'Lifetime',
      basePrice: price(999_000_000, '$999.00'),
      period: year,
      annualizedPrice: price(999_000_000, '$999.00'),
    });
    const resolved = getHardPaywallPackages(
      offeringsFor([extra, packages[2], packages[0], packages[1]])
    );

    expect(resolved?.map((pkg) => pkg.identifier)).toEqual(
      HARD_PAYWALL_PACKAGE_IDENTIFIERS
    );
  });

  it('fails closed when any required package is absent', () => {
    expect(getHardPaywallPackages(offeringsFor(requiredPackages().slice(0, 2)))).toBeNull();
  });

  it('keeps the yearly intro package when the customer is not intro-eligible', () => {
    const packages = requiredPackages();
    packages[0] = makePackage({
      identifier: 'yearly_intro',
      title: 'Intro Annual',
      basePrice: price(99_000_000, '$99.00'),
      period: year,
      annualizedPrice: price(99_000_000, '$99.00'),
    });

    expect(
      getHardPaywallPackages(offeringsFor(packages))?.map(
        (pkg) => pkg.identifier
      )
    ).toEqual(HARD_PAYWALL_PACKAGE_IDENTIFIERS);
  });
});

describe('RevenueCat hardPaywall display model', () => {
  it('derives intro, renewal, periods, prices, ordering, and savings from SDK values', () => {
    const plans = buildHardPaywallPlans(requiredPackages());

    expect(plans.map((plan) => plan.id)).toEqual(
      HARD_PAYWALL_PACKAGE_IDENTIFIERS
    );
    expect(plans[0]).toMatchObject({
      priceLine: '$19.99',
      periodLine: 'for the first month',
      renewalLine: 'then $99.00 per year',
      billingLine: '$19.99 for the first month, then $99.00 per year',
      savingsLabel: 'Save 79% vs monthly',
    });
    expect(plans[0].badgeLabel).toBeUndefined();
    expect(plans[1]).toMatchObject({
      priceLine: '$99.00',
      periodLine: 'per year',
      savingsLabel: 'Save 79% vs monthly',
      badgeLabel: 'MOST POPULAR',
    });
    expect(plans[2]).toMatchObject({
      priceLine: '$40.00',
      periodLine: 'per month',
    });
  });

  it('uses the intro phase period and cycle count instead of fixed month copy', () => {
    const packages = requiredPackages();
    packages[0] = makePackage({
      identifier: 'yearly_intro',
      title: 'Intro Annual',
      basePrice: price(99_000_000, '$99.00'),
      period: year,
      annualizedPrice: price(99_000_000, '$99.00'),
      introPrice: price(29_000_000, '$29.00'),
      introPeriod: { number: 2, unit: 'month' as Period['unit'] },
      introCycles: 2,
    });

    expect(buildHardPaywallPlans(packages)[0].periodLine).toBe(
      'for the first 4 months'
    );
  });

  it('hides the yearly intro package when the customer is not eligible', () => {
    const packages = requiredPackages();
    packages[0] = makePackage({
      identifier: 'yearly_intro',
      title: 'Intro Annual',
      basePrice: price(99_000_000, '$99.00'),
      period: year,
      annualizedPrice: price(99_000_000, '$99.00'),
    });

    const plans = buildHardPaywallPlans(packages);

    expect(plans.map((plan) => plan.id)).toEqual([
      '$rc_yearly_discount',
      '$rc_monthly',
    ]);
    expect(plans[0]).toMatchObject({
      priceLine: '$99.00',
      periodLine: 'per year',
      billingLine: '$99.00 per year',
      badgeLabel: 'MOST POPULAR',
    });
  });

  it('does not calculate savings across different currencies', () => {
    const usdAnnual = requiredPackages('USD')[1];
    const eurMonthly = requiredPackages('EUR')[2];

    expect(
      calculateAnnualSavingsPercentage(usdAnnual, eurMonthly)
    ).toBeNull();
  });
});
