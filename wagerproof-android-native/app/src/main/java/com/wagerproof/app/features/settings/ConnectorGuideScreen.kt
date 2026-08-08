package com.wagerproof.app.features.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import kotlinx.coroutines.delay

/**
 * AI Connector setup guide — port of iOS `WagerproofClaudeConnectorGuideSheet`
 * (`Features/Settings/SettingsView.swift`), widened to every provider WagerProof
 * publishes instructions for (web `src/features/mcp/mcpContent.ts`).
 *
 * Shape: hero → "add it once" callout → provider picker (+ Connector/Command
 * line toggle where the provider offers both) → three numbered steps with a
 * tap-to-copy endpoint/command card and outbound links → example chat mockups →
 * tap-to-copy prompts → the read-only boundary.
 *
 * Not Pro-gated on purpose: the connector is read-only and authorizes against
 * the account the user signs into, so every signed-in user can set it up (same
 * rule as iOS).
 *
 * // FIDELITY-WAIVER #335: iOS ships ONE Claude-only walkthrough (four steps,
 * // Claude screenshots, Claude-worded copy). Android ships the provider-neutral
 * // version instead — shared copy names no vendor, and the vendor specifics sit
 * // behind a provider picker fed by the same matrix the web tutorial uses. The
 * // Claude screenshots are still shown, but only under the Claude tab.
 * // Presentation also differs: a full-screen sub-screen with the standard
 * // Settings bar + Back, not a detented sheet with a floating close button.
 */
@Composable
fun ConnectorGuideScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    BackHandler(onBack = onDismiss)

    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    val uriHandler = LocalUriHandler.current

    var providerKey by remember { mutableStateOf(ConnectorContent.DEFAULT_PROVIDER.key) }
    // Held loosely: a provider without the requested mode falls back to its own
    // default instead of rendering nothing (see ConnectorContent.resolveMode).
    var requestedMode by remember { mutableStateOf<ConnectorMode?>(null) }
    var copiedValue by remember { mutableStateOf<String?>(null) }

    val provider = ConnectorContent.provider(providerKey)
    val mode = ConnectorContent.resolveMode(provider, requestedMode)
    val guide = ConnectorContent.guide(provider, requestedMode)

    // Auto-clears the "Copied" affordance; re-keying on the value restarts the
    // timer when the user copies something else.
    LaunchedEffect(copiedValue) {
        if (copiedValue == null) return@LaunchedEffect
        delay(1600)
        copiedValue = null
    }

    val copy: (String) -> Unit = { value ->
        clipboard.setText(AnnotatedString(value))
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        copiedValue = value
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "AI Connector", onDismiss = onDismiss)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = Spacing.xxl),
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            Hero()

            Column(
                modifier = Modifier.padding(horizontal = Spacing.lg),
                verticalArrangement = Arrangement.spacedBy(Spacing.xl),
            ) {
                Callout()

                // --- Setup ---
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                    SectionTitle(
                        eyebrow = ConnectorContent.SETUP_EYEBROW,
                        title = ConnectorContent.SETUP_TITLE,
                        subtitle = ConnectorContent.SETUP_SUBTITLE,
                    )

                    ProviderPicker(
                        selectedKey = provider.key,
                        onSelect = { providerKey = it },
                    )

                    if (provider.guides.size > 1) {
                        ModeToggle(
                            provider = provider,
                            selected = mode,
                            onSelect = { requestedMode = it },
                        )
                    }

                    ConnectorStep(number = 1, title = guide.copyTitle, detail = guide.copyDescription) {
                        CopyCard(
                            label = guide.copyLabel,
                            displayValue = guide.copyDisplayValue ?: guide.copyValue,
                            isEndpoint = guide.copyValue == ConnectorContent.ENDPOINT,
                            copied = copiedValue == guide.copyValue,
                            onCopy = { copy(guide.copyValue) },
                        )
                    }

                    ConnectorStep(number = 2, title = guide.setupTitle, detail = guide.setupDescription) {
                        guide.setupScreenshots.forEach { shot ->
                            Image(
                                painter = painterResource(shot.image),
                                contentDescription = shot.contentDescription,
                                contentScale = ContentScale.Fit,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = shot.maxHeightDp.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(shot.backgroundColor))
                                    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(12.dp)),
                            )
                        }
                        LinkButton(
                            label = guide.setupLabel,
                            onClick = { uriHandler.openUri(guide.setupUrl) },
                        )
                    }

                    ConnectorStep(number = 3, title = guide.finishTitle, detail = guide.finishDescription) {
                        NoteBlock(
                            icon = AppIcon.CHECKMARK_SHIELD_FILL.imageVector,
                            iconTint = AppColors.appPrimary,
                            background = AppColors.appPrimary.copy(alpha = 0.09f),
                            text = ConnectorContent.VERIFY_URL_NOTE,
                        )
                        LinkButton(
                            label = guide.finishLabel,
                            onClick = { uriHandler.openUri(guide.finishUrl) },
                            filled = false,
                        )
                    }

                    InlineNote(
                        icon = AppIcon.PERSON_2_BADGE_GEARSHAPE_FILL.imageVector,
                        text = ConnectorContent.ORG_PLAN_NOTE,
                    )
                }

                // --- Demos ---
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
                    SectionTitle(
                        eyebrow = ConnectorContent.DEMO_EYEBROW,
                        title = ConnectorContent.DEMO_TITLE,
                        subtitle = ConnectorContent.DEMO_SUBTITLE,
                    )
                    ConnectorContent.DEMOS.forEach { DemoCard(it) }
                }

                // --- Prompts ---
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                    SectionTitle(
                        eyebrow = ConnectorContent.PROMPTS_EYEBROW,
                        title = ConnectorContent.PROMPTS_TITLE,
                        subtitle = ConnectorContent.PROMPTS_SUBTITLE,
                    )
                    ConnectorContent.EXAMPLE_PROMPTS.forEach { prompt ->
                        PromptRow(
                            prompt = prompt,
                            copied = copiedValue == prompt,
                            onCopy = { copy(prompt) },
                        )
                    }
                }

                PrivacyBlock()

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { uriHandler.openUri(ConnectorContent.DOCS_URL) }
                        .padding(vertical = Spacing.sm),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = ConnectorContent.DOCS_LINK_LABEL,
                        style = AppTypography.bodyEmphasized,
                        color = accent,
                    )
                    Icon(
                        imageVector = AppIcon.ARROW_UP_RIGHT.imageVector,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.padding(start = 6.dp).size(14.dp),
                    )
                }
            }
        }
    }
}

/**
 * Guide accent — the second stop of the banner gradient, carried through so the
 * banner → guide transition reads as one surface (iOS does the same).
 */
private val accent = Color(0xFFD97757)
private val accentDeep = Color(0xFF4D2D27)
private val accentMid = Color(0xFFA6533F)

@Composable
private fun Hero() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))
            .background(Brush.linearGradient(listOf(accentDeep, accentMid, accent)))
            .padding(horizontal = Spacing.xl, vertical = Spacing.xl),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(17.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.30f), RoundedCornerShape(17.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = AppIcon.LINK.imageVector,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(26.dp),
                    )
                }
                Text(
                    text = ConnectorContent.HERO_EYEBROW,
                    fontSize = 10.sp,
                    letterSpacing = 1.1.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.78f),
                )
            }
            Text(
                text = ConnectorContent.HERO_TITLE,
                style = AppTypography.display.copy(fontSize = 26.sp, lineHeight = 31.sp),
                color = Color.White,
            )
            Text(
                text = ConnectorContent.HERO_BODY,
                fontSize = 15.sp,
                lineHeight = 21.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.90f),
            )
        }
    }
}

@Composable
private fun Callout() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(accent.copy(alpha = 0.10f), RoundedCornerShape(20.dp))
            .border(1.dp, accent.copy(alpha = 0.24f), RoundedCornerShape(20.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Icon(
                imageVector = AppIcon.ANTENNA_RADIOWAVES.imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = ConnectorContent.CALLOUT_TITLE,
                style = AppTypography.headline,
                color = AppColors.appTextPrimary,
            )
        }
        Text(
            text = ConnectorContent.CALLOUT_BODY,
            style = AppTypography.caption,
            color = AppColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Icon(
                imageVector = AppIcon.INFO_CIRCLE_FILL.imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = ConnectorContent.CALLOUT_NOTE,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SectionTitle(eyebrow: String, title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        Text(
            text = eyebrow,
            fontSize = 10.sp,
            letterSpacing = 1.1.sp,
            fontWeight = FontWeight.Bold,
            color = accent,
        )
        Text(
            text = title,
            style = AppTypography.display.copy(fontSize = 21.sp, lineHeight = 26.sp),
            color = AppColors.appTextPrimary,
        )
        Text(text = subtitle, style = AppTypography.caption, color = AppColors.appTextSecondary)
    }
}

// MARK: - Provider picker

@Composable
private fun ProviderPicker(selectedKey: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        ConnectorContent.PROVIDERS.forEach { provider ->
            val selected = provider.key == selectedKey
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(
                        if (selected) accent.copy(alpha = 0.18f) else AppColors.appSurfaceElevated,
                    )
                    .border(
                        width = 1.dp,
                        color = if (selected) accent.copy(alpha = 0.55f) else AppColors.appBorder,
                        shape = RoundedCornerShape(999.dp),
                    )
                    .clickable { onSelect(provider.key) }
                    .padding(start = 6.dp, end = Spacing.md, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                ProviderLogo(provider, size = 26)
                Text(
                    text = provider.name,
                    style = AppTypography.captionEmphasized,
                    color = if (selected) AppColors.appTextPrimary else AppColors.appTextSecondary,
                )
            }
        }
    }
}

/** Provider logo chip; the catch-all entry has no artwork, so it gets a glyph. */
@Composable
private fun ProviderLogo(provider: ConnectorProvider, size: Int) {
    val shape = RoundedCornerShape((size * 0.3f).dp)
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(shape)
            .background(Color(provider.iconBackground)),
        contentAlignment = Alignment.Center,
    ) {
        val icon = provider.icon
        if (icon != null) {
            Image(
                painter = painterResource(icon),
                contentDescription = null,
                contentScale = if (provider.iconFit == ConnectorIconFit.Cover) {
                    ContentScale.Crop
                } else {
                    ContentScale.Fit
                },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(if (provider.iconFit == ConnectorIconFit.Contain) (size * 0.13f).dp else 0.dp),
            )
        } else {
            Icon(
                imageVector = AppIcon.SPARKLES.imageVector,
                contentDescription = null,
                tint = Color(provider.accent),
                modifier = Modifier.size((size * 0.6f).dp),
            )
        }
    }
}

@Composable
private fun ModeToggle(
    provider: ConnectorProvider,
    selected: ConnectorMode,
    onSelect: (ConnectorMode) -> Unit,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(AppColors.appSurfaceMuted)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        ConnectorMode.entries.filter { provider.guides.containsKey(it) }.forEach { candidate ->
            val isSelected = candidate == selected
            Text(
                text = candidate.label,
                style = AppTypography.captionEmphasized,
                color = if (isSelected) Color.White else AppColors.appTextSecondary,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (isSelected) accent else Color.Transparent)
                    .clickable { onSelect(candidate) }
                    .padding(horizontal = Spacing.md, vertical = 7.dp),
            )
        }
    }
}

// MARK: - Steps

@Composable
private fun ConnectorStep(
    number: Int,
    title: String,
    detail: String,
    content: @Composable () -> Unit = {},
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(20.dp))
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(20.dp))
            .padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            Box(
                modifier = Modifier.size(30.dp).background(accent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("$number", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                Text(text = title, style = AppTypography.headline, color = AppColors.appTextPrimary)
                Text(text = detail, style = AppTypography.caption, color = AppColors.appTextSecondary)
            }
        }
        content()
    }
}

@Composable
private fun CopyCard(
    label: String,
    displayValue: String,
    isEndpoint: Boolean,
    copied: Boolean,
    onCopy: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = if (isEndpoint) "NAME" else label.uppercase(),
                    fontSize = 10.sp,
                    letterSpacing = 0.8.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.appTextMuted,
                )
                // The endpoint card doubles as a form preview — it shows the exact
                // connector NAME to type next to the URL, which a CLI card has no
                // equivalent of.
                if (isEndpoint) {
                    Text(
                        text = "WagerProof",
                        style = AppTypography.captionEmphasized.copy(fontSize = 14.sp),
                        color = AppColors.appTextPrimary,
                    )
                }
            }
            if (isEndpoint) {
                Text(
                    text = "CUSTOM",
                    fontSize = 9.sp,
                    letterSpacing = 0.6.sp,
                    fontWeight = FontWeight.Bold,
                    color = accent,
                    modifier = Modifier
                        .background(accent.copy(alpha = 0.12f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 7.dp, vertical = 4.dp),
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(AppColors.appSurfaceMuted)
                .border(
                    width = 1.dp,
                    color = if (copied) AppColors.appPrimary.copy(alpha = 0.45f) else AppColors.appBorder,
                    shape = RoundedCornerShape(12.dp),
                )
                .clickable(onClick = onCopy)
                .padding(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = displayValue,
                style = AppTypography.monoCaption.copy(fontSize = 11.5.sp),
                color = AppColors.appTextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                imageVector = if (copied) {
                    AppIcon.CHECKMARK_CIRCLE_FILL.imageVector
                } else {
                    AppIcon.DOC_ON_DOC.imageVector
                },
                contentDescription = if (copied) "Copied" else "Copy",
                tint = if (copied) AppColors.appPrimary else accent,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun LinkButton(label: String, onClick: () -> Unit, filled: Boolean = true) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (filled) accent else Color.Transparent)
            .then(
                if (filled) Modifier else Modifier.border(1.dp, AppColors.appBorderStrong, RoundedCornerShape(16.dp)),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = AppTypography.majorCta,
            color = if (filled) Color.White else AppColors.appTextPrimary,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = AppIcon.ARROW_UP_RIGHT.imageVector,
            contentDescription = null,
            tint = if (filled) Color.White else AppColors.appTextSecondary,
            modifier = Modifier.size(15.dp),
        )
    }
}

@Composable
private fun NoteBlock(icon: ImageVector, iconTint: Color, background: Color, text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(background, RoundedCornerShape(14.dp))
            .padding(Spacing.md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(16.dp))
        Text(
            text = text,
            fontSize = 12.sp,
            lineHeight = 17.sp,
            fontWeight = FontWeight.Medium,
            color = AppColors.appTextSecondary,
        )
    }
}

@Composable
private fun InlineNote(icon: ImageVector, text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.xs),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
        Text(text = text, fontSize = 12.sp, lineHeight = 17.sp, color = AppColors.appTextSecondary)
    }
}

// MARK: - Demos

@Composable
private fun DemoCard(demo: ConnectorDemo) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(
            text = demo.caption,
            style = AppTypography.bodyEmphasized,
            color = AppColors.appTextSecondary,
            modifier = Modifier.padding(start = 2.dp),
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF0F0F0F), RoundedCornerShape(22.dp))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(22.dp))
                .padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text(
                    text = demo.userText,
                    fontSize = 14.5.sp,
                    lineHeight = 20.sp,
                    color = Color.White,
                    modifier = Modifier
                        .padding(start = 44.dp)
                        .background(Color(0xFF2A2A28), RoundedCornerShape(18.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }

            // Tool-call chip — the "your assistant called WagerProof" moment.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Box(Modifier.size(7.dp).background(Color(0xFF9CCB7A), CircleShape))
                Text(
                    text = demo.toolText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.5f),
                )
                Icon(
                    imageVector = AppIcon.CHEVRON_RIGHT.imageVector,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.35f),
                    modifier = Modifier.size(10.dp),
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                demo.lines.forEach { line ->
                    when (line) {
                        is ConnectorDemoLine.Reply -> Text(
                            text = line.text,
                            fontSize = 14.5.sp,
                            lineHeight = 20.sp,
                            color = Color.White.copy(alpha = 0.9f),
                        )
                        is ConnectorDemoLine.Bullet -> Row(
                            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                        ) {
                            Text("•", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = accent)
                            Text(
                                text = line.name,
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White.copy(alpha = 0.92f),
                            )
                            Text(
                                text = line.meta,
                                fontSize = 14.5.sp,
                                color = Color.White.copy(alpha = 0.5f),
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Prompts + privacy

@Composable
private fun PromptRow(prompt: String, copied: Boolean, onCopy: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .border(
                width = 1.dp,
                color = if (copied) AppColors.appPrimary.copy(alpha = 0.45f) else AppColors.appBorder,
                shape = RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onCopy)
            .padding(15.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            imageVector = AppIcon.BUBBLE_LEFT_AND_TEXT_BUBBLE_RIGHT_FILL.imageVector,
            contentDescription = null,
            tint = accent,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = prompt,
            style = AppTypography.caption.copy(fontSize = 14.sp, lineHeight = 19.sp),
            color = AppColors.appTextPrimary,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = if (copied) {
                AppIcon.CHECKMARK_CIRCLE_FILL.imageVector
            } else {
                AppIcon.DOC_ON_DOC.imageVector
            },
            contentDescription = if (copied) "Copied" else "Copy prompt",
            tint = if (copied) AppColors.appPrimary else AppColors.appTextMuted,
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun PrivacyBlock() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(accent.copy(alpha = 0.10f), RoundedCornerShape(20.dp))
            .border(1.dp, accent.copy(alpha = 0.24f), RoundedCornerShape(20.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Icon(
                imageVector = AppIcon.LOCK_SHIELD_FILL.imageVector,
                contentDescription = null,
                tint = AppColors.appTextPrimary,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = ConnectorContent.PRIVACY_TITLE,
                style = AppTypography.headline,
                color = AppColors.appTextPrimary,
            )
        }
        Text(
            text = ConnectorContent.PRIVACY_BODY,
            style = AppTypography.caption,
            color = AppColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Icon(
                imageVector = AppIcon.EXCLAMATION_TRIANGLE_FILL.imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(14.dp),
            )
            Text(
                text = ConnectorContent.PRIVACY_DISCLAIMER,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Medium,
                color = accent,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Icon(
                imageVector = AppIcon.RECTANGLE_PORTRAIT_AND_ARROW_RIGHT.imageVector,
                contentDescription = null,
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(14.dp),
            )
            Text(
                text = ConnectorContent.PRIVACY_DISCONNECT,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.appTextSecondary,
            )
        }
    }
}
