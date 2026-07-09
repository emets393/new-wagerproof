package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.PeriodType
import com.revenuecat.purchases.models.StoreTransaction
import com.revenuecat.purchases.ui.revenuecatui.Paywall
import com.revenuecat.purchases.ui.revenuecatui.PaywallListener
import com.revenuecat.purchases.ui.revenuecatui.PaywallOptions
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.services.RevenueCatService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Port of iOS `PostOnboardingPaywall.swift` (see 06 §2.22).
 *
 * Mounted by the coordinator above the main shell once onboarding finishes and
 * the user isn't yet Pro. Renders RevenueCatUI's native [Paywall] driven by the
 * `onboarding` placement (the dashboard owns layout / package selection / copy
 * / A-B variants). We own only:
 *   - Placement offering fetch + retry / skip fallbacks if RC is unreachable.
 *   - Post-purchase finalization: refresh [com.wagerproof.core.stores.RevenueCatStore]
 *     so the app re-renders with the granted entitlement, fire Meta conversion
 *     events, then dismiss.
 *   - A guaranteed escape hatch (own top-trailing ✕ + skip button).
 *
 * FIDELITY-WAIVER #053: Mixpanel "Subscription Purchased" event not fired here
 * — AnalyticsStore wiring lands in a later wave. Meta SDK events fire in
 * [finalize] since they're the attribution-critical path (ad-network LTV).
 */
@Composable
fun PostOnboardingPaywall(onUserDismissed: () -> Unit) {
    val revenueCat = appGraph().revenueCat
    val scope = rememberCoroutineScope()

    var offering by remember { mutableStateOf<Offering?>(null) }
    var isLoadingOffering by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var isFinalizing by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableStateOf(0) }

    suspend fun loadOffering() {
        isLoadingOffering = true
        loadError = null

        // Prefer the placement-specific offering so the dashboard can ship a
        // distinct post-onboarding variant; fall back to the cached offering.
        val placementOffering = revenueCat.fetchOffering(RevenueCatService.Placement.ONBOARDING)
        if (placementOffering != null) {
            offering = placementOffering
            isLoadingOffering = false
            return
        }
        val fallback = revenueCat.offering
        if (fallback != null) {
            offering = fallback
            isLoadingOffering = false
            return
        }
        offering = null
        loadError = "Couldn't reach the subscription service. Check your connection and try again."
        isLoadingOffering = false
    }

    LaunchedEffect(reloadKey) { loadOffering() }

    // Safety watchdog — if the fetch hasn't resolved within 10s, flip into the
    // error/retry surface so the user is never trapped behind a spinner.
    LaunchedEffect(reloadKey) {
        delay(10_000)
        if (isLoadingOffering && offering == null) {
            isLoadingOffering = false
            if (loadError == null) {
                loadError = "Subscription options are taking longer than expected to load."
            }
        }
    }

    // Trusted refresh (may flip granted/denied) so the rest of the app sees the
    // new entitlement immediately, then fire Meta events, then dismiss.
    fun finalize(transaction: StoreTransaction?, customerInfo: CustomerInfo) {
        scope.launch {
            isFinalizing = true
            revenueCat.refreshCustomerInfo()
            if (transaction != null) {
                trackMetaConversion(offering, transaction, customerInfo)
            }
            isFinalizing = false
            onUserDismissed()
        }
    }

    // Forced dark — the app is dark-only, but pin black regardless of template.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        val current = offering
        if (current != null && !isLoadingOffering && loadError == null) {
            val options = remember(current) {
                // RECONCILE: verify against RevenueCatUI 9.7.0 — PaywallOptions
                // builder + PaywallListener signatures.
                PaywallOptions.Builder(dismissRequest = { onUserDismissed() })
                    .setOffering(current)
                    .setShouldDisplayDismissButton(true)
                    .setListener(object : PaywallListener {
                        override fun onPurchaseCompleted(
                            customerInfo: CustomerInfo,
                            storeTransaction: StoreTransaction,
                        ) {
                            finalize(storeTransaction, customerInfo)
                        }

                        override fun onRestoreCompleted(customerInfo: CustomerInfo) {
                            // Restore can complete WITHOUT a granted entitlement
                            // (restored on a device with no purchase history).
                            // Only collapse when "WagerProof Pro" is actually active.
                            if (customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER] == null) {
                                return
                            }
                            finalize(null, customerInfo)
                        }
                    })
                    .build()
            }
            Paywall(options)
        }

        if (isLoadingOffering || isFinalizing) {
            LoadingOverlay(isFinalizing = isFinalizing)
        } else if (loadError != null || offering == null) {
            ErrorOverlay(
                message = loadError,
                onRetry = { reloadKey++ },
                onSkip = onUserDismissed,
            )
        }

        // Own ✕ overlay — guarantees an escape hatch regardless of RC template
        // version (V2 templates ignore the dashboard dismiss-button flag).
        CloseOverlay(onClose = onUserDismissed)
    }
}

@Composable
private fun LoadingOverlay(isFinalizing: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = AppColors.appPrimary)
        Text(
            text = if (isFinalizing) "Finalizing your subscription..." else "Loading subscription options...",
            fontSize = 16.sp,
            color = Color.White.copy(alpha = 0.75f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.md, start = Spacing.xxl, end = Spacing.xxl),
        )
    }
}

@Composable
private fun ErrorOverlay(
    message: String?,
    onRetry: () -> Unit,
    onSkip: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .navigationBarsPadding()
            .padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))
        AppIcon.fromSystemName("exclamationmark.triangle.fill")?.imageVector?.let { warn ->
            Icon(
                imageVector = warn,
                contentDescription = null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(56.dp),
            )
        }
        Text(
            text = "Unable to load subscription options",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.xl),
        )
        if (message != null) {
            Text(
                text = message,
                fontSize = 15.sp,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = Spacing.md, start = Spacing.xxl, end = Spacing.xxl),
            )
        }
        Spacer(Modifier.weight(1f))
        GlassButton(title = "Retry", onClick = onRetry)
        Spacer(Modifier.size(Spacing.md))
        // Same escape hatch as RN's "skip" — keeps the user moving when the
        // network is down so onboarding can't strand them on a dead paywall.
        GlassButton(
            title = "Continue without subscription",
            tint = Color.White.copy(alpha = 0.18f),
            onClick = onSkip,
        )
        Spacer(Modifier.size(Spacing.xxl))
    }
}

/** Minimal stand-in for iOS `OnboardingLiquidGlassButton`. */
@Composable
private fun GlassButton(
    title: String,
    tint: Color = AppColors.appPrimary,
    onClick: () -> Unit,
) {
    Text(
        text = title,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        color = Color.White,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(tint, RoundedCornerShape(14.dp))
            .padding(vertical = Spacing.lg),
    )
}

@Composable
private fun CloseOverlay(onClose: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
            .padding(top = Spacing.sm, end = Spacing.lg),
        horizontalArrangement = Arrangement.End,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .background(Color.Black.copy(alpha = 0.55f), CircleShape)
                .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape)
                .clickable(onClick = onClose),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon.fromSystemName("xmark")?.imageVector?.let { x ->
                Icon(imageVector = x, contentDescription = "Close paywall", tint = Color.White)
            }
        }
    }
}

/**
 * Fire Meta SDK Subscribe / Purchase events using price + currency from the
 * matched RevenueCat package. Mirrors the RN mapping where trials map to
 * `fb_mobile_purchase` and paid subs map to `Subscribe` with a coarse
 * predicted-LTV multiplier (monthly×4 / yearly×1.3). Best-effort: the service
 * intentionally remains disabled when the production Meta credentials are not
 * supplied to the build.
 */
private fun trackMetaConversion(
    offering: Offering?,
    transaction: StoreTransaction,
    customerInfo: CustomerInfo,
) {
    val txnProductId = transaction.productIds.firstOrNull() ?: return
    // Resolve the purchased package off the offering so we can pull price +
    // currency off the StoreProduct (StoreTransaction doesn't expose price).
    // Play Billing StoreProduct ids are "productId:basePlanId"; the transaction
    // carries the bare productId, so match on either form.
    val pkg = offering?.availablePackages?.firstOrNull {
        it.product.id == txnProductId || it.product.id.substringBefore(":") == txnProductId
    } ?: return

    val price = pkg.product.price
    val amount = BigDecimal.valueOf(price.amountMicros)
        .divide(BigDecimal(1_000_000), 2, RoundingMode.HALF_UP)
    val currency = price.currencyCode.ifBlank { "USD" }

    val entitlement = customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER]
    val productId = (entitlement?.productIdentifier ?: txnProductId).lowercase()
    val subscriptionType = when {
        productId.contains("lifetime") -> "lifetime"
        productId.contains("annual") || productId.contains("yearly") -> "yearly"
        productId.contains("monthly") -> "monthly"
        else -> "unknown"
    }

    val contentId = "${subscriptionType}_subscription"
    val predictedLtv = when (subscriptionType) {
        "monthly" -> amount.multiply(BigDecimal(4))
        "yearly" -> amount.multiply(BigDecimal("1.3"))
        else -> amount
    }
    val isTrial = entitlement?.periodType == PeriodType.TRIAL

    val metaParameters: Map<String, Any?> = mapOf(
        "fb_currency" to currency,
        "fb_content_type" to "product",
        "fb_content_id" to contentId,
        "fb_order_id" to transaction.orderId,
        "fb_predicted_ltv" to predictedLtv.toPlainString(),
        "fb_success" to "1",
        "fb_payment_info_available" to "1",
    )

    if (isTrial) {
        // Trial start → `fb_mobile_purchase` (matches RC server-side mapping).
        MetaAnalyticsService.trackPurchase(amount, currency, metaParameters)
    } else {
        // Paid first sub → `Subscribe` w/ valueToSum for LTV attribution.
        MetaAnalyticsService.trackSubscribe(amount, currency, metaParameters)
    }
    // Force-flush so the event hits Meta's pipeline before the user backgrounds.
    MetaAnalyticsService.flush()
}
