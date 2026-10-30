package com.wagerproof.app.features.games.tools

import androidx.compose.ui.graphics.Color
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.OutliersStore

/**
 * A per-sport analytics "tool" surfaced as a promo banner on the Games page and
 * routed (via [ToolRouter]) to the same leaf page as the Outliers hub. iOS
 * `Games/Tools/SportTool`.
 */
data class SportTool(
    val id: String,
    val sport: GamesStore.Sport,
    val title: String,
    val subtitle: String,
    val actionWord: String,
    val primaryColor: Color,
    val secondaryColor: Color,
    val symbols: List<String>,
    val seed: Double,
    val speedFactor: Double,
    val yJitter: Float,
    /** The tool's leaf page, shared with the Outliers hub. */
    val category: OutliersStore.Category,
) {
    companion object {
        /** Per-sport tool inventory. Accents mirror each tool's page accent. */
        val registry: Map<GamesStore.Sport, List<SportTool>> = mapOf(
            GamesStore.Sport.nfl to listOf(
                publicBetting(GamesStore.Sport.nfl, OutliersStore.Category.nflPublicBetting, "football.fill", 0.22),
                SportTool(
                    id = "nfl-historical-trends", sport = GamesStore.Sport.nfl,
                    title = "NFL Historical Trends", subtitle = "See how any bet type has performed",
                    actionWord = "Open",
                    primaryColor = Color(0xFF3B82F6), secondaryColor = Color(0xFF93C5FD),
                    symbols = listOf("chart.bar.fill", "chart.line.uptrend.xyaxis", "calendar", "football.fill", "percent", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"),
                    seed = 0.41, speedFactor = 0.98, yJitter = -0.02f,
                    category = OutliersStore.Category.nflHistoricalAnalysis,
                ),
            ),
            GamesStore.Sport.cfb to listOf(
                publicBetting(GamesStore.Sport.cfb, OutliersStore.Category.cfbPublicBetting, "graduationcap.fill", 0.28),
                SportTool(
                    id = "cfb-historical-trends", sport = GamesStore.Sport.cfb,
                    title = "CFB Historical Trends", subtitle = "See how any bet type has performed",
                    actionWord = "Open",
                    primaryColor = Color(0xFFF59E0B), secondaryColor = Color(0xFFFCD34D),
                    symbols = listOf("chart.bar.fill", "chart.line.uptrend.xyaxis", "calendar", "graduationcap.fill", "percent", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"),
                    seed = 0.52, speedFactor = 1.0, yJitter = -0.02f,
                    category = OutliersStore.Category.cfbHistoricalAnalysis,
                ),
            ),
            GamesStore.Sport.mlb to listOf(
                // Trends first, matching iOS's MLB tool order — MLB is the only
                // in-season sport, so this banner is the app's entry point to
                // Historical Trends for most of the year.
                SportTool(
                    id = "mlb-historical-trends", sport = GamesStore.Sport.mlb,
                    title = "MLB Historical Trends", subtitle = "Situational hit rates, F5, matching games",
                    actionWord = "Open",
                    primaryColor = Color(0xFF3B82F6), secondaryColor = Color(0xFF4ADE80),
                    // "baseball" not iOS's "baseball.fill": AppIcon has no `.fill`
                    // variant for it, and an unmapped name silently renders as a
                    // sparkle in the drift field.
                    symbols = listOf("chart.bar.fill", "chart.line.uptrend.xyaxis", "baseball", "percent", "calendar", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"),
                    seed = 0.48, speedFactor = 0.99, yJitter = -0.02f,
                    category = OutliersStore.Category.mlbHistoricalAnalysis,
                ),
                SportTool(
                    id = "mlb-regression-report", sport = GamesStore.Sport.mlb,
                    title = "MLB Regression Report", subtitle = "AI narrative + suggested picks",
                    actionWord = "Open",
                    primaryColor = Color(0xFFA855F7), secondaryColor = Color(0xFFC9A0FB),
                    symbols = listOf("chart.bar.xaxis", "function", "waveform.path.ecg", "brain.head.profile", "sparkles", "chart.xyaxis.line", "arrow.triangle.2.circlepath", "bolt.fill", "flame.fill", "star.fill"),
                    seed = 0.37, speedFactor = 0.96, yJitter = -0.03f,
                    category = OutliersStore.Category.mlbRegression,
                ),
            ),
            GamesStore.Sport.nba to listOf(
                publicBetting(GamesStore.Sport.nba, OutliersStore.Category.nbaPublicBetting, "basketball", 0.19),
            ),
            GamesStore.Sport.ncaab to listOf(
                publicBetting(GamesStore.Sport.ncaab, OutliersStore.Category.ncaabPublicBetting, "basketball", 0.24),
                SportTool(
                    id = "ncaab-model-accuracy", sport = GamesStore.Sport.ncaab,
                    title = "NCAAB Model Accuracy", subtitle = "The model's college track record",
                    actionWord = "Open",
                    primaryColor = Color(0xFFF97316), secondaryColor = Color(0xFFFBA864),
                    symbols = listOf("target", "scope", "checkmark.seal.fill", "chart.bar.fill", "percent", "graduationcap.fill", "gauge.high", "chart.xyaxis.line", "bolt.fill", "star.fill"),
                    seed = 0.59, speedFactor = 1.03, yJitter = -0.02f,
                    category = OutliersStore.Category.ncaabAccuracy,
                ),
            ),
        )

        private fun publicBetting(
            sport: GamesStore.Sport,
            category: OutliersStore.Category,
            symbol: String,
            seed: Double,
        ) = SportTool(
            id = "${sport.name}-public-betting",
            sport = sport,
            title = "Public Betting",
            subtitle = "Tickets, money, and which way the line moved",
            actionWord = "Open",
            primaryColor = Color(0xFF10B981),
            secondaryColor = Color(0xFF6EE7B7),
            symbols = listOf("chart.bar.fill", "arrow.left.arrow.right", "dollarsign.circle.fill", "person.3.fill", symbol, "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"),
            seed = seed,
            speedFactor = 0.97,
            yJitter = -0.02f,
            category = category,
        )

        /** Tools for a sport (empty for sports without tools). */
        fun tools(sport: GamesStore.Sport): List<SportTool> = registry[sport] ?: emptyList()
    }
}
