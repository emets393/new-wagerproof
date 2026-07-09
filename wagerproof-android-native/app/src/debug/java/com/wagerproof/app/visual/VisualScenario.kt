package com.wagerproof.app.visual

internal enum class VisualSurface {
    Auth, Games, Props, Agents, Outliers, Search,
    NflGame, CfbGame, NbaGame, NcaabGame, MlbGame,
    MlbProp, NflProp, AgentOwner, AgentPublic, AgentCreate, AgentSettings,
    Chat, Settings, Paywall,
}

internal enum class VisualState { Loaded, Empty, Loading }

internal data class VisualScenario(
    val slug: String,
    val surface: VisualSurface,
    val state: VisualState = VisualState.Loaded,
    val locked: Boolean = false,
) {
    companion object {
        val all: List<VisualScenario> = buildList {
            add(VisualScenario("auth-gate", VisualSurface.Auth))
            listOf(VisualSurface.Games, VisualSurface.Props, VisualSurface.Agents, VisualSurface.Outliers, VisualSurface.Search).forEach { surface ->
                val prefix = surface.name.lowercase()
                VisualState.entries.forEach { state -> add(VisualScenario("$prefix-${state.name.lowercase()}", surface, state)) }
            }
            listOf(
                "nfl" to VisualSurface.NflGame,
                "cfb" to VisualSurface.CfbGame,
                "nba" to VisualSurface.NbaGame,
                "ncaab" to VisualSurface.NcaabGame,
                "mlb" to VisualSurface.MlbGame,
            ).forEach { (sport, surface) ->
                add(VisualScenario("game-$sport-expanded", surface))
                add(VisualScenario("game-$sport-collapsed", surface))
                add(VisualScenario("game-$sport-locked", surface, locked = true))
            }
            add(VisualScenario("prop-mlb-detail", VisualSurface.MlbProp))
            add(VisualScenario("prop-nfl-detail", VisualSurface.NflProp))
            add(VisualScenario("agent-owner-detail", VisualSurface.AgentOwner))
            add(VisualScenario("agent-public-detail", VisualSurface.AgentPublic))
            add(VisualScenario("agent-create", VisualSurface.AgentCreate))
            add(VisualScenario("agent-settings", VisualSurface.AgentSettings))
            add(VisualScenario("chat", VisualSurface.Chat))
            add(VisualScenario("settings", VisualSurface.Settings))
            add(VisualScenario("paywall", VisualSurface.Paywall))
        }

        fun fromSlug(raw: String?): VisualScenario = all.firstOrNull { it.slug == raw } ?: all.first()
    }
}
