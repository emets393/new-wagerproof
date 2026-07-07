package com.wagerproof.app.features.nba

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NBAInjuryReport
import java.util.Locale

/**
 * NBA injury report widget for the game detail page — port of iOS
 * `NBAInjuryReportWidget`. Chromeless body: the hosting
 * [com.wagerproof.app.features.components.WidgetCollapsingSection] owns the
 * title + chevron; this renders per-team PLAYER|STATUS|PIE tables plus the
 * cumulative injury-impact footer.
 */
@Composable
fun NBAInjuryReportWidget(
    awayTeam: String,
    homeTeam: String,
    awayInjuries: List<NBAInjuryReport>,
    homeInjuries: List<NBAInjuryReport>,
    awayInjuryImpact: Double,
    homeInjuryImpact: Double,
    isLoading: Boolean,
    errorMessage: String?,
    expanded: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        when {
            isLoading -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
            }
            errorMessage != null -> ErrorState(errorMessage)
            expanded -> Content(awayTeam, homeTeam, awayInjuries, homeInjuries, awayInjuryImpact, homeInjuryImpact)
            else -> Text(
                "Tap to view injuries and impact scores",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun ErrorState(message: String) {
    Row(
        Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon.fromSystemName("exclamationmark.circle")?.let {
            Icon(it.imageVector, null, tint = AppColors.appAccentRed, modifier = Modifier.size(16.dp))
        }
        Text(message, color = AppColors.appAccentRed, fontSize = 13.sp)
    }
}

@Composable
private fun Content(
    awayTeam: String,
    homeTeam: String,
    awayInjuries: List<NBAInjuryReport>,
    homeInjuries: List<NBAInjuryReport>,
    awayInjuryImpact: Double,
    homeInjuryImpact: Double,
) {
    if (awayInjuries.isEmpty() && homeInjuries.isEmpty()) {
        Column(
            Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppIcon.fromSystemName("checkmark.circle")?.let {
                Icon(it.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(32.dp))
            }
            Text("No injuries reported for this matchup", color = AppColors.appTextSecondary, fontSize = 14.sp)
        }
        return
    }
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TeamColumn(awayTeam, awayInjuries, Modifier.weight(1f))
            TeamColumn(homeTeam, homeInjuries, Modifier.weight(1f))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
        ImpactFooter(awayTeam, homeTeam, awayInjuryImpact, homeInjuryImpact)
    }
}

@Composable
private fun TeamColumn(name: String, injuries: List<NBAInjuryReport>, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        GameCardTeamAvatar(sport = "nba", team = name, diameter = 40.dp, colors = NBATeams.colorPair(name))
        if (injuries.isEmpty()) {
            Text(
                "No injuries reported",
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 16.dp),
            )
        } else {
            InjuryTable(injuries)
        }
    }
}

@Composable
private fun InjuryTable(injuries: List<NBAInjuryReport>) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
            TableHeader("PLAYER", Modifier.weight(1f))
            TableHeader("STATUS", Modifier.weight(1f))
            TableHeader("PIE", Modifier.widthIn(min = 50.dp), TextAlign.End)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
        // Highest-impact players first — mirrors RN `sortByPIE`.
        injuries.sortedByDescending { it.pieValue ?: Double.NEGATIVE_INFINITY }.forEach { injury ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    formatPlayerName(injury.playerName),
                    color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium,
                    maxLines = 1, modifier = Modifier.weight(1f),
                )
                Text(
                    injury.status,
                    color = AppColors.appTextSecondary, fontSize = 10.sp,
                    maxLines = 1, modifier = Modifier.weight(1f),
                )
                Text(
                    formatPIE(injury.pieValue),
                    color = AppColors.appPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.End, modifier = Modifier.widthIn(min = 50.dp),
                )
            }
        }
    }
}

@Composable
private fun TableHeader(text: String, modifier: Modifier = Modifier, align: TextAlign = TextAlign.Start) {
    Text(
        text,
        color = AppColors.appTextSecondary,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = align,
        modifier = modifier,
    )
}

@Composable
private fun ImpactFooter(awayTeam: String, homeTeam: String, awayImpact: Double, homeImpact: Double) {
    Column(
        Modifier.fillMaxWidth().padding(top = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "CUMULATIVE INJURY IMPACT SCORE",
            color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
        )
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            ImpactScore(awayTeam, awayImpact, homeImpact)
            Spacer(Modifier.weight(1f))
            ImpactScore(homeTeam, homeImpact, awayImpact)
        }
    }
}

@Composable
private fun ImpactScore(team: String, my: Double, other: Double) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        GameCardTeamAvatar(sport = "nba", team = team, diameter = 32.dp, colors = NBATeams.colorPair(team))
        Text(
            String.format(Locale.US, "%.2f", my),
            color = impactColor(my, other),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** Lower (more negative) score = more injured = red; healthier side = green. */
private fun impactColor(my: Double, other: Double): Color = when {
    my < other -> AppColors.appAccentRed
    my > other -> AppColors.appPrimary
    else -> AppColors.appTextPrimary
}

private fun formatPlayerName(full: String): String {
    val parts = full.split(" ").filter { it.isNotEmpty() }
    if (parts.size < 2) return full
    val firstInitial = parts[0].take(1).uppercase(Locale.US)
    val last = parts.drop(1).joinToString(" ")
    return "$firstInitial. $last"
}

private fun formatPIE(value: Double?): String =
    value?.let { String.format(Locale.US, "%.4f", it) } ?: "N/A"
