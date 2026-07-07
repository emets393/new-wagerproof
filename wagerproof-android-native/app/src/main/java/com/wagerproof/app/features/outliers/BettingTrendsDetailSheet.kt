package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors

/** Which "How to Use This Tool" copy variant to render. */
enum class TrendsGuide { mlb, basketball }

/**
 * Per-game situational betting trends detail sheet, shared by the MLB, NBA, and
 * NCAAB trends surfaces. Header card → optional demoted "View matchup" action →
 * full [TrendsMatrixView] → "How to Use" guide. Port of iOS
 * BettingTrendsDetailSheet.swift (a `.large`-detent modal sheet).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BettingTrendsDetailSheet(
    awayName: String,
    homeName: String,
    timeDisplay: String?,
    stripeColors: List<Color>,
    accent: Color,
    sections: List<TrendsMatrixSection>,
    guide: TrendsGuide,
    avatar: @Composable (TrendsTeamSide, Dp) -> Unit,
    onDismiss: () -> Unit,
    onViewMatchup: (() -> Unit)? = null,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
        dragHandle = null,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HeaderCard(awayName, homeName, timeDisplay, stripeColors, accent, avatar, onViewMatchup)
            TrendsMatrixView(sections = sections, accent = accent, avatar = avatar)
            HowToUseSection(guide)
            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun HeaderCard(
    awayName: String,
    homeName: String,
    timeDisplay: String?,
    stripeColors: List<Color>,
    accent: Color,
    avatar: @Composable (TrendsTeamSide, Dp) -> Unit,
    onViewMatchup: (() -> Unit)?,
) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .liquidGlassBackground(shape, hairline = true),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(Brush.horizontalGradient(stripeColors.ifEmpty { listOf(accent, accent) })),
        )
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Situational Betting Trends", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TeamColumn(Modifier.weight(1f), TrendsTeamSide.away, awayName, avatar)
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("@", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary.copy(alpha = 0.5f))
                    if (!timeDisplay.isNullOrEmpty()) {
                        Text(
                            timeDisplay,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.appTextSecondary,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(AppColors.appSurfaceMuted)
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
                TeamColumn(Modifier.weight(1f), TrendsTeamSide.home, homeName, avatar)
            }
            if (onViewMatchup != null) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.12f))
                        .clickable(onClick = onViewMatchup)
                        .padding(vertical = 9.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(outlierSymbol("arrow.up.right.square"), null, tint = accent, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("View matchup", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = accent)
                }
            }
        }
    }
}

@Composable
private fun TeamColumn(
    modifier: Modifier,
    side: TrendsTeamSide,
    name: String,
    avatar: @Composable (TrendsTeamSide, Dp) -> Unit,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        avatar(side, 64.dp)
        Text(
            name,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

@Composable
private fun HowToUseSection(guide: TrendsGuide) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .liquidGlassBackground(shape, hairline = true)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                outlierSymbol("book.fill"),
                null,
                tint = if (guide == TrendsGuide.mlb) hexColor(0x16A34AL) else AppColors.appAccentBlue,
                modifier = Modifier.size(18.dp),
            )
            Text("How to Use This Tool", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        when (guide) {
            TrendsGuide.mlb -> {
                GuideBlock(
                    "Win % (Moneyline)",
                    "Win percentage shows how often each team wins outright in this situation.\n\n• Strong signal: One team ≥60%, other ≤45% (≥15pt gap)\n• Key insight: Contrast matters — a big gap between teams suggests moneyline value",
                )
                GuideBlock(
                    "Over % (Totals)",
                    "• Strong Over: Both teams ≥55% Over rate\n• Strong Under: Both teams ≤45% Over rate\n• Key insight: For totals, alignment matters — both must lean the same way",
                )
            }
            TrendsGuide.basketball -> {
                GuideBlock(
                    "ATS (Against The Spread)",
                    "ATS means betting on whether a team will \"cover\" the point spread — win by more than the spread (favorites) or lose by less than the spread (underdogs).\n\n• Strong signal: One team ≥60% ATS, other ≤45% (≥15pt difference)\n• Weak/No signal: Both teams 48-55% or both strong\n• Key insight: For ATS, contrast matters more than alignment",
                )
                GuideBlock(
                    "Over/Under (Totals)",
                    "• Strong Over: Both teams ≥60% Over rate\n• Strong Under: Both teams ≥60% Under rate\n• No signal: One team leans Over, other leans Under\n• Key insight: For totals, alignment matters — both must agree",
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Color Legend", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            LegendRow(hexColor(0x22C55EL), "≥55% — Strong trend")
            LegendRow(hexColor(0xEAB308L), "45-54% — Neutral")
            LegendRow(hexColor(0xEF4444L), "<45% — Weak/Fade")
        }
        when (guide) {
            TrendsGuide.mlb -> GuideBlock(
                "Quick Tips",
                "• Multiple situations aligning increases confidence\n• Rest and home/away are especially impactful in baseball\n• Division games carry familiarity edge — pitchers face same lineups more\n• Park factors can shift totals — pair with weather data on game cards",
            )
            TrendsGuide.basketball -> GuideBlock(
                "Quick Tips",
                "• Require ≥4 game sample size for reliable signals\n• Multiple situations aligning increases confidence\n• Role-based trends (home favorite, away dog) are most predictive\n• Rest advantages amplify existing ATS edges",
            )
        }
    }
}

@Composable
private fun GuideBlock(title: String, body: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        Text(body, fontSize = 12.sp, color = AppColors.appTextSecondary, lineHeight = 16.sp)
    }
}

@Composable
private fun LegendRow(color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(text, fontSize = 12.sp, color = AppColors.appTextSecondary)
    }
}
