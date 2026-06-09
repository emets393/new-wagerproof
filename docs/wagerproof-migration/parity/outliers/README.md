# B06 Outliers — parity screenshots

This directory will contain three screenshots once the project compiles end-to-end:
- `empty.png` — hub view with no value/fade alerts loaded
- `loaded.png` — hub view populated from `OutliersFixtures` (3 value alerts, 2 fade alerts)
- `error.png` — hub view with a failed-state store (banner-style error)

## How to capture

The screenshot harness is wired and the fixture data ships in `Wagerproof/Features/Outliers/OutliersFixtures.swift`. To capture:

```bash
# 1) Boot the iPhone 16 Pro sim and install the Debug build
xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof \
    -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
    -configuration Debug build

# 2) Launch via the screenshot harness flag
xcrun simctl launch <UDID> com.wagerproof.mobile \
    -uiScreenshotMode outliersLoaded

# 3) Snap the screenshot
xcrun simctl io <UDID> screenshot loaded.png

# Repeat with -uiScreenshotMode outliersEmpty / outliersError
```

## Current blocker

`xcodebuild` currently fails because of pre-existing untracked work in `Wagerproof/Features/Onboarding/OnboardingView.swift` that references undefined symbols (`OnboardingAgentValue247View`, `AgentGenerationView`, etc.). Those errors are entirely outside the B06 scope; the Outliers source files compile cleanly when isolated.

Reviewer task: once the Onboarding agent-value subviews land (or the unrelated work gets removed from the working tree), capture the three screenshots using the commands above.
