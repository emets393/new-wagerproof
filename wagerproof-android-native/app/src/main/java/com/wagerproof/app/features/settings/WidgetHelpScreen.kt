package com.wagerproof.app.features.settings

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing

/** Home Screen Widget walkthrough, adapted to Android launchers. */
@Composable
fun WidgetHelpScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    var selected by remember { mutableStateOf(WidgetKind.Outliers) }
    BackHandler(onBack = onDismiss)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "Widgets", onDismiss = onDismiss)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(vertical = Spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            // Intro
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                Box(
                    modifier = Modifier.size(80.dp).background(green.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = AppIcon.RECTANGLE_STACK_FILL.imageVector,
                        contentDescription = null,
                        tint = green,
                        modifier = Modifier.size(38.dp),
                    )
                }
                Text(
                    text = "WagerProof Widgets",
                    style = AppTypography.display,
                    color = AppColors.appTextPrimary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Add Top Outliers and Agent Monitor to your Home Screen for instant access to today's sharpest signals and your agents' latest picks.",
                    style = AppTypography.body,
                    color = AppColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = Spacing.lg),
                )
            }

            // Segmented selector
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                WidgetKind.entries.forEach { kind ->
                    val isSel = kind == selected
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (isSel) green else AppColors.appSurfaceMuted)
                            .clickable { selected = kind }
                            .padding(horizontal = Spacing.md, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            imageVector = kind.icon,
                            contentDescription = null,
                            tint = if (isSel) Color.White else AppColors.appTextSecondary,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = kind.label,
                            style = AppTypography.captionEmphasized,
                            color = if (isSel) Color.White else AppColors.appTextSecondary,
                        )
                    }
                }
            }

            // Widget preview mock (always dark, like the iOS mock)
            WidgetPreviewMock(selected)

            // Instructions
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.lg)
                    .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
                    .padding(Spacing.lg),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                Text("How to Add a Widget", style = AppTypography.headline, color = AppColors.appTextPrimary)
                Step(1, "Long-press an empty spot on your Home Screen, then tap Widgets")
                Step(2, "Scroll to (or search for) WagerProof")
                Step(3, "Pick \"Top Outliers\" or \"Agent Monitor\"")
                Step(4, "Drag the size you want onto the Home Screen")
                Step(5, "Repeat to add the other widget — each lives independently")
            }

            // Info note
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.lg)
                    .background(green.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
                    .padding(Spacing.lg),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Icon(
                    imageVector = AppIcon.INFO_CIRCLE_FILL.imageVector,
                    contentDescription = null,
                    tint = green,
                )
                Text(
                    text = "Widgets sync automatically when you open the app and refresh roughly every 60 minutes in the background.",
                    style = AppTypography.body,
                    color = AppColors.appTextSecondary,
                )
            }
        }
    }
}

private val green = Color(0xFF22C55E)

private enum class WidgetKind(val title: String, val label: String, val icon: ImageVector) {
    Outliers("Top Outliers", "Outliers", AppIcon.BELL_BADGE_FILL.imageVector),
    Agents("Agent Monitor", "Agents", AppIcon.BRAIN_HEAD_PROFILE.imageVector),
}

@Composable
private fun Step(index: Int, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Box(
            modifier = Modifier.size(24.dp).background(green, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text("$index", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Text(text = text, style = AppTypography.body, color = AppColors.appTextSecondary)
    }
}

private data class WidgetSampleRow(
    val sport: String,
    val matchup: String,
    val line: String,
    val trailing: String,
    val color: Color,
)

@Composable
private fun WidgetPreviewMock(kind: WidgetKind) {
    val rows = when (kind) {
        WidgetKind.Outliers -> listOf(
            WidgetSampleRow("NFL", "49ers @ Cowboys", "Fade to Cowboys", "85%", Color(0xFF013369)),
            WidgetSampleRow("NBA", "Warriors @ Suns", "Fade to Suns", "11pt", Color(0xFF1D428A)),
            WidgetSampleRow("CFB", "Alabama @ Georgia", "Over value", "62%", Color(0xFF8B0000)),
            WidgetSampleRow("NCAAB", "Kansas @ Kentucky", "Fade to Kansas", "7pt", Color(0xFFFF6600)),
        )
        WidgetKind.Agents -> listOf(
            WidgetSampleRow("🎯", "Sharp Edge — 28-18", "Ravens @ Chiefs — Ravens -3.5", "+8.4u", green),
            WidgetSampleRow("🧠", "Line Hunter — 24-18", "Alabama @ Georgia — Georgia -7", "+6.1u", Color(0xFF3B82F6)),
            WidgetSampleRow("⚡", "Market Fade — 20-17", "Duke @ UNC — Duke +2.5", "+4.2u", Color(0xFFF59E0B)),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Text(
            text = "WIDGET PREVIEW",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextSecondary,
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF0A0A0A), RoundedCornerShape(24.dp))
                .padding(Spacing.md),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = kind.icon,
                    contentDescription = null,
                    tint = green,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.size(6.dp))
                Text(kind.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(Modifier.weight(1f))
                Text("WagerProof", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Color(0xFF9CA3AF))
            }
            rows.forEach { row ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    Text(
                        text = row.sport,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        modifier = Modifier
                            .background(row.color, RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 3.dp),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(row.matchup, fontSize = 9.sp, color = Color(0xFF9CA3AF))
                        Text(row.line, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                    }
                    Text(row.trailing, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = green)
                }
            }
        }
    }
}
