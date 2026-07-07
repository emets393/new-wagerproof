package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.backgrounds.PixelGlyphField

/**
 * Subtle animated pixel-glyph wash for agent list cards — port of iOS
 * `AgentCardGlyphTexture.swift`. Reuses the shared [PixelGlyphField] automaton
 * verbatim, re-tinted/re-seeded per agent so no two cards bloom in lockstep,
 * then masked to ease down toward the trailing edge and clipped to the card.
 *
 * Dark-only (the Android app): white glyphs mixing toward the agent hue at
 * their cores, matching the detail-hero field.
 */
@Composable
fun AgentCardGlyphTexture(
    avatarColor: String,
    seedString: String,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 26.dp,
) {
    val primary = AgentColorPalette.primary(avatarColor)
    val seed = fnv1aSeed(seedString)

    Box(
        modifier
            .clip(RoundedCornerShape(cornerRadius))
            // Offscreen so the leading→trailing fade masks the whole field's
            // alpha, not each glyph's draw call.
            .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
            .drawWithContent {
                drawContent()
                drawRect(
                    brush = Brush.horizontalGradient(
                        0f to Color.White,
                        0.5f to Color.White.copy(alpha = 0.84f),
                        1f to Color.White.copy(alpha = 0.64f),
                    ),
                    blendMode = BlendMode.DstIn,
                )
            },
    ) {
        PixelGlyphField(
            modifier = Modifier.fillMaxSize(),
            intervals = listOf(0.3), // same 300ms beat as the hero field
            baseColor = Color.White,
            accentColor = primary,
            spacing = 22f, // a touch tighter than the hero (26) for the smaller card
            dotSize = 5f,
            peakOpacity = 0.4,
            seed = seed,
            tapRipples = false,
        )
    }
}

/**
 * FNV-1a hash of the seed string → non-zero PRNG seed. Mirrors the iOS texture's
 * hashing; empty seed falls back to the shared hero constant.
 */
private fun fnv1aSeed(seedString: String): Long {
    if (seedString.isEmpty()) return 0x5EED_1234L
    var h = 0xcbf29ce484222325uL
    for (b in seedString.encodeToByteArray()) {
        h = (h xor b.toUByte().toULong()) * 0x100000001b3uL
    }
    return (h or 1uL).toLong()
}
