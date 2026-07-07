package com.wagerproof.app.features.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography

/**
 * Placeholder for a not-yet-ported feature screen (iOS `ScaffoldPlaceholder` /
 * `ContentUnavailableView` "hammer.fill", doc 08 §1.4). Every appearance = a
 * TODO. Later feature agents replace the specific screen composable in place;
 * this file stays as the fallback.
 */
@Composable
fun TodoScreen(
    screenName: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = AppIcon.HAMMER_FILL.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
        )
        Text(
            text = screenName,
            style = AppTypography.title,
            color = AppColors.appTextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            text = detail ?: "TODO port",
            style = AppTypography.caption,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
