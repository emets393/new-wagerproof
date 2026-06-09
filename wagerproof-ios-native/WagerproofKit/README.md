# WagerproofKit

Local Swift package containing the data, services, state, and design layers of the Wagerproof iOS app.

Five products:

| Product | Layer | Depends on |
|---|---|---|
| `WagerproofModels` | Codable types | Foundation only |
| `WagerproofServices` | SDK wrappers (Supabase, RevenueCat, Mixpanel, GoogleSignIn) | Models, SharedKit |
| `WagerproofStores` | `@Observable` app state | Models, Services, SharedKit |
| `WagerproofDesign` | Tokens, animations, typography, primitive views | nothing |
| `WagerproofSharedKit` | Keychain + App Group helpers (extension-safe) | RevenueCat |

Layering is enforced by the `dependencies:` lists in `Package.swift`. Stores never reach past Services to call an SDK directly; Views never reach past Stores.

See `../../docs/wagerproof-migration/REBUILD_PLAN.md` for the full migration contract.
