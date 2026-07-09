package com.wagerproof.app.features.agents.creation

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.models.Agent
import kotlinx.coroutines.delay

/** Two-stage, six-second creation interstitial. */
@Composable
fun AgentCreationGenerationIntro(onComplete: () -> Unit, modifier: Modifier = Modifier) {
    val stageOne = listOf("Hacking Vegas computers...", "Mining sharp-market signals...", "Decoding suspicious line movement...")
    val stageTwo = listOf("Calibrating confidence engines...", "Simulating 10,000 bet outcomes...", "Assembling your agent brain...")
    val history = remember { mutableStateListOf<String>() }
    var stage by remember { mutableIntStateOf(1) }
    val pulse by rememberInfiniteTransition(label = "creation-pulse").animateFloat(
        initialValue = 0.82f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(tween(780), RepeatMode.Reverse),
        label = "creation-pulse-value",
    )

    LaunchedEffect(Unit) {
        for (line in stageOne) {
            history.add(0, line)
            if (history.size > 4) history.removeAt(history.lastIndex)
            delay(900)
        }
        delay(300)
        stage = 2
        for (line in stageTwo) {
            history.add(0, line)
            if (history.size > 4) history.removeAt(history.lastIndex)
            delay(900)
        }
        delay(500)
        onComplete()
    }

    Box(modifier.fillMaxSize().background(Color.Black)) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 82.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            history.forEachIndexed { index, line ->
                Text(line, color = Color.White.copy(alpha = (1f - index * 0.2f).coerceAtLeast(0.35f)), fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            }
        }
        Box(
            Modifier.align(Alignment.Center).size(210.dp).scale(pulse).clip(RoundedCornerShape(if (stage == 1) 105.dp else 48.dp)).background(Color(0xFF00E676).copy(alpha = 0.13f)).border(2.dp, Color(0xFF00E676).copy(alpha = 0.55f), RoundedCornerShape(if (stage == 1) 105.dp else 48.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = if (stage == 1) AppIcon.SPORTSCOURT_FILL.imageVector else AppIcon.BRAIN_HEAD_PROFILE.imageVector,
                contentDescription = if (stage == 1) "Gathering data" else "Assembling agent",
                tint = Color(0xFF00E676),
                modifier = Modifier.size(112.dp),
            )
        }
    }
}

/** Brand reveal shown after the server successfully creates the agent. */
@Composable
fun AgentBornCelebration(agent: Agent, onContinue: () -> Unit, modifier: Modifier = Modifier) {
    var revealed by remember { mutableStateOf(false) }
    var contentVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(1_000)
        revealed = true
        delay(280)
        contentVisible = true
    }
    val primary = AgentColorPalette.primary(agent.avatarColor)

    Box(
        modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF00E676).copy(alpha = if (revealed) 0.17f else 1f), Color.Black, Color.Black))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.fillMaxWidth().alpha(if (contentVisible) 1f else 0f).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(AppIcon.SPARKLES.imageVector, null, tint = Color(0xFF00E676), modifier = Modifier.size(22.dp))
                Text("Agent Created", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
            }
            Text(
                if (agent.autoGenerate) "Your strategy is live and ready for picks." else "Your agent starts in manual mode until an auto slot opens up.",
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
            )
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF1A1A1A)).border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(18.dp)).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(Modifier.size(60.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(AgentColorPalette.avatarGradient(agent.avatarColor))), contentAlignment = Alignment.Center) {
                    PixelSpriteAvatar(agent.spriteIndex, animated = true, modifier = Modifier.size(52.dp))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(agent.name.ifBlank { "Your Agent" }, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        agent.preferredSports.take(3).forEach { sport ->
                            Text(sport.label, color = Color.White.copy(alpha = 0.78f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }
                    Text(if (agent.autoGenerate) "● AUTOPILOT ON" else "● MANUAL MODE", color = if (agent.autoGenerate) Color(0xFF10B981) else Color(0xFFFBBF24), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp)
                }
            }
            Text(
                "View Agent",
                color = Color.Black,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(Color(0xFF00E676)).clickable(enabled = contentVisible, onClick = onContinue).semantics { role = Role.Button; contentDescription = "View created agent" }.padding(vertical = 15.dp),
            )
        }
    }
}
