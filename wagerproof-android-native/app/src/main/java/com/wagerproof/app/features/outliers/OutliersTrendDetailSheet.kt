package com.wagerproof.app.features.outliers

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsSport

/**
 * Bottom sheet revealing a single Outliers trend card in FULL
 * ([OutliersTrendCardMode.Expanded]) — every betting line and every trend row,
 * instead of growing the compact carousel card. Port of iOS
 * `Components/OutliersTrendDetailSheet.swift`.
 *
 * // FIDELITY-WAIVER #233: iOS fit-to-content clear sheet (GeometryReader +
 * // `.presentationDetents([.height(measured)])`) → a wrap-content ModalBottomSheet
 * // with a transparent container so only the card's own rounded surface floats.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutliersTrendDetailSheet(
    card: OutliersTrendsCard,
    sport: OutliersTrendsSport,
    game: OutliersTrendsGame?,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color.Transparent,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                // Even horizontal + vertical insets so the card floats centered.
                .padding(horizontal = 20.dp, vertical = 24.dp),
        ) {
            OutliersTrendCard(
                card = card,
                sport = sport,
                game = game,
                displayMode = OutliersTrendCardMode.Expanded,
            )
        }
    }
}
