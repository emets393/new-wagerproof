package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.creation.inputs.SwipeableEmojiPicker
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.stores.AgentCreationStore

private val IdentityGradients = listOf(
    "gradient:#6366f1,#ec4899", "gradient:#8b5cf6,#06b6d4",
    "gradient:#ef4444,#f97316", "gradient:#22c55e,#06b6d4",
    "gradient:#f97316,#eab308", "gradient:#ec4899,#8b5cf6",
    "gradient:#06b6d4,#6366f1", "gradient:#22c55e,#eab308",
    "gradient:#ef4444,#ec4899", "gradient:#8b5cf6,#f97316",
    "gradient:#3b82f6,#22c55e", "gradient:#f59e0b,#ef4444",
    "gradient:#14b8a6,#8b5cf6", "gradient:#6366f1,#3b82f6",
    "gradient:#dc2626,#7c3aed", "gradient:#0ea5e9,#22d3ee",
)

/** Step 2: agent name, pixel character, emoji, and gradient identity. */
@Composable
fun Step2IdentityView(store: AgentCreationStore, modifier: Modifier = Modifier) {
    val draft = store.draft
    val primary = AgentColorPalette.primary(draft.avatarColor)
    val trimmed = draft.name.trim()
    val duplicate = trimmed.isNotEmpty() && store.existingAgentNames.any { it.equals(trimmed, ignoreCase = true) }
    val sprite = draft.spriteIndex ?: AgentSpriteIndex.forSeed(draft.name.ifBlank { "new-agent" })

    Column(
        modifier.fillMaxWidth().background(AppColors.appSurface).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier.size(88.dp).clip(RoundedCornerShape(25.dp)).background(Brush.linearGradient(AgentColorPalette.avatarGradient(draft.avatarColor))).border(3.dp, primary, RoundedCornerShape(25.dp)),
                contentAlignment = Alignment.Center,
            ) {
                PixelSpriteAvatar(spriteIndex = sprite, animated = true, modifier = Modifier.size(72.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(draft.name.ifBlank { "Agent Name" }, color = AppColors.appTextPrimary.copy(alpha = if (draft.name.isBlank()) 0.5f else 1f), fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }

        WizardSectionHeader("AGENT NAME")
        WizardSectionCard {
            TextField(
                value = draft.name,
                onValueChange = { store.draft = store.draft.copy(name = it) },
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Agent name" },
                placeholder = { Text("e.g., Sharp Shooter, The Oracle") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = primary,
                    unfocusedIndicatorColor = AppColors.appBorder,
                    focusedTextColor = AppColors.appTextPrimary,
                    unfocusedTextColor = AppColors.appTextPrimary,
                ),
            )
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 5.dp)) {
            Text(
                when {
                    duplicate -> "You already have an agent with this name"
                    draft.name.isBlank() -> "Give your agent a unique name (required)"
                    else -> ""
                },
                color = if (duplicate) AppColors.appLoss else AppColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.weight(1f),
            )
            Text("${draft.name.length}/50", color = if (draft.name.length > 50) AppColors.appLoss else AppColors.appTextSecondary, fontSize = 12.sp)
        }

        WizardSectionHeader("PIXEL CHARACTER")
        WizardSectionCard {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(8) { index ->
                    val selected = sprite == index
                    Box(
                        Modifier.size(width = 54.dp, height = 68.dp).clip(RoundedCornerShape(12.dp)).background(if (selected) primary.copy(alpha = 0.18f) else AppColors.appSurfaceMuted).border(if (selected) 2.dp else 1.dp, if (selected) primary else AppColors.appBorder, RoundedCornerShape(12.dp)).clickable { store.draft = store.draft.copy(spriteIndex = index) }.semantics { contentDescription = "Character ${index + 1}${if (selected) ", selected" else ""}" },
                        contentAlignment = Alignment.Center,
                    ) { PixelSpriteAvatar(index, animated = selected, modifier = Modifier.size(width = 44.dp, height = 58.dp)) }
                }
            }
        }

        WizardSectionHeader("CHOOSE AN EMOJI")
        WizardSectionCard {
            SwipeableEmojiPicker(
                selectedEmoji = draft.avatarEmoji,
                onSelect = { store.draft = store.draft.copy(avatarEmoji = it) },
                selectedColor = primary,
                modifier = Modifier.padding(vertical = 8.dp),
            )
        }
        WizardSectionFooter("Select an emoji to represent your agent (required)")

        WizardSectionHeader("CHOOSE A COLOR")
        WizardSectionCard {
            IdentityGradients.chunked(4).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceAround) {
                    row.forEach { gradient ->
                        val selected = draft.avatarColor == gradient
                        Box(
                            Modifier.size(50.dp).clip(CircleShape).background(Brush.linearGradient(AgentColorPalette.avatarGradient(gradient))).border(if (selected) 3.dp else 0.dp, Color.White, CircleShape).clickable { store.draft = store.draft.copy(avatarColor = gradient) }.semantics { contentDescription = "Agent color${if (selected) ", selected" else ""}" },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) {
                                Box(Modifier.size(24.dp).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) {
                                    Icon(AppIcon.CHECKMARK.imageVector, null, tint = Color.Black, modifier = Modifier.size(13.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
        WizardSectionFooter("Select a gradient color for your agent")
        Spacer(Modifier.height(24.dp))
    }
}
