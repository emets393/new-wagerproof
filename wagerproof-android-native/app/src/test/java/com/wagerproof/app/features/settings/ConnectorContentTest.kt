package com.wagerproof.app.features.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Contract tests for the AI Connector content model (AND-034).
 *
 * Two things this guards that a human reviewer will not catch reliably:
 * 1. the endpoint host — `mcp.wagerproof.bet` is NOT live, so any "cleanup"
 *    that swaps the workers.dev URL for the branded one breaks every setup;
 * 2. provider neutrality — the shared copy must never name one vendor, because
 *    the same screen serves ChatGPT, Cursor, Hermes and everything else.
 */
class ConnectorContentTest {

    private val vendorTokens = listOf(
        "Claude", "Anthropic", "ChatGPT", "OpenAI", "Gemini", "Grok",
        "Cursor", "OpenClaw", "Hermes", "Codex", "Copilot",
    )

    @Test
    fun endpointIsTheLiveWorkersDevHostNotTheUnlaunchedCustomDomain() {
        assertEquals("https://wagerproof-mcp.habib225.workers.dev/mcp", ConnectorContent.ENDPOINT)
        assertFalse(ConnectorContent.ENDPOINT.contains("mcp.wagerproof.bet"))
        assertTrue(ConnectorContent.DOCS_URL.startsWith("https://wagerproof-mcp.habib225.workers.dev"))
        assertEquals("https://wagerproof.bet/mcp", ConnectorContent.TUTORIAL_URL)
    }

    @Test
    fun sharedCopyNeverNamesASingleVendor() {
        val shared = buildList {
            add(ConnectorContent.BANNER_TITLE)
            add(ConnectorContent.BANNER_SUBTITLE)
            add(ConnectorContent.HERO_EYEBROW)
            add(ConnectorContent.HERO_TITLE)
            add(ConnectorContent.HERO_BODY)
            add(ConnectorContent.CALLOUT_TITLE)
            add(ConnectorContent.CALLOUT_BODY)
            add(ConnectorContent.CALLOUT_NOTE)
            add(ConnectorContent.VERIFY_URL_NOTE)
            add(ConnectorContent.ORG_PLAN_NOTE)
            add(ConnectorContent.SETUP_EYEBROW)
            add(ConnectorContent.SETUP_TITLE)
            add(ConnectorContent.SETUP_SUBTITLE)
            add(ConnectorContent.PROMPTS_EYEBROW)
            add(ConnectorContent.PROMPTS_TITLE)
            add(ConnectorContent.PROMPTS_SUBTITLE)
            add(ConnectorContent.DEMO_EYEBROW)
            add(ConnectorContent.DEMO_TITLE)
            add(ConnectorContent.DEMO_SUBTITLE)
            add(ConnectorContent.PRIVACY_TITLE)
            add(ConnectorContent.PRIVACY_BODY)
            add(ConnectorContent.PRIVACY_DISCLAIMER)
            add(ConnectorContent.PRIVACY_DISCONNECT)
            add(ConnectorContent.DOCS_LINK_LABEL)
            addAll(ConnectorContent.EXAMPLE_PROMPTS)
            ConnectorContent.DEMOS.forEach { demo ->
                add(demo.caption)
                add(demo.userText)
                add(demo.toolText)
                demo.lines.forEach { line ->
                    when (line) {
                        is ConnectorDemoLine.Reply -> add(line.text)
                        is ConnectorDemoLine.Bullet -> {
                            add(line.name)
                            add(line.meta)
                        }
                    }
                }
            }
        }

        shared.forEach { text ->
            assertTrue(text.isNotBlank(), "shared copy must not be blank")
            vendorTokens.forEach { vendor ->
                assertFalse(
                    text.contains(vendor, ignoreCase = true),
                    "shared copy names a single vendor ($vendor): \"$text\"",
                )
            }
        }
    }

    @Test
    fun bannerShowsTheFiveConsumerAssistantsAndDerivesItsCaption() {
        val names = ConnectorContent.BANNER_PROVIDERS.map { it.name }
        assertEquals(listOf("Claude", "ChatGPT", "Gemini", "Grok", "Codex"), names)
        assertEquals(names.joinToString("  ·  "), ConnectorContent.BANNER_CAPTION)
        names.forEach { assertTrue(ConnectorContent.BANNER_ACCESSIBILITY_LABEL.contains(it)) }
    }

    @Test
    fun providerKeysAreUniqueAndIncludeTheCatchAll() {
        val keys = ConnectorContent.PROVIDERS.map { it.key }
        assertEquals(keys.size, keys.toSet().size, "duplicate provider key")
        assertTrue(ConnectorContent.OTHER_KEY in keys)
        // Catch-all sorts last so the named assistants lead the picker.
        assertEquals(ConnectorContent.OTHER_KEY, keys.last())
        assertEquals("claude", ConnectorContent.DEFAULT_PROVIDER.key)
    }

    @Test
    fun everyGuideIsCompleteAndPointsAtHttpsUrls() {
        ConnectorContent.PROVIDERS.forEach { provider ->
            assertTrue(provider.guides.isNotEmpty(), "${provider.key} has no guide")
            assertTrue(
                provider.guides.containsKey(provider.defaultMode),
                "${provider.key} default mode ${provider.defaultMode} has no guide",
            )
            assertTrue(provider.name.isNotBlank())

            provider.guides.forEach { (mode, guide) ->
                val where = "${provider.key}/$mode"
                listOf(
                    guide.copyValue, guide.copyLabel, guide.copyTitle, guide.copyDescription,
                    guide.setupTitle, guide.setupDescription, guide.setupLabel,
                    guide.finishTitle, guide.finishDescription, guide.finishLabel,
                ).forEach { assertTrue(it.isNotBlank(), "$where has a blank field") }

                assertTrue(guide.setupUrl.startsWith("https://"), "$where setupUrl not https")
                assertTrue(guide.finishUrl.startsWith("https://"), "$where finishUrl not https")
                guide.setupScreenshots.forEach {
                    assertTrue(it.contentDescription.isNotBlank(), "$where screenshot needs alt text")
                    assertTrue(it.maxHeightDp > 0)
                }
            }
        }
    }

    @Test
    fun everyCopyValueCarriesTheConnectorEndpoint() {
        ConnectorContent.PROVIDERS.forEach { provider ->
            provider.guides.forEach { (mode, guide) ->
                if (mode == ConnectorMode.Connector) {
                    assertEquals(
                        ConnectorContent.ENDPOINT,
                        guide.copyValue,
                        "${provider.key} connector step must copy the raw endpoint",
                    )
                    // The endpoint card renders NAME/CUSTOM chrome instead of a
                    // shortened label, so it must never carry a display override.
                    assertNull(guide.copyDisplayValue, "${provider.key} endpoint needs no display override")
                } else {
                    // CLI commands and config blobs embed the endpoint literally —
                    // a typo'd host here silently sends users to a dead server.
                    assertTrue(
                        guide.copyValue.contains(ConnectorContent.ENDPOINT),
                        "${provider.key} command drops the endpoint",
                    )
                    assertNotNull(
                        guide.copyDisplayValue,
                        "${provider.key} multi-line command needs a short display value",
                    )
                }
            }
        }
    }

    @Test
    fun resolveModeFallsBackWhenTheProviderDoesNotOfferTheRequestedMode() {
        val chatgpt = ConnectorContent.provider("chatgpt")
        assertEquals(1, chatgpt.guides.size)
        // Selecting "Command line" on Claude then switching to ChatGPT must not
        // resolve to a mode ChatGPT has no guide for.
        assertEquals(
            ConnectorMode.Connector,
            ConnectorContent.resolveMode(chatgpt, ConnectorMode.CommandLine),
        )
        assertEquals(ConnectorMode.Connector, ConnectorContent.resolveMode(chatgpt, null))

        val claudeCode = ConnectorContent.provider("claude-code")
        assertEquals(ConnectorMode.CommandLine, ConnectorContent.resolveMode(claudeCode, null))
        assertEquals(
            ConnectorMode.Connector,
            ConnectorContent.resolveMode(claudeCode, ConnectorMode.Connector),
        )
    }

    @Test
    fun guideLookupNeverThrowsForAnyProviderModeCombination() {
        ConnectorContent.PROVIDERS.forEach { provider ->
            (ConnectorMode.entries + null).forEach { mode ->
                val guide = ConnectorContent.guide(provider, mode)
                assertTrue(guide.copyValue.isNotBlank(), "${provider.key}/$mode resolved to an empty guide")
            }
        }
        // Unknown keys degrade to the default provider rather than crashing.
        assertEquals(ConnectorContent.DEFAULT_PROVIDER.key, ConnectorContent.provider("nope").key)
    }

    @Test
    fun examplePromptsAreCopyReadyQuestions() {
        assertEquals(4, ConnectorContent.EXAMPLE_PROMPTS.size)
        ConnectorContent.EXAMPLE_PROMPTS.forEach {
            assertTrue(it.trim() == it, "prompt has stray whitespace: \"$it\"")
            assertTrue(it.endsWith("?") || it.endsWith("."), "prompt is not a full sentence: \"$it\"")
        }
        assertEquals(
            ConnectorContent.EXAMPLE_PROMPTS.size,
            ConnectorContent.EXAMPLE_PROMPTS.toSet().size,
            "duplicate prompt would break the copied-state highlight",
        )
    }

    @Test
    fun demosShowATransparentToolCallAndAModelEstimateDisclaimer() {
        assertTrue(ConnectorContent.DEMOS.isNotEmpty())
        ConnectorContent.DEMOS.forEach { demo ->
            assertTrue(demo.toolText.startsWith("WagerProof · "), "tool chip must name WagerProof")
            assertTrue(demo.lines.isNotEmpty())
        }
        val allReplies = ConnectorContent.DEMOS
            .flatMap { it.lines }
            .filterIsInstance<ConnectorDemoLine.Reply>()
            .joinToString(" ") { it.text }
        assertTrue(
            allReplies.contains("not guaranteed outcomes or betting advice"),
            "the mock transcript must keep the no-advice disclaimer",
        )
    }
}
