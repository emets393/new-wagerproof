package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * JSON payload persisted for the home-screen widgets — port of iOS
 * `WagerproofModels/WidgetDataPayload.swift`, itself mirroring
 * `wagerproof-mobile/modules/widget-data-bridge/src/WidgetDataBridge.ts`.
 *
 * The schema is intentionally a JSON-friendly grab bag: fields not in scope
 * for a given sync are left untouched (read-modify-write) so each domain
 * (editor picks, fade alerts, polymarket values, top agent picks, outliers)
 * refreshes independently.
 *
 * All field names match the RN bridge byte-for-byte (camelCase) — the payload
 * is a cross-platform contract, so never rename.
 */
@Serializable
data class WidgetDataPayload(
    val editorPicks: List<EditorPickForWidget> = emptyList(),
    val fadeAlerts: List<FadeAlertForWidget> = emptyList(),
    val polymarketValues: List<PolymarketValueForWidget> = emptyList(),
    val topAgentPicks: List<TopAgentWidgetData> = emptyList(),
    /**
     * Top outliers (value + fade alerts, ranked by confidence) for the native
     * "Top Outliers" widget. Additive field — old RN-shipped widgets don't
     * round-trip it.
     */
    val topOutliers: List<OutlierAlertForWidget> = emptyList(),
    /**
     * Configurable Outliers market groups. Each widget instance persists one
     * [OutliersWidgetMarketData.id] and renders that market's strongest rows.
     * Additive: payloads written before the configurable widget shipped decode
     * with an empty list and continue to expose [topOutliers].
     */
    val outlierMarkets: List<OutliersWidgetMarketData> = emptyList(),
    /**
     * Schema marker for [outlierMarkets]. Version zero means the payload
     * predates configurable markets, so the widget may still render the
     * legacy [topOutliers] slice. Version one or newer means an empty market
     * list is authoritative and must render as an empty state instead of
     * silently switching to unrelated value/fade alerts.
     */
    val outlierMarketsVersion: Int = 0,
    val lastUpdated: String = "",
) {
    companion object {
        fun empty() = WidgetDataPayload()
    }
}

/** One selectable market in the configurable Top Outliers widget. */
@Serializable
data class OutliersWidgetMarketData(
    val id: String,
    val title: String,
    /** iOS SF Symbol name retained as a cross-platform semantic icon key. */
    val symbolName: String,
    val items: List<OutliersWidgetItem>,
    /** Count before the payload's per-market item cap. */
    val totalCount: Int,
)

/**
 * Glanceable projection of an Outliers trend card or a Parlay God ticket.
 * Fractions always come from live trend samples; the widget never invents a
 * streak or recalculates the underlying analysis.
 */
@Serializable
data class OutliersWidgetItem(
    val id: String,
    val sport: String,
    val matchup: String,
    val subject: String,
    val selection: String,
    val oddsText: String? = null,
    val hitCount: Int,
    val sampleSize: Int,
    val additionalTrendCount: Int = 0,
) {
    val fractionText: String get() = "$hitCount/$sampleSize"
}

/**
 * Lightweight widget projection of an Outliers alert — combines value alerts
 * (market money on a side) and fade alerts (model disagrees with the line)
 * into one rankable shape via [kind].
 */
@Serializable
data class OutlierAlertForWidget(
    val id: String,
    val kind: Kind,
    val sport: String,
    val awayTeam: String,
    val homeTeam: String,
    val marketType: String,
    /** The side/selection this alert is about (team name, "Over"/"Under"). */
    val side: String,
    /**
     * Value alerts: market percentage on [side]. Fade alerts: model confidence
     * (0-100) or point-delta depending on sport — same ambiguity as upstream.
     */
    val confidence: Int,
    val gameTime: String? = null,
) {
    @Serializable
    enum class Kind {
        @SerialName("value")
        VALUE,

        @SerialName("fade")
        FADE,
    }
}

/** Mirrors `EditorPickForWidget` in the RN bridge. */
@Serializable
data class EditorPickForWidget(
    val id: String,
    val gameType: String,
    val awayTeam: String,
    val homeTeam: String,
    val pickValue: String? = null,
    val bestPrice: String? = null,
    val sportsbook: String? = null,
    val units: Double? = null,
    val result: String? = null,
    val gameDate: String? = null,
)

/** Mirrors `FadeAlertForWidget` in the RN bridge. */
@Serializable
data class FadeAlertForWidget(
    val gameId: String,
    val sport: String,
    val awayTeam: String,
    val homeTeam: String,
    val pickType: String,
    val predictedTeam: String,
    val confidence: Double,
    val gameTime: String? = null,
)

/** Mirrors `PolymarketValueForWidget` in the RN bridge. */
@Serializable
data class PolymarketValueForWidget(
    val gameId: String,
    val sport: String,
    val awayTeam: String,
    val homeTeam: String,
    val marketType: String,
    val side: String,
    val percentage: Double,
)

/** Mirrors `AgentPickForWidget` in the RN bridge. */
@Serializable
data class AgentPickForWidget(
    val id: String,
    val sport: String,
    val matchup: String,
    val pickSelection: String,
    val odds: String? = null,
    val result: String? = null,
    val gameDate: String? = null,
)

/**
 * Mirrors `TopAgentWidgetData` in the RN bridge — an agent's identity +
 * cached performance summary + up to N representative picks.
 *
 * This is the ONE declaration; `TopAgentsWidgetService` used to keep a private
 * twin, which is how the widget lost fields the service already had. Every field
 * name is a cross-platform wire contract — never rename one.
 */
@Serializable
data class TopAgentWidgetData(
    val agentId: String,
    val agentName: String,
    val agentEmoji: String,
    val agentColor: String,
    val isFavorite: Boolean,
    val netUnits: Double,
    val winRate: Double? = null,
    val currentStreak: Int,
    /** Longest run the agent has ever put together — the widget's "BEST n" label. */
    val bestStreak: Int = 0,
    val record: String,
    val picks: List<AgentPickForWidget> = emptyList(),
    /**
     * Owner-picked pixel-office character (0…7). Null in payloads written before
     * the column was projected — read [resolvedSpriteIndex], never this.
     */
    val spriteIndex: Int? = null,
    /**
     * Cumulative recent graded-pick results (win +1 / loss −1 / push holds) for
     * the small tile's form sparkline. Empty = draw a flat baseline, never
     * invented movement.
     */
    val form: List<Double> = emptyList(),
) {
    /** [spriteIndex] when the payload carries a valid one, else the stable hash of the id. */
    val resolvedSpriteIndex: Int
        get() = spriteIndex?.takeIf { it in 0..7 } ?: AgentSpriteIndex.forSeed(agentId)
}
