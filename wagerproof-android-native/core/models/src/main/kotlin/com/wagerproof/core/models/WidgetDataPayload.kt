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
    val lastUpdated: String = "",
) {
    companion object {
        fun empty() = WidgetDataPayload()
    }
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
    val record: String,
    val picks: List<AgentPickForWidget> = emptyList(),
)
