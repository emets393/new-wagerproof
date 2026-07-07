package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors

/**
 * "Learn more" explainer content for the Outliers tab, hosted inside the
 * [OutliersHowToBanner]'s bottom sheet. Port of iOS
 * `Components/OutliersLearnMoreSheet.swift` — headline + "How it works" flow +
 * "What we flag" tour.
 */

private data class LearnStep(
    val icon: String,
    val tint: Color,
    val title: String,
    val desc: String,
)

private val flowSteps = listOf(
    LearnStep("dot.radiowaves.left.and.right", hexColor(0x22C55E), "We scan",
        "Every line, model signal, and situational trend across all five sports — refreshed throughout the day."),
    LearnStep("chart.bar.xaxis", hexColor(0xF59E0B), "We flag",
        "Only the rare setups where our data and the history behind it say the edge is real — not noise."),
    LearnStep("scope", hexColor(0x7C4DFF), "You act",
        "Open a flagged matchup to see exactly why it surfaced — before the line moves."),
)

private val kindSteps = listOf(
    LearnStep("chart.line.uptrend.xyaxis", hexColor(0x22C55E), "Market value",
        "Prediction-market consensus diverges from the sportsbook line."),
    LearnStep("bolt.fill", hexColor(0xF59E0B), "Model fades",
        "When our model is extremely confident, the backtest says fade it."),
    LearnStep("baseball.fill", hexColor(0x0EA5E9), "Situational trends",
        "ATS and over/under win rates in this exact spot."),
    LearnStep("target", hexColor(0x14B8A6), "Model accuracy",
        "How the model has graded in matchups like this one."),
)

@Composable
fun OutliersLearnMoreSheet(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Header row: title + close affordance (iOS's inline nav + xmark).
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "How Outliers work",
                color = AppColors.appTextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Icon(
                outlierSymbol("xmark.circle.fill"),
                contentDescription = "Close",
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(22.dp).clickable(onClick = onClose),
            )
        }

        Headline()

        SectionTitle("How it works")
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            flowSteps.forEach { StepRow(it) }
        }

        SectionTitle("What we flag")
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            kindSteps.forEach { StepRow(it) }
        }
    }
}

@Composable
private fun Headline() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Spot the setup before the outcome.",
            color = AppColors.appTextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
        )
        Text(
            "We watch every game for statistical outliers — the rare conditions that have historically pointed to a betting edge. When the data lines up, the matchup shows up here.",
            color = AppColors.appTextSecondary,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text.uppercase(),
        color = AppColors.appTextSecondary,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
    )
}

/** One glass row: tinted icon chip + title/description. */
@Composable
private fun StepRow(step: LearnStep) {
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .liquidGlassBackground(shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(step.tint.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(outlierSymbol(step.icon), null, tint = step.tint, modifier = Modifier.size(17.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(step.title, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(step.desc, color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
    }
}
