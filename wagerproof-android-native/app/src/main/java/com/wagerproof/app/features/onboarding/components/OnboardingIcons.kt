package com.wagerproof.app.features.onboarding.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SportsBaseball
import androidx.compose.material.icons.filled.SportsBasketball
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckBox
import androidx.compose.material.icons.rounded.CheckBoxOutlineBlank
import androidx.compose.material.icons.rounded.Dangerous
import androidx.compose.material.icons.rounded.EmojiEmotions
import androidx.compose.material.icons.rounded.EventBusy
import androidx.compose.material.icons.rounded.FactCheck
import androidx.compose.material.icons.rounded.FormatQuote
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Layers
import androidx.compose.material.icons.rounded.ManageSearch
import androidx.compose.material.icons.rounded.MonitorHeart
import androidx.compose.material.icons.rounded.ShowChart
import androidx.compose.material.icons.rounded.SportsBar
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material.icons.rounded.Circle
import androidx.compose.ui.graphics.vector.ImageVector
import com.wagerproof.core.design.icons.AppIcon

/**
 * SF-symbol name → Compose [ImageVector] for the onboarding pages, mirroring the
 * agents feature's `agentSymbol`. Resolves through the shared [AppIcon] map
 * first, then fills the handful of symbols the onboarding copy uses that AppIcon
 * lacks (see AppIcon.kt — several of these are not mapped there). Unknown names
 * fall back to a filled circle so nothing crashes.
 *
 * FIDELITY-WAIVER #244: A few SF Symbols have no exact Material equivalent
 * (`waveform.path.ecg`, `cylinder.split.1x2`, `list.clipboard`) — mapped to the
 * closest-reading Material icon.
 */
fun onboardingIcon(systemName: String): ImageVector {
    AppIcon.fromSystemName(systemName)?.let { return it.imageVector }
    return when (systemName) {
        "basketball.fill", "basketball" -> Icons.Filled.SportsBasketball
        "baseball.fill", "baseball" -> Icons.Filled.SportsBaseball
        "soccerball" -> Icons.Filled.SportsSoccer
        "face.smiling" -> Icons.Rounded.EmojiEmotions
        "waveform.path.ecg" -> Icons.Rounded.MonitorHeart
        "clock.badge.checkmark" -> Icons.Rounded.TaskAlt
        "checkmark.square.fill" -> Icons.Rounded.CheckBox
        "square" -> Icons.Rounded.CheckBoxOutlineBlank
        "xmark.octagon", "xmark.octagon.fill" -> Icons.Rounded.Dangerous
        "text.magnifyingglass" -> Icons.Rounded.ManageSearch
        "figure.run" -> Icons.Rounded.SportsBar
        "list.clipboard", "list.clipboard.fill" -> Icons.Rounded.FactCheck
        "cylinder.split.1x2" -> Icons.Rounded.Storage
        "text.quote" -> Icons.Rounded.FormatQuote
        "chart.xyaxis.line" -> Icons.Rounded.ShowChart
        "square.stack.3d.up.fill" -> Icons.Rounded.Layers
        "waveform" -> Icons.Rounded.GraphicEq
        "bolt.fill" -> Icons.Rounded.Bolt
        "calendar.badge.clock" -> Icons.Rounded.EventBusy
        else -> Icons.Rounded.Circle
    }
}
