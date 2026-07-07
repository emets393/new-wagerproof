package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NFLTeamAssets

/**
 * Simple gradient-disc avatar — port of iOS `GameCardTeamAvatar.swift`. Used by
 * heroes, chips, trend rows, and detail tables (everywhere except the glass
 * avatar in `GameRowCard`). Logo resolves by sport.
 */
@Composable
fun GameCardTeamAvatar(
    sport: String,
    team: String,
    diameter: Dp,
    modifier: Modifier = Modifier,
    colors: TeamColorPair = defaultColors(sport, team),
    logoURL: String? = resolveLogo(sport, team),
) {
    Box(
        modifier
            .size(diameter)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(colors.primary, colors.secondary)))
            .border(2.dp, colors.secondary, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = logoURL,
            contentDescription = team,
            modifier = Modifier.size(diameter).padding(diameter * 0.12f),
            error = {
                Text(
                    TeamInitials.from(team),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = (diameter.value * 0.36f).sp,
                )
            },
        )
    }
}

/** Logo URL resolution by sport (matches iOS `logoURL(for:sport:)`). */
fun resolveLogo(sport: String, team: String): String? = when (sport.lowercase()) {
    "nfl" -> NFLTeamAssets.logo(team)
    "cfb", "ncaaf" -> CFBTeamAssets.logo(team)
    "mlb" -> MLBTeams.logoUrl(team)
    else -> null
}

fun defaultColors(sport: String, team: String): TeamColorPair = when (sport.lowercase()) {
    "nfl" -> FallbackTeamColor.colorPair(team)
    "cfb", "ncaaf" -> CFBTeamColors.colorPair(team)
    "mlb" -> MLBTeamColors.colorPair(team)
    "nba" -> NBATeams.colorPair(team)
    else -> FallbackTeamColor.colorPair(team)
}
