package com.wagerproof.app.features.settings

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppTypography

/**
 * The multi-provider AI connector banner — port of iOS `AIConnectorBanner`
 * (`Features/Settings/SettingsView.swift`).
 *
 * Lives in the Settings feature but is deliberately public: iOS shows the same
 * banner on the custom paywall's final benefit page, so the paywall surface can
 * reuse it (pass `onClick = null` for the display-only variant).
 *
 * // FIDELITY-WAIVER #334: iOS's `OptionCardIconChrome` drifts its SF-symbol chrome
 * // across the card. Here the chrome is a STATIC scatter — same as the two
 * // Settings hero banners (waiver #257) and the Outliers how-to banner (#235).
 * // The provider logo stack, gradient, scrim and copy are 1:1.
 */
@Composable
fun AIConnectorBanner(
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(23.dp)
    val primary = Color(0xFF30231F)
    val secondary = Color(0xFFD97757)
    val logoSize = if (compact) 38.dp else 46.dp

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(if (compact) 152.dp else 184.dp)
            .clip(shape)
            .background(Brush.horizontalGradient(listOf(primary, secondary)))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .border(1.dp, Color.White.copy(alpha = 0.14f), shape)
            .semantics(mergeDescendants = true) {
                contentDescription = ConnectorContent.BANNER_ACCESSIBILITY_LABEL
            },
    ) {
        ChromeScatter()

        // Left-weighted scrim so the copy stays legible over the chrome, exactly
        // like iOS's third gradient layer.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        0f to primary,
                        0.45f to primary.copy(alpha = 0.88f),
                        1f to primary.copy(alpha = 0.18f),
                    ),
                ),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(if (compact) 10.dp else 14.dp),
            verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp, Alignment.CenterVertically),
        ) {
            // Overlapping logo stack — negative spacing mirrors iOS's -11pt HStack.
            Row(horizontalArrangement = Arrangement.spacedBy(if (compact) (-9).dp else (-11).dp)) {
                ConnectorContent.BANNER_PROVIDERS.forEachIndexed { index, provider ->
                    Image(
                        painter = painterResource(provider.icon),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .zIndex((ConnectorContent.BANNER_PROVIDERS.size - index).toFloat())
                            .size(logoSize)
                            .clip(CircleShape)
                            .background(Color.Black, CircleShape)
                            .border(if (compact) 1.5.dp else 2.dp, Color.White.copy(alpha = 0.82f), CircleShape),
                    )
                }
            }

            Text(
                text = ConnectorContent.BANNER_TITLE,
                style = AppTypography.display.copy(
                    fontSize = if (compact) 15.sp else 18.sp,
                    lineHeight = if (compact) 19.sp else 22.sp,
                ),
                color = Color.White,
            )

            Text(
                text = ConnectorContent.BANNER_SUBTITLE,
                fontSize = if (compact) 12.5.sp else 15.sp,
                lineHeight = if (compact) 16.sp else 19.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.92f),
                // iOS shrinks the text to fit three lines; Compose has no
                // minimumScaleFactor, so cap at two and ellipsize rather than
                // letting the copy overflow the fixed-height card.
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )

            Text(
                text = ConnectorContent.BANNER_CAPTION,
                style = AppTypography.micro.copy(fontSize = if (compact) 8.sp else 9.sp),
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.72f),
                maxLines = 1,
            )
        }
    }
}

/** Faint glyph wash in the card's top-right corner (iOS `OptionCardIconChrome`). */
@Composable
private fun ChromeScatter() {
    val glyphs = listOf(
        AppIcon.LINK,
        AppIcon.SPARKLES,
        AppIcon.BRAIN_HEAD_PROFILE,
        AppIcon.CHART_BAR_FILL,
        AppIcon.BOLT_FILL,
        AppIcon.TERMINAL,
    )
    Box(Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.align(Alignment.TopEnd).padding(top = 12.dp, end = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            glyphs.forEachIndexed { index, glyph ->
                Icon(
                    imageVector = glyph.imageVector,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.10f + index * 0.018f),
                    modifier = Modifier.size((17 + (index % 3) * 4).dp),
                )
            }
        }
        Row(
            modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = 16.dp, end = 22.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            glyphs.reversed().take(4).forEachIndexed { index, glyph ->
                Icon(
                    imageVector = glyph.imageVector,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.08f + index * 0.02f),
                    modifier = Modifier.size((15 + (index % 2) * 6).dp),
                )
            }
        }
    }
}
