# WagerProof native achievements

Implemented from Honeydew Swift's achievement experience, verified against origin/main `d426714` in an isolated checkout. The collection has 24 awards in six families. All four Experience ticket masters have smooth notch joins; approved contours and the stronger shared bow remain intact.

## App flow

Settings shows the collection count and a Recently Unlocked or Up Next shelf. See All opens a filterable collection grouped by family. Collection cells use cached PNG thumbnails. Detail loads a cloned RealityKit family hierarchy, selects the matching variant, and supports horizontal drag, front/back snapping, double-tap flip, and an expanded view using the same renderer. VoiceOver can adjust rotation. Reduce Motion skips snap animation.

Earned medals display the account's profile name, award title and persisted earned date on their curved reverse. Locked reverses stay blank. Personal text is generated only on an instance clone and never written into bundled assets. Loading failures fall back to a thumbnail. One shared non-AR renderer transfers ownership between detail and celebration, while static shelves never start RealityKit sessions.

`AchievementsStore` binds to the authenticated UID, resets on account changes, caches snapshots per user, preserves the earliest persisted unlock and original credited agent, and rejects stale account responses. Server progress alone cannot award a medal. Successful first initialization silently backfills existing evidence. Later awards queue one at a time and wait for existing modal presentations to finish. Dismissals are acknowledged locally and on the server; failed acknowledgments retry. Completed exploration activities also persist per user while offline and replay idempotently.

The app refreshes on login, foreground, tab changes, collection/detail entry, agent-list changes, follow completion, viewed pick generation and saved systems. Game analysis, prop detail and successful historical analysis record their specific usage events. Server triggers handle agent, follow, pick, performance, system and WagerBot milestones. The MCP Worker records successful authenticated research separately. Eligibility and RPC details are in [achievements-backend.md](achievements-backend.md).

## Source and resources

- `wagerproof-ios-native/WagerproofKit/Sources/WagerproofModels/Achievement.swift`: catalog and transport values.
- `.../WagerproofServices/AchievementService.swift`: authenticated RPC transport.
- `.../WagerproofStores/AchievementsStore.swift`: account lifecycle, snapshots, offline retries and celebrations.
- `wagerproof-ios-native/Wagerproof/Features/Achievements`: library, shelf, detail, celebration and renderer.
- `wagerproof-ios-native/Wagerproof/Resources/Achievements`: six family USDZs, 48 native earned/locked thumbnails and studio environment. The verification folder is excluded from the app bundle.
- `scripts/package-achievement-runtime.py`: reproducible runtime packaging. Editable review masters remain under `artifacts/achievements`.

## Validation

Use the existing iPhone 17 Pro Max iOS 26.0 simulator `D69B4254-398D-4806-921B-56411888C597` only.

```sh
cd wagerproof-ios-native
xcodegen generate
xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -configuration Debug \
  -destination 'platform=iOS Simulator,id=D69B4254-398D-4806-921B-56411888C597' build
```

The DEBUG-only `-achievementPreview` launch argument opens a local fixture collection without Supabase writes. Add `-achievementID experience-50`, `-achievementLocked`, or `-achievementName 'A long test name'` to inspect detail states. These fixtures never grant production awards and are excluded from Release code.

Validation completed on September 9, 2026:

- Debug and Release simulator builds passed with the final resources.
- 13 model/store tests passed against the production sources in an isolated SwiftPM harness with mocked transport.
- PostgreSQL behavior tests, MCP success/failure tests and MCP TypeScript checks passed.
- All 24 review-master inventory checks passed. The final six runtime USDZs match the built app byte-for-byte.
- All six families were visually inspected in the simulator. Checked collection thumbnails and filters, shield-to-ticket navigation, expanded presentation, flip gesture, earned engraving, blank locked reverse, and long recipient-name fitting.
- Runtime USDZs, thumbnails and studio source total 39.43 MB. QA source renders are excluded from the app bundle.

The simulator used isolated demo data. Live database RPC behavior was verified in a rollback-only transaction. Production database and MCP deployments are complete; real-account device interaction and two-device synchronization remain acceptance checks.

Focused model/store tests cover latching, attribution, backfill, progress safety, pending celebrations, stale responses, account isolation and offline retries. SQL behavior and MCP tests are documented separately. Simulator screenshots live in `artifacts/achievements/ios-validation`.

## Release boundary

The production migration and MCP hook are deployed. The signed Debug build, version 3.6.1 (326), was installed and launched normally on the selected iPhone 14 Pro on September 9, 2026. No preview arguments were supplied and existing app data was preserved. Find the feature at Settings → Your Collection → See All. No App Store upload was performed.

## Family color revision

The later color-only pass updates all 24 authored medals, six runtime exports and 24 thumbnails to emerald, sapphire, ember/amber, amethyst, ruby/rose and teal/aqua. See `artifacts/achievements/palette-review/family-palettes.png` and its README. Export shader colors, material bindings, variant anchors and unchanged mesh counts were verified. The palette revision passed a new Debug simulator build and signed device build. The updated simulator collection was visually checked; `ios-validation/final-palette-collection.png` records the result. Earlier screenshots and build hashes predate this palette revision.

## Honeydew presentation alignment

The follow-up rendering pass copies Honeydew's 50-degree camera, 1.06 framing margin, 0.65-second smoothstep reveal, gentle idle rocking, front/back detents and role-specific PBR roughness/clearcoat. WagerProof retains the approved authored family colors and geometry. Detail uses the same 420-point hero size and spring grow-in.

The collection now uses 48 earned/locked PNGs baked through the production RealityKit surface, replacing the Blender preview images and opacity-based locked treatment. To regenerate after an asset/material change, launch a Debug simulator build with `-achievementPreview -bakeAchievementThumbnails`. Wait for `Documents/AchievementBakes/complete.txt`, copy all 48 PNGs into the achievement resources and regenerate the Xcode project. Runtime packaging's Blender thumbnails are interim previews; perform this native bake afterward for release.

The unlock sheet initially shows a finger-swipe hint and “Swipe me to rotate.” Touching the medal dismisses the hint and stops automatic rotation. Reduce Motion suppresses the reveal, rocking and finger animation. `-achievementPreview -achievementCelebration` is the isolated Debug preview for this surface and does not grant a real award.
