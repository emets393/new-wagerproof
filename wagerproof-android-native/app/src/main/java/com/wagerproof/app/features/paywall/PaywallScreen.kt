package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
import kotlinx.coroutines.launch

/**
 * Port of iOS `RevenueCatPaywallView.swift`.
 *
 * Fetches the placement-specific offering (fallback to the cached
 * `RevenueCatStore.offering`), gates on load state, and hands the resolved
 * offering to RevenueCatUI's native [Paywall] composable — the same code path
 * the RevenueCat dashboard designs against.
 *
 * On purchase / restore completion we refresh the RevenueCat store so the rest
 * of the app re-renders with the granted entitlement, then dismiss.
 *
 * Every in-app Pro gate (Settings, Developer Settings, [ProFeatureGate],
 * [ProContentSection], [LockedGameCard], [LockedOverlay]) funnels through this
 * screen, so the attribution fan-out here covers all of them. It goes through
 * [PaywallConversionTracker] rather than calling MetaAnalyticsService inline —
 * the tracker owns order-id dedup, which is what makes it safe for several
 * surfaces to report the same purchase.
 */
@Composable
fun PaywallScreen(
    placementId: String = RevenueCatService.Placement.GENERIC_FEATURE,
    onDismiss: () -> Unit,
) {
    val graph = appGraph()
    val revenueCat = graph.revenueCat
    val scope = rememberCoroutineScope()

    var loadState by remember { mutableStateOf<LoadState>(LoadState.Loading) }
    var offering by remember { mutableStateOf<Offering?>(null) }

    // `key` bumps to force a re-fetch when the user taps Retry.
    var reloadKey by remember { mutableStateOf(0) }
    LaunchedEffect(placementId, reloadKey) {
        loadState = LoadState.Loading
        val fetched = revenueCat.fetchOffering(placementId) ?: revenueCat.offering
        if (fetched != null) {
            offering = fetched
            loadState = LoadState.Ready
        } else {
            loadState = LoadState.Empty
        }
    }

    // Impression: once per presentation, and only once the offering resolved —
    // Meta's ViewContent carries the highlighted plan's price as a pre-purchase
    // value signal, so firing before we know the price is worthless.
    var didTrackPresented by remember(placementId) { mutableStateOf(false) }
    LaunchedEffect(placementId, loadState, offering) {
        val current = offering
        if (didTrackPresented || loadState != LoadState.Ready || current == null) return@LaunchedEffect
        didTrackPresented = true
        AnalyticsService.track(
            "paywall_presented",
            mapOf("source" to placementId, "variant" to "revenuecat_template"),
        )
        PaywallConversionTracker.trackPaywallView(source = placementId, offering = current)
    }

    // Refresh the trusted entitlement snapshot then dismiss so downstream Pro
    // gating updates immediately after a purchase / restore.
    fun finalizeAndDismiss() {
        scope.launch {
            revenueCat.refreshCustomerInfo()
            onDismiss()
        }
    }

    fun dismissTracked(result: String) {
        AnalyticsService.track(
            "paywall_dismissed",
            mapOf("source" to placementId, "result" to result),
        )
        onDismiss()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        PaywallHeader(title = "Upgrade to WagerProof Pro", onDismiss = { dismissTracked("closed") })
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (val state = loadState) {
                LoadState.Loading -> LoadingState()
                LoadState.Empty -> ErrorState(
                    icon = AppIcon.fromSystemName("shippingbox.fill")?.imageVector,
                    message = "No subscription options available at this time.",
                    onRetry = { reloadKey++ },
                )
                is LoadState.Failed -> ErrorState(
                    icon = AppIcon.fromSystemName("exclamationmark.triangle.fill")?.imageVector,
                    message = state.message,
                    onRetry = { reloadKey++ },
                )
                LoadState.Ready -> {
                    val current = offering
                    if (current != null) {
                        val options = remember(current) {
                        // RECONCILE: verify against RevenueCatUI 9.7.0 —
                        // PaywallOptions.Builder(dismissRequest), .setOffering,
                        // .setListener, .setShouldDisplayDismissButton, .build().
                        PaywallOptions.Builder(dismissRequest = { dismissTracked("closed") })
                            .setOffering(current)
                            .setShouldDisplayDismissButton(false)
                            .setListener(object : PaywallListener {
                                override fun onPurchaseStarted(rcPackage: Package) {
                                    AnalyticsService.track(
                                        "paywall_checkout_started",
                                        mapOf(
                                            "source" to placementId,
                                            "variant" to "revenuecat_template",
                                            "product_id" to rcPackage.product.id,
                                        ),
                                    )
                                    // Before Play Billing resolves, so an
                                    // abandoned billing sheet still counts.
                                    PaywallConversionTracker.trackCheckoutStarted(
                                        source = placementId,
                                        pkg = rcPackage,
                                    )
                                }

                                override fun onPurchaseCompleted(
                                    customerInfo: CustomerInfo,
                                    storeTransaction: StoreTransaction,
                                ) {
                                    AnalyticsService.track(
                                        "paywall_converted",
                                        mapOf("source" to placementId, "variant" to "revenuecat_template"),
                                    )
                                    // These conversions were previously invisible
                                    // to Meta entirely — only the onboarding
                                    // paywall reported anything.
                                    PaywallConversionTracker.trackConversion(
                                        source = placementId,
                                        transaction = storeTransaction,
                                        customerInfo = customerInfo,
                                        pkg = null,
                                        offering = current,
                                    )
                                    finalizeAndDismiss()
                                }

                                override fun onRestoreCompleted(customerInfo: CustomerInfo) {
                                    AnalyticsService.track(
                                        "paywall_restore_completed",
                                        mapOf("source" to placementId),
                                    )
                                    finalizeAndDismiss()
                                }
                            })
                            .build()
                    }
                        Paywall(options)
                    }
                }
            }
        }
    }
}

@Composable
internal fun PaywallHeader(title: String, onDismiss: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(56.dp).padding(start = Spacing.lg, end = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = AppTypography.headline,
            color = AppColors.appTextPrimary,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = onDismiss) {
            AppIcon.fromSystemName("xmark")?.imageVector?.let {
                Icon(it, contentDescription = "Close", tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
            }
        }
    }
}

private sealed interface LoadState {
    data object Loading : LoadState
    data object Ready : LoadState
    data object Empty : LoadState
    data class Failed(val message: String) : LoadState
}

@Composable
private fun LoadingState() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = AppColors.appPrimary)
        Text(
            text = "Loading subscription options…",
            style = AppTypography.body,
            color = AppColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.md),
        )
    }
}

@Composable
private fun ErrorState(
    icon: androidx.compose.ui.graphics.vector.ImageVector?,
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = AppColors.appAccentAmber,
                modifier = Modifier.padding(bottom = Spacing.md),
            )
        }
        Text(
            text = message,
            style = AppTypography.body,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
            modifier = Modifier.padding(top = Spacing.lg),
        ) {
            Text("Retry", color = AppColors.appTextInverse)
        }
    }
}

/**
 * Full-screen modal host for [PaywallScreen] used by the Pro gates
 * ([ProFeatureGate], [ProContentSection], [LockedGameCard], [LockedOverlay]).
 *
 * The iOS gates present the paywall via `.sheet(isPresented:)`; on Android we
 * host it in a full-bleed [Dialog] so the gate owns its own presentation
 * (the top-level coordinator only owns the app-flow paywall presentations).
 */
@Composable
internal fun PaywallDialogHost(
    show: Boolean,
    placementId: String,
    onDismiss: () -> Unit,
) {
    if (!show) return
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            PaywallScreen(placementId = placementId, onDismiss = onDismiss)
        }
    }
}
