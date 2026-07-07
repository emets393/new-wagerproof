package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentWithPerformance
import java.util.Locale

/**
 * Compact agency stats pill that floats over the office hero's top-trailing
 * corner — the only surviving piece of iOS `CollapsingAgentsHeader.swift`.
 * Net units (P/L-tinted) · avg win% · active/total, on a liquid-glass capsule.
 */
@Composable
fun AgencyStatsPill(
    agents: List<AgentWithPerformance>,
    modifier: Modifier = Modifier,
) {
    val totalNetUnits = agents.sumOf { it.performance?.netUnits ?: 0.0 }
    val winRateAverage = avgWinRate(agents)
    val activeCount = agents.count { it.agent.isActive }

    Row(
        modifier
            .liquidGlassBackground(CircleShape)
            .padding(horizontal = 11.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val dot: @Composable (String, Color) -> Unit = { text, color ->
            Text(
                text,
                color = color,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Default,
                maxLines = 1,
                modifier = Modifier.padding(horizontal = 2.5.dp),
            )
        }
        dot(netUnitsLabel(totalNetUnits), if (totalNetUnits >= 0) AppColors.statsPillProfit else AppColors.statsPillLoss)
        dot("·", Color.White.copy(alpha = 0.5f))
        dot(String.format(Locale.US, "%.0f%%", winRateAverage * 100), Color.White)
        dot("·", Color.White.copy(alpha = 0.5f))
        dot("$activeCount/${agents.size}", Color.White)
    }
}
