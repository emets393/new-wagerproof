package com.wagerproof.app.features.agents.creation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.creation.inputs.clickableNoRipple
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.stores.AgentCreationStore

private enum class InsightField { PHILOSOPHY, EDGES, AVOID, TARGET }
private data class InsightConfig(
    val field: InsightField,
    val title: String,
    val icon: String,
    val description: String,
    val placeholder: String,
    val maxLength: Int,
)

private val InsightFields = listOf(
    InsightConfig(InsightField.PHILOSOPHY, "Betting Philosophy", "book.fill", "Describe the principles that guide your decisions.", "e.g., I believe in value betting and only take plays with a significant market edge...", 500),
    InsightConfig(InsightField.EDGES, "Perceived Edges", "chart.line.uptrend.xyaxis", "What unique insights or edges do you think you have?", "e.g., I'm particularly good at spotting mispriced totals in divisional games...", 500),
    InsightConfig(InsightField.AVOID, "Situations to Avoid", "xmark.octagon", "What games or situations should your agent avoid?", "e.g., Avoid teams coming off emotional wins and games with uncertain QB situations...", 300),
    InsightConfig(InsightField.TARGET, "Target Situations", "target", "What games or situations should your agent prioritize?", "e.g., Look for home underdogs off a bye and late-season division games...", 300),
)

/** Step 5: optional long-form steering instructions. */
@Composable
fun Step5CustomInsightsView(store: AgentCreationStore, modifier: Modifier = Modifier) {
    val insights = store.draft.customInsights
    fun value(field: InsightField): String = when (field) {
        InsightField.PHILOSOPHY -> insights.bettingPhilosophy.orEmpty()
        InsightField.EDGES -> insights.perceivedEdges.orEmpty()
        InsightField.AVOID -> insights.avoidSituations.orEmpty()
        InsightField.TARGET -> insights.targetSituations.orEmpty()
    }
    fun update(field: InsightField, raw: String) {
        val text = raw.ifEmpty { null }
        val next = when (field) {
            InsightField.PHILOSOPHY -> insights.copy(bettingPhilosophy = text)
            InsightField.EDGES -> insights.copy(perceivedEdges = text)
            InsightField.AVOID -> insights.copy(avoidSituations = text)
            InsightField.TARGET -> insights.copy(targetSituations = text)
        }
        store.draft = store.draft.copy(customInsights = next)
    }
    val filled = InsightFields.count { value(it.field).isNotEmpty() }

    Column(
        modifier.fillMaxWidth().background(AppColors.appSurface).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("Custom Insights", color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, top = 8.dp))
        Text("Help your agent understand your betting perspective. These are optional, but improve how closely it matches your style.", color = AppColors.appTextSecondary, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 4.dp))
        Text("$filled of ${InsightFields.size} completed (optional)", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp))

        InsightFields.forEach { config ->
            val text = value(config.field)
            val over = text.length > config.maxLength
            Row(Modifier.fillMaxWidth().padding(start = 4.dp, top = 18.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Icon(AppIcon.fromSystemName(config.icon)?.imageVector ?: AppIcon.SPARKLES.imageVector, null, tint = if (text.isNotEmpty()) AppColors.brandGreenBright else AppColors.appTextSecondary)
                Text(config.title, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                if (text.isNotEmpty()) Text("Filled", color = AppColors.brandGreenBright, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.background(AppColors.brandGreenBright.copy(alpha = 0.18f), RoundedCornerShape(50)).padding(horizontal = 7.dp, vertical = 3.dp))
            }
            WizardSectionCard {
                TextField(
                    value = text,
                    onValueChange = { update(config.field, it) },
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = config.title },
                    placeholder = { Text(config.placeholder, color = AppColors.appTextSecondary.copy(alpha = 0.65f)) },
                    minLines = 4,
                    maxLines = 10,
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedIndicatorColor = AppColors.brandGreenBright,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedTextColor = AppColors.appTextPrimary,
                        unfocusedTextColor = AppColors.appTextPrimary,
                    ),
                )
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 5.dp)) {
                Text(config.description, color = AppColors.appTextSecondary, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text("${text.length}/${config.maxLength}", color = if (over) AppColors.appLoss else AppColors.appTextSecondary, fontSize = 11.sp)
            }
        }

        Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextSecondary)
            Text("These insights help the AI understand your philosophy. You can edit them later in agent settings.", color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.height(18.dp))
    }
}
