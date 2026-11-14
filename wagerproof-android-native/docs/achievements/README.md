# Native Android achievements

Android uses the same 35 IDs, requirements, server eligibility, immutable unlock dates, quiet backfill and per-agent attribution as native iOS. No client progress value grants an award. `AchievementsStore` binds at the auth boundary, rejects stale responses after account switches, caches per user, queues exploration events offline and remembers dismissed celebrations while retrying acknowledgment.

Settings begins with the collection shelf, using 88-dp cards and short numeric dates. The full collection groups all six families with unlocked/in-progress filters. Earned medals can be shared as their native-baked image plus a WagerProof caption through Android's share chooser. FileProvider access is restricted to the dedicated sharing cache folder.

The detail and unlock surfaces render the approved curved geometry through native Filament (SceneView 2.3.0), with drag rotation, double-tap flipping, studio lighting, locked gray finishes and personalized text conforming to the rear shell. Names and dates are runtime data; locked models have no engraving. The unlock screen plays the same one-shot confetti Lottie as Honeydew's share-import completion and teaches rotation with an animated finger hint. System-disabled animations suppress rocking, hint motion and confetti. Rendering follows the surface lifecycle and uses static thumbnails while inactive.

Onboarding adds `ACHIEVEMENTS` after the leaderboard with stable raw ID 25, preserving all previous IDs. Declaration order drives navigation and progress. The legacy 24-step analytics funnel excludes this new page. The title is “Track skill with achievements!” and the initial medal is gold 25 Win Streak. The same medal rocks on the third of eight paywall slides; checkout and entitlements are unchanged.

The app refreshes server awards after auth, foreground entry and agent/follow/chat changes, and every minute while foregrounded. Game, prop and successfully loaded historical-analysis views report the allowlisted exploration activities. Existing server triggers cover agent creation/following, pick generation/grading, saved systems and WagerBot responses; connected research is server-only.

## Assets

`app/src/main/assets/achievements` includes 35 GLBs, 70 earned/locked native thumbnails, studio HDR and confetti JSON (about 50 MB before APK compression). `scripts/export-android-achievement-models.py` splits the verified iOS runtime USDZ families into GLBs through Blender. It preserves geometry, authored names, material roles and rear anchors. PNGs are the existing production RealityKit bakes, not new AI artwork.

## Verification

Run the standard repository checks:

```sh
./gradlew testDebugUnitTest :core:models:test :app:lintDebug :app:assembleDebug :app:lintRelease :app:bundleRelease
```

Validation completed: 498 unit tests passed; debug APK, release bundle, and debug/release lint passed. Pixel 9 API 35 visual checks covered onboarding selection, gold flame rendering, drag rotation, double-tap flip, readable personalized rear labels, locked states, native sharing and unlock confetti. Screenshots are in `previews/`. These use isolated fixtures; production authenticated earning was not exercised.

Focused tests verify all 35 milestones, server JSON decoding, progress never unlocking an award, earliest persisted unlock/credited-agent preservation, and onboarding insertion with unchanged raw IDs and correct progress.

Debug-only isolated visual entry (no RPCs or unlock writes):

```sh
adb shell am start -S -n com.wagerproof.mobile.debug/com.wagerproof.app.MainActivity --es achievement_preview streak-25
```

Other values: `locked:experience-1000`, `celebration:first-agent`, `onboarding`, `paywall`. The preview flag is ignored in release builds. Emulator verification uses the existing Pixel 9 API 35. Production account eligibility still comes from the shared backend; no real award was fabricated for UI testing.

Android marketing version is 3.6.2, versionCode 95. This PR prepares artifacts; it does not upload to Google Play. Publishing remains the existing explicit Android release workflow, with signing and a versionCode above the live Play build verified at release time.
