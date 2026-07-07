package com.wagerproof.app.features.auth

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon

/**
 * One page of the LoginView carousel — port of iOS `Auth/Components/OnboardingSlide`.
 * Retained componentry: iOS `LoginView` doesn't actually render the carousel, so
 * this is preserved but not wired into [LoginView] (matches the iOS note).
 *
 * FIDELITY-WAIVER #001 (carried from iOS): the `createBots` slide's RN
 * PixelOffice 3D scene isn't ported — [CreateBotsPlaceholder] renders an emoji
 * bot trio stand-in.
 */
enum class OnboardingSlideKind {
    ProData,
    CreateBots,
    AiModels,
    PublicBetting,
    Discord,
    GetStarted;

    val title: String
        get() = when (this) {
            ProData -> "Access Pro-Level Sports Data"
            CreateBots -> "Create Bots"
            AiModels -> "Advanced AI Models"
            PublicBetting -> "Live Public Betting Data"
            Discord -> "Exclusive Discord Community"
            GetStarted -> "Get Started"
        }

    val subtitle: String
        get() = when (this) {
            ProData -> "We take the data that the pros use and make it accessible to you."
            CreateBots -> "Build multiple bots that research picks for you 24/7."
            AiModels -> "We run thousands of historical games through advanced models and give you the results."
            PublicBetting -> "Track where the public is leaning and make your own decisions."
            Discord -> "Gain access to a private chat with other data driven bettors."
            GetStarted -> "Join today. Money-back guarantee. Cancel at any time."
        }

    /** Per-slide auto-advance duration (ms). createBots gets 10s in RN; else 5s. */
    val durationMillis: Long
        get() = when (this) {
            CreateBots -> 10_000
            else -> 5_000
        }

    /** Whether this slide uses the looping login-background video (vs the placeholder). */
    val hasVideoBackground: Boolean
        get() = this == ProData || this == GetStarted
}

@Composable
fun OnboardingSlide(kind: OnboardingSlideKind, isActive: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(350.dp),
        contentAlignment = Alignment.Center,
    ) {
        when (kind) {
            // Video slides have no floating widget — transparent spacer.
            OnboardingSlideKind.ProData, OnboardingSlideKind.GetStarted -> Spacer(Modifier.size(1.dp))
            OnboardingSlideKind.PublicBetting -> FloatingPublicBettingVisual(isActive)
            OnboardingSlideKind.AiModels -> FloatingAIModelVisual(isActive)
            OnboardingSlideKind.CreateBots -> CreateBotsPlaceholder()
            OnboardingSlideKind.Discord -> FloatingDiscordVisual(isActive)
        }
    }
}

// MARK: - Per-slide visuals

@Composable
private fun FloatingPublicBettingVisual(isActive: Boolean) {
    var revealed by remember { mutableStateOf(false) }
    LaunchedEffect(isActive) { revealed = false; revealed = true }

    val lineX by animateDpAsState(if (revealed) 50.dp else 20.dp, tween(5000), label = "lineX")
    val lineY by animateDpAsState(if (revealed) 30.dp else 10.dp, tween(5000), label = "lineY")
    val statsX by animateDpAsState(if (revealed) (-70).dp else (-40).dp, tween(5000), label = "statsX")
    val statsY by animateDpAsState(if (revealed) (-10).dp else 0.dp, tween(5000), label = "statsY")

    Box(contentAlignment = Alignment.Center) {
        StatsCard(
            modifier = Modifier
                .padding(start = 0.dp)
                .offsetDp(statsX, statsY)
                .rotate(-10f)
                .scale(0.9f),
        )
        LineMovementCard(
            modifier = Modifier
                .offsetDp(lineX, lineY)
                .rotate(5f),
        )
    }
}

@Composable
private fun FloatingAIModelVisual(isActive: Boolean) {
    var revealed by remember { mutableStateOf(false) }
    LaunchedEffect(isActive) { revealed = false; revealed = true }
    val y by animateDpAsState(if (revealed) (-15).dp else 0.dp, tween(500), label = "aiY")
    val scale by animateFloatAsState(if (revealed) 1.03f else 1.0f, tween(500), label = "aiScale")
    val alpha by animateFloatAsState(if (revealed) 1f else 0f, tween(500), label = "aiAlpha")

    AIModelCard(
        modifier = Modifier
            .offsetDp(0.dp, y)
            .scale(scale)
            .androidxAlpha(alpha),
    )
}

@Composable
private fun FloatingDiscordVisual(isActive: Boolean) {
    var revealed by remember { mutableStateOf(false) }
    LaunchedEffect(isActive) { revealed = false; revealed = true }
    val y by animateDpAsState(if (revealed) (-10).dp else 30.dp, tween(500), label = "discY")
    val scale by animateFloatAsState(if (revealed) 1.0f else 0.95f, tween(500), label = "discScale")
    val alpha by animateFloatAsState(if (revealed) 1f else 0f, tween(500), label = "discAlpha")

    DiscordCard(
        modifier = Modifier
            .offsetDp(0.dp, y)
            .scale(scale)
            .androidxAlpha(alpha),
    )
}

// MARK: - Stats card

@Composable
private fun StatsCard(modifier: Modifier = Modifier) {
    MockCard(modifier = modifier, width = 220.dp, height = 240.dp, fill = Color.Black) {
        Text("% Statistics", color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.Bottom,
        ) {
            StatBar(top = "13", height = 60.dp, color = Color(0xFFFF4081), bottom = "12/19")
            StatBar(top = "15", height = 80.dp, color = Color(0xFF00BFA5), bottom = "12/21")
            StatBar(top = "26", height = 120.dp, color = Color(0xFF00E5FF), bottom = "12/23")
        }
    }
}

@Composable
private fun StatBar(top: String, height: androidx.compose.ui.unit.Dp, color: Color, bottom: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(top, color = Color.White, fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        Box(Modifier.width(28.dp).height(height).clip(RoundedCornerShape(6.dp)).background(color))
        Text(bottom, color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
    }
}

// MARK: - Line movement card

@Composable
private fun LineMovementCard(modifier: Modifier = Modifier) {
    MockCard(modifier = modifier, width = 300.dp, height = 220.dp, fill = Color(0xFF1E1E1E)) {
        Text(
            "Line movement and public bet %",
            color = Color.White.copy(alpha = 0.9f),
            fontSize = 13.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            StatColumn("+1.5 CIN", "Line", Color.White)
            StatColumn("69% CIN", "Public Bet %", Color(0xFF448AFF))
            StatColumn("49% CIN", "Public Money %", Color(0xFF00BFA5))
        }
        Spacer(Modifier.height(10.dp))
        ChartScribble(Modifier.fillMaxWidth().height(90.dp))
    }
}

@Composable
private fun StatColumn(value: String, label: String, tint: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(value, color = tint, fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
    }
}

@Composable
private fun ChartScribble(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        // Purple area fill.
        val area = Path().apply {
            moveTo(0f, h * 0.55f)
            lineTo(w * 0.1f, h * 0.55f); lineTo(w * 0.1f, h * 0.35f)
            lineTo(w * 0.2f, h * 0.40f); lineTo(w * 0.3f, h * 0.30f)
            lineTo(w * 0.45f, h * 0.32f); lineTo(w * 0.55f, h * 0.22f)
            lineTo(w * 0.7f, h * 0.28f); lineTo(w * 0.85f, h * 0.30f)
            lineTo(w * 1.0f, h * 0.40f); lineTo(w, h); lineTo(0f, h); close()
        }
        drawPath(
            area,
            brush = Brush.verticalGradient(
                0f to Color(0xFF7C4DFF).copy(alpha = 0.4f),
                1f to Color(0xFF7C4DFF).copy(alpha = 0f),
            ),
        )
        val stroke = Path().apply {
            moveTo(0f, h * 0.55f)
            lineTo(w * 0.1f, h * 0.55f); lineTo(w * 0.1f, h * 0.35f)
            lineTo(w * 0.2f, h * 0.40f); lineTo(w * 0.3f, h * 0.30f)
            lineTo(w * 0.45f, h * 0.32f); lineTo(w * 0.55f, h * 0.22f)
            lineTo(w * 0.7f, h * 0.28f); lineTo(w * 0.85f, h * 0.30f)
            lineTo(w * 1.0f, h * 0.40f)
        }
        drawPath(stroke, color = Color(0xFF7C4DFF).copy(alpha = 0.8f), style = Stroke(width = 2f))
        // Cyan stepped line.
        val stepped = Path().apply {
            moveTo(w * 0.03f, h * 0.65f)
            lineTo(w * 0.15f, h * 0.65f); lineTo(w * 0.15f, h * 0.80f)
            lineTo(w * 0.30f, h * 0.80f); lineTo(w * 0.30f, h * 0.55f)
            lineTo(w * 0.47f, h * 0.55f); lineTo(w * 0.47f, h * 0.65f)
            lineTo(w * 0.60f, h * 0.65f); lineTo(w * 0.60f, h * 0.40f)
            lineTo(w * 0.80f, h * 0.40f); lineTo(w * 0.80f, h * 0.65f)
            lineTo(w * 1.0f, h * 0.65f)
        }
        drawPath(stepped, color = Color(0xFF00E5FF), style = Stroke(width = 2f))
    }
}

// MARK: - AI Model card

@Composable
private fun AIModelCard(modifier: Modifier = Modifier) {
    MockCard(modifier = modifier, width = 280.dp, height = 220.dp, fill = Color(0xFF1E1E1E)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIcon.fromSystemName("brain.head.profile")?.imageVector?.let {
                Icon(it, contentDescription = null, tint = Color(0xFF00BFA5), modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(6.dp))
            Text("NFL Predictor v2.1", color = Color.White, fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text(
                "LIVE",
                color = Color(0xFF00BFA5),
                fontSize = 10.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color(0xFF00BFA5).copy(alpha = 0.2f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            MetricColumn("Win Rate", "68.4%", Color(0xFF00BFA5), "Last 50 games")
            Spacer(Modifier.weight(1f))
            MetricColumn("ROI", "+12.8%", Color(0xFF00E5FF), "All time")
        }
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.fillMaxWidth().height(50.dp)) {
            val w = size.width
            val h = size.height
            val curve = Path().apply {
                moveTo(0f, h * 0.8f)
                quadraticTo(w * 0.25f, h * 0.8f, w * 0.5f, h * 0.3f)
                quadraticTo(w * 0.75f, 0f, w, h * 0.15f)
            }
            drawPath(curve, color = Color(0xFF00BFA5), style = Stroke(width = 3f))
        }
    }
}

@Composable
private fun MetricColumn(label: String, value: String, valueColor: Color, footnote: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = Color.White, fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        Text(value, color = valueColor, fontSize = 24.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Black)
        Text(footnote, color = Color.White.copy(alpha = 0.5f), fontSize = 10.sp)
    }
}

// MARK: - Discord card

@Composable
private fun DiscordCard(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .size(280.dp, 240.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF1E1E1E))
            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(16.dp)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF5865F2))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon.fromSystemName("number")?.imageVector?.let {
                Icon(it, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
            }
            Spacer(Modifier.width(6.dp))
            Text("sharp-plays", color = Color.White, fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        }
        Column(
            modifier = Modifier.padding(horizontal = 16.dp).padding(top = 16.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            DiscordRow(Color(0xFFFF4081), "SharpShooter", "Hitting the over on LeBron props tonight", 1.0f)
            DiscordRow(Color(0xFF00E5FF), "DataDave", "Model agrees. 5 star value.", 1.0f)
            DiscordRow(Color(0xFF00BFA5), "WinBot", "New alert: Line movement detected...", 0.5f)
        }
    }
}

@Composable
private fun DiscordRow(color: Color, name: String, text: String, alpha: Float) {
    Row(
        modifier = Modifier.androidxAlpha(alpha),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(32.dp).clip(CircleShape).background(color))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name, color = Color.White, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Text(text, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
        }
    }
}

// MARK: - Create-bots placeholder (FIDELITY-WAIVER #001)

@Composable
private fun CreateBotsPlaceholder(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .width(320.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF1A1A2E))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            BotDisc("🦅", Color(0xFF3B82F6))
            BotDisc("🌮", Color(0xFFF59E0B))
            BotDisc("🤖", Color(0xFF8B5CF6))
        }
        Text(
            "Sharp Edge · Taco King · Data Bot",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 12.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
        )
    }
}

@Composable
private fun BotDisc(emoji: String, color: Color) {
    Box(
        modifier = Modifier
            .size(64.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.2f))
            .border(2.dp, color, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(emoji, fontSize = 32.sp)
    }
}

// MARK: - Shared card chrome + tiny modifier helpers

@Composable
private fun MockCard(
    modifier: Modifier,
    width: androidx.compose.ui.unit.Dp,
    height: androidx.compose.ui.unit.Dp,
    fill: Color,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .size(width, height)
            .clip(RoundedCornerShape(16.dp))
            .background(fill)
            .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        content = content,
    )
}

private fun Modifier.offsetDp(x: androidx.compose.ui.unit.Dp, y: androidx.compose.ui.unit.Dp): Modifier =
    this.offset(x = x, y = y)

private fun Modifier.androidxAlpha(a: Float): Modifier = this.alpha(a)
