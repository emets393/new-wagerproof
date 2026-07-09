package com.wagerproof.app.features.agents

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.creation.AgentBornCelebration
import com.wagerproof.app.features.agents.creation.AgentCreationGenerationIntro
import com.wagerproof.app.features.agents.creation.Step1SportArchetypeView
import com.wagerproof.app.features.agents.creation.Step2IdentityView
import com.wagerproof.app.features.agents.creation.Step3PersonalityView
import com.wagerproof.app.features.agents.creation.Step4DataAndConditionsView
import com.wagerproof.app.features.agents.creation.Step5CustomInsightsView
import com.wagerproof.app.features.agents.creation.Step6ReviewView
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.services.AgentAuthorizedActionsService
import com.wagerproof.core.stores.AgentCreationStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private enum class CreationStage { BUILDER, PREPARING, CELEBRATION }

/** Six-step native agent builder backed by the authorized create-agent service. */
@Composable
fun AgentCreateScreen(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val navigator = LocalAppNavigator.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId
    val store = remember { AgentCreationStore() }
    val agents = remember { AgentsStore() }
    val entitlements = remember(graph.proAccess) { AgentEntitlementsStore(graph.proAccess) }

    var confirmDiscard by remember { mutableStateOf(false) }
    var validationMessage by remember { mutableStateOf<String?>(null) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var stage by remember { mutableStateOf(CreationStage.BUILDER) }
    var createdAgent by remember { mutableStateOf<Agent?>(null) }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    fun requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun requestExit() {
        if (store.step == 0 && store.draft == AgentCreationStore.Draft()) navigator.popAgents()
        else confirmDiscard = true
    }

    fun submit() {
        if (store.submitState is AgentCreationStore.SubmitState.Submitting) return
        val autoForcedOff = !entitlements.isAdmin && entitlements.isPro && agents.activeCount >= AgentEntitlementsStore.PRO_MAX_ACTIVE_AGENTS
        scope.launch {
            val agent = store.submit(autoModeForcedOff = autoForcedOff)
            if (agent == null) {
                submitError = (store.submitState as? AgentCreationStore.SubmitState.Failed)?.message
                    ?: "Something went wrong creating your agent. Please try again."
                return@launch
            }
            val sprite = store.draft.spriteIndex
            if (sprite != null && agent.spriteIndex != sprite) {
                agent.spriteIndexOverride = sprite
                launch(Dispatchers.IO) {
                    runCatching {
                        AgentAuthorizedActionsService.updateAgent(
                            agentId = agent.id,
                            payload = buildJsonObject { put("sprite_index", sprite) },
                        )
                    }
                }
            }
            createdAgent = agent
            stage = CreationStage.PREPARING
        }
    }

    LaunchedEffect(userId) {
        agents.bind(userId)
        agents.refresh()
        store.existingAgentNames = agents.agents.map { it.agent.name }
        store.loadArchetypesIfNeeded()
        if (store.draft.spriteIndex == null) {
            store.draft = store.draft.copy(spriteIndex = AgentSpriteIndex.forSeed("${userId.orEmpty()}-${System.nanoTime()}"))
        }
    }
    LaunchedEffect(agents.agents) { store.existingAgentNames = agents.agents.map { it.agent.name } }
    DisposableEffect(Unit) {
        onDispose {
            agents.close()
            store.close()
        }
    }

    BackHandler {
        when (stage) {
            CreationStage.BUILDER -> if (store.step > 0) store.back() else requestExit()
            CreationStage.PREPARING, CreationStage.CELEBRATION -> Unit
        }
    }

    when (stage) {
        CreationStage.PREPARING -> AgentCreationGenerationIntro(
            onComplete = { stage = CreationStage.CELEBRATION },
            modifier = modifier,
        )
        CreationStage.CELEBRATION -> createdAgent?.let { agent ->
            AgentBornCelebration(
                agent = agent,
                onContinue = {
                    navigator.popAgents()
                    navigator.openAgentDetail(agent.id, isPublic = false)
                },
                modifier = modifier,
            )
        }
        CreationStage.BUILDER -> CreationWizard(
            store = store,
            agents = agents,
            entitlements = entitlements,
            validationMessage = validationMessage,
            onValidationMessage = { validationMessage = it },
            onClose = ::requestExit,
            onRequestNotifications = ::requestNotifications,
            onSubmit = ::submit,
            modifier = modifier,
        )
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("Discard Agent?") },
            text = { Text("Are you sure you want to discard this agent? All progress will be lost.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    navigator.popAgents()
                }) { Text("Discard", color = AppColors.appLoss) }
            },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("Keep Editing") } },
            containerColor = AppColors.appSurfaceElevated,
            titleContentColor = AppColors.appTextPrimary,
            textContentColor = AppColors.appTextSecondary,
        )
    }

    submitError?.let { message ->
        AlertDialog(
            onDismissRequest = { submitError = null; store.submitState = AgentCreationStore.SubmitState.Idle },
            title = { Text("Couldn't create agent") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { submitError = null; store.submitState = AgentCreationStore.SubmitState.Idle }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
            titleContentColor = AppColors.appTextPrimary,
            textContentColor = AppColors.appTextSecondary,
        )
    }
}

@Composable
private fun CreationWizard(
    store: AgentCreationStore,
    agents: AgentsStore,
    entitlements: AgentEntitlementsStore,
    validationMessage: String?,
    onValidationMessage: (String?) -> Unit,
    onClose: () -> Unit,
    onRequestNotifications: () -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier,
) {
    val stepTitles = listOf("Sport & Style", "Identity", "Personality", "Data & Conditions", "Custom Insights", "Review")
    val canProceed = store.canProceed(store.step)
    val autoForcedOff = !entitlements.isAdmin && entitlements.isPro && agents.activeCount >= AgentEntitlementsStore.PRO_MAX_ACTIVE_AGENTS
    val maxLive = if (entitlements.isAdmin) null else if (entitlements.isPro) AgentEntitlementsStore.PRO_MAX_ACTIVE_AGENTS else null

    Column(
        modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding().imePadding(),
    ) {
        CreationHeader(stepTitles[store.step], store.step, onClose)
        AnimatedContent(
            targetState = store.step,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            transitionSpec = {
                val forward = targetState > initialState
                val direction = if (forward) 1 else -1
                (slideInHorizontally(tween(260)) { it * direction } + fadeIn(tween(220))) togetherWith
                    (slideOutHorizontally(tween(260)) { -it * direction } + fadeOut(tween(180)))
            },
            label = "agent-creation-step",
        ) { step ->
            when (step) {
                0 -> Step1SportArchetypeView(store, Modifier.fillMaxSize())
                1 -> Step2IdentityView(store, Modifier.fillMaxSize())
                2 -> Step3PersonalityView(store, Modifier.fillMaxSize())
                3 -> Step4DataAndConditionsView(store, Modifier.fillMaxSize())
                4 -> Step5CustomInsightsView(store, Modifier.fillMaxSize())
                else -> Step6ReviewView(
                    store = store,
                    autoModeForcedOff = autoForcedOff,
                    liveAutoAgentsCount = agents.activeCount,
                    maxLiveAutoAgents = maxLive,
                    onRequestNotifications = onRequestNotifications,
                    onCreate = onSubmit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        if (store.step < AgentCreationStore.totalSteps - 1) {
            validationMessage?.let {
                Text(it, color = AppColors.appLoss, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 3.dp))
            }
            CreationFooter(
                step = store.step,
                canProceed = canProceed,
                onBack = { onValidationMessage(null); store.back() },
                onNext = {
                    if (canProceed) {
                        onValidationMessage(null)
                        store.advance()
                    } else {
                        onValidationMessage(store.validationError(store.step))
                    }
                },
            )
        }
    }
}

@Composable
private fun CreationHeader(title: String, step: Int, onClose: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Row(Modifier.fillMaxWidth().height(52.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose, modifier = Modifier.semantics { contentDescription = "Cancel agent creation" }) {
                Icon(AppIcon.XMARK.imageVector, null, tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
            }
            Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            Text("${step + 1}/${AgentCreationStore.totalSteps}", color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 12.dp))
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 42.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(AgentCreationStore.totalSteps) { index ->
                Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (index <= step) AppColors.brandGreenBright else AppColors.appBorder))
            }
        }
    }
}

@Composable
private fun CreationFooter(step: Int, canProceed: Boolean, onBack: () -> Unit, onNext: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (step > 0) {
            Text(
                "Back",
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f).clip(CircleShape).background(AppColors.appSurfaceElevated).border(1.dp, AppColors.appBorder, CircleShape).clickable(onClick = onBack).semantics { role = Role.Button }.padding(vertical = 16.dp),
            )
        }
        Text(
            "Next",
            color = if (canProceed) Color.Black else AppColors.appTextSecondary,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f).clip(CircleShape).background(AppColors.brandGreenBright.copy(alpha = if (canProceed) 0.9f else 0.24f)).clickable(onClick = onNext).semantics { role = Role.Button; contentDescription = if (canProceed) "Next step" else "Next step unavailable" }.padding(vertical = 16.dp),
        )
    }
}
