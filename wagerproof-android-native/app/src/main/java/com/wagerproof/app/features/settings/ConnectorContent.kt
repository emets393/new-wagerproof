package com.wagerproof.app.features.settings

import androidx.annotation.DrawableRes
import com.wagerproof.app.R

/**
 * Content model for the AI Connector section + setup guide (AND-034).
 *
 * Ported from two sources that must stay in sync:
 * - iOS `Features/Settings/SettingsView.swift` — `AIConnectorBanner` and
 *   `WagerproofClaudeConnectorGuideSheet` (hero, four setup steps, endpoint copy
 *   card, example prompts, chat mockups, read-only privacy block).
 * - Web `src/features/mcp/mcpContent.ts` — the multi-provider setup matrix.
 *
 * WHY the copy here is provider-neutral: the connector is a plain remote MCP
 * server and serves Claude, ChatGPT, Cursor, OpenClaw, Hermes and any other
 * MCP-capable client. iOS's guide is written Claude-first for historical
 * reasons; this port keeps every shared string vendor-agnostic and pushes the
 * vendor specifics down into [ConnectorProvider] entries. `ConnectorContentTest`
 * enforces that (it fails if a shared string names a vendor).
 */
object ConnectorContent {

    /**
     * Canonical connector endpoint. The `mcp.wagerproof.bet` custom domain is
     * NOT live — do not "tidy" this to the branded host; iOS and web both ship
     * the workers.dev URL and it is what the OAuth allowlist is registered for.
     */
    const val ENDPOINT = "https://wagerproof-mcp.habib225.workers.dev/mcp"

    /** Live connector docs served by the worker itself. */
    const val DOCS_URL = "https://wagerproof-mcp.habib225.workers.dev/docs"

    /** Public web walkthrough (`/mcp`), the long-form version of this screen. */
    const val TUTORIAL_URL = "https://wagerproof.bet/mcp"

    // MARK: - Banner (Settings section + reusable elsewhere)

    const val BANNER_TITLE = "Connect WagerProof to your AI"
    const val BANNER_SUBTITLE =
        "Bring your agents, picks, and model analytics into a read-only AI workflow."

    /**
     * Faces shown on the banner — mirrors iOS's five-logo stack. This is the
     * recognizability row, deliberately the consumer assistants; the guide below
     * covers a wider provider list plus an "any MCP client" fallback.
     */
    val BANNER_PROVIDERS: List<ConnectorBannerProvider> = listOf(
        ConnectorBannerProvider("Claude", R.drawable.ai_provider_claude),
        ConnectorBannerProvider("ChatGPT", R.drawable.ai_provider_chatgpt),
        ConnectorBannerProvider("Gemini", R.drawable.ai_provider_gemini),
        ConnectorBannerProvider("Grok", R.drawable.ai_provider_grok),
        ConnectorBannerProvider("Codex", R.drawable.ai_provider_codex),
    )

    val BANNER_CAPTION: String = BANNER_PROVIDERS.joinToString("  ·  ") { it.name }

    val BANNER_ACCESSIBILITY_LABEL: String =
        "Connect WagerProof to your AI. Setup guide for " +
            BANNER_PROVIDERS.joinToString(", ") { it.name } + " and other MCP clients."

    // MARK: - Guide hero

    const val HERO_EYEBROW = "WAGERPROOF CUSTOM CONNECTOR"
    const val HERO_TITLE = "Put your agents and models in the conversation."
    const val HERO_BODY =
        "Your AI assistant can review your prediction agents and their history, then compare " +
            "WagerProof model estimates with market prices — right inside your chats."

    // MARK: - "Add it once" callout

    const val CALLOUT_TITLE = "Add it once, then use it everywhere"
    const val CALLOUT_BODY =
        "WagerProof is not listed in the AI connector directories yet, so add it manually from " +
            "your assistant on the web or desktop. Once connected, it follows your account onto " +
            "that assistant's mobile app too."
    const val CALLOUT_NOTE =
        "Your assistant will label it a custom connector because the listing has not been " +
            "reviewed yet. The endpoint below is operated by WagerProof and exposes read-only tools."

    /** Shown under the final step — the "is this really WagerProof?" check. */
    const val VERIFY_URL_NOTE =
        "Your assistant may warn that a custom connector is unverified. Confirm the URL ends in " +
            "wagerproof-mcp.habib225.workers.dev/mcp before continuing."

    /** Org-plan caveat (iOS states the Claude Team/Enterprise case). */
    const val ORG_PLAN_NOTE =
        "On team or enterprise plans, an owner may need to allow custom connectors for the " +
            "organization before members can connect their own accounts."

    const val SETUP_EYEBROW = "GET CONNECTED"
    const val SETUP_TITLE = "Three steps on web or desktop"
    const val SETUP_SUBTITLE = "No API keys or advanced OAuth settings required."

    // MARK: - Example prompts (tap to copy)

    const val PROMPTS_EYEBROW = "TRY ASKING"
    const val PROMPTS_TITLE = "Start with one of these"
    const val PROMPTS_SUBTITLE = "Tap a prompt to copy it, then paste it into a chat."

    val EXAMPLE_PROMPTS: List<String> = listOf(
        "How have my prediction agents performed over the last 30 days?",
        "Show my contrarian agent's last 10 picks and how they graded.",
        "Compare WagerProof's model for tonight's NBA games with prediction-market odds.",
        "Which agents do I follow, and what is their recent record?",
    )

    // MARK: - Chat mockups

    const val DEMO_EYEBROW = "SEE IT IN ACTION"
    const val DEMO_TITLE = "A few things to try"
    const val DEMO_SUBTITLE =
        "Your assistant can combine your account history with WagerProof's public analytics."

    val DEMOS: List<ConnectorDemo> = listOf(
        ConnectorDemo(
            caption = "Review your prediction agents",
            userText = "How have my agents performed over the last 30 days?",
            toolText = "WagerProof · checked your agents",
            lines = listOf(
                ConnectorDemoLine.Reply("I found three active agents. Here's the 30-day snapshot:"),
                ConnectorDemoLine.Bullet("Contrarian", "18–12 · 60%"),
                ConnectorDemoLine.Bullet("NBA Specialist", "14–11 · 56%"),
                ConnectorDemoLine.Bullet("Market Watcher", "10–10 · 50%"),
                ConnectorDemoLine.Reply("Want me to break down their most recent picks?"),
            ),
        ),
        ConnectorDemo(
            caption = "Compare models with the market",
            userText =
                "Where do WagerProof's NBA estimates differ most from prediction-market prices tonight?",
            toolText = "WagerProof · compared model and market",
            lines = listOf(
                ConnectorDemoLine.Reply("The largest probability gaps in the current slate are:"),
                ConnectorDemoLine.Bullet("Game A", "model 64% · market 55%"),
                ConnectorDemoLine.Bullet("Game B", "model 41% · market 49%"),
                ConnectorDemoLine.Reply(
                    "These are model estimates, not guaranteed outcomes or betting advice.",
                ),
            ),
        ),
    )

    // MARK: - Read-only boundary

    const val PRIVACY_TITLE = "Read-only analytics"
    const val PRIVACY_BODY =
        "Your assistant can retrieve your own agents, picks, follows, and community record when " +
            "you ask. It can also read WagerProof's public model estimates, market prices, and " +
            "editor analyses. It cannot create, change, or delete your data, and it cannot place a bet."
    const val PRIVACY_DISCLAIMER =
        "Model estimates are informational, not betting advice or guaranteed outcomes."
    const val PRIVACY_DISCONNECT =
        "Disconnect at any time from your assistant's connector settings."

    const val DOCS_LINK_LABEL = "Read the full connector guide"

    // MARK: - Providers

    /** Key of the catch-all "any other MCP client" entry. */
    const val OTHER_KEY = "other"

    // Long literals hoisted so the provider table below stays readable.

    private const val CLAUDE_CODE_DOCS_URL = "https://code.claude.com/docs/en/mcp"
    private const val OPENCLAW_DOCS_URL = "https://docs.openclaw.ai/cli/mcp"
    private const val HERMES_DOCS_URL =
        "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp"

    /** Base64 payload is the endpoint JSON — matches web's `CURSOR_INSTALL_URL`. */
    private const val CURSOR_INSTALL_URL =
        "https://cursor.com/install-mcp?name=WagerProof&config=" +
            "eyJ1cmwiOiJodHRwczovL3dhZ2VycHJvb2YtbWNwLmhhYmliMjI1LndvcmtlcnMuZGV2L21jcCJ9"

    private const val CLAUDE_CODE_COMMANDS =
        "claude mcp add --scope user --transport http wagerproof $ENDPOINT\n" +
            "claude mcp login wagerproof"

    private const val CURSOR_MCP_JSON =
        "{\n  \"mcpServers\": {\n    \"wagerproof\": {\n      \"url\": \"$ENDPOINT\"\n    }\n  }\n}"

    private const val OPENCLAW_COMMANDS =
        "openclaw mcp add wagerproof --url $ENDPOINT --transport streamable-http --auth oauth\n" +
            "openclaw mcp login wagerproof"

    private const val HERMES_COMMAND =
        "hermes mcp add wagerproof --url $ENDPOINT --auth oauth --connect-timeout 315"

    /**
     * Setup matrix, 1:1 with web `MCP_PROVIDERS` (same URLs, same commands) plus
     * the generic [OTHER_KEY] entry for clients we do not name individually.
     * Keep this list and `src/features/mcp/mcpContent.ts` in step.
     */
    val PROVIDERS: List<ConnectorProvider> = listOf(
        ConnectorProvider(
            key = "claude",
            name = "Claude",
            icon = R.drawable.ai_provider_claude,
            accent = 0xFFD97757,
            iconBackground = 0xFFF0EEE6,
            iconFit = ConnectorIconFit.Contain,
            defaultMode = ConnectorMode.Connector,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription = "You'll paste this URL into Claude in the next step.",
                    setupTitle = "Go to Claude → Connectors",
                    setupDescription =
                        "Click your name at the bottom-left, open Settings, then Customize → " +
                            "Connectors → Add custom connector. Name it WagerProof, paste the " +
                            "URL, and leave the Advanced OAuth fields blank.",
                    setupUrl = "https://claude.ai/settings/connectors",
                    setupLabel = "Open Claude Connectors",
                    setupScreenshots = listOf(
                        ConnectorScreenshot(
                            image = R.drawable.connector_setup_claude_settings,
                            contentDescription = "Claude account menu with Settings selected.",
                            maxHeightDp = 210,
                            backgroundColor = 0xFF222222,
                        ),
                        ConnectorScreenshot(
                            image = R.drawable.connector_setup_claude_connectors,
                            contentDescription =
                                "Claude Settings with Connectors selected under Customize.",
                            maxHeightDp = 140,
                            backgroundColor = 0xFF1A1A19,
                        ),
                    ),
                    finishTitle = "Connect, sign in, and research",
                    finishDescription =
                        "Click Connect, sign in with the same WagerProof email and password you " +
                            "use in the app, and approve read-only access.",
                    finishUrl = "https://claude.ai/new",
                    finishLabel = "Start in Claude",
                ),
                ConnectorMode.CommandLine to ConnectorGuide(
                    copyValue = CLAUDE_CODE_COMMANDS,
                    copyDisplayValue = "claude mcp add … && claude mcp login wagerproof",
                    copyLabel = "Claude Code commands",
                    copyTitle = "Copy the Claude Code commands",
                    copyDescription =
                        "Use the CLI route when you want WagerProof available across Claude Code sessions.",
                    setupTitle = "Run both commands in Terminal",
                    setupDescription =
                        "The first command adds WagerProof for your user. The second starts the " +
                            "browser-based WagerProof OAuth sign-in.",
                    setupUrl = CLAUDE_CODE_DOCS_URL,
                    setupLabel = "Open Claude Code MCP docs",
                    finishTitle = "Return to Claude Code",
                    finishDescription =
                        "After sign-in, ask Claude Code to list the WagerProof tools or research " +
                            "a matchup with live model context.",
                    finishUrl = "https://claude.com/product/claude-code",
                    finishLabel = "Open Claude Code",
                ),
            ),
        ),
        ConnectorProvider(
            key = "chatgpt",
            name = "ChatGPT",
            icon = R.drawable.ai_provider_chatgpt,
            accent = 0xFF10A37F,
            iconBackground = 0xFFFFFFFF,
            iconFit = ConnectorIconFit.Cover,
            defaultMode = ConnectorMode.Connector,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription = "You'll add this as a custom MCP connection in ChatGPT.",
                    setupTitle = "Enable Developer mode and add WagerProof",
                    setupDescription =
                        "Open Plugins, enable Developer mode in Settings, press +, and paste the " +
                            "URL. Menu placement can vary by plan and workspace.",
                    setupUrl = "https://chatgpt.com/plugins",
                    setupLabel = "Open ChatGPT Plugins",
                    finishTitle = "Connect, sign in, and research",
                    finishDescription =
                        "Complete the WagerProof OAuth screen, then ask ChatGPT to use WagerProof " +
                            "for live sports research.",
                    finishUrl = "https://chatgpt.com/",
                    finishLabel = "Start in ChatGPT",
                ),
            ),
        ),
        ConnectorProvider(
            key = "cursor",
            name = "Cursor",
            icon = R.drawable.ai_provider_cursor,
            accent = 0xFFEDECEC,
            iconBackground = 0xFF14120B,
            iconFit = ConnectorIconFit.Cover,
            defaultMode = ConnectorMode.Connector,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription =
                        "Keep the URL handy, or use the one-click installer in the next step.",
                    setupTitle = "Install WagerProof in Cursor",
                    setupDescription =
                        "Use the one-click installer. Cursor adds WagerProof as a remote HTTP MCP " +
                            "server and prompts you to authenticate.",
                    setupUrl = CURSOR_INSTALL_URL,
                    setupLabel = "Install in Cursor",
                    finishTitle = "Approve access and start researching",
                    finishDescription =
                        "Complete WagerProof sign-in, then ask Cursor Agent to list the tools or " +
                            "analyze a live matchup.",
                    finishUrl = "https://cursor.com/",
                    finishLabel = "Open Cursor",
                ),
                ConnectorMode.CommandLine to ConnectorGuide(
                    copyValue = CURSOR_MCP_JSON,
                    copyDisplayValue = "{ \"mcpServers\": { \"wagerproof\": { \"url\": \"…\" } } }",
                    copyLabel = "Cursor MCP config",
                    copyTitle = "Copy the Cursor MCP config",
                    copyDescription = "Use this JSON when you prefer to configure Cursor manually.",
                    setupTitle = "Add it to mcp.json",
                    setupDescription =
                        "Paste the block into your Cursor MCP configuration, save it, and enable " +
                            "WagerProof from Cursor Settings.",
                    setupUrl = "https://cursor.com/docs/mcp",
                    setupLabel = "Open Cursor MCP docs",
                    finishTitle = "Sign in from Cursor",
                    finishDescription =
                        "Open the WagerProof server in Cursor, complete OAuth, and use its sports " +
                            "research tools.",
                    finishUrl = CURSOR_INSTALL_URL,
                    finishLabel = "Install in Cursor",
                ),
            ),
        ),
        ConnectorProvider(
            key = "claude-code",
            name = "Claude Code",
            icon = R.drawable.ai_provider_claude,
            accent = 0xFFD97757,
            iconBackground = 0xFF1F2021,
            iconFit = ConnectorIconFit.Contain,
            defaultMode = ConnectorMode.CommandLine,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription =
                        "Claude Code connects to this remote Streamable HTTP MCP endpoint.",
                    setupTitle = "Add the remote server in Claude Code",
                    setupDescription =
                        "Use the HTTP transport, name the server wagerproof, and set user scope " +
                            "if you want it in every project.",
                    setupUrl = CLAUDE_CODE_DOCS_URL,
                    setupLabel = "Open Claude Code MCP docs",
                    finishTitle = "Authenticate and research",
                    finishDescription =
                        "Run the login flow, approve access in your browser, and return to Claude Code.",
                    finishUrl = "https://claude.com/product/claude-code",
                    finishLabel = "Open Claude Code",
                ),
                ConnectorMode.CommandLine to ConnectorGuide(
                    copyValue = CLAUDE_CODE_COMMANDS,
                    copyDisplayValue = "claude mcp add … && claude mcp login wagerproof",
                    copyLabel = "Claude Code commands",
                    copyTitle = "Copy the Claude Code commands",
                    copyDescription = "The commands add WagerProof at user scope, then start OAuth.",
                    setupTitle = "Run both commands in Terminal",
                    setupDescription =
                        "Claude Code recognizes the remote server, opens WagerProof sign-in, and " +
                            "stores the connection after approval.",
                    setupUrl = CLAUDE_CODE_DOCS_URL,
                    setupLabel = "Open Claude Code MCP docs",
                    finishTitle = "Return to Claude Code",
                    finishDescription =
                        "Ask Claude Code to list WagerProof tools or research a matchup with " +
                            "current model and market context.",
                    finishUrl = "https://claude.com/product/claude-code",
                    finishLabel = "Open Claude Code",
                ),
            ),
        ),
        ConnectorProvider(
            key = "openclaw",
            name = "OpenClaw",
            icon = R.drawable.ai_provider_openclaw,
            accent = 0xFFEF4444,
            iconBackground = 0xFFF5F3ED,
            iconFit = ConnectorIconFit.Contain,
            defaultMode = ConnectorMode.CommandLine,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription = "OpenClaw connects to WagerProof over remote Streamable HTTP.",
                    setupTitle = "Add a remote OAuth MCP server",
                    setupDescription =
                        "Name it wagerproof, select Streamable HTTP rather than SSE, use OAuth, " +
                            "and paste the connector URL.",
                    setupUrl = OPENCLAW_DOCS_URL,
                    setupLabel = "Open OpenClaw MCP docs",
                    finishTitle = "Sign in and start researching",
                    finishDescription =
                        "Complete browser OAuth, return to OpenClaw, and ask it to call a " +
                            "WagerProof tool.",
                    finishUrl = "https://openclaw.ai/",
                    finishLabel = "Open OpenClaw",
                ),
                ConnectorMode.CommandLine to ConnectorGuide(
                    copyValue = OPENCLAW_COMMANDS,
                    copyDisplayValue = "openclaw mcp add wagerproof … && openclaw mcp login wagerproof",
                    copyLabel = "OpenClaw commands",
                    copyTitle = "Copy the OpenClaw commands",
                    copyDescription =
                        "The explicit transport flag prevents OpenClaw from falling back to SSE.",
                    setupTitle = "Run both commands in Terminal",
                    setupDescription =
                        "Add the server, then open the WagerProof OAuth flow. Use " +
                            "mcp doctor wagerproof --probe if you need to verify it.",
                    setupUrl = OPENCLAW_DOCS_URL,
                    setupLabel = "Open OpenClaw MCP docs",
                    finishTitle = "Return to OpenClaw",
                    finishDescription =
                        "After sign-in, ask OpenClaw to list WagerProof tools or start a sports " +
                            "research task.",
                    finishUrl = "https://openclaw.ai/",
                    finishLabel = "Open OpenClaw",
                ),
            ),
        ),
        ConnectorProvider(
            key = "hermes",
            name = "Hermes",
            icon = R.drawable.ai_provider_hermes,
            accent = 0xFF4F9EAE,
            iconBackground = 0xFF214F5D,
            iconFit = ConnectorIconFit.Cover,
            defaultMode = ConnectorMode.CommandLine,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription =
                        "Hermes Agent can discover this remote MCP server and its OAuth flow.",
                    setupTitle = "Add WagerProof as a remote server",
                    setupDescription =
                        "Name it wagerproof, paste the URL, select OAuth, and allow extra time " +
                            "for browser authentication.",
                    setupUrl = HERMES_DOCS_URL,
                    setupLabel = "Open Hermes MCP docs",
                    finishTitle = "Choose tools and start researching",
                    finishDescription =
                        "Hermes discovers the tools after sign-in. Select the WagerProof tools " +
                            "you want available to the agent.",
                    finishUrl = "https://hermes-agent.nousresearch.com/",
                    finishLabel = "Open Hermes",
                ),
                ConnectorMode.CommandLine to ConnectorGuide(
                    copyValue = HERMES_COMMAND,
                    copyDisplayValue = "hermes mcp add wagerproof … --auth oauth",
                    copyLabel = "Hermes command",
                    copyTitle = "Copy the Hermes MCP command",
                    copyDescription =
                        "Hermes handles discovery, browser OAuth, and tool selection in this " +
                            "single add flow.",
                    setupTitle = "Run the command in Terminal",
                    setupDescription =
                        "Finish WagerProof sign-in in the browser Hermes opens. Use " +
                            "hermes mcp test wagerproof afterward if needed.",
                    setupUrl = HERMES_DOCS_URL,
                    setupLabel = "Open Hermes MCP docs",
                    finishTitle = "Return to Hermes",
                    finishDescription =
                        "Select the WagerProof tools you want enabled, then ask Hermes to " +
                            "research a matchup or your agent history.",
                    finishUrl = "https://hermes-agent.nousresearch.com/",
                    finishLabel = "Open Hermes",
                ),
            ),
        ),
        // Catch-all so users on assistants we don't enumerate (Gemini, Grok,
        // Codex, self-hosted agents…) still get an accurate path. Derived from
        // the web FAQ: any compatible remote-MCP client can connect.
        ConnectorProvider(
            key = OTHER_KEY,
            name = "Other",
            icon = null,
            accent = 0xFF22C55E,
            iconBackground = 0xFF11301E,
            iconFit = ConnectorIconFit.Contain,
            defaultMode = ConnectorMode.Connector,
            guides = mapOf(
                ConnectorMode.Connector to ConnectorGuide(
                    copyValue = ENDPOINT,
                    copyLabel = "Connector URL",
                    copyTitle = "Copy the WagerProof connector URL",
                    copyDescription =
                        "Any client that speaks remote Streamable HTTP MCP with OAuth 2.1 can connect.",
                    setupTitle = "Add WagerProof as a remote MCP server",
                    setupDescription =
                        "Name it wagerproof, paste the URL, choose Streamable HTTP with OAuth, " +
                            "and leave advanced settings empty unless your client requires them.",
                    setupUrl = DOCS_URL,
                    setupLabel = "Open the connector docs",
                    finishTitle = "Sign in and approve read-only access",
                    finishDescription =
                        "Your client opens WagerProof sign-in in a browser. Approve access and " +
                            "the sports research tools appear in your session.",
                    finishUrl = TUTORIAL_URL,
                    finishLabel = "Open the web walkthrough",
                ),
            ),
        ),
    )

    /** Provider chosen when the guide opens. */
    val DEFAULT_PROVIDER: ConnectorProvider = PROVIDERS.first()

    fun provider(key: String): ConnectorProvider =
        PROVIDERS.firstOrNull { it.key == key } ?: DEFAULT_PROVIDER

    /**
     * The mode to show for [provider] when [requested] is not offered — a
     * provider with a single guide (e.g. ChatGPT) must not render an empty step
     * list just because the previous selection was Command line.
     */
    fun resolveMode(provider: ConnectorProvider, requested: ConnectorMode?): ConnectorMode =
        requested?.takeIf { provider.guides.containsKey(it) } ?: provider.defaultMode

    fun guide(provider: ConnectorProvider, requested: ConnectorMode?): ConnectorGuide =
        provider.guides.getValue(resolveMode(provider, requested))
}

/** A face on the Settings banner's logo stack. */
data class ConnectorBannerProvider(
    val name: String,
    @DrawableRes val icon: Int,
)

/** How a provider logo fills its rounded chip (web `iconFit`). */
enum class ConnectorIconFit { Cover, Contain }

/** Remote-connector setup vs. a terminal command. */
enum class ConnectorMode(val label: String) {
    Connector("Connector"),
    CommandLine("Command line"),
}

data class ConnectorProvider(
    val key: String,
    val name: String,
    @DrawableRes val icon: Int?,
    val accent: Long,
    val iconBackground: Long,
    val iconFit: ConnectorIconFit,
    val defaultMode: ConnectorMode,
    val guides: Map<ConnectorMode, ConnectorGuide>,
)

/** A screenshot rendered inside a numbered step. */
data class ConnectorScreenshot(
    @DrawableRes val image: Int,
    val contentDescription: String,
    val maxHeightDp: Int,
    val backgroundColor: Long,
)

/**
 * One provider's three-step walkthrough: copy something, add it, sign in.
 * [copyDisplayValue] shortens multi-line commands for display; the clipboard
 * always receives [copyValue].
 */
data class ConnectorGuide(
    val copyValue: String,
    val copyDisplayValue: String? = null,
    val copyLabel: String,
    val copyTitle: String,
    val copyDescription: String,
    val setupTitle: String,
    val setupDescription: String,
    val setupUrl: String,
    val setupLabel: String,
    val setupScreenshots: List<ConnectorScreenshot> = emptyList(),
    val finishTitle: String,
    val finishDescription: String,
    val finishUrl: String,
    val finishLabel: String,
)

/** A fake chat transcript used to show what the connector answers. */
data class ConnectorDemo(
    val caption: String,
    val userText: String,
    val toolText: String,
    val lines: List<ConnectorDemoLine>,
)

sealed interface ConnectorDemoLine {
    /** Prose paragraph in the assistant's reply. */
    data class Reply(val text: String) : ConnectorDemoLine

    /** Bulleted "name — metric" row. */
    data class Bullet(val name: String, val meta: String) : ConnectorDemoLine
}
