package com.wagerproof.app.features.paywall

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Plan resolution + price presentation for the custom paywall — port of the
 * pure logic inside iOS `CustomPaywallView.swift` (package resolution, trial
 * eligibility, savings badge, billing copy).
 *
 * Deliberately free of RevenueCat and Android types: the Compose layer adapts
 * `Package`/`StoreProduct` into [PaywallProduct] once (see
 * `CustomPaywallView.kt`'s `toPaywallProduct`), and everything that decides
 * WHICH plans render, in what order, at what price, lives here where it can be
 * unit-tested. Getting this wrong ships the trial-backed annual product to a
 * checkout that promises no trial, which is exactly what the iOS
 * `annualPackage` fail-closed rule exists to prevent.
 */

/** Billing-period unit. Mirrors RevenueCat `Period.Unit` without the dependency. */
enum class PaywallPeriodUnit { DAY, WEEK, MONTH, YEAR, UNKNOWN }

data class PaywallPeriod(val value: Int, val unit: PaywallPeriodUnit)

/**
 * How an introductory offer is priced.
 *
 * StoreKit calls these `freeTrial` / `payUpFront` / `payAsYouGo`; Play Billing
 * calls them FREE_TRIAL / SINGLE_PAYMENT / DISCOUNTED_RECURRING_PAYMENT. Same
 * three shapes, so the paywall copy branches identically on both platforms.
 */
enum class PaywallIntroMode { FREE_TRIAL, PAY_UP_FRONT, DISCOUNTED_RECURRING }

data class PaywallIntroOffer(
    val mode: PaywallIntroMode,
    /** Store-localized price of the intro phase ("$19.99"); "" for a free trial. */
    val formattedPrice: String,
    val period: PaywallPeriod,
)

enum class PaywallPackageKind { ANNUAL, MONTHLY, OTHER }

/**
 * One purchasable plan, flattened out of a RevenueCat `Package`.
 *
 * [introOffer] is non-null only when the shopper can actually take the offer:
 * Play Billing filters ineligible offers out of `subscriptionOptions` server
 * side, which is why Android has no equivalent of iOS's
 * `checkTrialOrIntroDiscountEligibility` call. Presence == eligibility.
 */
data class PaywallProduct(
    val packageId: String,
    val productId: String,
    val kind: PaywallPackageKind,
    /** Store-localized full price ("$99.99"). */
    val formattedPrice: String,
    val priceMicros: Long,
    val currencyCode: String,
    val period: PaywallPeriod?,
    val introOffer: PaywallIntroOffer?,
)

data class PaywallPlan(val product: PaywallProduct, val name: String) {
    val id: String get() = product.packageId
}

/**
 * Remote-config switch (offering metadata `entry_offer`) that swaps the second
 * ("entry") plan card between the recurring monthly plan and the pay-up-front
 * intro annual. Absent/unknown = [MONTHLY], so the paywall is unaffected until
 * the dashboard opts in.
 */
enum class PaywallEntryOffer(val raw: String) {
    MONTHLY("monthly"),
    INTRO_ANNUAL("intro_annual"),
}

data class ResolvedPaywallPlans(
    val annual: PaywallProduct?,
    val monthly: PaywallProduct?,
    val entry: PaywallProduct?,
    val plans: List<PaywallPlan>,
    val annualSavingsPercent: Int?,
) {
    fun plan(packageId: String?): PaywallPlan? = plans.firstOrNull { it.id == packageId }
}

object PaywallPlanResolver {

    /**
     * RevenueCat package `lookup_key` for the pay-up-front intro annual
     * (`rc_android_pro_yearly_intro`: discounted first month, then the standard
     * annual price). Only ever fills the entry slot, never the headline Yearly.
     */
    const val INTRO_PACKAGE_ID = "yearly_intro"

    private const val MONTHLY_ID = "\$rc_monthly"
    private const val MONTHLY_DISCOUNT_ID = "\$rc_monthly_discount"
    private const val YEARLY_DISCOUNT_ID = "\$rc_yearly_discount"
    private const val ANNUAL_ID = "\$rc_annual"

    // Same divisors iOS uses so a "/mo" figure never differs by a cent across
    // platforms: mean Gregorian month and mean weeks-per-month.
    private const val DAYS_PER_MONTH = 30.4375
    private const val WEEKS_PER_MONTH = 4.345

    // MARK: - Offering metadata

    /**
     * Read a dashboard boolean out of offering metadata.
     *
     * Deliberately narrow: only real booleans and 0/1 numbers count, matching
     * what iOS's `as? Bool` NSNumber bridge accepts. A metadata value typed as
     * the STRING `"true"` resolves to [default] on both platforms — for
     * `paywall_close_enabled` (default false) that keeps the gate hard rather
     * than softening it off a typo.
     */
    fun metadataBoolean(metadata: Map<String, Any?>, key: String, default: Boolean): Boolean =
        when (val raw = metadata[key]) {
            is Boolean -> raw
            is Number -> when (raw.toDouble()) {
                1.0 -> true
                0.0 -> false
                else -> default
            }
            else -> default
        }

    fun entryOffer(metadata: Map<String, Any?>): PaywallEntryOffer {
        val raw = metadata["entry_offer"] as? String ?: return PaywallEntryOffer.MONTHLY
        return PaywallEntryOffer.entries.firstOrNull { it.raw == raw } ?: PaywallEntryOffer.MONTHLY
    }

    // MARK: - Web checkout link-out

    /**
     * WagerProof's RevenueCat Web Purchase Link (dashboard: Funnels → Purchase
     * Links → Share URL). The trailing slash is load-bearing — the app user id
     * is appended as the next path segment. `web_checkout_url` in offering
     * metadata overrides this without an app release.
     */
    const val DEFAULT_WEB_CHECKOUT_URL = "https://pay.rev.cat/ynvjwxbzxgwjjgok/"

    /**
     * Advertised discount for buying on the web instead of through Play
     * Billing. Metadata-driven for the same reason as the URL: the number in the
     * copy has to track whatever the web offering is actually priced at.
     */
    fun webCheckoutSavingsPercent(metadata: Map<String, Any?>): Int =
        when (val raw = metadata["web_checkout_savings_percent"]) {
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull() ?: DEFAULT_WEB_CHECKOUT_SAVINGS
            else -> DEFAULT_WEB_CHECKOUT_SAVINGS
        }

    /**
     * Build the app-to-web checkout URL.
     *
     * The purchase MUST land on the same RevenueCat customer or the entitlement
     * never reaches the device. RevenueCat documents two shapes and they
     * disagree on where the id goes, so branch on the host rather than guessing:
     *
     *  - `pay.rev.cat` Web Purchase Link — app user id is a trailing PATH
     *    segment (`https://pay.rev.cat/<token>/<appUserId>`), package preselected
     *    with `package_id`.
     *  - anything else (our own checkout page) — query params `rc_app_user_id`,
     *    `rc_package`, `rc_env`, the names RevenueCat's own Web Purchase Button
     *    sends to a "Custom" checkout URL.
     *
     * Returns null when the configured value isn't a usable http(s) URL.
     */
    fun webCheckoutUrl(
        metadata: Map<String, Any?>,
        appUserId: String,
        packageId: String?,
        isDebugBuild: Boolean,
    ): String? {
        val configured = (metadata["web_checkout_url"] as? String)?.trim()
        val raw = if (!configured.isNullOrEmpty()) configured else DEFAULT_WEB_CHECKOUT_URL
        val parsed = runCatching { URI(raw) }.getOrNull() ?: return null
        if (parsed.scheme?.lowercase() !in setOf("http", "https")) return null

        val builder = StringBuilder()
        val base = raw.substringBefore('?').substringBefore('#')
        val existingQuery = raw.substringAfter('?', "").substringBefore('#')

        return if (parsed.host?.contains("pay.rev.cat") == true) {
            builder.append(base.trimEnd('/'))
            if (!base.trimEnd('/').endsWith("/$appUserId")) {
                // Appended RAW, not form-encoded: this is a path segment, and
                // `$` / `:` are legal there. RevenueCat anonymous ids look like
                // `$RCAnonymousID:abc`, and percent-encoding them here would
                // diverge from iOS's URLComponents output for the same id.
                builder.append('/').append(appUserId)
            }
            val query = buildList {
                if (existingQuery.isNotEmpty()) add(existingQuery)
                if (packageId != null) add("package_id=${encode(packageId)}")
            }
            if (query.isNotEmpty()) builder.append('?').append(query.joinToString("&"))
            builder.toString()
        } else {
            builder.append(base)
            val query = buildList {
                if (existingQuery.isNotEmpty()) add(existingQuery)
                add("rc_app_user_id=${encode(appUserId)}")
                if (packageId != null) add("rc_package=${encode(packageId)}")
                // `rc_env` hints which RevenueCat environment the page should
                // bill against. Build type is the proxy — treat it as a hint for
                // the page, never as an entitlement decision.
                add("rc_env=${if (isDebugBuild) "sandbox" else "production"}")
            }
            builder.append('?').append(query.joinToString("&"))
            builder.toString()
        }
    }

    private const val DEFAULT_WEB_CHECKOUT_SAVINGS = 30

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.name())

    // MARK: - Trial / intro predicates

    fun hasFreeTrial(product: PaywallProduct): Boolean =
        product.introOffer?.mode == PaywallIntroMode.FREE_TRIAL

    /** Non-null when the plan carries a pay-up-front intro (e.g. $19.99 first month). */
    fun payUpFrontIntro(product: PaywallProduct): PaywallIntroOffer? =
        product.introOffer?.takeIf { it.mode == PaywallIntroMode.PAY_UP_FRONT }

    /**
     * Whether the intro price may be shown. On iOS this waits on RevenueCat's
     * eligibility check; on Play, an ineligible shopper never sees the offer in
     * `subscriptionOptions` at all, so presence is the eligibility signal.
     */
    fun introDisplayEligible(product: PaywallProduct): Boolean = payUpFrontIntro(product) != null

    // MARK: - Package resolution

    fun resolve(
        products: List<PaywallProduct>,
        entryOffer: PaywallEntryOffer,
    ): ResolvedPaywallPlans {
        val monthly = products.firstOrNull { it.packageId == MONTHLY_ID }
            ?: products.firstOrNull { it.packageId == MONTHLY_DISCOUNT_ID }
            ?: products.firstOrNull { it.kind == PaywallPackageKind.MONTHLY }

        // RevenueCat exposes two yearly packages in the onboarding offering. The
        // discounted yearly has no free trial and is the intended default here.
        // Fail closed to another NON-trial annual rather than silently presenting
        // the trial-backed annual product under a card that promises no trial.
        val annualCandidates = products.filter {
            it.packageId != INTRO_PACKAGE_ID &&
                (
                    it.kind == PaywallPackageKind.ANNUAL ||
                        it.packageId == YEARLY_DISCOUNT_ID ||
                        it.packageId == ANNUAL_ID
                    )
        }
        val annual = annualCandidates.firstOrNull {
            it.packageId == YEARLY_DISCOUNT_ID && !hasFreeTrial(it)
        } ?: annualCandidates.firstOrNull { !hasFreeTrial(it) }

        val intro = products.firstOrNull { it.packageId == INTRO_PACKAGE_ID }
        // Never strand a returning customer on an intro they can't get: Play
        // omits the offer for them, so `introDisplayEligible` is false and the
        // entry slot falls back to the standard monthly plan.
        val entry = if (entryOffer == PaywallEntryOffer.INTRO_ANNUAL &&
            intro != null &&
            introDisplayEligible(intro)
        ) {
            intro
        } else {
            monthly
        }

        // Yearly leads because it is the recommended and preselected plan.
        val plans = buildList {
            annual?.let { add(PaywallPlan(it, "Yearly")) }
            entry?.let {
                add(PaywallPlan(it, if (it.packageId == INTRO_PACKAGE_ID) "1st Month" else "Monthly"))
            }
        }

        return ResolvedPaywallPlans(
            annual = annual,
            monthly = monthly,
            entry = entry,
            plans = plans,
            annualSavingsPercent = savingsPercent(annual, monthly),
        )
    }

    /** Plan preselected on appear — annual, else monthly, else whatever exists. */
    fun defaultSelection(resolved: ResolvedPaywallPlans): PaywallProduct? =
        resolved.annual ?: resolved.monthly ?: resolved.plans.firstOrNull()?.product

    // MARK: - Price math

    /** Price normalized to one year, in micros. Null when the period is unusable. */
    fun annualizedMicros(product: PaywallProduct): Double? {
        val period = product.period ?: return null
        if (period.value <= 0) return null
        val per = product.priceMicros.toDouble() / period.value
        return when (period.unit) {
            PaywallPeriodUnit.DAY -> per * 365
            PaywallPeriodUnit.WEEK -> per * 52
            PaywallPeriodUnit.MONTH -> per * 12
            PaywallPeriodUnit.YEAR -> per
            PaywallPeriodUnit.UNKNOWN -> null
        }
    }

    fun savingsPercent(annual: PaywallProduct?, monthly: PaywallProduct?): Int? {
        val annualized = annual?.let { annualizedMicros(it) } ?: return null
        val monthlyAnnualized = monthly?.let { annualizedMicros(it) } ?: return null
        if (monthlyAnnualized <= 0) return null
        val percent = ((monthlyAnnualized - annualized) / monthlyAnnualized * 100).roundToInt()
        return percent.takeIf { it > 0 }
    }

    /** Months in one billing period; null when the period can't be expressed. */
    fun monthsInPeriod(period: PaywallPeriod?): Double? {
        if (period == null || period.value <= 0) return null
        return when (period.unit) {
            PaywallPeriodUnit.DAY -> period.value / DAYS_PER_MONTH
            PaywallPeriodUnit.WEEK -> period.value / WEEKS_PER_MONTH
            PaywallPeriodUnit.MONTH -> period.value.toDouble()
            PaywallPeriodUnit.YEAR -> period.value * 12.0
            PaywallPeriodUnit.UNKNOWN -> null
        }
    }

    /** "$8.33" — the annual plan's monthly-equivalent price. */
    fun perMonthPrice(product: PaywallProduct, locale: Locale = Locale.getDefault()): String? {
        val months = monthsInPeriod(product.period) ?: return null
        if (months <= 0) return null
        return formatCurrency(product.priceMicros / 1_000_000.0 / months, product.currencyCode, locale)
    }

    /** Store-style zero price, used by the "Continue for $0.00" trial CTA. */
    fun zeroPrice(currencyCode: String, locale: Locale = Locale.getDefault()): String =
        formatCurrency(0.0, currencyCode, locale)

    private fun formatCurrency(amount: Double, currencyCode: String, locale: Locale): String {
        val formatter = NumberFormat.getCurrencyInstance(locale)
        runCatching { formatter.currency = Currency.getInstance(currencyCode) }
        return formatter.format(amount)
    }

    // MARK: - Copy

    fun unitName(unit: PaywallPeriodUnit, value: Int): String {
        val singular = when (unit) {
            PaywallPeriodUnit.DAY -> "day"
            PaywallPeriodUnit.WEEK -> "week"
            PaywallPeriodUnit.MONTH -> "month"
            PaywallPeriodUnit.YEAR -> "year"
            PaywallPeriodUnit.UNKNOWN -> "period"
        }
        return if (value == 1) singular else "${singular}s"
    }

    /** "year" / "3 months" — the trailing half of "$99.99 per ___". */
    fun billingPeriod(product: PaywallProduct): String {
        val period = product.period ?: return "purchase"
        if (period.value == 1) return unitName(period.unit, 1)
        return "${period.value} ${unitName(period.unit, period.value)}"
    }

    /** "first month" / "first 3 months" — a pay-up-front intro's prepaid span. */
    fun introDurationPhrase(intro: PaywallIntroOffer): String {
        val unit = unitName(intro.period.unit, intro.period.value)
        return if (intro.period.value == 1) "first $unit" else "first ${intro.period.value} $unit"
    }

    fun ctaTitle(selected: PaywallProduct?, locale: Locale = Locale.getDefault()): String {
        if (selected == null) return "Choose a plan"
        if (!hasFreeTrial(selected)) return "Continue"
        return "Continue for ${zeroPrice(selected.currencyCode, locale)}"
    }

    /** The small print under the CTA — the exact charge the user is agreeing to. */
    fun billingLine(selected: PaywallProduct?): String {
        if (selected == null) return "Choose a plan to continue"
        val price = selected.formattedPrice
        val period = billingPeriod(selected)
        val intro = payUpFrontIntro(selected)
        if (intro != null && introDisplayEligible(selected)) {
            return "${intro.formattedPrice} for your ${introDurationPhrase(intro)}, then $price per $period"
        }
        val trial = selected.introOffer?.takeIf { it.mode == PaywallIntroMode.FREE_TRIAL }
        if (trial != null) {
            return "${trial.period.value} ${unitName(trial.period.unit, trial.period.value)} free, " +
                "then $price per $period"
        }
        return "$price per $period"
    }

    /** Headline price on a plan card — the intro price when one applies. */
    fun cardPrice(product: PaywallProduct): String {
        val intro = payUpFrontIntro(product)
        return if (intro != null && introDisplayEligible(product)) intro.formattedPrice else product.formattedPrice
    }

    /** Amber ribbon above a plan card; null when the card gets no ribbon. */
    fun cardRibbon(
        product: PaywallProduct,
        isAnnual: Boolean,
        annualSavingsPercent: Int?,
    ): String? = when {
        isAnnual && annualSavingsPercent != null -> "SAVE $annualSavingsPercent%"
        introDisplayEligible(product) -> "INTRO OFFER"
        hasFreeTrial(product) -> product.introOffer?.let {
            "${it.period.value} ${unitName(it.period.unit, it.period.value).uppercase()} FREE"
        }
        else -> null
    }

    fun accessibilityLabel(plan: PaywallPlan, isSelected: Boolean): String {
        val product = plan.product
        val intro = payUpFrontIntro(product)
        var label = if (intro != null && introDisplayEligible(product)) {
            "${plan.name}, ${intro.formattedPrice} for the ${introDurationPhrase(intro)}, " +
                "then ${product.formattedPrice} per ${billingPeriod(product)}"
        } else {
            "${plan.name}, ${product.formattedPrice} per ${billingPeriod(product)}"
        }
        if (hasFreeTrial(product)) label += ", includes an eligible free trial"
        if (isSelected) label += ", selected"
        return label
    }
}
