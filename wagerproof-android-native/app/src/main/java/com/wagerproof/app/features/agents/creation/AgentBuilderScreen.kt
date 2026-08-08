package com.wagerproof.app.features.agents.creation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.OnboardingPageShell
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderArchetypePage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderBetStylePage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderDataTrustPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderIdentityPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderInsightsPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderMindsetPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderSportRulesPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderSportsPage
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.backgrounds.LocalGlyphRippleEmitter
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.components.LocalHazeState
import com.wagerproof.core.design.components.liquidGlassSource
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.services.runCatchingCancellable
import com.wagerproof.core.stores.AgentCreationStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AuthStore
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.launch

/**
 * The in-app "build an agent" flow, rebuilt on the onboarding pixelwave
 * carousel — port of iOS `AgentBuilderView`.
 *
 * It drives the SAME eight builder pages onboarding uses (sports → archetype →
 * mindset → bet style → data trust → sport rules → insights → identity) through
 * [OnboardingPageShell] over a [PixelWaveBackground], so in-app creation matches
 * onboarding instead of the retired Step 1–6 wizard.
 *
 * Deliberately DROPS onboarding's post-create stages per product direction: no
 * PREPARING cinematic and no CELEBRATION screen. On "Create my agent" it submits
 * and hands the agent to [onCreated], which lands on the agent's detail page —
 * the ticket-printer reveal then plays there when picks generate.
 *
 * SHARED-STORE NOTE: the builder pages read `appGraph().onboarding` directly for
 * the accent tint and the `hasChosenArchetype` starting-point flag. iOS gets to
 * hand them a local throwaway OnboardingStore; on Android the pages resolve the
 * app-scoped one themselves, so this screen brackets its session with
 * `clearArchetypeChosen()` on entry and exit. That is safe because onboarding is
 * a root-router gate — it can never be on screen at the same time as this.
 */
@Composable
fun AgentBuilderScreen(
    modifier: Modifier = Modifier,
    /**
     * Seed draft for the "Copy build" CTA on public agent detail
     * (`AgentCreationStore.Draft.copying`). Null = normal from-scratch path.
     */
    initialDraft: AgentCreationStore.Draft? = null,
    onCreated: (Agent) -> Unit,
    onCancel: () -> Unit,
) {
    val graph = appGraph()
    val onboarding = graph.onboarding
    val agents = graph.agents
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId
    val entitlements = remember(graph.proAccess) { AgentEntitlementsStore(graph.proAccess) }

    val creation = remember { AgentCreationStore() }
    val spritePersister = remember { AgentSpritePersister() }
    val rippleEmitter = remember { GlyphRippleEmitter() }
    val hazeState = remember { HazeState() }
    val reduceMotion = remember {
        runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        }.getOrDefault(false)
    }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    fun requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    // Copy build opens ON the starting-point page: the copied build IS the
    // starting point, so page 1 (pick your sports) would be a pointless detour.
    var slot by remember { mutableIntStateOf(if (initialDraft != null) BuilderStep.Archetype.ordinal else 0) }
    var forward by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var pendingCreatedAgent by remember { mutableStateOf<Agent?>(null) }
    var isCopyStartingPointSelected by remember {
        mutableStateOf(initialDraft?.copySource != null)
    }

    val step = BuilderStep.entries.getOrElse(slot) { BuilderStep.Sports }
    val isLast = slot == BuilderStep.entries.lastIndex

    // Seed once: a stable pixel character so the identity preview doesn't
    // reshuffle per keystroke, plus the copied draft when there is one.
    LaunchedEffect(Unit) {
        onboarding.clearArchetypeChosen()
        if (initialDraft != null) {
            creation.draft = initialDraft
            // A copied build is itself a valid starting-point choice — including
            // a fully-custom source with no preset archetype.
            onboarding.setArchetypeChosen()
        }
        if (creation.draft.spriteIndex == null) {
            creation.draft = creation.draft.copy(
                spriteIndex = AgentSpriteIndex.forSeed("${userId.orEmpty()}-${System.nanoTime()}"),
            )
        }
        agents.bind(userId?.lowercase())
        if (agents.loadState.needsInitialLoad) agents.refresh()
        creation.loadArchetypesIfNeeded()
    }
    // Duplicate-name validation needs the user's current roster.
    LaunchedEffect(agents.agents) { creation.existingAgentNames = agents.agents.map { it.agent.name } }
    DisposableEffect(Unit) {
        onDispose {
            creation.close()
            // Leave no residue on the shared store — see the SHARED-STORE note.
            onboarding.clearArchetypeChosen()
        }
    }

    val accent = builderAccent(creation, onboarding.hasChosenArchetype, onboarding.survey.bettorType)

    val ctaEnabled = when (step) {
        BuilderStep.Sports -> creation.draft.preferredSports.isNotEmpty()
        BuilderStep.Archetype -> onboarding.hasChosenArchetype
        BuilderStep.Identity -> creation.identityValidationError() == null
        else -> true
    }
    val effectiveCtaEnabled = pendingCreatedAgent != null || ctaEnabled

    fun submit() {
        if (isSubmitting) return
        isSubmitting = true
        scope.launch {
            try {
                // A sprite-write retry resumes the already-created row. Never
                // call create_agent twice just because its required follow-up
                // update failed.
                val agent = pendingCreatedAgent ?: run {
                    when (val preflight = runAgentCreationPreflight(userId, agents, entitlements)) {
                        AgentCreationPreflight.Allowed -> Unit
                        is AgentCreationPreflight.Blocked -> {
                            errorMessage = preflight.message
                            return@launch
                        }
                    }
                    // The refresh above is authoritative for both quota and
                    // duplicate names at the instant before server submission.
                    creation.existingAgentNames = agents.agents.map { it.agent.name }
                    creation.identityValidationError()?.let {
                        errorMessage = it
                        return@launch
                    }

                    // The retired wizard's review step prompted for
                    // POST_NOTIFICATIONS when autopilot was on; keep that.
                    if (creation.draft.autoGenerate) requestNotifications()
                    val autoForcedOff = !entitlements.isAdmin && entitlements.isPro &&
                        agents.activeCount >= AgentEntitlementsStore.PRO_MAX_ACTIVE_AGENTS
                    val created = creation.submit(autoModeForcedOff = autoForcedOff)
                    if (created == null) {
                        errorMessage = (creation.submitState as? AgentCreationStore.SubmitState.Failed)?.message
                            ?: "Something went wrong creating your agent. Please try again."
                        return@launch
                    }
                    pendingCreatedAgent = created
                    created
                }

                // Everything below is awaited before navigation. create_agent
                // has no sprite field, so a failed follow-up write leaves this
                // builder open with the created row retained for a safe retry.
                val sprite = creation.draft.spriteIndex
                when (val result = spritePersister.persist(agent.id, agent.spriteIndexOverride, sprite)) {
                    is AgentSpritePersistenceResult.Saved -> {
                        agent.spriteIndexOverride = result.spriteIndex
                    }
                    is AgentSpritePersistenceResult.Failed -> {
                        errorMessage =
                            "Your agent was created, but its character wasn't saved. " +
                                "Try again to finish setup. (${result.message})"
                        return@launch
                    }
                }
                // Pull the new row into the shared list — the Agents tab no
                // longer rebuilds its store on return, so nothing else would.
                runCatchingCancellable { agents.refresh() }
                graph.reviewPrompts.recordAgentCreated(
                    agentID = agent.id,
                    totalAgentCount = agents.totalCount,
                )
                pendingCreatedAgent = null
                onCreated(agent)
            } finally {
                isSubmitting = false
            }
        }
    }

    fun goBack() {
        when {
            pendingCreatedAgent != null -> {
                errorMessage =
                    "Your agent already exists, but its character still needs to be saved. " +
                        "Retry to finish setup."
            }
            slot > 0 -> { forward = false; slot -= 1 }
            creation.draft == AgentCreationStore.Draft() -> onCancel()
            else -> confirmDiscard = true
        }
    }

    BackHandler(enabled = !isSubmitting) { goBack() }

    CompositionLocalProvider(
        LocalGlyphRippleEmitter provides rippleEmitter,
        LocalOnboardingReduceMotion provides reduceMotion,
        LocalHazeState provides hazeState,
    ) {
        Box(modifier.fillMaxSize().liquidGlassSource(hazeState)) {
            PixelWaveBackground(
                accentColor = accent,
                rippleEmitter = rippleEmitter,
                reduceMotion = reduceMotion,
                modifier = Modifier.fillMaxSize(),
            )

            OnboardingPageShell(
                progress = (slot + 1).toDouble() / BuilderStep.entries.size,
                continueTitle = when {
                    pendingCreatedAgent != null -> "Retry character save"
                    isLast -> "Create my agent"
                    else -> "Continue"
                },
                isCTAEnabled = effectiveCtaEnabled && !isSubmitting,
                isCTALoading = isSubmitting,
                canGoBack = true,
                ctaTint = accent,
                onContinue = {
                    if (effectiveCtaEnabled && !isSubmitting) {
                        if (isLast) submit() else { forward = true; slot += 1 }
                    }
                },
                onBack = ::goBack,
            ) {
                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        if (reduceMotion) {
                            fadeIn(tween(120)) togetherWith fadeOut(tween(120))
                        } else {
                            val sign = if (forward) 1 else -1
                            (slideInHorizontally(tween(350)) { it * sign } + fadeIn(tween(180))) togetherWith
                                (slideOutHorizontally(tween(350)) { -it * sign } + fadeOut(tween(180)))
                        }
                    },
                    label = "agentBuilderCarousel",
                ) { page ->
                    when (page) {
                        BuilderStep.Sports -> OnboardingBuilderSportsPage(creation)
                        BuilderStep.Archetype -> {
                            val copiedDraft = initialDraft
                            val source = copiedDraft?.copySource
                            if (copiedDraft != null && source != null) {
                                CopyBuildStartingPointPage(
                                    creation = creation,
                                    copiedDraft = copiedDraft,
                                    source = source,
                                    isCopySelected = isCopyStartingPointSelected,
                                    onCopySelectionChanged = { isCopyStartingPointSelected = it },
                                )
                            } else {
                                OnboardingBuilderArchetypePage(creation)
                            }
                        }
                        BuilderStep.Mindset -> OnboardingBuilderMindsetPage(creation)
                        BuilderStep.BetStyle -> OnboardingBuilderBetStylePage(creation)
                        BuilderStep.DataTrust -> OnboardingBuilderDataTrustPage(creation)
                        BuilderStep.SportRules -> OnboardingBuilderSportRulesPage(creation)
                        BuilderStep.Insights -> OnboardingBuilderInsightsPage(creation)
                        BuilderStep.Identity -> AgentBuilderIdentityPage(creation)
                    }
                }
            }
        }
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("Discard Agent?") },
            text = { Text("Are you sure you want to discard this agent? All progress will be lost.") },
            confirmButton = {
                TextButton(onClick = { confirmDiscard = false; onCancel() }) {
                    Text("Discard", color = AppColors.appLoss)
                }
            },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("Keep Editing") } },
            containerColor = AppColors.appSurfaceElevated,
            titleContentColor = AppColors.appTextPrimary,
            textContentColor = AppColors.appTextSecondary,
        )
    }

    errorMessage?.let { message ->
        AlertDialog(
            onDismissRequest = {
                errorMessage = null
                creation.submitState = AgentCreationStore.SubmitState.Idle
            },
            title = {
                Text(if (pendingCreatedAgent == null) "Couldn't create agent" else "Finish setting up your agent")
            },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = {
                    errorMessage = null
                    creation.submitState = AgentCreationStore.SubmitState.Idle
                }) { Text("OK") }
            },
            containerColor = AppColors.appSurfaceElevated,
            titleContentColor = AppColors.appTextPrimary,
            textContentColor = AppColors.appTextSecondary,
        )
    }
}

/** The eight builder pages, in carousel order (iOS `AgentBuilderView.BuilderStep`). */
private enum class BuilderStep {
    Sports, Archetype, Mindset, BetStyle, DataTrust, SportRules, Insights, Identity
}

/** Keep duplicate-name feedback visible without changing onboarding's page. */
@Composable
private fun AgentBuilderIdentityPage(creation: AgentCreationStore) {
    Column(Modifier.fillMaxSize()) {
        OnboardingBuilderIdentityPage(creation, Modifier.weight(1f))
        if (creation.hasDuplicateName()) {
            Text(
                "You already have an agent with this name",
                color = AppColors.appAccentRed,
                fontSize = 13.sp,
                modifier = Modifier
                    .padding(horizontal = 24.dp, vertical = 6.dp)
                    .fillMaxWidth()
                    .background(
                        AppColors.appAccentRed.copy(alpha = 0.12f),
                        RoundedCornerShape(10.dp),
                    )
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            )
        }
    }
}

/**
 * Archetype accent wins once a preset is chosen (matches onboarding's tint
 * logic); before that the avatar gradient drives, falling back to the survey's
 * bettor-type accent.
 */
private fun builderAccent(
    creation: AgentCreationStore,
    hasChosenArchetype: Boolean,
    bettorType: com.wagerproof.core.stores.OnboardingStore.BettorType?,
) = if (hasChosenArchetype && creation.draft.archetype != null) {
    val id = creation.draft.archetype?.raw
    OnboardingTheme.archetypeAccent(creation.archetypeRows.firstOrNull { it.id == id }?.color)
        ?: AgentColorPalette.primary(creation.draft.avatarColor)
} else if (creation.draft.avatarColor.isNotEmpty()) {
    AgentColorPalette.primary(creation.draft.avatarColor)
} else {
    OnboardingTheme.accent(bettorType)
}
