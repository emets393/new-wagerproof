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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.mutableIntStateOf
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
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.models.StoreTransaction
import com.revenuecat.purchases.ui.revenuecatui.Paywall
import com.revenuecat.purchases.ui.revenuecatui.PaywallListener
import com.revenuecat.purchases.ui.revenuecatui.PaywallOptions
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.AnalyticsService
import com.wagerproof.core.services.PaywallConversionTracker
import com.wagerproof.core.services.RevenueCatService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Attribution placement id for this surface — matches iOS's `"post_onboarding"`. */
private const val PAYWALL_SOURCE = "post_onboarding"

/**
 * Host for the post-onboarding paywall — port of iOS `PostOnboardingPaywall.swift`.
 *
 * Mounted by [com.wagerproof.app.nav.RootHost] above the main shell once
 * onboarding finishes and the user isn't yet Pro.
 *
 * The renderer and the gate hardness are remote-configured from the placement
 * offering's metadata (dashboard-editable, no app release):
 *  - `custom_paywall_enabled` (default TRUE): the fully custom [CustomPaywallView]
 *    with RevenueCat as data layer only. `false` is the kill switch back to the
 *    RevenueCatUI template.
 *  - `paywall_close_enabled` (default FALSE = HARD): the real onboarding gate
 *    ships hard — no ✕ on either renderer, and back is swallowed. Flip it `true`
 *    to soften the gate (e.g. an App Review build). The error/timeout
 *    "Continue without subscription" escape survives BOTH modes, so a user can
 *    never be stranded on a paywall that failed to load.
 *
 * [isDebugPreview] (Secret Settings) overrides both and always draws a bright red
 * DEBUG close, so a tester can escape the otherwise-non-dismissible gate and can
 * see at a glance that the run is a debug invocation.
 *
 * The host owns the offering fetch + retry/skip fallbacks and post-purchase
 * finalization (refresh [com.wagerproof.core.stores.RevenueCatStore], fan out
 * attribution, dismiss). Mixpanel paywall-funnel events fire inside
 * [CustomPaywallView] on the custom path.
 */
@Composable
fun PostOnboardingPaywall(
    onUserDismissed: () -> Unit,
    isDebugPreview: Boolean = false,
    /**
     * Reports the resolved `paywall_close_enabled` state to the host so the
     * modal's back handler and the ✕ stay in step. Without this the hard gate
     * would only be half applied: no ✕, but back still dismissing.
     */
    onCloseEnabledChanged: (Boolean) -> Unit = {},
) {
    val graph = appGraph()
    val revenueCat = graph.revenueCat
    val onboarding = graph.onboarding
    val scope = rememberCoroutineScope()

    var offering by remember { mutableStateOf<Offering?>(null) }
    var isLoadingOffering by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var isFinalizing by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableIntStateOf(0) }

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

    val current = offering
    val metadata = current?.metadata.orEmpty()

    // Absent key = HARD (no ✕): the real onboarding gate ships hard and a remote
    // `true` softens it. The debug preview always allows closing.
    val closeEnabled = isDebugPreview ||
        PaywallPlanResolver.metadataBoolean(metadata, "paywall_close_enabled", default = false)

    // Absent key = custom paywall; explicit `false` = legacy RC template.
    val customPaywallEnabled =
        PaywallPlanResolver.metadataBoolean(metadata, "custom_paywall_enabled", default = true)

    val isShowingCustomPaywall =
        customPaywallEnabled && current != null && !isLoadingOffering && loadError == null

    LaunchedEffect(closeEnabled) { onCloseEnabledChanged(closeEnabled) }

    // Impression for the LEGACY template only — the custom paywall fires its own
    // `paywall_presented` (with the plan it actually highlighted) from inside
    // CustomPaywallView, and two senders would double-count the funnel step.
    var didTrackPresented by remember { mutableStateOf(false) }
    LaunchedEffect(current, isLoadingOffering, isShowingCustomPaywall) {
        if (didTrackPresented || isLoadingOffering || current == null || isShowingCustomPaywall) {
            return@LaunchedEffect
        }
        didTrackPresented = true
        AnalyticsService.track(
            "paywall_presented",
            mapOf("source" to PAYWALL_SOURCE, "variant" to "revenuecat_template"),
        )
        PaywallConversionTracker.trackPaywallView(source = PAYWALL_SOURCE, offering = current)
    }

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
    // new entitlement immediately, then fire attribution, then dismiss.
    fun finalize(transaction: StoreTransaction?, customerInfo: CustomerInfo) {
        scope.launch {
            isFinalizing = true
            revenueCat.refreshCustomerInfo()
            // Deduped by order id inside the tracker, so a billing-listener
            // catch-up — or CustomPaywallView having already reported the same
            // purchase — is a complete no-op. A restore proves access but is not a
            // new conversion: historical entitlements must never synthesize a
            // Subscribe/StartTrial event on reinstall or account recovery.
            if (transaction != null) {
                PaywallConversionTracker.trackConversion(
                    source = PAYWALL_SOURCE,
                    transaction = transaction,
                    customerInfo = customerInfo,
                    pkg = null,
                    offering = offering,
                )
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
        if (current != null && !isLoadingOffering && loadError == null) {
            if (customPaywallEnabled) {
                CustomPaywallView(
                    offering = current,
                    allowClose = closeEnabled,
                    source = PAYWALL_SOURCE,
                    // Monetization stays on the core WagerProof green so plan
                    // selection and purchase always read as the same product.
                    accent = AppColors.appPrimary,
                    agentName = onboarding.agentDraft.name,
                    spriteIndex = onboarding.agentDraft.spriteIndex ?: 0,
                    researchBucketRaw = onboarding.survey.researchTimeBucket,
                    stakesBucketRaw = onboarding.survey.weeklyStakesBucket,
                    onPurchaseFinalized = { transaction, customerInfo -> finalize(transaction, customerInfo) },
                    onRequestClose = onUserDismissed,
                    debugClose = isDebugPreview,
                )
            } else {
                // Legacy dashboard-owned template (kill-switch path).
                val options = remember(current, closeEnabled) {
                    // RECONCILE: verify against RevenueCatUI 9.7.0 — PaywallOptions
                    // builder + PaywallListener signatures.
                    PaywallOptions.Builder(
                        dismissRequest = {
                            // In hard mode the template's own dismissal request is
                            // ignored: the only ways out are purchase, restore, or
                            // the error surface's skip.
                            if (closeEnabled) onUserDismissed()
                        },
                    )
                        .setOffering(current)
                        // false, NOT true: [CloseOverlay] below already draws an ✕ in
                        // the same corner and is the only one guaranteed to exist (V2
                        // templates ignore this flag). With it true, any template that
                        // DID honour the flag stacked a second ✕ on top of ours.
                        .setShouldDisplayDismissButton(false)
                        .setListener(object : PaywallListener {
                            override fun onPurchaseStarted(rcPackage: Package) {
                                AnalyticsService.track(
                                    "paywall_checkout_started",
                                    mapOf(
                                        "source" to PAYWALL_SOURCE,
                                        "variant" to "revenuecat_template",
                                        "product_id" to rcPackage.product.id,
                                    ),
                                )
                                // Fires before Play Billing resolves so an abandoned
                                // billing sheet still counts as checkout intent.
                                PaywallConversionTracker.trackCheckoutStarted(
                                    source = PAYWALL_SOURCE,
                                    pkg = rcPackage,
                                )
                            }

                            override fun onPurchaseCompleted(
                                customerInfo: CustomerInfo,
                                storeTransaction: StoreTransaction,
                            ) {
                                AnalyticsService.track(
                                    "paywall_converted",
                                    mapOf("source" to PAYWALL_SOURCE, "variant" to "revenuecat_template"),
                                )
                                finalize(storeTransaction, customerInfo)
                            }

                            override fun onRestoreCompleted(customerInfo: CustomerInfo) {
                                // Restore can complete WITHOUT a granted entitlement
                                // (restored on a device with no purchase history).
                                // Only collapse when "WagerProof Pro" is actually active.
                                if (customerInfo.entitlements.active[RevenueCatService.ENTITLEMENT_IDENTIFIER] == null) {
                                    return
                                }
                                AnalyticsService.track(
                                    "paywall_restore_completed",
                                    mapOf("source" to PAYWALL_SOURCE),
                                )
                                finalize(null, customerInfo)
                            }
                        })
                        .build()
                }
                Paywall(options)
            }
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

        // ✕ overlay for the LEGACY branch and the loading state only — the custom
        // paywall draws its own metadata-gated close in its top bar, so drawing
        // one here too would double it up. Hidden entirely in hard mode; the
        // error surface's "Continue without subscription" stays the escape hatch.
        if (closeEnabled && !isShowingCustomPaywall) {
            CloseOverlay(isDebugPreview = isDebugPreview, onClose = onUserDismissed)
        }
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
        Icon(
            imageVector = AppIcon.EXCLAMATION_TRIANGLE_FILL.imageVector,
            contentDescription = null,
            tint = AppColors.appPrimary,
            modifier = Modifier.size(56.dp),
        )
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
        // UNCONDITIONAL escape hatch — survives the hard gate. Keeps the user
        // moving when the network is down so onboarding can't strand them on a
        // dead paywall.
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
private fun CloseOverlay(isDebugPreview: Boolean, onClose: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
            .padding(top = Spacing.sm, end = Spacing.lg),
        horizontalArrangement = Arrangement.End,
    ) {
        if (isDebugPreview) {
            // Matches CustomPaywallView's DEBUG pill so the escape hatch reads the
            // same whether the custom paywall or the loading/legacy surface is up.
            Row(
                modifier = Modifier
                    .height(34.dp)
                    .background(Color.Red, CircleShape)
                    .border(1.dp, Color.White.copy(alpha = 0.55f), CircleShape)
                    .clickable(onClick = onClose)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Icon(
                    imageVector = AppIcon.XMARK.imageVector,
                    contentDescription = "Close debug paywall",
                    tint = Color.White,
                    modifier = Modifier.size(12.dp),
                )
                Text(
                    text = "DEBUG",
                    style = AppTypography.monoCaption.copy(fontSize = 11.sp),
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(Color.Black.copy(alpha = 0.55f), CircleShape)
                    .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape)
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = AppIcon.XMARK.imageVector,
                    contentDescription = "Close paywall",
                    tint = Color.White,
                )
            }
        }
    }
}
