package com.wagerproof.app.features.gamecards.sheets

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Placeholder H2H modal — port of iOS `Sheets/H2HModal.swift`
 * (FIDELITY-WAIVER #032: head-to-head data source not wired).
 */
@Composable
fun H2HModal(awayTeam: String, homeTeam: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(AppIcon.CLOCK_ARROW_2_CIRCLEPATH.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(44.dp))
        Text("Head-to-Head Data", color = AppColors.appTextPrimary, fontSize = 17.sp, textAlign = TextAlign.Center)
        Text("$awayTeam vs $homeTeam history will appear here soon.", color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}

/**
 * Generic modal host with injected content — port of iOS
 * `Sheets/LineMovementModal.swift` (FIDELITY-WAIVER #033: charts are stubs).
 */
@Composable
fun LineMovementModal(title: String, modifier: Modifier = Modifier, content: @Composable () -> Unit = {}) {
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 20.sp)
        content()
    }
}
