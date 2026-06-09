# B08 Settings parity screenshots

The seven directories created in this batch (`settings/`, `delete-account/`, `secret-settings/`, `discord-modal/`, `ios-widget/`, `paywall/`, `customer-center/`) contain `.placeholder` markers only.

The screenshot harness (`Wagerproof/App/ScreenshotHarness.swift`) does not yet have targets registered for the Settings cluster (B08-implementer did not extend the harness in-scope to avoid touching `ScreenshotHarness.Target` while other batches were in flight). A follow-up pass will:

1. Add `.settings`, `.settingsFree`, `.settingsPro`, `.deleteAccount`, `.secretSettings`, `.discordLocked`, `.discordUnlocked`, `.iosWidgetPicks`, `.iosWidgetFades`, `.iosWidgetMarket`, `.paywallLoading`, `.paywallLoaded`, `.customerCenter` cases to `ScreenshotHarness.Target`.
2. Mount the corresponding views with DEBUG fixtures (see `SettingsFixtures.swift`).
3. Run the existing screenshot capture script (`scripts/capture-parity.sh` or equivalent) to populate the `.png` files.

Until then the build verifies the views compile + render correctly; manual smoke runs in the simulator should be used to validate visual parity.
