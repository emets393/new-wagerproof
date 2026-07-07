package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offering
import com.revenuecat.purchases.models.StoreTransaction
import com.revenuecat.purchases.ui.revenuecatui.Paywall
import com.revenuecat.purchases.ui.revenuecatui.PaywallListener
import com.revenuecat.purchases.ui.revenuecatui.PaywallOptions
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
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
 * FIDELITY-WAIVER #052: Mixpanel paywall events (`paywall_presented`,
 * `paywall_dismissed`, `paywall_converted`) not yet fired — analytics fan-out
 * lands when AnalyticsStore wires the global event bus.
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

    // Refresh the trusted entitlement snapshot then dismiss so downstream Pro
    // gating updates immediately after a purchase / restore.
    fun finalizeAndDismiss() {
        scope.launch {
            revenueCat.refreshCustomerInfo()
            onDismiss()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.appSurface),
    ) {
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
                        PaywallOptions.Builder(dismissRequest = { onDismiss() })
                            .setOffering(current)
                            .setShouldDisplayDismissButton(true)
                            .setListener(object : PaywallListener {
                                override fun onPurchaseCompleted(
                                    customerInfo: CustomerInfo,
                                    storeTransaction: StoreTransaction,
                                ) {
                                    finalizeAndDismiss()
                                }

                                override fun onRestoreCompleted(customerInfo: CustomerInfo) {
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
