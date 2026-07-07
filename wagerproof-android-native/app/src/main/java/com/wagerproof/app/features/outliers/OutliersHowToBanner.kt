package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors

/**
 * The Outliers hub's how-to entry. Port of iOS `Components/OutliersHowToBanner.swift`.
 *
 * // FIDELITY-WAIVER #235: HoneydewOptionCard drifting-symbol animation
 * // simplified to a static gradient banner. Tapping still opens the same
 * // [OutliersLearnMoreSheet].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutliersHowToBanner(modifier: Modifier = Modifier) {
    var showLearnMore by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(16.dp)

    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            // Outliers' signature scan→flag→act gradient (cyan → violet).
            .background(
                Brush.linearGradient(
                    0f to hexColor(0x00B0FF),
                    1f to hexColor(0x7C4DFF),
                    start = Offset(0f, 0f),
                    end = Offset.Infinite,
                ),
            )
            .clickable { showLearnMore = true }
            .padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("How Outliers work", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(
                "Spot the setup before the outcome",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
            )
        }
        Row(
            Modifier
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.2f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Learn more", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Icon(outlierSymbol("chevron.right"), null, tint = Color.White, modifier = Modifier.size(11.dp))
        }
    }

    if (showLearnMore) {
        ModalBottomSheet(
            onDismissRequest = { showLearnMore = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = AppColors.appSurfaceElevated,
        ) {
            OutliersLearnMoreSheet(onClose = { showLearnMore = false })
        }
    }
}
