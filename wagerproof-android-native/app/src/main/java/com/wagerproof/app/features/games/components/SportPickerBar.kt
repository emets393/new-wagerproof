package com.wagerproof.app.features.games.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.GamesStore

/**
 * Horizontal sport pill bar. iOS `Games/Components/SportPickerBar`. Selected
 * pill gets bold weight + a 3dp underline rule. Pure presentation — parent owns
 * selection. (GamesScreen itself uses a segmented control; this is the parity
 * port of the alternative pill bar.)
 */
@Composable
fun SportPickerBar(
    selectedSport: GamesStore.Sport,
    onSelect: (GamesStore.Sport) -> Unit,
    modifier: Modifier = Modifier,
) {
    val sports = GamesStore.Sport.displayOrder()
    Column(
        modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(AppColors.appSurface),
    ) {
        Row(
            Modifier
                .weight(1f)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            sports.forEach { sport ->
                val selected = sport == selectedSport
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    // Match SwiftUI's VStack intrinsic width: the underline is
                    // exactly as wide as its label, rather than a fixed 20dp
                    // dash that looked undersized under NCAAB.
                    modifier = Modifier.width(IntrinsicSize.Min).clickable { onSelect(sport) },
                ) {
                    Text(
                        sport.label,
                        color = if (selected) AppColors.appTextPrimary else AppColors.appTextSecondary,
                        fontSize = 16.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    )
                    val underlineColor by animateColorAsState(
                        if (selected) AppColors.appPrimary else Color.Transparent,
                        label = "sportPill",
                    )
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(50))
                            .background(underlineColor),
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder.copy(alpha = 0.3f)))
    }
}
