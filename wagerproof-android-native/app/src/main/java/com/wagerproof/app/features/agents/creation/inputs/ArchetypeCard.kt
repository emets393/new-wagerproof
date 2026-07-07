package com.wagerproof.app.features.agents.creation.inputs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.colorFromHexString
import com.wagerproof.app.features.agents.iconVector
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.services.PresetArchetypeRow

/**
 * Tappable preset archetype tile in Step 1's "Use a Preset" path. Port of iOS
 * `ArchetypeCard`. Accent color = the row's hex color (fallback brand green).
 */
@Composable
fun ArchetypeCard(
    row: PresetArchetypeRow,
    selected: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accentColor = colorFromHexString(row.color) ?: AppColors.brandGreenBright
    val cardShape = RoundedCornerShape(16.dp)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .liquidGlassBackground(
                shape = cardShape,
                tint = if (selected) accentColor.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.05f),
            )
            .border(
                if (selected) 2.dp else 0.dp,
                if (selected) accentColor else Color.Transparent,
                cardShape,
            )
            .clickableNoRipple(onSelect)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .liquidGlassBackground(
                        shape = RoundedCornerShape(12.dp),
                        tint = accentColor.copy(alpha = 0.20f),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = row.emoji, fontSize = 24.sp)
            }

            Spacer(Modifier.size(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = row.name,
                    color = AppColors.appTextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = row.description,
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (selected) {
                Spacer(Modifier.size(8.dp))
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(50))
                        .background(accentColor),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }

        if (row.recommendedSports.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.recommendedSports.forEach { sport ->
                    Row(
                        modifier = Modifier
                            .background(AppColors.appBorder.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .border(1.dp, AppColors.appBorder, RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 5.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = sport.iconVector(),
                            contentDescription = null,
                            tint = AppColors.appTextSecondary,
                            modifier = Modifier.size(11.dp),
                        )
                        Text(
                            text = sport.label,
                            color = AppColors.appTextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}
