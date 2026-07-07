package com.wagerproof.app.features.games.tools

import androidx.compose.ui.graphics.Color
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.OutliersStore

/**
 * A per-sport analytics "tool" surfaced as a promo banner on the Games page and
 * routed (via [ToolRouter]) to the same leaf page as the Outliers hub. iOS
 * `Games/Tools/SportTool`. NFL/CFB have no tools.
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
            GamesStore.Sport.mlb to listOf(
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
                SportTool(
                    id = "nba-model-accuracy", sport = GamesStore.Sport.nba,
                    title = "NBA Model Accuracy", subtitle = "Track record on today's slate",
                    actionWord = "Open",
                    primaryColor = Color(0xFF14B8A6), secondaryColor = Color(0xFF5FD6C9),
                    symbols = listOf("target", "scope", "checkmark.seal.fill", "chart.bar.fill", "percent", "basketball.fill", "gauge.high", "chart.xyaxis.line", "bolt.fill", "star.fill"),
                    seed = 0.44, speedFactor = 1.02, yJitter = -0.03f,
                    category = OutliersStore.Category.nbaAccuracy,
                ),
            ),
            GamesStore.Sport.ncaab to listOf(
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

        /** Tools for a sport (empty for sports without tools). */
        fun tools(sport: GamesStore.Sport): List<SportTool> = registry[sport] ?: emptyList()
    }
}
