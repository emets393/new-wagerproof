package com.wagerproof.app.features.paywall
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import com.wagerproof.core.models.SubscriptionTier
import com.wagerproof.core.services.RevenueCatService
@Composable
fun LockedGameCard(cardWidth: Dp? = null, content: @Composable () -> Unit) {
    var show by remember { mutableStateOf(false) }
    Box(Modifier.let { if(cardWidth != null) it.width(cardWidth) else it }) {
        LockedFeaturePreview(SubscriptionTier.STANDARD, "Game insights", { show = true }, content)
    }
    PaywallDialogHost(show, RevenueCatService.Placement.GENERIC_FEATURE, { show = false }, SubscriptionTier.STANDARD)
}
