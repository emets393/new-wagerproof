package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.SportLeague

/**
 * Square gradient matchup card used in Spotify-style rails (and Top Agent
 * Picks). Port of iOS `Components/OutlierMatchupCard.swift` (the
 * `OutlierMatchupCardView` struct only — `OutlierTeamPalette` is ported
 * separately in `OutlierTeamPalette.kt`).
 *
 * Two diagonal team discs (away top-left, home bottom-right) over an away→home
 * primary-color gradient, a centered "VS" glass pill, then a subtext row and
 * optional pick value below.
 *
 * // FIDELITY-WAIVER #236: LiquidGlassMergeContainer disc-merge not ported —
 * // the discs overlap plainly instead of liquid-fusing at the center.
 */
@Composable
fun OutlierMatchupCardView(
    awayTeam: String,
    homeTeam: String,
    sport: SportLeague,
    pickLabel: String,
    modifier: Modifier = Modifier,
    awayTeamLogo: String? = null,
    homeTeamLogo: String? = null,
    awayColor: Color? = null,
    homeColor: Color? = null,
    pickIcon: String? = null,
    pickValue: String? = null,
    accentColor: Color = AppColors.appPrimary,
    loading: Boolean = false,
    onTap: () -> Unit = {},
) {
    val cardSize = 80.dp
    val logoBgSize = 38.dp
    val vsSize = 18.dp
    val logoInset = 3.dp
    // Concentric with the discs: cardSize/2 - logoBg/2 + inset = 40 - 19 + 3.
    val corner = 24.dp

    val resolvedAwayColor = awayColor ?: OutlierTeamPalette.color(awayTeam, sport, OutlierTeamPalette.Slot.away)
    val resolvedHomeColor = homeColor ?: OutlierTeamPalette.color(homeTeam, sport, OutlierTeamPalette.Slot.home)
    val resolvedAwayLogo = awayTeamLogo ?: OutlierTeamPalette.logoURL(awayTeam, sport)
    val resolvedHomeLogo = homeTeamLogo ?: OutlierTeamPalette.logoURL(homeTeam, sport)

    Column(
        modifier
            .width(cardSize)
            .clickable(onClick = onTap),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // Gradient card + diagonal discs + VS pill.
        Box(
            Modifier
                .size(cardSize)
                .clip(RoundedCornerShape(corner))
                .background(
                    Brush.linearGradient(
                        listOf(resolvedAwayColor, resolvedHomeColor),
                        start = Offset(0f, 0f),
                        end = Offset.Infinite,
                    ),
                ),
        ) {
            // Away disc — top-left; home disc — bottom-right (diagonal).
            OutlierGlassTeamAvatar(
                logoUrl = resolvedAwayLogo,
                initials = OutlierTeamPalette.initials(awayTeam),
                primary = resolvedAwayColor,
                size = logoBgSize,
                modifier = Modifier.offset(x = 5.dp, y = 5.dp),
            )
            OutlierGlassTeamAvatar(
                logoUrl = resolvedHomeLogo,
                initials = OutlierTeamPalette.initials(homeTeam),
                primary = resolvedHomeColor,
                size = logoBgSize,
                modifier = Modifier.offset(x = 37.dp, y = 37.dp),
            )
            // VS pill — centered, glass so it reads over both discs.
            Box(
                Modifier
                    .align(Alignment.Center)
                    .size(vsSize)
                    .liquidGlassBackground(CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("VS", color = AppColors.appTextPrimary, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }

            if (loading) {
                Box(
                    Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                }
            }
        }

        // Subtext row: accent pick icon + pick label.
        Row(
            Modifier.padding(top = 3.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (pickIcon != null) {
                Icon(outlierSymbol(pickIcon), null, tint = accentColor, modifier = Modifier.size(13.dp))
            }
            Text(
                pickLabel,
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        if (pickValue != null) {
            Text(
                pickValue,
                color = accentColor,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
