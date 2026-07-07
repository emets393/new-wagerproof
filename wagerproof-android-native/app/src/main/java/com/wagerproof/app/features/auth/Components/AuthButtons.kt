package com.wagerproof.app.features.auth.Components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

// Error/success accent — iOS uses a fixed 0xFF6B6B coral for auth errors and
// appPrimary for success (matched here so banners read identically).
private val AuthErrorColor = Color(0xFFFF6B6B)

/** Light (white fill / black content) vs dark (black fill / white content) pill. */
enum class AuthPillStyle {
    Light,
    Dark;

    val foreground: Color get() = if (this == Light) Color.Black else Color.White
    val fill: Color get() = if (this == Light) Color.White else Color.Black
}

/**
 * Press-feedback helper shared by every auth pill — the Compose stand-in for
 * iOS `PillPressStyle` (0.98 scale / 0.85 opacity while pressed). Apply to the
 * pill's Modifier chain alongside the clickable that owns [interactionSource].
 */
fun Modifier.pillPressEffect(interactionSource: MutableInteractionSource): Modifier = composed {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.98f else 1f, tween(120), label = "pillScale")
    val opacity by animateFloatAsState(if (pressed) 0.85f else 1f, tween(120), label = "pillOpacity")
    this.scale(scale).alpha(opacity)
}

/**
 * The shared sign-in pill (Apple/Google/Email on the gate + sign-up). Renders
 * the [glyph] + [title] on a solid light/dark capsule; the dark variant gets a
 * hairline rim to stay legible on the near-black gate. Port of iOS
 * `AuthPillLabel` — here it's a full button (label + click) since Compose has no
 * detached `buttonStyle`.
 */
@Composable
fun AuthPillButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: AuthPillStyle = AuthPillStyle.Light,
    loading: Boolean = false,
    enabled: Boolean = true,
    glyph: @Composable () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(28.dp)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp)
            .pillPressEffect(interaction)
            .clip(shape)
            .background(style.fill, shape)
            .then(
                if (style == AuthPillStyle.Dark) {
                    Modifier.border(1.dp, Color.White.copy(alpha = 0.18f), shape)
                } else {
                    Modifier
                },
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled && !loading,
                onClick = onClick,
            )
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = style.foreground,
                strokeWidth = 2.dp,
            )
        } else {
            glyph()
            Box(Modifier.width(8.dp))
            Text(
                text = title,
                color = style.foreground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** Leading glyph for an [AuthPillButton] — resolves an SF Symbol to a Material icon. */
@Composable
fun AuthPillGlyph(iconName: String, tint: Color = Color.White) {
    AppIcon.fromSystemName(iconName)?.imageVector?.let { vector ->
        Icon(
            imageVector = vector,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(16.dp),
        )
    }
}

/**
 * Primary CTA rendered as a white-tint Liquid Glass capsule — the main action
 * on the email sign-in / sign-up / forgot-password / reset-password screens.
 * Port of iOS `LiquidGlassPillButton` (52pt): frosted white pill + specular
 * sheen + gradient hairline stroke. iOS 26's touch-refraction is out of scope
 * on the fallback tier (matches the design module's LiquidGlass contract).
 */
@Composable
fun LiquidGlassPillButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    isEnabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val shape = CircleShape
    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .pillPressEffect(interaction)
            .alpha(if (isEnabled) 1f else 0.45f)
            .clip(shape)
            .liquidGlassBackground(shape = shape, tint = Color.White.copy(alpha = 0.42f))
            // Specular sheen — the signature glass highlight (top → center fade).
            .background(
                Brush.verticalGradient(
                    0f to Color.White.copy(alpha = 0.26f),
                    0.5f to Color.White.copy(alpha = 0f),
                ),
                shape,
            )
            .border(
                BorderStroke(
                    1.dp,
                    Brush.linearGradient(
                        listOf(Color.White.copy(alpha = 0.5f), Color.White.copy(alpha = 0.1f)),
                    ),
                ),
                shape,
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = isEnabled && !loading,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = Color.White,
                strokeWidth = 2.dp,
            )
        } else {
            Text(
                text = title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/**
 * Shared liquid-glass input container (label + icon + field + optional trailing)
 * — port of iOS `AuthFieldRow`. [icon] is an SF Symbol name resolved through
 * [AppIcon]; callers pass the `.fill` variant since the outline names aren't in
 * the Material map (visually negligible).
 */
@Composable
fun AuthFieldRow(
    label: String,
    icon: String,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
    field: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .clip(shape)
                .liquidGlassBackground(shape = shape)
                .border(
                    1.dp,
                    if (isError) AuthErrorColor else Color.White.copy(alpha = 0.12f),
                    shape,
                )
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppIcon.fromSystemName(icon)?.imageVector?.let { vector ->
                Icon(
                    imageVector = vector,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.45f),
                    modifier = Modifier.size(20.dp),
                )
            }
            Box(Modifier.weight(1f)) { field() }
            trailing?.invoke()
        }
    }
}

/**
 * Bare white-on-glass text field for the auth forms. Uses [BasicTextField] so
 * the visual container stays owned by [AuthFieldRow] (a Material TextField would
 * fight it). Renders a 30%-white placeholder when empty and an appPrimary cursor
 * — matching the iOS `TextField`/`SecureField` prompt styling.
 */
@Composable
fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    passwordVisible: Boolean = false,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
    imeAction: androidx.compose.ui.text.input.ImeAction = androidx.compose.ui.text.input.ImeAction.Next,
    keyboardActions: androidx.compose.foundation.text.KeyboardActions = androidx.compose.foundation.text.KeyboardActions.Default,
    enabled: Boolean = true,
) {
    androidx.compose.foundation.text.BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        singleLine = true,
        textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 15.sp),
        cursorBrush = androidx.compose.ui.graphics.SolidColor(AppColors.appPrimary),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
            keyboardType = keyboardType,
            imeAction = imeAction,
            autoCorrectEnabled = false,
        ),
        keyboardActions = keyboardActions,
        visualTransformation = if (isPassword && !passwordVisible) {
            androidx.compose.ui.text.input.PasswordVisualTransformation()
        } else {
            androidx.compose.ui.text.input.VisualTransformation.None
        },
        decorationBox = { inner ->
            Box(contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) {
                    Text(text = placeholder, color = Color.White.copy(alpha = 0.3f), fontSize = 15.sp)
                }
                inner()
            }
        },
    )
}

/**
 * Trailing eye toggle for a password [AuthFieldRow] (32pt visual / 44pt tap).
 * FIDELITY-WAIVER: `eye`/`eye.slash` aren't in the AppIcon SF map, so we use the
 * Material Visibility icons directly.
 */
@Composable
fun PasswordVisibilityToggle(visible: Boolean, onToggle: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .defaultMinSize(minWidth = 44.dp, minHeight = 44.dp)
            .clickable(interactionSource = interaction, indication = null, onClick = onToggle),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (visible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
            contentDescription = if (visible) "Hide password" else "Show password",
            tint = Color.White.copy(alpha = 0.45f),
            modifier = Modifier.size(20.dp),
        )
    }
}

/** Inline error banner — coral icon + text on a 12%-tinted rounded card. */
@Composable
fun AuthErrorBanner(message: String, modifier: Modifier = Modifier) {
    AuthBanner(
        message = message,
        accent = AuthErrorColor,
        iconName = "exclamationmark.circle",
        modifier = modifier,
    )
}

/** Inline success banner — green checkmark + text on a 12%-tinted rounded card. */
@Composable
fun AuthSuccessBanner(message: String, modifier: Modifier = Modifier) {
    AuthBanner(
        message = message,
        accent = AppColors.appPrimary,
        iconName = "checkmark.circle",
        modifier = modifier,
    )
}

@Composable
private fun AuthBanner(
    message: String,
    accent: Color,
    iconName: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(accent.copy(alpha = 0.12f))
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon.fromSystemName(iconName)?.imageVector?.let { vector ->
            Icon(
                imageVector = vector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(18.dp),
            )
        }
        Text(
            text = message,
            color = accent,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * Compact brand mark used at the top of every auth screen.
 *
 * FIDELITY-WAIVER #242: iOS renders a bundled `WagerproofLogo` asset; no such
 * drawable exists in the Android resources yet, so we render the "WagerProof"
 * wordmark tile as a stand-in (same brand-green identity, 40dp square).
 */
@Composable
fun AuthLogo(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appPrimary),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "W",
            color = Color.Black,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Circular liquid-glass back button (40pt visual / 44pt tap target) shared by
 * the email / sign-up / forgot-password screens. Port of the repeated iOS
 * `backButton` sub-view.
 */
@Composable
fun AuthBackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = 44.dp, minHeight = 44.dp)
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .liquidGlassBackground(shape = CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon.fromSystemName("chevron.left")?.imageVector?.let { vector ->
                Icon(
                    imageVector = vector,
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}
