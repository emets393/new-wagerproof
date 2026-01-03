# WagerProof iOS Widget

This document describes the iOS Home Screen widget implementation for WagerProof.

## Overview

The WagerProof iOS widget allows users to view betting insights directly on their Home Screen. Users can choose between three content types:

1. **Editor Picks** - Latest published betting picks from the WagerProof editors
2. **Fade Alerts** - High-confidence model predictions worth fading (betting against)
3. **Polymarket Value** - Market consensus outliers indicating potential value

## Features

- **Widget Sizes**: Medium (2-3 items) and Large (4-5 items)
- **Content Selection**: Users can configure which content type to display
- **Dark Theme**: Matches WagerProof's dark aesthetic
- **Deep Linking**: Tapping the widget opens the relevant section in the app
- **Auto-Sync**: Data syncs automatically when the app fetches new data
- **Fallback Fetch**: Widget can fetch data directly if app data is stale

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  WagerProof App (React Native + Expo)                           │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ Existing Supabase│ →  │ Widget Data Sync │ → App Group       │
│  │ Services         │    │ Native Module    │   UserDefaults    │
│  └──────────────────┘    └──────────────────┘   (shared)        │
└─────────────────────────────────────────────────────┬───────────┘
                                                      │
┌─────────────────────────────────────────────────────┴───────────┐
│  Widget Extension (SwiftUI + WidgetKit)                          │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────────────┐  │
│  │ Timeline       │ → │ Widget Views   │   │ Direct Supabase │  │
│  │ Provider       │   │ (Med/Large)    │   │ Fetch (fallback)│  │
│  └────────────────┘   └────────────────┘   └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. Main app fetches data from Supabase (using existing services)
2. `useWidgetDataSync` hook transforms and writes data to App Group storage
3. Widget reads from shared storage (fast, no network required)
4. If data is stale (>30 min), widget fetches directly from Supabase

## File Structure

```
wagerproof-mobile/
├── targets/
│   └── WagerProofWidget/
│       ├── expo-target.config.js       # Widget target configuration
│       ├── WagerProofWidget.swift      # Main widget entry point
│       ├── Info.plist                  # Widget extension info
│       ├── Models/
│       │   └── WidgetModels.swift      # Data models
│       ├── Views/
│       │   ├── MediumWidgetView.swift  # Medium size layout
│       │   ├── LargeWidgetView.swift   # Large size layout
│       │   └── SharedComponents.swift  # Reusable UI components
│       ├── Providers/
│       │   └── WidgetTimelineProvider.swift  # Timeline & config
│       ├── Services/
│       │   ├── AppGroupDataManager.swift     # Shared storage reader
│       │   └── SupabaseWidgetService.swift   # Direct API fallback
│       └── Assets.xcassets/            # Widget assets
│
├── modules/
│   └── widget-data-bridge/
│       ├── index.ts                    # Module export
│       ├── src/
│       │   └── WidgetDataBridge.ts     # TypeScript API
│       └── ios/
│           ├── WidgetDataBridgeModule.swift  # Native module
│           └── WidgetDataBridgeModule.m      # Obj-C bridge
│
└── hooks/
    └── useWidgetDataSync.ts            # Auto-sync hook
```

## Usage

### Integrating Widget Data Sync

Add the `useWidgetDataSync` hook to a component that has access to the data:

```typescript
import { useWidgetDataSync } from '@/hooks/useWidgetDataSync';

function MyDataProvider() {
  const { data: editorPicks } = useEditorPicksQuery();
  const { data: fadeAlerts } = useFadeAlertsQuery();
  const { data: valueAlerts } = useValueAlertsQuery();

  // This hook automatically syncs data to the widget
  useWidgetDataSync({
    editorPicks,
    fadeAlerts,
    valueAlerts,
  });

  return <>{/* ... */}</>;
}
```

### Manual Sync

You can also trigger a manual sync:

```typescript
import { syncDataToWidget } from '@/hooks/useWidgetDataSync';

async function handleDataUpdate() {
  await saveData();
  await syncDataToWidget({
    editorPicks: newPicks,
    fadeAlerts: newAlerts,
    valueAlerts: newValues,
  });
}
```

### Using the Bridge Module Directly

```typescript
import {
  syncWidgetData,
  reloadWidgets,
  getWidgetData,
  clearWidgetData,
  isWidgetSupported,
} from '@/modules/widget-data-bridge';

// Check widget support
const supported = await isWidgetSupported();

// Sync data
await syncWidgetData({
  editorPicks: [...],
  fadeAlerts: [...],
  polymarketValues: [...],
  lastUpdated: new Date().toISOString(),
});

// Force widget refresh
await reloadWidgets();

// Debug: get current widget data
const currentData = await getWidgetData();

// Clear widget data
await clearWidgetData();
```

## Apple Developer Portal Setup

Before building, you must configure App Groups in the Apple Developer Portal:

### 1. Create App Group

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** > **Identifiers**
3. Click **App Groups** in the sidebar
4. Click **+** to register a new App Group
5. Enter identifier: `group.com.wagerproof.mobile`
6. Click **Continue** and **Register**

### 2. Update Main App Identifier

1. In Identifiers, find `com.wagerproof.mobile`
2. Click to edit
3. Enable **App Groups** capability
4. Select `group.com.wagerproof.mobile`
5. Save changes

### 3. Create Widget Identifier

1. Click **+** to register new identifier
2. Select **App IDs**
3. Enter:
   - Description: `WagerProof Widget`
   - Bundle ID: `com.wagerproof.mobile.widget`
4. Enable **App Groups** capability
5. Select `group.com.wagerproof.mobile`
6. Register

### 4. Regenerate Provisioning Profiles

```bash
eas credentials --platform ios
# Select "Update provisioning profile" for both main app and widget
```

## Building

### Development Build

```bash
# Clean prebuild to ensure widget target is included
npx expo prebuild --clean

# Build with EAS
eas build --platform ios --profile development
```

### Production Build

```bash
eas build --platform ios --profile production
```

### Testing in Xcode

1. Open `ios/WagerProof.xcworkspace` in Xcode
2. Select `WagerProofWidget` scheme
3. Use SwiftUI previews to test widget views
4. Run on simulator or device

## Adding a New Content Type

To add a new content type to the widget:

### 1. Update Data Models

Edit `targets/WagerProofWidget/Models/WidgetModels.swift`:

```swift
// Add new case to WidgetContentType
enum WidgetContentType: String, Codable, CaseIterable {
    case editorPicks = "editor_picks"
    case fadeAlerts = "fade_alerts"
    case polymarketValue = "polymarket_value"
    case newType = "new_type"  // Add this

    var displayName: String {
        switch self {
        // ... existing cases
        case .newType: return "New Type"
        }
    }
}

// Add new data struct
struct NewTypeWidgetData: Codable, Identifiable {
    let id: String
    // ... fields
}
```

### 2. Update TypeScript Types

Edit `modules/widget-data-bridge/src/WidgetDataBridge.ts`:

```typescript
export interface NewTypeForWidget {
  id: string;
  // ... fields
}

export interface WidgetDataPayload {
  editorPicks: EditorPickForWidget[];
  fadeAlerts: FadeAlertForWidget[];
  polymarketValues: PolymarketValueForWidget[];
  newTypes: NewTypeForWidget[];  // Add this
  lastUpdated: string;
}
```

### 3. Update Transform Function

Edit `hooks/useWidgetDataSync.ts`:

```typescript
function transformNewTypes(items: NewType[]): NewTypeForWidget[] {
  return items.slice(0, 5).map((item) => ({
    id: item.id,
    // ... map fields
  }));
}
```

### 4. Add Widget Views

Create row component in `SharedComponents.swift` and add to `MediumWidgetView.swift` and `LargeWidgetView.swift`.

## Troubleshooting

### Widget Not Appearing

1. Ensure App Groups are configured in Apple Developer Portal
2. Verify provisioning profiles are regenerated
3. Run `npx expo prebuild --clean` to rebuild native project
4. Check that `@bacons/apple-targets` plugin is in `app.json`

### Data Not Syncing

1. Check console logs for sync errors
2. Verify App Group identifier matches: `group.com.wagerproof.mobile`
3. Test with `getWidgetData()` to see current stored data
4. Ensure `useWidgetDataSync` hook is mounted

### Widget Shows Empty State

1. Open the main app to trigger data sync
2. Check if `isWidgetSupported()` returns true
3. Verify Supabase keys in widget fallback service

### Deep Links Not Working

1. Check `wagerproof` URL scheme is in `app.json`
2. Verify deep link handler in `_layout.tsx`
3. Test with: `xcrun simctl openurl booted "wagerproof://picks"`

## Notes

- Widget refresh is system-controlled (40-70 times/day max)
- Supabase anon keys are read-only and safe to embed
- iOS 17+ deployment target is required for modern WidgetKit features
- App Group storage is persistent across app updates
