package com.wagerproof.app.features.paywall
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.models.SubscriptionTier
import com.wagerproof.core.services.RevenueCatService

@Composable
fun ProContentSection(title: String? = null, placementId: String = RevenueCatService.Placement.GENERIC_FEATURE,
    minHeight: Dp = 100.dp, minimumTier: SubscriptionTier = SubscriptionTier.STANDARD, content: @Composable () -> Unit) {
    val access = appGraph().proAccess
    var show by remember { mutableStateOf(false) }
    when {
        LocalFeatureGatePreview.current -> content()
        access.isLoading -> CircularProgressIndicator()
        access.hasAccess(minimumTier) -> content()
        else -> LockedFeaturePreview(minimumTier, title ?: "Game insights", { show = true }) {
            Box(Modifier.heightIn(min = minHeight)) { content() }
        }
    }
    PaywallDialogHost(show, if (minimumTier == SubscriptionTier.STANDARD) placementId else "tier_upgrade_${minimumTier.slug}",
        onDismiss = { show = false }, minimumTier = minimumTier)
}
