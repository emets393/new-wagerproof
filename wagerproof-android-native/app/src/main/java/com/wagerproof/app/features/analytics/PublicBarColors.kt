package com.wagerproof.app.features.analytics

import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.nfl.NFLTeamColors
import com.wagerproof.core.models.PublicMarket
import java.util.Locale
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Spread and moneyline bars use team colors. Totals stay Over green and Under blue.
 * A navy or black primary is lifted until it reads on the dark card, matching the website.
 */
object PublicBarColors {
    val over: Color = Color(0xFF10B981)
    val under: Color = Color(0xFF3B82F6)

    fun sides(sport: String, market: PublicMarket, away: String, home: String): Pair<Color, Color> {
        if (market == PublicMarket.total) return over to under
        val awayChoices = choices(brand(sport, away))
        val homeChoices = choices(brand(sport, home))
        val primaryAway = awayChoices[0]
        val primaryHome = homeChoices[0]
        if (distance(primaryAway, primaryHome) >= MIN_SEPARATION) return primaryAway to primaryHome

        var bestAway = primaryAway
        var bestHome = primaryHome
        var bestScore = distance(primaryAway, primaryHome)
        var bestRank = 0
        awayChoices.forEachIndexed { awayIndex, awayColor ->
            homeChoices.forEachIndexed { homeIndex, homeColor ->
                val score = distance(awayColor, homeColor)
                val rank = awayIndex + homeIndex
                val better = score > bestScore + 6 || (score >= bestScore - 6 && rank < bestRank)
                if (better) {
                    bestAway = awayColor
                    bestHome = homeColor
                    bestScore = score
                    bestRank = rank
                }
            }
        }
        if (bestScore >= MIN_SEPARATION) return bestAway to bestHome
        return bestAway to lift(bestHome)
    }

    fun canonicalCollege(name: String): String {
        val key = name.trim().lowercase(Locale.US).replace(".", "").replace("'", "").replace("  ", " ")
        return collegeAliases[key] ?: name
    }

    private fun brand(sport: String, name: String): TeamColorPair = when (sport) {
        "nfl" -> NFLTeamColors.colorPair(name)
        "nba" -> NBATeams.colorPair(name)
        else -> CFBTeamColors.colorPair(canonicalCollege(name))
    }

    private fun choices(pair: TeamColorPair): List<Color> {
        val seen = linkedSetOf<String>()
        val result = mutableListOf<Color>()
        for (color in listOf(visible(pair.primary), visible(pair.secondary))) {
            if (seen.add(fingerprint(color))) result += color
        }
        return result.ifEmpty { listOf(Color(0xFF94A3B8)) }
    }

    private fun visible(color: Color): Color {
        if (contrast(color) >= MIN_CONTRAST) return color
        var lo = 0.0
        var hi = 0.92
        repeat(14) {
            val mid = (lo + hi) / 2
            if (contrast(mix(color, mid)) >= MIN_CONTRAST) hi = mid else lo = mid
        }
        val lifted = mix(color, hi)
        return if (contrast(lifted) >= MIN_CONTRAST) lifted else mix(color, minOf(0.92, hi + 0.05))
    }

    private fun lift(color: Color): Color = visible(mix(color, 0.55))

    private fun mix(color: Color, amount: Double): Color {
        val (r, g, b) = channels(color)
        return Color(
            red = (r + (1 - r) * amount).toFloat(),
            green = (g + (1 - g) * amount).toFloat(),
            blue = (b + (1 - b) * amount).toFloat(),
        )
    }

    private fun distance(a: Color, b: Color): Double {
        val left = channels(a)
        val right = channels(b)
        val dr = (left.first - right.first) * 255
        val dg = (left.second - right.second) * 255
        val db = (left.third - right.third) * 255
        return sqrt(dr * dr + dg * dg + db * db)
    }

    private fun contrast(color: Color): Double {
        val left = luminance(channels(color))
        val right = luminance(Triple(CARD_R / 255.0, CARD_G / 255.0, CARD_B / 255.0))
        val lighter = maxOf(left, right)
        val darker = minOf(left, right)
        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun luminance(rgb: Triple<Double, Double, Double>): Double {
        fun linear(unit: Double) = if (unit <= 0.04045) unit / 12.92 else ((unit + 0.055) / 1.055).pow(2.4)
        return 0.2126 * linear(rgb.first) + 0.7152 * linear(rgb.second) + 0.0722 * linear(rgb.third)
    }

    private fun channels(color: Color) = Triple(color.red.toDouble(), color.green.toDouble(), color.blue.toDouble())

    private fun fingerprint(color: Color): String {
        val (r, g, b) = channels(color)
        return "${(r * 255).toInt()}-${(g * 255).toInt()}-${(b * 255).toInt()}"
    }

    private const val MIN_SEPARATION = 72.0
    private const val MIN_CONTRAST = 4.0
    private const val CARD_R = 17.0
    private const val CARD_G = 23.0
    private const val CARD_B = 37.0

    private val collegeAliases = mapOf(
        "middle tenn" to "Middle Tennessee",
        "s alabama" to "South Alabama",
        "n mexico state" to "New Mexico State",
        "e carolina" to "East Carolina",
        "umass" to "Massachusetts",
        "fl atlantic" to "Florida Atlantic",
        "w michigan" to "Western Michigan",
        "miami (fl)" to "Miami",
        "c michigan" to "Central Michigan",
        "boston col" to "Boston College",
        "ga tech" to "Georgia Tech",
        "s carolina" to "South Carolina",
        "n illinois" to "Northern Illinois",
        "k state" to "Kansas State",
        "e michigan" to "Eastern Michigan",
        "la-monroe" to "UL Monroe",
        "la tech" to "Louisiana Tech",
        "ok state" to "Oklahoma State",
        "va tech" to "Virginia Tech",
        "nd state" to "North Dakota State",
        "w kentucky" to "Western Kentucky",
        "n texas" to "North Texas",
        "s florida" to "South Florida",
        "s miss" to "Southern Miss",
        "c carolina" to "Coastal Carolina",
        "n carolina" to "North Carolina",
        "w virginia" to "West Virginia",
    )
}
