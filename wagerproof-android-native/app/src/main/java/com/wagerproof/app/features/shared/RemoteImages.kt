package com.wagerproof.app.features.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import coil3.compose.AsyncImagePainter
import coil3.compose.SubcomposeAsyncImage
import coil3.compose.SubcomposeAsyncImageContent
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shared remote-image primitives for the Chat + Props feature ports. Coil3 is
 * the project's image loader (see app/build.gradle.kts). This wraps
 * SubcomposeAsyncImage so callers get explicit loading + error slots — team
 * logos, player headshots, and sportsbook logos all 404/timeout in the wild,
 * and the iOS sources always render an initials / silhouette fallback.
 */
@Composable
fun RemoteImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    loading: @Composable () -> Unit = {},
    error: @Composable () -> Unit = {},
) {
    if (url.isNullOrBlank()) {
        Box(modifier, contentAlignment = Alignment.Center) { error() }
        return
    }
    SubcomposeAsyncImage(
        model = url,
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
    ) {
        val state by painter.state.collectAsState()
        when (state) {
            is AsyncImagePainter.State.Loading -> loading()
            is AsyncImagePainter.State.Error -> error()
            else -> SubcomposeAsyncImageContent()
        }
    }
}

/** Convert an iOS-style 0xRRGGBB hex into an opaque Compose [Color]. */
fun hexColor(hex: Long): Color = Color(0xFF000000 or (hex and 0xFFFFFF))

/**
 * Circular initials fallback disc. Used when a headshot / logo url is absent
 * or fails, mirroring the iOS `TeamInitials` / silhouette discs.
 */
@Composable
fun InitialsDisc(
    initials: String,
    diameter: Dp,
    modifier: Modifier = Modifier,
    background: Color = AppColors.appSurfaceMuted,
    foreground: Color = AppColors.appTextSecondary,
) {
    Box(
        modifier
            .size(diameter)
            .clip(CircleShape)
            .background(background),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials.take(3),
            color = foreground,
            fontWeight = FontWeight.Bold,
            fontSize = (diameter.value * 0.36f).sp,
        )
    }
}
