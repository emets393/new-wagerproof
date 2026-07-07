package com.wagerproof.app.features.props.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps

/**
 * Circular MLB player headshot from the MLB CDN, with a neutral fallback disc
 * while loading or on failure. Port of iOS `PlayerHeadshot.swift`.
 */
@Composable
fun PlayerHeadshot(
    playerId: Int,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted)
            .border(1.dp, AppColors.appBorder, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = MLBPlayerProps.headshotURL(playerId),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            loading = { CircularProgressIndicator(strokeWidth = 1.5.dp, modifier = Modifier.size(size * 0.4f)) },
            error = {
                Icon(
                    AppIcon.PERSON.imageVector,
                    contentDescription = null,
                    tint = AppColors.appTextMuted,
                    modifier = Modifier.size(size * 0.5f),
                )
            },
        )
    }
}
