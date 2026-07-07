package com.wagerproof.app.features.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.AuthStore

private const val INVITE_URL = "https://discord.gg/gwy9y7XSDV"
private const val LINK_URL_BASE = "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/discord-callback"
private val blurple = Color(0xFF5865F2)
private val blurpleLight = Color(0xFF7289DA)
private val discordGreen = Color(0xFF22D35F)
private val amber = Color(0xFFD97706)

/**
 * Discord modal — port of iOS `Features/Settings/DiscordView`.
 *
 * Non-Pro users see a locked card that opens the paywall; Pro users get the
 * two-step link + join flow.
 *
 * // FIDELITY-WAIVER #254: the live `profiles.discord_user_id` link-state read
 * // is not performed — the app module has no direct Supabase (postgrest)
 * // classpath, and adding a core service is out of this batch's scope. We show
 * // the "not linked" state, which is exactly iOS's failure fallback ("treat
 * // unknown as not-linked"). Linking + joining both work.
 */
@Composable
fun DiscordScreen(onDismiss: () -> Unit, onUpgrade: () -> Unit, modifier: Modifier = Modifier) {
    val proAccess = appGraph().proAccess
    val auth = appGraph().auth
    val uriHandler = LocalUriHandler.current
    BackHandler(onBack = onDismiss)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "Discord", onDismiss = onDismiss)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(vertical = Spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            // Hero
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.lg),
            ) {
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(blurple, blurpleLight))),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL.imageVector,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(50.dp),
                    )
                }
                Text(
                    text = "Join Our Discord Community",
                    style = AppTypography.display,
                    color = AppColors.appTextPrimary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = Spacing.lg),
                )
            }

            if (proAccess.isPro) {
                Column(
                    modifier = Modifier.padding(horizontal = Spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(Spacing.lg),
                ) {
                    StepCard(
                        iconBg = blurple.copy(alpha = 0.15f),
                        iconColor = blurple,
                        icon = AppIcon.LINK.imageVector,
                        title = "Step 1: Link Your Discord Account",
                        description = "Link your Discord account to verify your subscription and get the WagerProof Member role with access to exclusive channels.",
                        buttonLabel = "Link Discord Account",
                        buttonIcon = AppIcon.LINK.imageVector,
                    ) {
                        val userId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId ?: return@StepCard
                        uriHandler.openUri("$LINK_URL_BASE?user_id=$userId")
                    }
                    StepCard(
                        iconBg = discordGreen.copy(alpha = 0.15f),
                        iconColor = discordGreen,
                        icon = AppIcon.CHECKMARK_SHIELD_FILL.imageVector,
                        title = "Step 2: Join the Discord Server",
                        description = "Click below to join other community members! Enable notifications to receive instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.",
                        buttonLabel = "Join Discord Server",
                        buttonIcon = AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL.imageVector,
                    ) {
                        uriHandler.openUri(INVITE_URL)
                    }
                }
            } else {
                LockedCard(modifier = Modifier.padding(horizontal = Spacing.lg), onUpgrade = onUpgrade)
            }

            BenefitsList(modifier = Modifier.padding(horizontal = Spacing.lg))

            Text(
                text = "By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service",
                style = AppTypography.caption,
                color = AppColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = Spacing.lg),
            )
        }
    }
}

@Composable
private fun StepCard(
    iconBg: Color,
    iconColor: Color,
    icon: ImageVector,
    title: String,
    description: String,
    buttonLabel: String,
    buttonIcon: ImageVector,
    onButton: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Box(
            modifier = Modifier.size(80.dp).background(iconBg, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(36.dp))
        }
        Text(title, style = AppTypography.title, color = AppColors.appTextPrimary, textAlign = TextAlign.Center)
        Text(description, style = AppTypography.body, color = AppColors.appTextSecondary, textAlign = TextAlign.Center)
        GradientButton(
            label = buttonLabel,
            icon = buttonIcon,
            gradient = listOf(blurple, blurpleLight),
            onClick = onButton,
        )
    }
}

@Composable
private fun LockedCard(modifier: Modifier = Modifier, onUpgrade: () -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Row(
            modifier = Modifier
                .background(amber.copy(alpha = 0.15f), RoundedCornerShape(999.dp))
                .padding(horizontal = Spacing.md, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(AppIcon.CROWN_FILL.imageVector, contentDescription = null, tint = amber, modifier = Modifier.size(14.dp))
            Text("PRO FEATURE", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = amber)
        }
        Box(
            modifier = Modifier.size(80.dp).background(discordGreen.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CHECKMARK_SHIELD_FILL.imageVector, contentDescription = null, tint = discordGreen, modifier = Modifier.size(40.dp))
        }
        Text("Unlock our private Discord server!", style = AppTypography.title, color = AppColors.appTextPrimary, textAlign = TextAlign.Center)
        Text(
            "Get instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.",
            style = AppTypography.body,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        GradientButton(
            label = "Unlock with Pro",
            icon = AppIcon.LOCK_OPEN_FILL.imageVector,
            gradient = listOf(AppColors.appAccentAmber, amber),
            onClick = onUpgrade,
        )
    }
}

@Composable
private fun GradientButton(label: String, icon: ImageVector, gradient: List<Color>, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.horizontalGradient(gradient))
            .clickable(onClick = onClick)
            .padding(vertical = Spacing.md),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        Text(
            text = label,
            style = AppTypography.bodyEmphasized,
            color = Color.White,
            modifier = Modifier.padding(start = Spacing.sm),
        )
    }
}

@Composable
private fun BenefitsList(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Benefit(AppIcon.PERSON_CROP_CIRCLE_FILL.imageVector, "Active Community", "Connect with subscribers who share your passion for smart betting")
        Benefit(AppIcon.BELL_BADGE_FILL.imageVector, "Push Notifications", "Get instant Editors Picks alerts sent directly to your phone")
        Benefit(AppIcon.LOCK_SHIELD_FILL.imageVector, "Exclusive Access", "Subscriber-only channels with premium content and analysis")
    }
}

@Composable
private fun Benefit(icon: ImageVector, title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(12.dp))
            .padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(
            modifier = Modifier.size(60.dp).background(discordGreen.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = discordGreen, modifier = Modifier.size(26.dp))
        }
        Text(title, style = AppTypography.headline, color = AppColors.appTextPrimary)
        Text(body, style = AppTypography.body, color = AppColors.appTextSecondary, textAlign = TextAlign.Center)
    }
}
