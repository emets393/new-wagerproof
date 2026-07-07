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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.creation.inputs.ArchetypeCard
import com.wagerproof.app.features.agents.creation.inputs.clickableNoRipple
import com.wagerproof.app.features.agents.iconVector
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.stores.AgentCreationStore
import kotlinx.coroutines.launch

private enum class CreationPath { UNSET, SCRATCH, PRESET }

/**
 * Step 1 of the wizard: pick a creation path (scratch / preset), then select
 * sports (scratch) or an archetype preset (preset). Port of iOS
 * `Step1SportArchetypeView`.
 */
@Composable
fun Step1SportArchetypeView(store: AgentCreationStore, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    // Derive initial path from draft (so back-navigation restores the sub-screen).
    var path by remember {
        mutableStateOf(
            when {
                store.draft.archetype != null -> CreationPath.PRESET
                store.draft.preferredSports.isNotEmpty() -> CreationPath.SCRATCH
                else -> CreationPath.UNSET
            },
        )
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 20.dp, bottom = 24.dp),
    ) {
        when (path) {
            CreationPath.UNSET -> PathSelection(
                onScratch = {
                    store.clearArchetype()
                    path = CreationPath.SCRATCH
                },
                onPreset = {
                    store.draft = store.draft.copy(preferredSports = emptyList())
                    store.clearArchetype()
                    path = CreationPath.PRESET
                    scope.launch { store.loadArchetypesIfNeeded() }
                },
            )
            CreationPath.SCRATCH -> ScratchSection(store) { path = CreationPath.UNSET }
            CreationPath.PRESET -> PresetSection(store) { path = CreationPath.UNSET }
        }
    }
}

@Composable
private fun PathSelection(onScratch: () -> Unit, onPreset: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "How do you want to start?",
            color = AppColors.appTextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
        )
        Text(
            text = "Build a custom strategy or pick a proven preset.",
            color = AppColors.appTextSecondary,
            fontSize = 15.sp,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        PathCard(
            icon = Icons.Filled.Tune,
            iconColor = AppColors.brandGreenBright,
            title = "Build from Scratch",
            desc = "Choose your sports, then fine-tune every parameter yourself.",
            onClick = onScratch,
        )
        PathCard(
            icon = Icons.Filled.Bolt,
            iconColor = Color(0xFF818CF8),
            title = "Use a Preset",
            desc = "Start with a proven betting style. Sports and settings are pre-configured.",
            onClick = onPreset,
        )
        Spacer(Modifier.height(0.dp))
        PerformanceCard(modifier = Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun PathCard(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    desc: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appBorder.copy(alpha = 0.25f), shape)
            .border(1.dp, AppColors.appBorder, shape)
            .clickableNoRipple(onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(iconColor.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(text = desc, color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.width(8.dp))
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
        )
    }
}

@Composable
private fun PerformanceCard(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appBorder.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(Color(0xFF22C55E), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.BarChart, contentDescription = null, tint = Color.White, modifier = Modifier.size(11.dp))
            }
            Text(
                text = "This Model Wins Across the Board",
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            text = "Our agents consistently outperform average bettors by running disciplined, 24/7 research and execution.",
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
        )
        PerfRow("Our Agents", "9-12%", 120.dp, Color(0xFF22C55E), positive = true)
        PerfRow("Pro Bettor", "2-5%", 62.dp, AppColors.appBorder, positive = true)
        PerfRow("Casual Bettor", "-5%", 38.dp, AppColors.appBorder.copy(alpha = 0.6f), positive = false)
    }
}

@Composable
private fun PerfRow(label: String, value: String, barWidth: androidx.compose.ui.unit.Dp, color: Color, positive: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            color = AppColors.appTextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.width(82.dp),
        )
        Box(
            modifier = Modifier.weight(1f).height(12.dp),
            contentAlignment = if (positive) Alignment.CenterStart else Alignment.CenterEnd,
        ) {
            Box(
                modifier = Modifier
                    .width(barWidth)
                    .height(12.dp)
                    .background(color, RoundedCornerShape(4.dp)),
            )
        }
        Text(
            text = value,
            color = AppColors.appTextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(44.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.End,
        )
    }
}

@Composable
private fun ScratchSection(store: AgentCreationStore, onChangePath: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ChangePathButton(onChangePath)
        Text("Select Sports", color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(
            "Which sports should your agent analyze? Pick one or more.",
            color = AppColors.appTextSecondary,
            fontSize = 15.sp,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        AgentSport.entries.forEach { sport ->
            SportRow(
                sport = sport,
                selected = store.draft.preferredSports.contains(sport),
                onClick = { store.toggleSport(sport) },
            )
        }
        if (store.draft.preferredSports.isEmpty()) {
            Text(
                "Select at least one sport to continue",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

private data class SportConfig(val label: String, val desc: String, val color: Color)

private fun sportConfig(sport: AgentSport): SportConfig = when (sport) {
    AgentSport.NFL -> SportConfig("NFL", "Pro Football", Color(0xFF013369))
    AgentSport.CFB -> SportConfig("CFB", "College Football", Color(0xFFC41E3A))
    AgentSport.NBA -> SportConfig("NBA", "Pro Basketball", Color(0xFF1D428A))
    AgentSport.NCAAB -> SportConfig("NCAAB", "College Basketball", Color(0xFFFF6B00))
    AgentSport.MLB -> SportConfig("MLB", "Pro Baseball", Color(0xFF002D72))
}

@Composable
private fun SportRow(sport: AgentSport, selected: Boolean, onClick: () -> Unit) {
    val conf = sportConfig(sport)
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (selected) AppColors.brandGreenBright.copy(alpha = 0.08f) else AppColors.appBorder.copy(alpha = 0.25f),
                shape,
            )
            .border(
                if (selected) 1.5.dp else 1.dp,
                if (selected) AppColors.brandGreenBright else AppColors.appBorder,
                shape,
            )
            .clickableNoRipple(onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(conf.color.copy(alpha = 0.18f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(sport.iconVector(), contentDescription = null, tint = conf.color, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(conf.label, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(conf.desc, color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(
                    if (selected) AppColors.brandGreenBright else Color.Transparent,
                    RoundedCornerShape(6.dp),
                )
                .border(
                    2.dp,
                    if (selected) AppColors.brandGreenBright else AppColors.appBorder,
                    RoundedCornerShape(6.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun PresetSection(store: AgentCreationStore, onChangePath: () -> Unit) {
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ChangePathButton(onChangePath)
        Text("Choose a Preset", color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(
            "Each preset comes with a tuned strategy and recommended sports. You can customize it later.",
            color = AppColors.appTextSecondary,
            fontSize = 15.sp,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        when (val state = store.archetypesLoadState) {
            AgentCreationStore.ArchetypesLoadState.Idle,
            AgentCreationStore.ArchetypesLoadState.Loading -> {
                Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AppColors.appPrimary)
                }
            }
            is AgentCreationStore.ArchetypesLoadState.Failed -> {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Filled.Warning, contentDescription = null, tint = AppColors.appAccentRed)
                    Text("Couldn't load presets", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(state.message, color = AppColors.appTextSecondary, fontSize = 12.sp)
                    TextButton(onClick = { scope.launch { store.loadArchetypesIfNeeded() } }) {
                        Text("Retry", color = AppColors.appPrimary)
                    }
                }
            }
            AgentCreationStore.ArchetypesLoadState.Loaded -> {
                store.archetypeRows.forEach { row ->
                    ArchetypeCard(
                        row = row,
                        selected = store.draft.archetype?.raw == row.id,
                        onSelect = { store.applyArchetype(row) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ChangePathButton(onClick: () -> Unit) {
    Row(
        modifier = Modifier.clickableNoRipple(onClick).padding(bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(13.dp),
        )
        Text("Change path", color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
