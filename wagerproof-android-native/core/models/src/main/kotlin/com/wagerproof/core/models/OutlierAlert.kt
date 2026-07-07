package com.wagerproof.core.models

/**
 * Lightweight summary of a game emitted by the Outliers feed (client-built,
 * never serialized). Only the columns the outliers screen actually renders
 * are surfaced here; per-sport sheets re-hydrate the full row themselves.
 */
data class OutlierGame(
    val gameId: String,
    val sport: SportLeague,
    val awayTeam: String,
    val homeTeam: String,
    val gameTime: String? = null,
    val awaySpread: Double? = null,
    val homeSpread: Double? = null,
    val totalLine: Double? = null,
    val awayMl: Int? = null,
    val homeMl: Int? = null,
    val awayTeamLogo: String? = null,
    val homeTeamLogo: String? = null,
    val awayTeamAbbrev: String? = null,
    val homeTeamAbbrev: String? = null,
    // Model-derived signals merged in during prediction hydration.
    val homeAwaySpreadCoverProb: Double? = null,
    val ouResultProb: Double? = null,
    val homeAwayMlProb: Double? = null,
    val homeSpreadDiff: Double? = null,
    val overLineDiff: Double? = null,
) {
    val id: String get() = gameId
}

/**
 * Prediction-market value alert: Polymarket consensus crossing a threshold
 * for a side the sportsbook hasn't repriced yet.
 */
data class OutlierValueAlert(
    val gameId: String,
    val sport: SportLeague,
    val awayTeam: String,
    val homeTeam: String,
    val marketType: MarketType,
    val side: String,
    val percentage: Double,
    val game: OutlierGame,
) {
    // ⚠️ Capitalized raws — id strings must match iOS exactly.
    enum class MarketType(val raw: String) {
        SPREAD("Spread"),
        TOTAL("Total"),
        MONEYLINE("Moneyline"),
    }

    val id: String get() = "$gameId-${marketType.raw}-$side"
}

/**
 * Model fade alert: the model is extremely confident on a side; backtesting
 * says fading high-confidence picks has historically been more profitable.
 */
data class OutlierFadeAlert(
    val gameId: String,
    val sport: SportLeague,
    val awayTeam: String,
    val homeTeam: String,
    val pickType: PickType,
    val predictedTeam: String,
    val confidence: Int,
    val game: OutlierGame,
) {
    enum class PickType(val raw: String) {
        SPREAD("Spread"),
        TOTAL("Total"),
    }

    val id: String get() = "$gameId-${pickType.raw}-$predictedTeam"
}
