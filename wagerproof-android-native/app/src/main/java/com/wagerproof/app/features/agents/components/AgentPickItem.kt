package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.MLBTeams
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// =====================================================================
// AgentPickItem — compact "bet slip" row (RN port) + PickCardSkeleton.
// No live call sites; ported for parity. Port of iOS AgentPickItem.swift.
// =====================================================================

enum class ReasoningMode { None, Summary, Full }

private val accentGradient = listOf(
    Color(0xFF4F46E5), Color(0xFF06B6D4), Color(0xFF10B981), Color(0xFFF59E0B),
)
private val chipBlue = Color(0xFF3B82F6)

@Composable
fun AgentPickItem(
    pick: AgentPick,
    modifier: Modifier = Modifier,
    showReasoning: ReasoningMode = ReasoningMode.None,
    loading: Boolean = false,
    onTap: () -> Unit = {},
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.2f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .clickable(enabled = !loading) { onTap() },
    ) {
        Column(Modifier.fillMaxWidth()) {
            // 3pt accent top border.
            Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(accentGradient)))
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                HeaderRow(pick)
                PickPill(pick)
                if (showReasoning != ReasoningMode.None && pick.reasoningText.isNotEmpty()) {
                    ReasoningSection(pick, showReasoning)
                }
            }
        }
        if (loading) {
            Box(
                Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)).background(Color.Black.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = Color.White)
            }
        }
    }
}

@Composable
private fun HeaderRow(pick: AgentPick) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        MatchupTitle(pick, Modifier.weight(1f, fill = false))
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            DateBadge(pick.gameDate)
            ResultBadge(pick.result)
        }
    }
}

@Composable
private fun DateBadge(gameDate: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier = Modifier.clip(CircleShape).background(AppColors.appBorder.copy(alpha = 0.5f)).padding(horizontal = 7.dp, vertical = 3.dp),
    ) {
        Icon(agentSymbol("clock"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(10.dp))
        Text(formatItemGameDate(gameDate), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ResultBadge(result: AgentPick.PickResultStatus) {
    val (symbol, label, color) = when (result) {
        AgentPick.PickResultStatus.WON -> Triple("checkmark", "WIN", Color(0xFF22C55E))
        AgentPick.PickResultStatus.LOST -> Triple("xmark", "LOSS", Color(0xFFEF4444))
        AgentPick.PickResultStatus.PUSH -> Triple("minus", "PUSH", Color(0xFFEAB308))
        AgentPick.PickResultStatus.PENDING -> return
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier = Modifier.clip(CircleShape).background(color).padding(horizontal = 7.dp, vertical = 3.dp),
    ) {
        Icon(agentSymbol(symbol), null, tint = Color.White, modifier = Modifier.size(10.dp))
        Text(label, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun MatchupTitle(pick: AgentPick, modifier: Modifier = Modifier) {
    val matchup = parsedMLBMatchup(pick)
    if (matchup != null) {
        Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            CompactTeam(matchup.first, logoSize = 20.dp, textSize = 13.sp)
            Text("@", color = AppColors.appTextMuted, fontSize = 12.sp, fontWeight = FontWeight.Black)
            CompactTeam(matchup.second, logoSize = 20.dp, textSize = 13.sp)
        }
    } else {
        Text(pick.matchup, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = modifier)
    }
}

@Composable
private fun PickPill(pick: AgentPick) {
    val icon = pickPillIcon(pick)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appBorder.copy(alpha = 0.35f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Box(Modifier.size(30.dp).clip(CircleShape).background(icon.second), contentAlignment = Alignment.Center) {
            Icon(agentSymbol(icon.first), null, tint = Color.White, modifier = Modifier.size(16.dp))
        }
        PickSelectionDisplay(pick, Modifier.weight(1f, fill = false))
        Spacer(Modifier.weight(1f))
        val odds = pick.odds
        if (odds != null && odds.isNotEmpty()) {
            Text(
                odds, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace,
                modifier = Modifier.clip(CircleShape).background(AppColors.appBorder.copy(alpha = 0.6f)).padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        Text(
            String.format(Locale.US, "%.0fu", pick.units),
            color = chipBlue, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace,
            modifier = Modifier.clip(CircleShape).background(chipBlue.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun PickSelectionDisplay(pick: AgentPick, modifier: Modifier = Modifier) {
    val compact = compactMLBPick(pick)
    if (compact != null) {
        Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            CompactTeam(compact.first, logoSize = 24.dp, textSize = 15.sp)
            Text(compact.second, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    } else {
        Text(pick.pickSelection, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = modifier)
    }
}

@Composable
private fun CompactTeam(team: MLBPickTeam, logoSize: Dp, textSize: androidx.compose.ui.unit.TextUnit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        val url = team.logoUrl
        if (url != null) {
            AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.size(logoSize))
        } else {
            Box(Modifier.size(logoSize).clip(CircleShape).background(AppColors.appSurfaceMuted), contentAlignment = Alignment.Center) {
                Text(team.abbr.take(2), color = AppColors.appTextSecondary, fontSize = (logoSize.value * 0.4f).sp, fontWeight = FontWeight.Black)
            }
        }
        Text(team.abbr, color = AppColors.appTextPrimary, fontSize = textSize, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

@Composable
private fun ReasoningSection(pick: AgentPick, mode: ReasoningMode) {
    Column(Modifier.fillMaxWidth().padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
        Text("SUMMARY", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
        Text(
            pick.reasoningText, color = AppColors.appTextSecondary, fontSize = 14.sp,
            maxLines = if (mode == ReasoningMode.Summary) 2 else Int.MAX_VALUE, overflow = TextOverflow.Ellipsis,
        )
        val factors = pick.keyFactors
        if (mode == ReasoningMode.Full && !factors.isNullOrEmpty()) {
            Text("KEY FACTORS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                factors.forEach { factor ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.padding(top = 6.dp).size(5.dp).clip(CircleShape).background(chipBlue))
                        Text(factor, color = AppColors.appTextSecondary, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

// MARK: - Skeleton

@Composable
fun PickCardSkeleton(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.2f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.4f), RoundedCornerShape(12.dp)),
    ) {
        Column(Modifier.fillMaxWidth()) {
            Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(accentGradient.map { it.copy(alpha = 0.5f) })))
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp).shimmering(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    SkeletonBlock(height = 14.dp, width = 130.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonCapsule(height = 18.dp, width = 58.dp)
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(AppColors.appBorder.copy(alpha = 0.25f))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                ) {
                    SkeletonCircle(30.dp)
                    SkeletonBlock(height = 15.dp, width = 110.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonCapsule(height = 22.dp, width = 44.dp)
                    SkeletonCapsule(height = 22.dp, width = 34.dp)
                }
            }
        }
    }
}

// MARK: - MLB compact helpers

private data class MLBPickTeam(val name: String, val abbr: String, val logoUrl: String?)

private fun mlbPickTeam(raw: String): MLBPickTeam {
    val trimmed = raw.trim()
    MLBTeams.info(trimmed)?.let { return MLBPickTeam(trimmed, it.team, it.logoUrl) }
    return MLBPickTeam(trimmed, fallbackAbbr(trimmed), null)
}

private fun parsedMLBMatchup(pick: AgentPick): Pair<MLBPickTeam, MLBPickTeam>? {
    if (pick.sport != AgentSport.MLB) return null
    val parts = splitMatchupItem(pick.matchup)
    if (parts.size != 2) return null
    return mlbPickTeam(parts[0]) to mlbPickTeam(parts[1])
}

private fun compactMLBPick(pick: AgentPick): Pair<MLBPickTeam, String>? {
    if (pick.sport != AgentSport.MLB) return null
    if (isTotalPick(pick)) return null
    val matchup = parsedMLBMatchup(pick) ?: return null
    val team = selectedMLBTeam(pick, matchup) ?: return null
    return team to compactMLBMarketLabel(pick)
}

private fun isTotalPick(pick: AgentPick): Boolean {
    val h = "${pick.betType} ${pick.pickSelection}".lowercase()
    return h.contains("total") || h.contains("over") || h.contains("under")
}

private fun compactMLBMarketLabel(pick: AgentPick): String {
    val h = "${pick.betType} ${pick.pickSelection}".lowercase()
    val isF5 = h.contains("f5") || h.contains("first 5") || h.contains("first-five")
    val isML = h.contains("moneyline") || h.contains(" ml")
    if (isML) return if (isF5) "F5 ML" else "ML"
    if (h.contains("runline") || h.contains("run line") || h.contains("spread")) {
        val line = extractLine(pick.pickSelection) ?: extractLine(pick.betType)
        if (line != null) return if (isF5) "$line F5" else "$line Runline"
        return if (isF5) "F5 RL" else "Runline"
    }
    return pick.pickSelection
}

private fun selectedMLBTeam(pick: AgentPick, matchup: Pair<MLBPickTeam, MLBPickTeam>): MLBPickTeam? {
    val selection = normalizedItem(pick.pickSelection)
    val betType = normalizedItem(pick.betType)
    for (team in listOf(matchup.first, matchup.second)) {
        if (selectionMatches(team, selection) || selectionMatches(team, betType)) return team
    }
    return null
}

private fun selectionMatches(team: MLBPickTeam, text: String): Boolean {
    if (text.isEmpty()) return false
    val name = normalizedItem(team.name)
    val abbr = normalizedItem(team.abbr)
    val tokens = name.split(" ").filter { it.isNotEmpty() }
    val nickname = tokens.lastOrNull() ?: name
    val city = tokens.dropLast(1).joinToString(" ")
    return text.contains(name) ||
        (abbr.isNotEmpty() && text.contains(abbr)) ||
        (nickname.isNotEmpty() && text.contains(nickname)) ||
        (city.isNotEmpty() && text.contains(city))
}

private fun splitMatchupItem(matchup: String): List<String> {
    val separators = listOf(" @ ", " at ", " vs. ", " vs ", " v. ", " v ")
    for (sep in separators) {
        val parts = matchup.split(sep)
        if (parts.size == 2) return parts.map { it.trim() }
    }
    return emptyList()
}

private val lineRegex = Regex("([+-]\\d+(?:\\.\\d+)?)")

private fun extractLine(raw: String): String? = lineRegex.find(raw)?.groupValues?.getOrNull(1)

private fun normalizedItem(raw: String): String =
    raw.lowercase().replace(".", "").replace("-", " ").trim()

private fun fallbackAbbr(name: String): String {
    val words = name.split(" ").filter { it.isNotEmpty() }
    if (words.size >= 2) return words.mapNotNull { it.firstOrNull() }.joinToString("").uppercase()
    return name.take(3).uppercase()
}

private fun pickPillIcon(pick: AgentPick): Pair<String, Color> {
    val bt = pick.betType.lowercase()
    val sel = pick.pickSelection.lowercase()
    if (bt.contains("total") || bt.contains("over") || bt.contains("under")) {
        val isOver = sel.contains("over")
        return if (isOver) "arrow.up" to Color(0xFF22C55E) else "arrow.down" to Color(0xFFEF4444)
    }
    if (bt.contains("spread")) return "plusminus" to Color(0xFF3B82F6)
    if (bt.contains("moneyline") || bt.contains("ml")) return "dollarsign" to Color(0xFF10B981)
    return "arrow.up.arrow.down" to AppColors.appTextSecondary
}

private fun formatItemGameDate(s: String): String {
    if (s.isEmpty()) return "Pending"
    val date = try {
        LocalDate.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd"))
    } catch (_: Throwable) {
        return s
    }
    val today = LocalDate.now()
    return when (date) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        else -> date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
    }
}
