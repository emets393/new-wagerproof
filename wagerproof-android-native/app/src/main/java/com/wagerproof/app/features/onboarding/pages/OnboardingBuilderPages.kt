package com.wagerproof.app.features.onboarding.pages

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.creation.inputs.ArchetypeCard
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingOptionCard
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.stores.AgentCreationStore
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingBuilderSportsPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    OnboardingPageScaffold(
        title = "Which sports should your agent work?",
        subtitle = "Pick every league you want it to research — adjust anytime.",
        modifier = modifier,
    ) {
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            maxItemsInEachRow = 2,
        ) {
            AgentSport.entries.forEachIndexed { index, sport ->
                OnboardingChip(
                    label = sport.label,
                    icon = sport.sfSymbol,
                    isSelected = sport in creation.draft.preferredSports,
                    accent = accent,
                    modifier = Modifier.weight(1f).pageEntrance(2 + index),
                ) { creation.toggleSport(sport) }
            }
        }
    }
}

@Composable
fun OnboardingBuilderArchetypePage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val scope = rememberCoroutineScope()
    val customSelected = store.hasChosenArchetype && creation.draft.archetype == null
    OnboardingPageScaffold(
        title = "Pick a starting point",
        subtitle = "Preset or custom — either way, you'll walk its full personality on the next pages.",
        modifier = modifier,
    ) {
        Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            OnboardingOptionCard(
                title = "Customize",
                detail = "Start balanced and shape every dial yourself on the next pages",
                icon = "slider.horizontal.3",
                isSelected = customSelected,
                modifier = Modifier.pageEntrance(2),
            ) {
                if (!customSelected) {
                    val sports = creation.draft.preferredSports
                    creation.clearArchetype()
                    creation.draft = creation.draft.copy(preferredSports = sports)
                    store.setArchetypeChosen()
                }
            }
            Text(
                "OR PICK A PRESET",
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 8.dp).pageEntrance(3),
            )
            when (creation.archetypesLoadState) {
                AgentCreationStore.ArchetypesLoadState.Idle,
                AgentCreationStore.ArchetypesLoadState.Loading -> repeat(3) { ArchetypeSkeleton() }
                is AgentCreationStore.ArchetypesLoadState.Failed -> {
                    Column(
                        Modifier.fillMaxWidth().liquidGlassBackground(RoundedCornerShape(16.dp), Color.White.copy(alpha = 0.05f)).padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("Couldn't load presets", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("Check your connection and retry, or start from scratch above.", color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
                        Text("Retry", color = AppColors.appPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.onboardingPressable { scope.launch { creation.loadArchetypesIfNeeded() } }.padding(8.dp))
                    }
                }
                AgentCreationStore.ArchetypesLoadState.Loaded -> creation.archetypeRows.take(3).forEachIndexed { index, row ->
                    ArchetypeCard(
                        row = row,
                        selected = creation.draft.archetype?.raw == row.id && store.hasChosenArchetype,
                        onSelect = {
                            val sports = creation.draft.preferredSports
                            creation.applyArchetype(row)
                            if (sports.isNotEmpty()) creation.draft = creation.draft.copy(preferredSports = sports)
                            store.setArchetypeChosen()
                        },
                        modifier = Modifier.pageEntrance(4 + index),
                    )
                }
            }
        }
    }
}

@Composable
private fun ArchetypeSkeleton() {
    Row(
        Modifier.fillMaxWidth().height(82.dp).padding(vertical = 4.dp).background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(16.dp)).padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp)))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.width(140.dp).height(16.dp).background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(5.dp)))
            Box(Modifier.fillMaxWidth().height(12.dp).background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(5.dp)))
        }
    }
}

private val identityGradients = listOf(
    "gradient:#6366f1,#ec4899", "gradient:#8b5cf6,#06b6d4", "gradient:#ef4444,#f97316", "gradient:#22c55e,#06b6d4",
    "gradient:#f97316,#eab308", "gradient:#ec4899,#8b5cf6", "gradient:#06b6d4,#6366f1", "gradient:#22c55e,#eab308",
    "gradient:#ef4444,#ec4899", "gradient:#8b5cf6,#f97316", "gradient:#3b82f6,#22c55e", "gradient:#f59e0b,#ef4444",
    "gradient:#14b8a6,#8b5cf6", "gradient:#6366f1,#3b82f6", "gradient:#dc2626,#7c3aed", "gradient:#0ea5e9,#22d3ee",
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingBuilderIdentityPage(creation: AgentCreationStore, modifier: Modifier = Modifier) {
    val haptics = LocalHapticFeedback.current
    val sprite = creation.draft.spriteIndex ?: 0
    OnboardingPageScaffold(
        title = "Name your agent",
        subtitle = "This is who you'll see grinding the research.",
        modifier = modifier,
    ) {
        Box(
            Modifier.padding(top = 8.dp).size(88.dp).background(Brush.linearGradient(AgentColorPalette.avatarGradient(creation.draft.avatarColor)), RoundedCornerShape(26.dp)).border(1.5.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(26.dp)).pageEntrance(2),
            contentAlignment = Alignment.Center,
        ) {
            PixelSpriteAvatar(sprite, Modifier.size(80.dp).padding(8.dp))
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 10.dp).pageEntrance(3), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp)).border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 13.dp),
            ) {
                if (creation.draft.name.isEmpty()) Text("e.g., Sharp Shooter, The Oracle", color = Color.White.copy(alpha = 0.4f), fontSize = 16.sp)
                BasicTextField(
                    value = creation.draft.name,
                    onValueChange = { creation.draft = creation.draft.copy(name = it) },
                    textStyle = TextStyle(Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium),
                    cursorBrush = SolidColor(AppColors.appPrimary),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(Modifier.fillMaxWidth()) {
                if (creation.draft.name.length > 50) Text("Name must be 50 characters or less", color = AppColors.appAccentRed, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                Text("${creation.draft.name.length}/50", color = if (creation.draft.name.length > 50) AppColors.appAccentRed else Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
            }
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 10.dp).pageEntrance(4), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PickerLabel("CHARACTER")
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(8) { index ->
                    val selected = sprite == index
                    Box(
                        Modifier.width(56.dp).height(68.dp).liquidGlassBackground(RoundedCornerShape(10.dp), if (selected) AppColors.appPrimary.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.05f)).border(if (selected) 2.dp else 0.dp, if (selected) AppColors.appPrimary else Color.Transparent, RoundedCornerShape(10.dp)).onboardingPressable {
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            creation.draft = creation.draft.copy(spriteIndex = index)
                        }.padding(horizontal = 7.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) { PixelSpriteAvatar(index, Modifier.fillMaxWidth()) }
                }
            }
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 10.dp).pageEntrance(5), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PickerLabel("COLOR")
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp), maxItemsInEachRow = 4) {
                identityGradients.forEach { raw ->
                    val selected = creation.draft.avatarColor == raw
                    Box(
                        Modifier.size(48.dp).background(Brush.linearGradient(AgentColorPalette.avatarGradient(raw)), CircleShape).border(if (selected) 3.dp else 0.dp, if (selected) Color.White else Color.Transparent, CircleShape).onboardingPressable {
                            creation.draft = creation.draft.copy(avatarColor = raw)
                        },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (selected) Box(Modifier.size(22.dp).background(Color.White.copy(alpha = 0.9f), CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Filled.Check, null, tint = Color.Black, modifier = Modifier.size(12.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerLabel(label: String) {
    Text(label, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
}
