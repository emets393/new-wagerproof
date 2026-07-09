package com.wagerproof.app.features.onboarding

import android.provider.Settings
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.platform.LocalContext
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.cinematic.OnboardingGenerationCinematic
import com.wagerproof.app.features.onboarding.cinematic.OnboardingGenesisModel
import com.wagerproof.app.features.onboarding.cinematic.OnboardingRevealView
import com.wagerproof.app.features.onboarding.pages.OnboardingATTPage
import com.wagerproof.app.features.onboarding.pages.OnboardingAcquisitionPage
import com.wagerproof.app.features.onboarding.pages.OnboardingAgentHQPage
import com.wagerproof.app.features.onboarding.pages.OnboardingAgentPitchIntroPage
import com.wagerproof.app.features.onboarding.pages.OnboardingAgentPitchProofPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBettingPitfallsPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBettorTypePage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderArchetypePage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderBetStylePage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderDataTrustPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderIdentityPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderInsightsPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderMindsetPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderSportRulesPage
import com.wagerproof.app.features.onboarding.pages.OnboardingBuilderSportsPage
import com.wagerproof.app.features.onboarding.pages.OnboardingPersonalizedValuePage
import com.wagerproof.app.features.onboarding.pages.OnboardingPrimaryGoalPage
import com.wagerproof.app.features.onboarding.pages.OnboardingTermsPage
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.backgrounds.LocalGlyphRippleEmitter
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.components.LocalHazeState
import com.wagerproof.core.design.components.liquidGlassSource
import com.wagerproof.core.models.AgentArchetype
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.stores.AgentCreationStore
import com.wagerproof.core.stores.OnboardingStore
import kotlinx.coroutines.delay
import dev.chrisbanes.haze.HazeState

/**
 * Complete native port of the current iOS onboarding: one persistent reactive
 * pixel field, 18 button-driven carousel pages, then generation and reveal.
 */
@Composable
fun OnboardingScreen(modifier: Modifier = Modifier) {
    val onboarding = appGraph().onboarding
    val context = LocalContext.current
    val reduceMotion = remember {
        runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        }.getOrDefault(false)
    }
    val creation = remember { AgentCreationStore() }
    val rippleEmitter = remember { GlyphRippleEmitter() }
    val hazeState = remember { HazeState() }
    var genesis by remember { mutableStateOf<OnboardingGenesisModel?>(null) }
    var didSeedBuilder by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { creation.loadArchetypesIfNeeded() }
    DisposableEffect(Unit) {
        onDispose {
            genesis?.cancel()
            creation.close()
        }
    }

    // Seed once before the pitch/builder section, matching iOS: stable random
    // character and NFL as a non-empty starting point.
    LaunchedEffect(onboarding.currentStep) {
        if (!didSeedBuilder && onboarding.currentStep >= OnboardingStore.Step.AGENT_VALUE_INTRO) {
            didSeedBuilder = true
            if (creation.draft.spriteIndex == null) {
                creation.draft = creation.draft.copy(spriteIndex = (0..7).random())
            }
            if (creation.draft.preferredSports.isEmpty()) {
                creation.draft = creation.draft.copy(preferredSports = listOf(AgentSport.NFL))
            }
        }
        projectDraft(creation, onboarding)
    }
    LaunchedEffect(creation.draft) { projectDraft(creation, onboarding) }

    val baseAccent = OnboardingTheme.accent(onboarding.survey.bettorType)
    val archetypeAccent = if (onboarding.hasChosenArchetype) {
        val id = creation.draft.archetype?.raw
        OnboardingTheme.archetypeAccent(creation.archetypeRows.firstOrNull { it.id == id }?.color)
    } else {
        null
    }
    val phaseAccent = archetypeAccent ?: baseAccent
    val accent = if (onboarding.currentStep == OnboardingStore.Step.GENERATION) {
        OnboardingTheme.generationBoost(phaseAccent)
    } else {
        phaseAccent
    }

    LaunchedEffect(onboarding.currentStep) {
        if (onboarding.currentStep.isCinematic && genesis == null) {
            genesis = OnboardingGenesisModel(onboarding, creation, rippleEmitter)
            if (onboarding.currentStep == OnboardingStore.Step.GENERATION) genesis?.start()
        }
    }

    androidx.compose.runtime.CompositionLocalProvider(
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

            AnimatedContent(
                targetState = onboarding.currentStep.isCinematic,
                transitionSpec = {
                    val duration = if (reduceMotion) 1 else 450
                    fadeIn(tween(duration)) togetherWith fadeOut(tween(duration))
                },
                label = "onboardingPhase",
            ) { cinematic ->
                if (!cinematic) {
                    OnboardingCarouselContainer(onboarding, creation, accent)
                } else if (onboarding.currentStep == OnboardingStore.Step.GENERATION) {
                    OnboardingGenerationCinematic(genesis, accent)
                } else {
                    OnboardingRevealView(genesis, accent)
                }
            }
        }
    }
}

@Composable
private fun OnboardingCarouselContainer(
    store: OnboardingStore,
    creation: AgentCreationStore,
    accent: Color,
) {
    val reduceMotion = LocalOnboardingReduceMotion.current
    val step = store.currentStep
    val spec = OnboardingPageSpec.specFor(step)
    var previousRaw by remember { mutableStateOf(step.raw) }
    val forward = step.raw >= previousRaw
    LaunchedEffect(step) {
        delay(360)
        previousRaw = step.raw
    }

    OnboardingPageShell(
        progress = step.progress,
        continueTitle = spec.ctaTitle,
        isCTAEnabled = spec.isCTAEnabled(store) && !store.isTransitioning,
        isCTALoading = store.isTransitioning,
        canGoBack = step > OnboardingStore.Step.TERMS,
        ctaTint = accent,
        onContinue = { spec.onContinue(store) },
        onBack = store::back,
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
            label = "onboardingCarousel",
        ) { page ->
            when (page) {
                OnboardingStore.Step.TERMS -> OnboardingTermsPage()
                OnboardingStore.Step.BETTOR_TYPE -> OnboardingBettorTypePage()
                OnboardingStore.Step.BETTING_PITFALLS -> OnboardingBettingPitfallsPage()
                OnboardingStore.Step.PERSONALIZED_VALUE -> OnboardingPersonalizedValuePage()
                OnboardingStore.Step.ACQUISITION_SOURCE -> OnboardingAcquisitionPage()
                OnboardingStore.Step.PRIMARY_GOAL -> OnboardingPrimaryGoalPage()
                OnboardingStore.Step.AGENT_HQ -> OnboardingAgentHQPage()
                OnboardingStore.Step.AGENT_VALUE_INTRO -> OnboardingAgentPitchIntroPage()
                OnboardingStore.Step.AGENT_VALUE_PROOF -> OnboardingAgentPitchProofPage()
                OnboardingStore.Step.ATT_PRIMING -> OnboardingATTPage()
                OnboardingStore.Step.BUILDER_SPORTS -> OnboardingBuilderSportsPage(creation)
                OnboardingStore.Step.BUILDER_ARCHETYPE -> OnboardingBuilderArchetypePage(creation)
                OnboardingStore.Step.BUILDER_MINDSET -> OnboardingBuilderMindsetPage(creation)
                OnboardingStore.Step.BUILDER_BET_STYLE -> OnboardingBuilderBetStylePage(creation)
                OnboardingStore.Step.BUILDER_DATA_TRUST -> OnboardingBuilderDataTrustPage(creation)
                OnboardingStore.Step.BUILDER_SPORT_RULES -> OnboardingBuilderSportRulesPage(creation)
                OnboardingStore.Step.BUILDER_INSIGHTS -> OnboardingBuilderInsightsPage(creation)
                OnboardingStore.Step.BUILDER_IDENTITY -> OnboardingBuilderIdentityPage(creation)
                OnboardingStore.Step.GENERATION, OnboardingStore.Step.REVEAL -> Unit
            }
        }
    }
}

private fun projectDraft(creation: AgentCreationStore, onboarding: OnboardingStore) {
    val draft = creation.draft
    onboarding.setAgentDraft(
        OnboardingStore.AgentDraft(
            preferredSports = draft.preferredSports.mapNotNull { sport ->
                SportLeague.entries.firstOrNull { it.raw == sport.raw }
            },
            archetype = draft.archetype?.raw,
            name = draft.name,
            avatarEmoji = draft.avatarEmoji,
            avatarColor = draft.avatarColor,
            spriteIndex = draft.spriteIndex,
            personalityParams = draft.personalityParams,
            customInsights = draft.customInsights,
            autoGenerate = draft.autoGenerate,
            autoGenerateTime = draft.autoGenerateTime,
            autoGenerateTimezone = draft.autoGenerateTimezone,
        ),
    )
}
