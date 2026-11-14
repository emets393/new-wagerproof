package com.wagerproof.app.features.paywall

import com.wagerproof.core.models.SubscriptionTier
import java.net.URI
import java.util.Locale
import kotlin.math.roundToInt

internal object TieredPaywallCatalog {
    const val OFFERING_ID = "wagerproof_tiers_v1"
    fun priceCents(tier: SubscriptionTier, yearly: Boolean) =
        (if (yearly) listOf(19999, 29999, 35999) else listOf(1999, 2999, 7999))[tier.ordinal]
    fun comparisonCents(tier: SubscriptionTier, yearly: Boolean): Int? =
        when(tier) { SubscriptionTier.STANDARD -> null; SubscriptionTier.PREMIUM -> 5999; SubscriptionTier.PRO -> 12999 }?.times(if(yearly) 12 else 1)
    fun packageId(tier: SubscriptionTier, yearly: Boolean) = "${tier.slug}_${if(yearly) "yearly" else "monthly"}"
    fun productId(tier: SubscriptionTier, yearly: Boolean) = "wp_tiers_${tier.slug}:${if(yearly) "yearly" else "monthly"}"
    fun usd(cents: Int) = String.format(Locale.US, "$%.2f", cents / 100.0)
    fun savings(price: Long, comparison: Long) = if (price > 0 && comparison > price) ((1.0 - price.toDouble()/comparison)*100).roundToInt() else null
    fun hostedUrl(base: String?, rcUser: String, authUser: String?): String? {
        if (authUser == null || rcUser != authUser.lowercase() || runCatching { java.util.UUID.fromString(authUser) }.isFailure) return null
        val uri = runCatching { URI(base ?: return null) }.getOrNull() ?: return null
        if (uri.scheme != "https" || uri.host != "pay.rev.cat" || uri.userInfo != null || uri.port != -1 || uri.query != null || uri.fragment != null || uri.path.trim('/').contains('/') || uri.path.trim('/').isEmpty()) return null
        return "https://pay.rev.cat/${uri.path.trim('/')}/$rcUser?currency=USD"
    }
    data class Feature(val id: String, val title: String, val detail: String, val tier: SubscriptionTier)
    val features = listOf(
        Feature("games", "Game Data & Matchups", "Every matchup, key stats, injury reports, and live scores in one place.", SubscriptionTier.STANDARD),
        Feature("predictions", "WagerProof Predictions", "Model projections and signals to help you research every game.", SubscriptionTier.STANDARD),
        Feature("markets", "Prediction Markets", "Follow market probabilities and see how they compare with our models.", SubscriptionTier.STANDARD),
        Feature("discord", "Discord Community", "Join the WagerProof community to discuss games, research, and strategy.", SubscriptionTier.STANDARD),
        Feature("outliers", "Outliers", "Spot the biggest gaps between model projections and market expectations.", SubscriptionTier.PREMIUM),
        Feature("props", "Player Props", "Research player lines, matchup context, and recent performance.", SubscriptionTier.PREMIUM),
        Feature("parlays", "Parlay God", "Explore curated parlay combinations with the research behind every leg.", SubscriptionTier.PREMIUM),
        Feature("cheats", "Cheat Sheets", "Find the strongest trends and prop opportunities in a quick, scannable view.", SubscriptionTier.PREMIUM),
        Feature("agents", "Personal AI Agents", "Build up to 30 agents around your strategies, with 8 active in your office.", SubscriptionTier.PRO),
        Feature("picks", "Agent Picks & Autopilot", "Get picks from your agents and let autopilot handle their daily research.", SubscriptionTier.PRO),
        Feature("leaderboard", "Full Agent Leaderboard", "Explore every rank, compare track records, and follow the agents you trust.", SubscriptionTier.PRO),
    )
}
