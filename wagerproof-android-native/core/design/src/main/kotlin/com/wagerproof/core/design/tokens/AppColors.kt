package com.wagerproof.core.design.tokens

import androidx.compose.ui.graphics.Color

/**
 * Wagerproof color tokens, ported 1:1 from iOS `WagerproofDesign/Tokens.swift`
 * (see docs/inventory/04_design.md §1.1 for the parity table).
 *
 * The Android app is dark-only, so the DARK variants of the iOS adaptive
 * colors are canonical here; the light hex is preserved in a comment on each
 * token in case a light theme ever ships.
 *
 * Naming mirrors iOS (`app<Role>`) so Swift feature code ports mechanically.
 * Feature code adds new role-named colors here, never raw hex inline.
 */
object AppColors {
    // Brand-fixed (same in both modes on iOS)
    val appPrimary = Color(0xFF22C55E)
    val appPrimaryStrong = Color(0xFF16A34A)
    val appPrimarySubtle = Color(0xFFBBF7D0)

    val appAccentRed = Color(0xFFEF4444)
    val appAccentAmber = Color(0xFFF59E0B)
    val appAccentBlue = Color(0xFF3B82F6)
    val appAccentPurple = Color(0xFFA855F7)

    val appWin = Color(0xFF22C55E)
    val appLoss = Color(0xFFEF4444)
    val appPush = Color(0xFF94A3B8)
    val appPending = Color(0xFFF59E0B)

    // Light/dark adaptive on iOS — dark is canonical here
    val appSurface = Color(0xFF0A0A0A)          // light: 0xFFFFFF
    val appSurfaceElevated = Color(0xFF141414)  // light: 0xF8FAFC
    val appSurfaceMuted = Color(0xFF1F1F1F)     // light: 0xF1F5F9

    val appBorder = Color(0xFF262626)           // light: 0xE2E8F0
    val appBorderStrong = Color(0xFF404040)     // light: 0xCBD5E1

    val appTextPrimary = Color(0xFFF8FAFC)      // light: 0x0F172A
    val appTextSecondary = Color(0xFF94A3B8)    // light: 0x475569
    val appTextMuted = Color(0xFF64748B)        // light: 0x94A3B8
    val appTextInverse = Color(0xFF0F172A)      // light: 0xFFFFFF

    // Skeleton base fill + the brighter band the shimmer sweep reveals
    val appSkeleton = Color(0xFF2B2B2B)         // light: 0xE6ECF3
    val appSkeletonHighlight = Color(0xFF3D3D3D) // light: 0xF6F9FC

    // -------------------------------------------------------------------
    // Component-signature hexes used repeatedly outside Tokens.swift on iOS
    // (doc §1.1 "additional hard-coded hexes"). Named here so Compose ports
    // reference tokens instead of re-scattering literals.
    // -------------------------------------------------------------------

    /** Bright brand green — wordmark "Proof", terminal green. */
    val brandGreenBright = Color(0xFF00E676)

    /** Pixelwave backdrop base + gradient tail. */
    val pixelWaveBase = Color(0xFF111111)
    val pixelWaveTail = Color(0xFF0F100F)

    /** Onboarding backdrop top. */
    val onboardingBackdropTop = Color(0xFF0F1117)

    /** Pixel-office scene backdrop (iOS SKView bg). */
    val officeSceneBackdrop = Color(0xFF0F1118)

    /** Pick-ticket cardstock vertical gradient (compact ticket). */
    val ticketCardstockTop = Color(0xFF141927)
    val ticketCardstockBottom = Color(0xFF0D101A)

    /** Expanded pick-ticket gradient top. */
    val ticketExpandedTop = Color(0xFF151A28)

    /** Pick-history folder back flap gradient. */
    val folderBackTop = Color(0xFF151A25)
    val folderBackBottom = Color(0xFF0C0F17)

    /** Pick-history sheet background. */
    val pickHistorySheetBackground = Color(0xFF0B1011)

    /** Receipt-printer slot bar gradient. */
    val printerSlotTop = Color(0xFF2C313C)
    val printerSlotBottom = Color(0xFF0E1016)

    /** Thinking-terminal panel palette. */
    val terminalBackground = Color(0xFF070A0A)
    val terminalHeader = Color(0xFF9FB3AD)
    val terminalHistory = Color(0xFF8CA89B)

    /** Swipe-to-generate pill ignition gold. */
    val swipePillGold = Color(0xFFFFE7A6)

    /** Agency stats pill profit/loss. */
    val statsPillProfit = Color(0xFF4ADE80)
    val statsPillLoss = Color(0xFFF87171)

    /** Neutral team-disc gradient fallback (no team colors known). */
    val teamDiscNeutralTop = Color(0xFF1F2937)
    val teamDiscNeutralBottom = Color(0xFF6B7280)
}
