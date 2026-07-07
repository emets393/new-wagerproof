package com.wagerproof.core.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.tokens.AppColors

/**
 * Skeleton primitives — port of the placeholder shapes in iOS
 * `Modifiers/Shimmer.swift`. Compose these inside a card-shaped container
 * that mirrors the real card's chrome, then wrap the group in [shimmering].
 */

/**
 * A single rounded placeholder block. `width == null` means "fill the
 * available width", matching the iOS nil-width behavior.
 */
@Composable
fun SkeletonBlock(
    height: Dp,
    modifier: Modifier = Modifier,
    width: Dp? = null,
    cornerRadius: Dp = 6.dp,
) {
    SkeletonShape(modifier, width, height, RoundedCornerShape(cornerRadius))
}

/** Circular skeleton placeholder — avatars, logos, dots. */
@Composable
fun SkeletonCircle(
    diameter: Dp,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .size(diameter)
            .clip(CircleShape)
            .background(AppColors.appSkeleton),
    )
}

/** Pill/capsule skeleton placeholder — chips, pills, tags. */
@Composable
fun SkeletonCapsule(
    height: Dp,
    modifier: Modifier = Modifier,
    width: Dp? = null,
) {
    // CircleShape on a non-square box renders as a capsule (50% corners).
    SkeletonShape(modifier, width, height, CircleShape)
}

@Composable
private fun SkeletonShape(
    modifier: Modifier,
    width: Dp?,
    height: Dp,
    shape: Shape,
) {
    val sized = if (width != null) modifier.width(width) else modifier.fillMaxWidth()
    Box(
        sized
            .height(height)
            .clip(shape)
            .background(AppColors.appSkeleton),
    )
}
