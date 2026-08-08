package com.wagerproof.app.features.paywall

import java.util.Locale
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Contract tests for the custom paywall's plan resolution and price copy
 * (AND-001). These are the rules a reviewer cannot eyeball:
 *
 * 1. the annual slot must FAIL CLOSED to a non-trial product — presenting the
 *    trial-backed annual under a card that promises no trial is the exact bug
 *    iOS's `annualPackage` filter exists to prevent;
 * 2. the metadata booleans must default the way iOS defaults them, because
 *    `paywall_close_enabled` absent means the onboarding gate is HARD;
 * 3. the savings badge and "/mo" figure must match iOS's arithmetic to the
 *    rounded value, or the two platforms advertise different discounts.
 */
class PaywallPlanResolverTest {

    private val usd = "USD"

    private fun product(
        packageId: String,
        productId: String = packageId.removePrefix("\$rc_"),
        kind: PaywallPackageKind = PaywallPackageKind.OTHER,
        priceMicros: Long,
        formatted: String,
        period: PaywallPeriod? = PaywallPeriod(1, PaywallPeriodUnit.YEAR),
        introOffer: PaywallIntroOffer? = null,
    ) = PaywallProduct(
        packageId = packageId,
        productId = productId,
        kind = kind,
        formattedPrice = formatted,
        priceMicros = priceMicros,
        currencyCode = usd,
        period = period,
        introOffer = introOffer,
    )

    private val monthly = product(
        packageId = "\$rc_monthly",
        kind = PaywallPackageKind.MONTHLY,
        priceMicros = 12_990_000,
        formatted = "$12.99",
        period = PaywallPeriod(1, PaywallPeriodUnit.MONTH),
    )

    private val yearlyDiscount = product(
        packageId = "\$rc_yearly_discount",
        kind = PaywallPackageKind.ANNUAL,
        priceMicros = 99_990_000,
        formatted = "$99.99",
    )

    private val yearlyWithTrial = product(
        packageId = "\$rc_annual",
        kind = PaywallPackageKind.ANNUAL,
        priceMicros = 119_990_000,
        formatted = "$119.99",
        introOffer = PaywallIntroOffer(
            mode = PaywallIntroMode.FREE_TRIAL,
            formattedPrice = "$0.00",
            period = PaywallPeriod(7, PaywallPeriodUnit.DAY),
        ),
    )

    private val introAnnual = product(
        packageId = PaywallPlanResolver.INTRO_PACKAGE_ID,
        productId = "pro_yearly_intro",
        kind = PaywallPackageKind.ANNUAL,
        priceMicros = 99_990_000,
        formatted = "$99.99",
        introOffer = PaywallIntroOffer(
            mode = PaywallIntroMode.PAY_UP_FRONT,
            formattedPrice = "$19.99",
            period = PaywallPeriod(1, PaywallPeriodUnit.MONTH),
        ),
    )

    // MARK: - Package resolution

    @Test
    fun annualSlotPrefersTheDiscountedNonTrialYearly() {
        val resolved = PaywallPlanResolver.resolve(
            listOf(yearlyWithTrial, yearlyDiscount, monthly),
            PaywallEntryOffer.MONTHLY,
        )
        assertEquals("\$rc_yearly_discount", resolved.annual?.packageId)
    }

    @Test
    fun annualSlotFailsClosedRatherThanShowingATrialBackedAnnual() {
        // Only a trial-backed annual is available: iOS refuses to headline it,
        // and so must we — the Yearly card promises no trial.
        val resolved = PaywallPlanResolver.resolve(
            listOf(yearlyWithTrial, monthly),
            PaywallEntryOffer.MONTHLY,
        )
        assertNull(resolved.annual)
        assertEquals(listOf("Monthly"), resolved.plans.map { it.name })
    }

    @Test
    fun introAnnualIsNeverTheHeadlineYearlyCard() {
        val resolved = PaywallPlanResolver.resolve(
            listOf(introAnnual, monthly),
            PaywallEntryOffer.MONTHLY,
        )
        assertNull(resolved.annual)
        assertEquals("\$rc_monthly", resolved.entry?.packageId)
    }

    @Test
    fun yearlyLeadsAndEntryFollows() {
        val resolved = PaywallPlanResolver.resolve(
            listOf(monthly, yearlyDiscount),
            PaywallEntryOffer.MONTHLY,
        )
        assertEquals(listOf("Yearly", "Monthly"), resolved.plans.map { it.name })
        assertEquals(yearlyDiscount.packageId, PaywallPlanResolver.defaultSelection(resolved)?.packageId)
    }

    @Test
    fun entryOfferMetadataSwapsMonthlyForTheIntroAnnual() {
        val resolved = PaywallPlanResolver.resolve(
            listOf(yearlyDiscount, monthly, introAnnual),
            PaywallEntryOffer.INTRO_ANNUAL,
        )
        assertEquals(listOf("Yearly", "1st Month"), resolved.plans.map { it.name })
        assertEquals(PaywallPlanResolver.INTRO_PACKAGE_ID, resolved.entry?.packageId)
    }

    @Test
    fun entryOfferFallsBackToMonthlyWhenPlayOmitsTheIntroOffer() {
        // Play filters offers the shopper is ineligible for out of
        // subscriptionOptions, so a returning customer's intro package arrives
        // with no intro phase — never strand them on a price they can't get.
        val ineligibleIntro = introAnnual.copy(introOffer = null)
        val resolved = PaywallPlanResolver.resolve(
            listOf(yearlyDiscount, monthly, ineligibleIntro),
            PaywallEntryOffer.INTRO_ANNUAL,
        )
        assertEquals("\$rc_monthly", resolved.entry?.packageId)
        assertEquals(listOf("Yearly", "Monthly"), resolved.plans.map { it.name })
    }

    @Test
    fun monthlyDiscountIsUsedWhenThePlainMonthlyIsAbsent() {
        val discountMonthly = monthly.copy(packageId = "\$rc_monthly_discount")
        val resolved = PaywallPlanResolver.resolve(
            listOf(yearlyDiscount, discountMonthly),
            PaywallEntryOffer.MONTHLY,
        )
        assertEquals("\$rc_monthly_discount", resolved.entry?.packageId)
    }

    @Test
    fun emptyCatalogProducesNoPlansRatherThanThrowing() {
        val resolved = PaywallPlanResolver.resolve(emptyList(), PaywallEntryOffer.MONTHLY)
        assertTrue(resolved.plans.isEmpty())
        assertNull(PaywallPlanResolver.defaultSelection(resolved))
        assertNull(resolved.annualSavingsPercent)
    }

    // MARK: - Offering metadata

    @Test
    fun closeEnabledDefaultsToHardWhenTheKeyIsAbsent() {
        assertFalse(PaywallPlanResolver.metadataBoolean(emptyMap(), "paywall_close_enabled", default = false))
    }

    @Test
    fun customPaywallEnabledDefaultsToTrueWhenTheKeyIsAbsent() {
        assertTrue(PaywallPlanResolver.metadataBoolean(emptyMap(), "custom_paywall_enabled", default = true))
    }

    @Test
    fun metadataBooleansAcceptRealBooleansAndZeroOneNumbers() {
        assertTrue(PaywallPlanResolver.metadataBoolean(mapOf("k" to true), "k", default = false))
        assertFalse(PaywallPlanResolver.metadataBoolean(mapOf("k" to false), "k", default = true))
        assertTrue(PaywallPlanResolver.metadataBoolean(mapOf("k" to 1), "k", default = false))
        assertFalse(PaywallPlanResolver.metadataBoolean(mapOf("k" to 0.0), "k", default = true))
    }

    @Test
    fun stringMetadataFallsBackToTheDefaultSoATypoCannotSoftenTheGate() {
        // iOS's `as? Bool` NSNumber bridge rejects strings too — a dashboard typo
        // must leave the hard gate hard rather than opening it.
        assertFalse(PaywallPlanResolver.metadataBoolean(mapOf("k" to "true"), "k", default = false))
        assertTrue(PaywallPlanResolver.metadataBoolean(mapOf("k" to "false"), "k", default = true))
    }

    @Test
    fun entryOfferParsesTheKnownValuesAndIgnoresTheRest() {
        assertEquals(PaywallEntryOffer.MONTHLY, PaywallPlanResolver.entryOffer(emptyMap()))
        assertEquals(
            PaywallEntryOffer.INTRO_ANNUAL,
            PaywallPlanResolver.entryOffer(mapOf("entry_offer" to "intro_annual")),
        )
        assertEquals(
            PaywallEntryOffer.MONTHLY,
            PaywallPlanResolver.entryOffer(mapOf("entry_offer" to "quarterly_special")),
        )
    }

    // MARK: - Price math

    @Test
    fun savingsPercentComparesAnnualizedPrices() {
        // $12.99 × 12 = $155.88 vs $99.99 → 36% off.
        assertEquals(36, PaywallPlanResolver.savingsPercent(yearlyDiscount, monthly))
    }

    @Test
    fun savingsPercentIsNullWhenTheAnnualIsNotActuallyCheaper() {
        val cheapMonthly = monthly.copy(priceMicros = 5_000_000)
        assertNull(PaywallPlanResolver.savingsPercent(yearlyDiscount, cheapMonthly))
    }

    @Test
    fun perMonthPriceDividesTheAnnualByTwelve() {
        assertEquals("$8.33", PaywallPlanResolver.perMonthPrice(yearlyDiscount, Locale.US))
    }

    @Test
    fun perMonthPriceUsesTheMeanMonthForWeeklyAndDailyPeriods() {
        val weekly = yearlyDiscount.copy(
            priceMicros = 4_000_000,
            period = PaywallPeriod(1, PaywallPeriodUnit.WEEK),
        )
        // $4.00 ÷ (1 / 4.345) = $17.38 — the same 4.345 divisor iOS uses.
        assertEquals("$17.38", PaywallPlanResolver.perMonthPrice(weekly, Locale.US))
    }

    @Test
    fun perMonthPriceIsNullWithoutAUsablePeriod() {
        assertNull(PaywallPlanResolver.perMonthPrice(yearlyDiscount.copy(period = null), Locale.US))
        assertNull(
            PaywallPlanResolver.perMonthPrice(
                yearlyDiscount.copy(period = PaywallPeriod(1, PaywallPeriodUnit.UNKNOWN)),
                Locale.US,
            ),
        )
    }

    @Test
    fun zeroPriceRendersInTheProductCurrency() {
        assertEquals("$0.00", PaywallPlanResolver.zeroPrice("USD", Locale.US))
    }

    // MARK: - Copy

    @Test
    fun billingPeriodPluralizesMultiUnitPeriods() {
        assertEquals("year", PaywallPlanResolver.billingPeriod(yearlyDiscount))
        assertEquals(
            "3 months",
            PaywallPlanResolver.billingPeriod(
                yearlyDiscount.copy(period = PaywallPeriod(3, PaywallPeriodUnit.MONTH)),
            ),
        )
        assertEquals(
            "purchase",
            PaywallPlanResolver.billingPeriod(yearlyDiscount.copy(period = null)),
        )
    }

    @Test
    fun billingLineSpellsOutThePayUpFrontIntro() {
        assertEquals(
            "$19.99 for your first month, then $99.99 per year",
            PaywallPlanResolver.billingLine(introAnnual),
        )
    }

    @Test
    fun billingLineSpellsOutAFreeTrial() {
        assertEquals(
            "7 days free, then $119.99 per year",
            PaywallPlanResolver.billingLine(yearlyWithTrial),
        )
    }

    @Test
    fun billingLineIsThePlainPriceWithNoOffer() {
        assertEquals("$99.99 per year", PaywallPlanResolver.billingLine(yearlyDiscount))
        assertEquals("Choose a plan to continue", PaywallPlanResolver.billingLine(null))
    }

    @Test
    fun ctaTitleOnlyPromisesZeroWhenATrialIsActuallyAttached() {
        assertEquals("Choose a plan", PaywallPlanResolver.ctaTitle(null, Locale.US))
        assertEquals("Continue", PaywallPlanResolver.ctaTitle(yearlyDiscount, Locale.US))
        assertEquals("Continue for $0.00", PaywallPlanResolver.ctaTitle(yearlyWithTrial, Locale.US))
        // A pay-up-front intro is NOT free — it must not claim $0.00.
        assertEquals("Continue", PaywallPlanResolver.ctaTitle(introAnnual, Locale.US))
    }

    @Test
    fun cardPriceLeadsWithTheIntroPriceWhenOneApplies() {
        assertEquals("$19.99", PaywallPlanResolver.cardPrice(introAnnual))
        assertEquals("$99.99", PaywallPlanResolver.cardPrice(yearlyDiscount))
    }

    @Test
    fun ribbonPrioritizesSavingsThenIntroThenTrial() {
        assertEquals(
            "SAVE 36%",
            PaywallPlanResolver.cardRibbon(yearlyDiscount, isAnnual = true, annualSavingsPercent = 36),
        )
        assertEquals(
            "INTRO OFFER",
            PaywallPlanResolver.cardRibbon(introAnnual, isAnnual = false, annualSavingsPercent = null),
        )
        assertEquals(
            "7 DAYS FREE",
            PaywallPlanResolver.cardRibbon(yearlyWithTrial, isAnnual = false, annualSavingsPercent = null),
        )
        assertNull(
            PaywallPlanResolver.cardRibbon(monthly, isAnnual = false, annualSavingsPercent = null),
        )
    }

    @Test
    fun accessibilityLabelDescribesPriceTrialAndSelection() {
        val plans = PaywallPlanResolver.resolve(
            listOf(yearlyDiscount, monthly),
            PaywallEntryOffer.MONTHLY,
        ).plans
        assertEquals(
            "Yearly, $99.99 per year, selected",
            PaywallPlanResolver.accessibilityLabel(plans[0], isSelected = true),
        )
        assertEquals(
            "1st Month, $19.99 for the first month, then $99.99 per year",
            PaywallPlanResolver.accessibilityLabel(PaywallPlan(introAnnual, "1st Month"), isSelected = false),
        )
    }

    @Test
    fun introEligibilityFollowsOfferPresenceNotASeparateCheck() {
        assertTrue(PaywallPlanResolver.introDisplayEligible(introAnnual))
        assertFalse(PaywallPlanResolver.introDisplayEligible(introAnnual.copy(introOffer = null)))
        // A free trial is not a pay-up-front intro.
        assertFalse(PaywallPlanResolver.introDisplayEligible(yearlyWithTrial))
        assertTrue(PaywallPlanResolver.hasFreeTrial(yearlyWithTrial))
        assertFalse(PaywallPlanResolver.hasFreeTrial(introAnnual))
    }
}
