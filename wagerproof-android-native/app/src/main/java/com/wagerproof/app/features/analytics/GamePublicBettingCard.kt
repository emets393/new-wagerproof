package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.PublicBettingGame
import com.wagerproof.core.models.PublicCategory
import com.wagerproof.core.models.PublicMarket
import com.wagerproof.core.models.PublicMarketRead
import com.wagerproof.core.models.PublicSide
import com.wagerproof.core.services.PublicBettingService

private val cardMarkets = listOf(PublicMarket.spread, PublicMarket.ml, PublicMarket.total)

/**
 * Game-page public-betting card. Loads the Action Network board, finds this
 * matchup, and reuses the public-betting bars and line rail.
 */
@Composable
fun GamePublicBettingCard(
    sport: String,
    awayTeam: String,
    homeTeam: String,
    awayColor: Color,
    homeColor: Color,
    modifier: Modifier = Modifier,
    gameDate: String? = null,
) {
    var matched by remember(sport, awayTeam, homeTeam, gameDate) { mutableStateOf<PublicBettingGame?>(null) }
    var phase by remember(sport, awayTeam, homeTeam, gameDate) { mutableStateOf(LoadPhase.Loading) }
    var market by remember(sport, awayTeam, homeTeam, gameDate) { mutableStateOf(PublicMarket.spread) }

    LaunchedEffect(sport, awayTeam, homeTeam, gameDate) {
        phase = LoadPhase.Loading
        val board = runCatching { PublicBettingService.loadBoard() }.getOrDefault(emptyList())
        val found = PublicGameMatch.find(board, sport, awayTeam, homeTeam, gameDate)
        matched = found
        phase = if (found == null) LoadPhase.Empty else LoadPhase.Ready
        if (found != null) {
            market = cardMarkets.firstOrNull { found.reads[it] != null } ?: PublicMarket.spread
        }
    }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        MarketSwitcher(market) { market = it }
        when (phase) {
            LoadPhase.Loading -> Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
            }
            LoadPhase.Empty -> Text(
                "No public betting splits for this game yet.",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            LoadPhase.Ready -> {
                val game = matched
                val read = game?.reads?.get(market)
                if (game != null && read != null) {
                    DivergenceBars(game, market, read, awayColor, homeColor)
                    LineRail(game, market, read, railColor(read, awayColor, homeColor))
                } else {
                    Text(
                        "No ${market.noun} splits for this game yet.",
                        color = AppColors.appTextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}

@Composable
private fun MarketSwitcher(selected: PublicMarket, onSelect: (PublicMarket) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(AppColors.appTextPrimary.copy(alpha = 0.06f))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        cardMarkets.forEach { item ->
            val on = item == selected
            Text(
                item.label,
                color = if (on) AppColors.appSurface else AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (on) AppColors.appTextPrimary else Color.Transparent)
                    .clickable { onSelect(item) }
                    .padding(vertical = 7.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

private fun railColor(read: PublicMarketRead, awayColor: Color, homeColor: Color): Color {
    val confirm = if (read.moneyTiltSide == PublicSide.home) homeColor else awayColor
    val arrow = when (read.movedToward) {
        PublicSide.away -> awayColor
        PublicSide.home -> homeColor
        null -> AppColors.appTextSecondary
    }
    return if (read.category == PublicCategory.sharpMoney) confirm else arrow
}

private enum class LoadPhase { Loading, Ready, Empty }

object PublicGameMatch {
    fun find(
        games: List<PublicBettingGame>,
        sport: String,
        away: String,
        home: String,
        date: String?,
    ): PublicBettingGame? {
        val sportKey = sport.lowercase()
        var best: Pair<PublicBettingGame, Int>? = null
        for (game in games) {
            if (game.sport.lowercase() != sportKey) continue
            val awayDirect = teamScore(game.away, away, sportKey)
            val homeDirect = teamScore(game.home, home, sportKey)
            val awaySwap = teamScore(game.away, home, sportKey)
            val homeSwap = teamScore(game.home, away, sportKey)
            val directTotal = if (awayDirect > 0 && homeDirect > 0) awayDirect + homeDirect else 0
            val swapTotal = if (awaySwap > 0 && homeSwap > 0) awaySwap + homeSwap else 0
            var total = maxOf(directTotal, swapTotal)
            if (total == 0) continue
            if (date != null && game.startTime?.contains(date) == true) total += 30
            if (best == null || total > best.second) best = game to total
        }
        return best?.first
    }

    private fun teamScore(board: String, page: String, sport: String): Int {
        val left = normalize(board)
        val right = normalize(page)
        if (left.isEmpty() || right.isEmpty()) return 0
        if (left == right) return 100
        if (sport == "nba") {
            val code = NBATeams.knownAbbreviation(board)
            if (code != null && code == NBATeams.knownAbbreviation(page)) return 90
        }
        if (sport == "nfl" && NFLTeamAssets.abbr(board) == NFLTeamAssets.abbr(page)) return 90
        if ((sport == "cfb" || sport == "ncaab") &&
            CFBTeamAssets.team(board) != null &&
            CFBTeamAssets.team(page) != null &&
            CFBTeamAssets.abbr(board) == CFBTeamAssets.abbr(page)
        ) {
            return 90
        }
        if (left.length >= 5 && right.contains(left)) return 70
        if (right.length >= 5 && left.contains(right)) return 70
        val leftLast = left.substringAfterLast(' ')
        val rightLast = right.substringAfterLast(' ')
        if (leftLast.length >= 5 && leftLast == rightLast) return 60
        return 0
    }

    private fun normalize(value: String): String =
        value.trim().lowercase().replace(".", "").replace("'", "").replace("&", "and")
}
