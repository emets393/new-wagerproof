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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/** Fade-alert bet type (kept for API parity; copy is identical). */
enum class FadeBetType { SPREAD, TOTAL }

private val Amber = Color(0xFFF59E0B)

/**
 * Fade-alert card — port of iOS `Components/FadeAlertTooltip.swift`. Used by
 * NBA (live trigger) and NCAAB (wired, dormant).
 */
@Composable
fun FadeAlertTooltip(betType: FadeBetType, suggestedBet: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Amber.copy(alpha = 0.10f))
            .border(1.dp, Amber.copy(alpha = 0.30f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.BOLT_FILL.imageVector, null, tint = Amber, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("FADE ALERT TRIGGERED", color = Amber, fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
        Text(
            "The model shows extreme confidence here — historically these overconfident spots have been more profitable to fade.",
            color = AppColors.appTextSecondary, fontSize = 12.sp,
        )
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(AppColors.appPrimary.copy(alpha = 0.10f)).padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text("CONSIDER THE FADE", color = AppColors.appPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(suggestedBet, color = AppColors.appPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}
