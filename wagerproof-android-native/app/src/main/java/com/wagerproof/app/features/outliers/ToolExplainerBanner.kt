package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * One example-signal row for [ToolExplainerBanner]. Port of iOS
 * `ToolExplainerBannerView.Example`.
 */
data class ToolExplainerExample(
    val icon: String,
    val label: String,
    val value: String,
    val valueColor: Color? = null,
)

/**
 * Glassmorphic banner pinned to the top of each Outliers detail view. Port of
 * iOS `ToolExplainerBannerView` — header (tool name + headline + description)
 * then a list of "Example signals" rows showing what the tool surfaces.
 */
@Composable
fun ToolExplainerBanner(
    accentColor: Color,
    title: String,
    titleIcon: String,
    headline: String,
    description: String,
    examples: List<ToolExplainerExample>,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            // accent-gradient (0.12 → clear → 0.12) over the elevated surface.
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.98f))
            .background(
                Brush.linearGradient(
                    0f to accentColor.copy(alpha = 0.12f),
                    0.5f to Color.Transparent,
                    1f to accentColor.copy(alpha = 0.12f),
                    start = Offset(0f, 0f),
                    end = Offset.Infinite,
                ),
            )
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.6f), shape),
    ) {
        Box(Modifier.fillMaxWidth().height(3.dp).background(accentColor))

        Column(
            Modifier.padding(horizontal = Spacing.lg, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    outlierSymbol(titleIcon),
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    title.uppercase(),
                    color = accentColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                headline,
                color = AppColors.appTextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                description,
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
            )

            HorizontalDivider(
                Modifier.padding(top = 8.dp),
                color = AppColors.appBorder.copy(alpha = 0.4f),
            )

            Text(
                "EXAMPLE SIGNALS:",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                examples.forEach { ExampleRow(it, accentColor) }
            }
        }
    }
}

@Composable
private fun ExampleRow(ex: ToolExplainerExample, accentColor: Color) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(accentColor.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                outlierSymbol(ex.icon),
                contentDescription = null,
                tint = accentColor,
                modifier = Modifier.size(12.dp),
            )
        }
        Text(
            ex.label,
            color = AppColors.appTextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            ex.value,
            color = ex.valueColor ?: accentColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
    }
}
