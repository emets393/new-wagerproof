package com.wagerproof.app.features.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/** Fade-alert bet type (kept for API parity; copy is identical). */
enum class FadeBetType { SPREAD, TOTAL }

private val Amber = Color(0xFFF59E0B)
private val Green = Color(0xFF22C55E)

/**
 * Fade-alert card — port of iOS `Components/FadeAlertTooltip.swift`. Used by
 * NBA (live trigger at a 9.5-pt model/market gap) and NCAAB (wired, dormant).
 *
 * The card is asking the reader to bet AGAINST the model, so it has to carry its
 * own justification: the amber/green inline highlights mark the three claims
 * (extreme confidence → overconfident → more profitable), and the two backtest
 * chips at the bottom are the evidence for the last one. A one-line paraphrase
 * without them reads as an unsupported instruction.
 */
@Composable
fun FadeAlertTooltip(betType: FadeBetType, suggestedBet: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Amber.copy(alpha = 0.10f))
            .border(1.dp, Amber.copy(alpha = 0.30f), RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.BOLT_FILL.imageVector, null, tint = Amber, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "FADE ALERT TRIGGERED",
                color = Amber, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
            )
        }

        Text(fadeAlertDescription(), color = AppColors.appTextSecondary, fontSize = 13.sp, lineHeight = 18.sp)

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Green.copy(alpha = 0.10f))
                .border(1.dp, Green.copy(alpha = 0.30f), RoundedCornerShape(8.dp))
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    AppIcon.ARROW_LEFT_ARROW_RIGHT.imageVector, null,
                    tint = Green, modifier = Modifier.size(12.dp),
                )
                Text("CONSIDER THE FADE", color = Green, fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
            Text(fadeAlertSuggestion(suggestedBet), color = AppColors.appTextPrimary, fontSize = 13.sp, lineHeight = 18.sp)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            StatChip(AppIcon.CHART_LINE_UPTREND, "Higher hit rate when fading")
            StatChip(AppIcon.BANKNOTE, "Historically profitable")
        }
    }
}

@Composable
private fun StatChip(icon: AppIcon, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon.imageVector, null, tint = Green, modifier = Modifier.size(11.dp))
        Text(text, color = AppColors.appTextSecondary, fontSize = 11.sp, maxLines = 2)
    }
}

/**
 * Body paragraph with the three inline highlights RN and iOS both render —
 * amber on the two "the model is wrong here" phrases, green on the payoff.
 * Split out so the exact copy is assertable in a unit test.
 */
internal fun fadeAlertDescription(): AnnotatedString = buildAnnotatedString {
    append("Our model is showing ")
    withStyle(SpanStyle(color = Amber, fontWeight = FontWeight.Bold)) { append("extreme confidence") }
    append(" on this pick. Historical backtesting across thousands of games reveals that when the model is ")
    withStyle(SpanStyle(color = Amber, fontWeight = FontWeight.Bold)) { append("overconfident") }
    append(", betting the opposite direction has been ")
    withStyle(SpanStyle(color = Green, fontWeight = FontWeight.Bold)) { append("more profitable") }
    append(".")
}

/** Suggestion line with the fade target highlighted in green. */
internal fun fadeAlertSuggestion(suggestedBet: String): AnnotatedString = buildAnnotatedString {
    append("Instead of following the model, consider betting ")
    withStyle(SpanStyle(color = Green, fontWeight = FontWeight.Bold)) { append(suggestedBet) }
}
