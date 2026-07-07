package com.wagerproof.app.features.paywall

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.revenuecat.purchases.ui.revenuecatui.customercenter.CustomerCenter
import com.wagerproof.app.di.appGraph

/**
 * Port of iOS `CustomerCenterView.swift`.
 *
 * Wraps RevenueCatUI's native [CustomerCenter] so customers can manage,
 * cancel, request refunds, or switch plans in-app — the RC SDK handles every
 * StoreKit / Play Billing interaction for us.
 *
 * The `.task`-equivalent [LaunchedEffect] refreshes customer info when the
 * screen appears so the rest of the app sees any plan changes the user made
 * inside RC's UI.
 */
@Composable
fun CustomerCenterScreen(onDismiss: () -> Unit) {
    val revenueCat = appGraph().revenueCat

    LaunchedEffect(Unit) {
        revenueCat.refreshCustomerInfo()
    }

    // RECONCILE: verify against RevenueCatUI 9.7.0 — CustomerCenter(modifier,
    // onDismiss). Some builds expose onDismiss as an optional trailing lambda.
    CustomerCenter(
        modifier = Modifier.fillMaxSize(),
        onDismiss = { onDismiss() },
    )
}
