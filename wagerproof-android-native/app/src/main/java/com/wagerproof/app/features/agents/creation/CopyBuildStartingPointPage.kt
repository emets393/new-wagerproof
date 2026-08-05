package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.creation.inputs.ArchetypeCard
import com.wagerproof.app.features.onboarding.OnboardingOptionCard
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.AgentCreationStore
import kotlinx.coroutines.launch

/**
 * Agent-builder-only starting-point page for Copy Build. The shared onboarding
 * page has no concept of public-agent provenance; rendering this variant keeps
 * the copied source selected instead of incorrectly highlighting the balanced
 * Customize card for copied agents whose archetype is fully custom.
 */
@Composable
internal fun CopyBuildStartingPointPage(
    creation: AgentCreationStore,
    copiedDraft: AgentCreationStore.Draft,
    source: AgentCreationStore.CopySource,
    isCopySelected: Boolean,
    onCopySelectionChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val onboarding = appGraph().onboarding
    val scope = rememberCoroutineScope()
    val customSelected = onboarding.hasChosenArchetype &&
        creation.draft.archetype == null && !isCopySelected

    fun selectCopy() {
        creation.draft = copiedDraft
        onCopySelectionChanged(true)
        onboarding.setArchetypeChosen()
    }

    fun selectCustom() {
        val sports = creation.draft.preferredSports
        creation.clearArchetype()
        creation.draft = creation.draft.copy(
            preferredSports = sports,
            copySource = null,
        )
        onCopySelectionChanged(false)
        onboarding.setArchetypeChosen()
    }

    OnboardingPageScaffold(
        title = "Pick a starting point",
        subtitle = "Continue from ${source.name}'s build, or start another way.",
        modifier = modifier,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            CopiedSourceCard(
                source = source,
                selected = isCopySelected,
                onClick = ::selectCopy,
                modifier = Modifier.pageEntrance(2),
            )
            SectionDivider("OR START ANOTHER WAY", Modifier.pageEntrance(3))
            OnboardingOptionCard(
                title = "Customize",
                detail = "Start balanced and shape every dial yourself on the next pages",
                icon = "slider.horizontal.3",
                isSelected = customSelected,
                modifier = Modifier.pageEntrance(4),
                onClick = ::selectCustom,
            )
            SectionDivider("OR PICK A PRESET", Modifier.pageEntrance(5))
            when (creation.archetypesLoadState) {
                AgentCreationStore.ArchetypesLoadState.Idle,
                AgentCreationStore.ArchetypesLoadState.Loading -> repeat(3) { CopyArchetypeSkeleton() }
                is AgentCreationStore.ArchetypesLoadState.Failed -> {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .liquidGlassBackground(
                                RoundedCornerShape(16.dp),
                                Color.White.copy(alpha = 0.05f),
                            )
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("Couldn't load presets", color = Color.White, fontWeight = FontWeight.Bold)
                        Text(
                            "Retry, or keep the copied build selected above.",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 14.sp,
                        )
                        Text(
                            "Retry",
                            color = AppColors.appPrimary,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .onboardingPressable {
                                    scope.launch { creation.loadArchetypesIfNeeded() }
                                }
                                .padding(8.dp),
                        )
                    }
                }
                AgentCreationStore.ArchetypesLoadState.Loaded -> {
                    creation.archetypeRows.take(3).forEachIndexed { index, row ->
                        ArchetypeCard(
                            row = row,
                            spriteIndex = index,
                            selected = !isCopySelected && creation.draft.archetype?.raw == row.id,
                            onSelect = {
                                val sports = creation.draft.preferredSports
                                creation.applyArchetype(row)
                                creation.draft = creation.draft.copy(
                                    preferredSports = sports.ifEmpty { creation.draft.preferredSports },
                                    copySource = null,
                                )
                                onCopySelectionChanged(false)
                                onboarding.setArchetypeChosen()
                            },
                            modifier = Modifier.pageEntrance(6 + index),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CopiedSourceCard(
    source: AgentCreationStore.CopySource,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = AgentColorPalette.primary(source.avatarColor)
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier
            .fillMaxWidth()
            .liquidGlassBackground(
                shape,
                if (selected) accent.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.05f),
            )
            .border(if (selected) 1.5.dp else 0.dp, if (selected) accent else Color.Transparent, shape)
            .onboardingPressable(onClickLabel = "Continue from ${source.name}'s build", onClick = onClick)
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(48.dp)
                .background(
                    Brush.linearGradient(AgentColorPalette.avatarGradient(source.avatarColor)),
                    RoundedCornerShape(12.dp),
                )
                .padding(4.dp),
            contentAlignment = Alignment.Center,
        ) {
            PixelSpriteAvatar(source.spriteIndex, Modifier.size(42.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Copy this build", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "${source.name}'s sports, strategy, insights, and personality",
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 14.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun SectionDivider(label: String, modifier: Modifier = Modifier) {
    Text(
        label,
        color = Color.White.copy(alpha = 0.4f),
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.sp,
        modifier = modifier.fillMaxWidth().padding(vertical = 8.dp),
    )
}

@Composable
private fun CopyArchetypeSkeleton() {
    Row(
        Modifier
            .fillMaxWidth()
            .height(82.dp)
            .padding(vertical = 4.dp)
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp)))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.fillMaxWidth(0.55f).height(16.dp).background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(5.dp)))
            Box(Modifier.fillMaxWidth().height(12.dp).background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(5.dp)))
        }
        Spacer(Modifier.size(1.dp))
    }
}
