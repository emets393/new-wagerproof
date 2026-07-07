# WagerProof Android (native)

Jetpack Compose rebuild of the iOS native app (`../wagerproof-ios-native/`) with full feature parity.

- **Plan / architecture**: [docs/PLAN.md](docs/PLAN.md)
- **Parity status**: [docs/PARITY.md](docs/PARITY.md)
- **Parity contract** (exhaustive iOS inventory): [docs/inventory/](docs/inventory/)
- **Fidelity waivers**: [docs/waivers/](docs/waivers/)

## Build

```bash
./gradlew :app:assembleDebug
```

Requires JDK 17 and the Android SDK (`local.properties` → `sdk.dir`). Target SDK 36, min SDK 31.

## Modules

`:core:models` (pure JVM) → `:core:shared` → `:core:services` → `:core:stores` → `:app`; `:core:design` (UI-only, no data deps); `:widgets` (Glance). Mirrors the iOS `WagerproofKit` layering — see PLAN.md for the layering rules and locked architecture decisions.
