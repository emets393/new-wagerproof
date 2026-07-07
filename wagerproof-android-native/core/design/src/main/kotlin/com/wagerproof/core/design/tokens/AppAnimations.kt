package com.wagerproof.core.design.tokens

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.TweenSpec
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween

/**
 * Wagerproof motion vocabulary — ported from iOS `Animations.swift`.
 *
 * iOS `spring(response R, dampingFraction ζ)` maps to Compose
 * `spring(dampingRatio = ζ, stiffness = (2π/R)²)` at mass 1
 * (docs/inventory/04_design.md §1.4). Stiffness values below are those
 * conversions, not tuned-by-eye numbers — keep them in sync with iOS.
 */
object AppAnimations {
    // iOS spring(response, dampingFraction) → (dampingRatio, stiffness)
    const val QuickDamping = 0.85f
    const val QuickStiffness = 631.7f       // response 0.25

    const val StandardDamping = 0.8f
    const val StandardStiffness = 246.7f    // response 0.4

    const val BouncyDamping = 0.65f
    const val BouncyStiffness = 157.9f      // response 0.5

    const val CarouselDamping = 0.85f
    const val CarouselStiffness = 157.9f    // response 0.5

    /** `.staggeredAppear` entrance spring — iOS spring(0.42, 0.82). */
    const val StaggerDamping = 0.82f
    const val StaggerStiffness = 223.8f     // response 0.42

    /** CTA entrance spring — iOS spring(0.55, 0.82), delayed 180 ms on appear. */
    const val EntranceDamping = 0.82f
    const val EntranceStiffness = 130.5f    // response 0.55
    const val EntranceDelayMillis = 180

    fun <T> appQuick(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(QuickDamping, QuickStiffness, visibilityThreshold)

    fun <T> appStandard(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(StandardDamping, StandardStiffness, visibilityThreshold)

    fun <T> appBouncy(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(BouncyDamping, BouncyStiffness, visibilityThreshold)

    /** Softer-than-bouncy (no overshoot) for auto-rotating page carousels. */
    fun <T> appCarousel(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(CarouselDamping, CarouselStiffness, visibilityThreshold)

    fun <T> appStagger(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(StaggerDamping, StaggerStiffness, visibilityThreshold)

    fun <T> appEntrance(visibilityThreshold: T? = null): SpringSpec<T> =
        spring(EntranceDamping, EntranceStiffness, visibilityThreshold)

    /** iOS `.easeInOut` bezier — Compose has no exact built-in equivalent. */
    val EaseInOut = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)

    fun <T> appSlow(): TweenSpec<T> = tween(600, easing = EaseInOut)

    fun <T> appLinear(): TweenSpec<T> = tween(150, easing = LinearEasing)

    /** 1.5 s linear repeat-forever (no autoreverse) — generic shimmer beat. */
    fun appShimmer(): InfiniteRepeatableSpec<Float> =
        infiniteRepeatable(tween(1500, easing = LinearEasing), RepeatMode.Restart)

    // Other recurring durations across components (doc §1.4):
    // skeleton shimmer sweep 1.4 s, research shimmer 1.9 s,
    // swipe-pill shimmer 1.7 s, progress bar easeInOut 0.3 s.
    const val SkeletonShimmerMillis = 1400
    const val ResearchShimmerMillis = 1900
    const val SwipePillShimmerMillis = 1700
    const val ProgressBarMillis = 300
}
