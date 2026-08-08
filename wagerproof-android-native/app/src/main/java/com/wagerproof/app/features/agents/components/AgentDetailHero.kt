package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.gamecards.teamVisible
import com.wagerproof.app.features.props.teamGlassDisc
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentPerformance
import java.util.Locale

// ---------------------------------------------------------------------------
// Single-agent collapsing detail hero + aura. Port of iOS AgentDetailHero.swift.
// Hosted by the collapsing scroll: the hero receives `progress` (0 = expanded,
// 1 = collapsed) and morphs the avatar disc + name + stats from a tall centered
// block into a compact bar. Used by both owner + public agent detail screens.
// ---------------------------------------------------------------------------

// MARK: - Background

/**
 * Per-agent "pixelwave" backdrop — the animated pixel-glyph field tinted with
 * the agent's primary color so glyphs glow in the agent's hue. Screen-anchored
 * so the page background and its hero mask render one seamless field.
 */
@Composable
fun AgentPixelWaveBackground(
    avatarColor: String,
    progress: Float,
    modifier: Modifier = Modifier,
    rippleEmitter: GlyphRippleEmitter? = null,
) {
    PixelWaveBackground(
        modifier = modifier,
        accentColor = AgentColorPalette.primary(avatarColor),
        progress = progress,
        screenAnchored = true,
        rippleEmitter = rippleEmitter,
    )
}

// MARK: - Hero

@Composable
fun AgentGlassHero(
    agent: Agent,
    performance: AgentPerformance?,
    progress: Float,
    modifier: Modifier = Modifier,
    /** When true, the Net Units stat shows a lock blur (non-Pro). */
    lockedNetUnits: Boolean = false,
    /** Optional subtitle shown under the name in expanded state (e.g. "Public Agent"). */
    subtitle: String? = null,
    subtitleSystemImage: String? = null,
    /** While a run is in flight, the disc swaps to the seated "working" pose. */
    isGenerating: Boolean = false,
    bigSize: androidx.compose.ui.unit.Dp = 76.dp,
    smallSize: androidx.compose.ui.unit.Dp = 44.dp,
    /** Easter egg: reports the avatar disc's window center so the caller can ripple the field. */
    onAvatarTap: ((Offset) -> Unit)? = null,
) {
    val p = progress.coerceIn(0f, 1f)

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.TopStart,
    ) {
        // HARD CUT at the midpoint, no crossfade (iOS AgentDetailHero:66-79): both
        // layouts are anchored top-start, so a dissolve would double the avatar disc
        // and the name on top of each other through the middle of the collapse.
        if (p < 0.5f) {
            ExpandedHeader(
                agent = agent,
                performance = performance,
                lockedNetUnits = lockedNetUnits,
                subtitle = subtitle,
                subtitleSystemImage = subtitleSystemImage,
                isGenerating = isGenerating,
                discSize = bigSize,
                onAvatarTap = onAvatarTap,
            )
        } else {
            CompactHeader(
                agent = agent,
                performance = performance,
                lockedNetUnits = lockedNetUnits,
                isGenerating = isGenerating,
                discSize = smallSize,
                onAvatarTap = onAvatarTap,
            )
        }
    }
}

// MARK: Expanded — avatar + name (left), 2×2 stat quadrant (right)

@Composable
private fun ExpandedHeader(
    agent: Agent,
    performance: AgentPerformance?,
    lockedNetUnits: Boolean,
    subtitle: String?,
    subtitleSystemImage: String?,
    isGenerating: Boolean,
    discSize: androidx.compose.ui.unit.Dp,
    onAvatarTap: ((Offset) -> Unit)?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                AvatarDisc(agent, discSize, isGenerating, onAvatarTap)
                androidx.compose.material3.Text(
                    text = agent.name,
                    color = AppColors.appTextPrimary,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!subtitle.isNullOrEmpty()) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (!subtitleSystemImage.isNullOrEmpty()) {
                            androidx.compose.material3.Icon(
                                imageVector = agentSymbol(subtitleSystemImage),
                                contentDescription = null,
                                tint = AppColors.appTextSecondary,
                                modifier = Modifier.size(10.dp),
                            )
                        }
                        androidx.compose.material3.Text(
                            text = subtitle,
                            color = AppColors.appTextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
            Spacer(Modifier.width(10.dp))
            AgentStatQuadrant(
                performance = performance,
                lockedNetUnits = lockedNetUnits,
                modifier = Modifier.widthIn(max = 210.dp),
            )
        }
        SportPills(agent)
    }
}

// MARK: Compact — small avatar + name + one-line stats

@Composable
private fun CompactHeader(
    agent: Agent,
    performance: AgentPerformance?,
    lockedNetUnits: Boolean,
    isGenerating: Boolean,
    discSize: androidx.compose.ui.unit.Dp,
    onAvatarTap: ((Offset) -> Unit)?,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AvatarDisc(agent, discSize, isGenerating, onAvatarTap)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            androidx.compose.material3.Text(
                text = agent.name,
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            CompactStatLine(performance, lockedNetUnits)
        }
        Spacer(Modifier.width(0.dp))
    }
}

// MARK: Avatar

@Composable
private fun AvatarDisc(
    agent: Agent,
    size: androidx.compose.ui.unit.Dp,
    isGenerating: Boolean,
    onAvatarTap: ((Offset) -> Unit)?,
) {
    val primary = AgentColorPalette.primary(agent.avatarColor).teamVisible(0.5f)
    val secondary = AgentColorPalette.secondary(agent.avatarColor).teamVisible(0.5f)
    // Track the disc's window center every frame (it moves while the hero
    // collapses) so a tap ripples from the live position.
    var center by remember { mutableStateOf(Offset.Zero) }

    var mod = Modifier
        .size(size)
        // Accent shadow lifts the disc off the pixelwave (iOS AgentDetailHero:163).
        .shadow(
            elevation = 7.dp,
            shape = CircleShape,
            ambientColor = primary.copy(alpha = 0.3f),
            spotColor = primary.copy(alpha = 0.3f),
        )
        // `tint = 0.5` matches iOS's explicit glass tint for this disc.
        .teamGlassDisc(primary = primary, secondary = secondary, tint = 0.5f)
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    if (onAvatarTap != null) {
        mod = mod
            .onGloballyPositioned { center = it.boundsInWindow().center }
            .clip(CircleShape)
            // No ripple indication — mirrors iOS onTapGesture over a circular hit area.
            .clickable(
                interactionSource = interaction,
                indication = null,
            ) { onAvatarTap(center) }
    }

    Box(modifier = mod, contentAlignment = Alignment.Center) {
        // Hero disc swaps to the seated SitWorkSprite + LaptopSprite while a run
        // is in flight, matching iOS AgentDetailHero.swift:138-154.
        if (isGenerating) {
            Box(Modifier.size(size), contentAlignment = Alignment.Center) {
                SitWorkSprite(spriteIndex = agent.spriteIndex, modifier = Modifier.size(size * 0.60f, size * 0.80f))
                Box(Modifier.size(size * 0.30f, size * 0.44f).offset(y = size * 0.16f)) {
                    LaptopSprite()
                }
            }
        } else {
            val pad = size * 0.18f
            PixelSpriteAvatar(
                spriteIndex = agent.spriteIndex,
                modifier = Modifier.size(size).padding(pad),
            )
        }
    }
}

// MARK: Sport pills

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SportPills(agent: Agent) {
    // FlowRow, not Row: a 4-5 sport agent overruns the hero's width and a plain Row
    // squeezes/clips the trailing pills. iOS keeps each pill at its natural size
    // (`.fixedSize`) and lets the hero clip; wrapping is the closest behavior that
    // never truncates a label.
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        agent.preferredSports.forEach { sport ->
            Box(
                modifier = Modifier
                    .liquidGlassBackground(CircleShape)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                androidx.compose.material3.Text(
                    text = sport.label,
                    color = AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

// MARK: Compact stat line

@Composable
private fun CompactStatLine(performance: AgentPerformance?, lockedNetUnits: Boolean) {
    val perf = performance
    val netTint = if ((perf?.netUnits ?: 0.0) >= 0) AppColors.appWin else AppColors.appLoss
    val streakColor = streakColor(perf)
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompactStat(perf?.recordLabel ?: "0-0", AppColors.appTextPrimary)
        Dot()
        CompactStat(
            if (lockedNetUnits) "•••" else (perf?.netUnitsLabel ?: "+0.00u"),
            if (lockedNetUnits) AppColors.appTextSecondary else netTint,
        )
        Dot()
        CompactStat(perf?.winRate?.let { String.format(Locale.US, "%.0f%%", it * 100) } ?: "-", AppColors.appTextPrimary)
        val streak = perf?.currentStreakLabel
        if (streak != null && streak != "-") {
            Dot()
            CompactStat(streak, streakColor)
        }
    }
}

@Composable
private fun CompactStat(value: String, tint: Color) {
    androidx.compose.material3.Text(
        text = value,
        color = tint,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
        maxLines = 1,
    )
}

@Composable
private fun Dot() {
    androidx.compose.material3.Text(
        text = "·",
        color = AppColors.appTextMuted,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
    )
}

private fun streakColor(perf: AgentPerformance?): Color {
    val cs = perf?.currentStreak ?: 0
    return when {
        cs > 0 -> AppColors.appWin
        cs < 0 -> AppColors.appLoss
        else -> AppColors.appTextSecondary
    }
}

// MARK: - Stat strip (shared)

/**
 * Four-cell Record / Net Units / Win Rate / Streak strip. Both detail screens
 * render an identical strip, with the Net Units lock-blur preserved for non-Pro.
 */
@Composable
fun AgentStatStrip(
    performance: AgentPerformance?,
    modifier: Modifier = Modifier,
    lockedNetUnits: Boolean = false,
) {
    val perf = performance
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        AgentStatCell("Record", perf?.recordLabel ?: "0-0", modifier = Modifier.weight(1f))
        StripDivider()
        AgentStatCell(
            "Net Units",
            perf?.netUnitsLabel ?: "+0.00u",
            tint = if ((perf?.netUnits ?: 0.0) >= 0) AppColors.appWin else AppColors.appLoss,
            locked = lockedNetUnits,
            modifier = Modifier.weight(1f),
        )
        StripDivider()
        AgentStatCell(
            "Win Rate",
            perf?.winRate?.let { String.format(Locale.US, "%.1f%%", it * 100) } ?: "-",
            modifier = Modifier.weight(1f),
        )
        StripDivider()
        AgentStatCell(
            "Streak",
            perf?.currentStreakLabel ?: "-",
            tint = streakColor(perf),
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun StripDivider() {
    Box(
        Modifier
            .width(1.dp)
            .height(30.dp)
            .background(AppColors.appBorder),
    )
}

/**
 * 2×2 quadrant of the agent's headline stats on Liquid-Glass tiles — the
 * expanded hero's right column. Net Units lock-blurs for non-Pro.
 */
@Composable
fun AgentStatQuadrant(
    performance: AgentPerformance?,
    modifier: Modifier = Modifier,
    lockedNetUnits: Boolean = false,
) {
    val perf = performance
    val netTint = if ((perf?.netUnits ?: 0.0) >= 0) AppColors.appWin else AppColors.appLoss
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Tile(Modifier.weight(1f)) { AgentStatCell("Record", perf?.recordLabel ?: "0-0") }
            Tile(Modifier.weight(1f)) {
                AgentStatCell("Net Units", perf?.netUnitsLabel ?: "+0.00u", tint = netTint, locked = lockedNetUnits)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Tile(Modifier.weight(1f)) {
                AgentStatCell("Win Rate", perf?.winRate?.let { String.format(Locale.US, "%.1f%%", it * 100) } ?: "-")
            }
            Tile(Modifier.weight(1f)) { AgentStatCell("Streak", perf?.currentStreakLabel ?: "-", tint = streakColor(perf)) }
        }
    }
}

@Composable
private fun Tile(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = modifier
            .liquidGlassBackground(shape)
            .border(1.dp, Color.White.copy(alpha = 0.08f), shape)
            .padding(vertical = 8.dp, horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

@Composable
fun AgentStatCell(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    tint: Color = AppColors.appTextPrimary,
    locked: Boolean = false,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        androidx.compose.material3.Text(
            text = label,
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
        )
        Box(contentAlignment = Alignment.Center) {
            androidx.compose.material3.Text(
                text = value,
                color = tint,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                // Long records ("95-103-5") must shrink to one line, not wrap.
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                // Blur the glyphs themselves — a plate alone can be defeated by any
                // future layout change that resizes the value out from under it.
                modifier = if (locked) Modifier.blur(9.dp) else Modifier,
            )
            if (locked) {
                // Cover the WHOLE value, not a small chip: a paywalled net-units
                // figure must be unreadable (iOS washes the entire cell with
                // .ultraThinMaterial and centers the lock over it).
                Box(
                    Modifier
                        .matchParentSize()
                        .clip(RoundedCornerShape(6.dp))
                        .background(AppColors.appSurfaceElevated.copy(alpha = 0.88f)),
                )
                androidx.compose.material3.Icon(
                    imageVector = agentSymbol("lock.fill"),
                    contentDescription = null,
                    tint = AppColors.appTextSecondary,
                    modifier = Modifier.size(10.dp),
                )
            }
        }
    }
}
