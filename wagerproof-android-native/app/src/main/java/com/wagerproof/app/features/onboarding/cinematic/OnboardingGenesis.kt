package com.wagerproof.app.features.onboarding.cinematic

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentPickTicket
import com.wagerproof.app.features.agents.components.AgentRowCard
import com.wagerproof.app.features.agents.components.GenerationLoadingBar
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.services.AgentAuthorizedActionsService
import com.wagerproof.core.services.AgentPicksService
import com.wagerproof.core.stores.AgentCreationStore
import com.wagerproof.core.stores.OnboardingStore
import java.time.LocalDate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.math.max
import kotlin.random.Random

/** Runs the iOS-equivalent 15–30 second scripted theater over real agent creation. */
@Stable
class OnboardingGenesisModel(
    private val onboarding: OnboardingStore,
    private val creation: AgentCreationStore,
    private val rippleEmitter: GlyphRippleEmitter,
) {
    data class StatusLine(val id: Int, val text: String)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var runJob: Job? = null
    private var lineSequence = 0
    private var workSettled = false

    var statusLines by mutableStateOf<List<StatusLine>>(emptyList()); private set
    var progressFraction by mutableFloatStateOf(0f); private set
    var toolCallCount by mutableIntStateOf(0); private set
    var hapticTick by mutableIntStateOf(0); private set
    var isFinale by mutableStateOf(false); private set
    var createdAgent by mutableStateOf<Agent?>(null); private set
    var creationFailed by mutableStateOf(false); private set
    var teaserPicks by mutableStateOf<List<AgentPick>>(emptyList()); private set

    fun start() {
        if (runJob != null) return
        runJob = scope.launch { run() }
    }

    fun cancel() {
        runJob?.cancel()
        runJob = null
        scope.cancel()
    }

    private suspend fun run() = supervisorScope {
        val startedAt = System.currentTimeMillis()
        val work = async { performRealWork() }
        var line = 0
        var lastTool = Long.MIN_VALUE
        var lastRipple = Long.MIN_VALUE
        while (true) {
            val elapsedMs = System.currentTimeMillis() - startedAt
            pushLine(script[line % script.size])
            line += 1
            progressFraction = minOf(0.95f, elapsedMs / 15_000f)
            if (elapsedMs - lastTool > 2_800 && toolCallCount < 5) {
                lastTool = elapsedMs
                toolCallCount += 1
                hapticTick += 1
            }
            if (elapsedMs - lastRipple > 1_600) {
                lastRipple = elapsedMs
                rippleEmitter.emit(Offset(Random.nextFloat() * 900f + 90f, Random.nextFloat() * 1400f + 220f))
            }
            if ((elapsedMs >= 15_000 && workSettled) || elapsedMs >= 30_000) break
            delay(1_100)
        }
        progressFraction = 1f
        val name = creation.draft.name.trim().ifEmpty { "your agent" }
        pushLine("Done. Meet $name.")
        hapticTick += 1
        delay(900)
        isFinale = true
        repeat(4) { index ->
            rippleEmitter.emit(Offset(Random.nextFloat() * 600f + 230f, 1_600f - index * 330f))
            delay(240)
        }
        onboarding.advance()
        if (!work.isCompleted) work.cancel()
    }

    private fun pushLine(text: String) {
        lineSequence += 1
        statusLines = (listOf(StatusLine(lineSequence, text)) + statusLines).take(4)
    }

    private suspend fun performRealWork() = supervisorScope {
        val agent = async { createAgentWithRetry() }
        val picks = async { fetchTeaserPicks() }
        createdAgent = agent.await()
        creationFailed = createdAgent == null
        teaserPicks = picks.await()
        workSettled = true
    }

    private suspend fun createAgentWithRetry(): Agent? {
        var result = creation.submit(autoModeForcedOff = false)
        if (result == null) {
            delay(1_500)
            result = creation.submit(autoModeForcedOff = false)
        }
        val agent = result ?: return null
        val sprite = creation.draft.spriteIndex
        if (sprite != null && agent.spriteIndex != sprite) {
            agent.spriteIndexOverride = sprite
            scope.launch(Dispatchers.IO) {
                runCatching {
                    AgentAuthorizedActionsService.updateAgent(
                        agent.id,
                        buildJsonObject { put("sprite_index", sprite) },
                    )
                }
            }
        }
        return agent
    }

    private suspend fun fetchTeaserPicks(): List<AgentPick> {
        val sports = creation.draft.preferredSports.toSet()
        return runCatching {
            val rows = AgentPicksService.fetchTopAgentPicksFeed(filterMode = "top10", limit = 40)
            val matching = rows.filter { sports.isEmpty() || it.sport in sports }
            (matching.ifEmpty { rows }).take(3).map { it.asAgentPick }
        }.getOrNull()?.takeIf { it.isNotEmpty() } ?: fixturePicks(sports)
    }

    companion object {
        private val script = listOf(
            "Booting your agent's brain...", "Reading today's board...", "Pulling model probabilities...",
            "Scanning line movement...", "Checking public splits...", "Weighing matchup edges...",
            "Pricing value vs the market...", "Cross-checking injury news...", "Simulating outcomes...",
            "Grading confidence...", "Writing up the reasoning...", "Stamping the tickets...",
        )

        fun fixturePicks(sports: Set<AgentSport> = emptySet()): List<AgentPick> {
            val today = LocalDate.now().toString()
            fun pick(index: Int, sport: AgentSport, matchup: String, type: String, selection: String, odds: String, confidence: Int) = AgentPick(
                id = "onboarding-fixture-$index", avatarId = "onboarding-fixture", gameId = "onboarding-fixture-$index",
                sport = sport, matchup = matchup, gameDate = today, betType = type, pickSelection = selection,
                odds = odds, confidence = confidence, createdAt = today,
            )
            if (sports == setOf(AgentSport.MLB)) return listOf(
                pick(0, AgentSport.MLB, "Yankees @ Red Sox", "moneyline", "Yankees ML", "-125", 4),
                pick(1, AgentSport.MLB, "Dodgers @ Giants", "total", "Under 8.5", "-110", 3),
                pick(2, AgentSport.MLB, "Braves @ Phillies", "run line", "Braves -1.5", "+135", 3),
            )
            val out = mutableListOf<AgentPick>()
            if (sports.isEmpty() || AgentSport.NFL in sports || AgentSport.CFB in sports) out += pick(0, AgentSport.NFL, "Chiefs @ Bills", "spread", "Bills +2.5", "-110", 4)
            if (sports.isEmpty() || AgentSport.NBA in sports || AgentSport.NCAAB in sports) out += pick(1, AgentSport.NBA, "Lakers @ Celtics", "total", "Over 224.5", "-108", 3)
            out += pick(2, AgentSport.NFL, "Cowboys @ Eagles", "moneyline", "Eagles ML", "-135", 4)
            return out.take(3)
        }
    }
}

@Composable
fun OnboardingGenerationCinematic(model: OnboardingGenesisModel?, accent: Color, modifier: Modifier = Modifier) {
    val store = com.wagerproof.app.di.appGraph().onboarding
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(model?.hapticTick) { if ((model?.hapticTick ?: 0) > 0) haptics.performHapticFeedback(HapticFeedbackType.LongPress) }
    val name = store.agentDraft.name.trim().ifEmpty { "Your agent" }
    Column(
        modifier.fillMaxSize().alpha(if (model?.isFinale == true) 0f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.height(180.dp).fillMaxWidth().padding(horizontal = 28.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            model?.statusLines.orEmpty().forEachIndexed { index, line ->
                Text(line.text, color = Color.White.copy(alpha = max(0.3f, 1f - index * 0.24f)), fontSize = 15.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.weight(1f))
        WorkingDeskAvatar(store.agentDraft.spriteIndex ?: 0, accent)
        Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            GlyphMatrix(accent)
            Text("Building $name...", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
        GenerationLoadingBar(model?.progressFraction ?: 0f, accent, Modifier.width(220.dp).padding(top = 14.dp))
        Spacer(Modifier.weight(1f))
        ToolTicketStack(model?.toolCallCount ?: 0, accent, Modifier.fillMaxWidth().height(190.dp).padding(horizontal = 24.dp, vertical = 24.dp))
    }
}

@Composable
private fun WorkingDeskAvatar(spriteIndex: Int, accent: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(150.dp), contentAlignment = Alignment.BottomCenter) {
            Box(Modifier.width(142.dp).height(62.dp).background(Color(0xFF1A1D24), RoundedCornerShape(12.dp)).border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(12.dp)))
            PixelSpriteAvatar(spriteIndex, Modifier.size(130.dp).padding(bottom = 22.dp))
            Box(Modifier.width(148.dp).height(14.dp).background(Color(0xFF333844), RoundedCornerShape(5.dp)).align(Alignment.BottomCenter))
        }
    }
}

@Composable
private fun GlyphMatrix(accent: Color) {
    Canvas(Modifier.size(28.dp)) {
        val step = size.width / 3f
        repeat(3) { row -> repeat(3) { col -> drawCircle(accent.copy(alpha = 0.35f + (row + col) * 0.09f), radius = 2.8f, center = Offset((col + 0.5f) * step, (row + 0.5f) * step)) } }
    }
}

@Composable
private fun ToolTicketStack(count: Int, accent: Color, modifier: Modifier = Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        repeat(count.coerceAtMost(5)) { index ->
            Box(
                Modifier.fillMaxWidth(0.82f).height(86.dp).rotate((index - 2) * 2.2f).background(Color(0xFF191D24), RoundedCornerShape(18.dp)).border(1.dp, accent.copy(alpha = 0.22f), RoundedCornerShape(18.dp)).padding(14.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Box(Modifier.fillMaxWidth(0.45f).height(10.dp).background(Color.White.copy(alpha = 0.16f), CircleShape))
                    Box(Modifier.fillMaxWidth().height(8.dp).background(Color.White.copy(alpha = 0.08f), CircleShape))
                    Box(Modifier.fillMaxWidth(0.72f).height(8.dp).background(accent.copy(alpha = 0.15f), CircleShape))
                }
            }
        }
    }
}

@Composable
fun OnboardingRevealView(model: OnboardingGenesisModel?, accent: Color, modifier: Modifier = Modifier) {
    val store = com.wagerproof.app.di.appGraph().onboarding
    val draft = store.agentDraft
    val displayAgent = model?.createdAgent ?: Agent(
        id = "onboarding-draft", userId = "onboarding-draft", name = draft.name.trim().ifEmpty { "Your Agent" },
        avatarEmoji = draft.avatarEmoji, avatarColor = draft.avatarColor, spriteIndexOverride = draft.spriteIndex,
        preferredSports = draft.preferredSports.mapNotNull { league -> AgentSport.entries.firstOrNull { it.raw == league.raw } },
        archetype = draft.archetype?.let { raw -> com.wagerproof.core.models.AgentArchetype.entries.firstOrNull { it.raw == raw } },
        personalityParams = draft.personalityParams, customInsights = draft.customInsights,
        autoGenerate = draft.autoGenerate, autoGenerateTime = draft.autoGenerateTime, autoGenerateTimezone = draft.autoGenerateTimezone,
        createdAt = "",
    )
    val tickets = model?.teaserPicks?.takeIf { it.isNotEmpty() } ?: OnboardingGenesisModel.fixturePicks()
    val reduceMotion = LocalOnboardingReduceMotion.current
    var contentAlpha by remember { mutableFloatStateOf(0f) }
    var shownTickets by remember { mutableIntStateOf(0) }
    val animatedAlpha by animateFloatAsState(contentAlpha, tween(650), label = "revealAlpha")
    LaunchedEffect(Unit) {
        contentAlpha = 1f
        if (reduceMotion) {
            shownTickets = tickets.size
            return@LaunchedEffect
        }
        delay(700)
        repeat(tickets.size) { shownTickets = it + 1; delay(260) }
    }
    Box(modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).alpha(animatedAlpha).padding(bottom = 118.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Text("${displayAgent.name} is live!", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 60.dp, start = 24.dp, end = 24.dp))
            Text("First research run complete — here's a taste.", color = Color.White.copy(alpha = 0.85f), fontSize = 15.sp)
            AgentRowCard(AgentWithPerformance(displayAgent), Modifier.fillMaxWidth().padding(horizontal = 20.dp), onTap = {})
            Column(Modifier.padding(horizontal = 28.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                tickets.forEachIndexed { index, pick ->
                    AnimatedVisibility(
                        visible = shownTickets > index,
                        enter = fadeIn(tween(280)) + slideInVertically(tween(360)) { 70 },
                        exit = fadeOut() + slideOutVertically(),
                    ) {
                        AgentPickTicket(pick, Modifier.rotate(if (index % 2 == 0) -1.2f else 1.4f), accent, teaserBlur = true)
                    }
                }
            }
        }
        Box(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 24.dp, vertical = 24.dp).height(60.dp).liquidGlassBackground(CircleShape, Color.White.copy(alpha = 0.92f)).onboardingPressable(store::markComplete),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("See everything", color = Color.Black, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("→", color = Color.Black, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
