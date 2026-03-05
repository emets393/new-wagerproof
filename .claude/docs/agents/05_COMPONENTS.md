# Components List

## March 2026 Additions

- New debug settings hook/service:
  - `wagerproof-mobile/services/agentV2DebugSettings.ts`
  - `wagerproof-mobile/hooks/useAgentV2DebugSettings.ts`
- Secret Settings adds `Force Agents V2 Only` toggle for runtime debugging.
- `AgentLeaderboard`, `TopAgentPicksFeed`, and agent detail screens now render debug error snackbars in `Portal` to ensure they appear above all UI layers.
- Loading skeletons in leaderboard and pick cards now animate (pulse) to clearly indicate active loading.

## File Structure

```
/wagerproof-mobile/
├── app/(drawer)/(tabs)/agents/
│   ├── index.tsx              # Agents Hub
│   ├── create.tsx             # Creation flow
│   ├── [id]/
│   │   ├── index.tsx          # Agent detail
│   │   └── settings.tsx       # Full settings
│   └── public/
│       └── [id].tsx           # Public agent view
│
├── components/agents/
│   ├── AgentCard.tsx
│   ├── AgentPickCard.tsx
│   ├── AgentLeaderboard.tsx
│   ├── AgentStatsBanner.tsx
│   ├── ThinkingTrace.tsx
│   │
│   ├── creation/
│   │   ├── CreationStepContainer.tsx
│   │   ├── ArchetypeCard.tsx
│   │   ├── EmojiColorPicker.tsx
│   │   ├── DataWeightsAllocator.tsx
│   │   └── AgentPreviewCard.tsx
│   │
│   └── settings/
│       ├── SettingsSection.tsx
│       ├── LabeledSlider.tsx
│       ├── BiasSlider.tsx
│       ├── WeightAllocationSlider.tsx
│       ├── RadioCardGroup.tsx
│       ├── DraggableRankList.tsx
│       ├── TeamPicker.tsx
│       └── MultiSliderGroup.tsx
│
├── services/
│   └── agentService.ts        # CRUD + pick generation
│
├── hooks/
│   ├── useAgents.ts           # React Query hooks
│   └── useAgentPicks.ts       # Pick fetching/generation
│
└── types/
    └── agent.ts               # TypeScript interfaces
```

---

## Agent Display Components

### `AgentCard.tsx`
Displays an agent with emoji, name, color theme, and performance stats.

**Props:**
```typescript
interface AgentCardProps {
  agent: Agent;
  onPress: () => void;
  variant?: 'full' | 'compact';
}
```

**Features:**
- Emoji avatar with colored background
- Name and sports tags
- Record (W-L-P) and net units
- Win percentage progress bar
- Current streak indicator
- "View Picks" arrow

---

### `AgentPickCard.tsx`
Individual pick display with reasoning and key factors.

**Props:**
```typescript
interface AgentPickCardProps {
  pick: AgentPick;
  game: Game;
  variant?: 'pending' | 'won' | 'lost' | 'push';
  expandable?: boolean;
}
```

**Features:**
- Game matchup header with time
- Team logo/abbreviation
- Pick value (e.g., "KC -3.5")
- Units and confidence
- Reasoning text (expandable)
- Key factors as chips

---

### `AgentLeaderboard.tsx`
Ranked list component for public agents.

**Props:**
```typescript
interface AgentLeaderboardProps {
  agents: LeaderboardAgent[];
  filters: LeaderboardFilters;
  onFilterChange: (filters: LeaderboardFilters) => void;
  onAgentPress: (agentId: string) => void;
  isLoading: boolean;
}
```

---

### `AgentStatsBanner.tsx`
Horizontal stats display for agent header.

**Props:**
```typescript
interface AgentStatsBannerProps {
  record: { wins: number; losses: number; pushes: number };
  netUnits: number;
  winRate: number;
  streak: { type: 'win' | 'loss'; count: number };
}
```

---

### `ThinkingTrace.tsx`
Animated loading state during pick generation.

**Props:**
```typescript
interface ThinkingTraceProps {
  agentName: string;
  isComplete: boolean;
  onComplete?: () => void;
}
```

**Animation Stages:**
```typescript
const STAGES = [
  { icon: '📡', label: 'Scanning today\'s games...', delay: 0 },
  { icon: '🧮', label: 'Analyzing model predictions...', delay: 1500 },
  { icon: '📊', label: 'Identifying value edges...', delay: 3000 },
  { icon: '🎯', label: `Applying {agentName}'s strategy...`, delay: 4500 },
  { icon: '✨', label: 'Making final selections...', delay: 6000 },
];
```

**States:**
- `pending`: Gray circle, gray text
- `active`: Pulsing green dot, white text
- `complete`: Green checkmark, green text

---

## Creation Flow Components

### `CreationStepContainer.tsx`
Wrapper for each creation step with consistent layout.

**Props:**
```typescript
interface CreationStepContainerProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextEnabled: boolean;
  nextLabel?: string;
}
```

---

### `ArchetypeCard.tsx`
Preset template card for quick-start selection.

**Props:**
```typescript
interface ArchetypeCardProps {
  archetype: Archetype;
  isSelected: boolean;
  onSelect: () => void;
}

interface Archetype {
  id: string;
  name: string;
  emoji: string;
  description: string;
  keySettings: string;
}
```

---

### `EmojiColorPicker.tsx`
Combined emoji grid and color swatch selector.

**Props:**
```typescript
interface EmojiColorPickerProps {
  selectedEmoji: string;
  selectedColor: string;
  onEmojiChange: (emoji: string) => void;
  onColorChange: (color: string) => void;
}

const EMOJIS = ['🎯', '🔥', '🧊', '💰', '🎲', '🦅', '🐻', '🏀', '🏈', '⚡'];
const COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'];
```

---

### `DataWeightsAllocator.tsx`
Multi-slider allocation that must sum to 100.

**Props:**
```typescript
interface DataWeightsAllocatorProps {
  weights: DataWeights;
  onChange: (weights: DataWeights) => void;
}

interface DataWeights {
  model_predictions: number;
  sharp_money: number;
  public_fade: number;
  prediction_markets: number;
  news_and_context: number;
}
```

**Behavior:**
- Sliders interconnected to maintain sum of 100
- When one increases, others decrease proportionally
- Visual indicator shows current total
- Error state if not equal to 100

---

### `AgentPreviewCard.tsx`
Live updating preview during creation.

**Props:**
```typescript
interface AgentPreviewCardProps {
  name: string;
  emoji: string;
  color: string;
  sports: string[];
  riskTolerance?: number;
  style?: string;
}
```

---

## Settings Components

### `SettingsSection.tsx`
Collapsible section with header.

**Props:**
```typescript
interface SettingsSectionProps {
  icon: string;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

---

### `LabeledSlider.tsx`
Slider with min/max labels and current value display.

**Props:**
```typescript
interface LabeledSliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (value: number) => void;
}
```

---

### `BiasSlider.tsx`
Centered slider for -10 to +10 values with neutral indicator.

**Props:**
```typescript
interface BiasSliderProps {
  label: string;
  value: number;  // -10 to +10
  leftLabel: string;
  rightLabel: string;
  onChange: (value: number) => void;
}
```

**Features:**
- Center mark at 0 (neutral)
- Different colors for negative vs positive
- Shows "neutral" label when at 0

---

### `WeightAllocationSlider.tsx`
Multiple sliders that must sum to 100.

**Props:**
```typescript
interface WeightAllocationSliderProps {
  items: Array<{
    key: string;
    label: string;
    icon: string;
    description: string;
  }>;
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
}
```

---

### `RadioCardGroup.tsx`
Single-select cards with descriptions.

**Props:**
```typescript
interface RadioCardGroupProps {
  options: Array<{
    id: string;
    label: string;
    description: string;
    icon?: string;
  }>;
  selectedId: string;
  onChange: (id: string) => void;
}
```

---

### `DraggableRankList.tsx`
Drag-to-reorder list for bet type preferences.

**Props:**
```typescript
interface DraggableRankListProps {
  items: Array<{
    id: string;
    label: string;
  }>;
  order: string[];
  weights: Record<string, number>;
  onChange: (order: string[], weights: Record<string, number>) => void;
}
```

**Features:**
- Haptic feedback on drag
- Reorder animation
- Weight percentage display
- Adjust weights via slider per item

---

### `TeamPicker.tsx`
Searchable team selector.

**Props:**
```typescript
interface TeamPickerProps {
  selectedTeams: string[];
  onChange: (teams: string[]) => void;
  sports: string[];  // Filter available teams
  mode: 'favorite' | 'avoided';
}
```

**Features:**
- Search by team name or city
- Filter by sport
- Add/remove chips
- Team logo display

---

### `MultiSliderGroup.tsx`
Group of related sliders (for situational factors, market signals).

**Props:**
```typescript
interface MultiSliderGroupProps {
  title: string;
  sliders: Array<{
    key: string;
    label: string;
    icon: string;
    description: string;
    min: number;
    max: number;
  }>;
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  collapsible?: boolean;
}
```

---

## Services & Hooks

### `agentService.ts`

```typescript
// CRUD operations
createAgent(data: CreateAgentInput): Promise<Agent>
updateAgent(id: string, data: UpdateAgentInput): Promise<Agent>
deleteAgent(id: string): Promise<void>
getAgent(id: string): Promise<Agent>
getMyAgents(): Promise<Agent[]>
getPublicAgents(filters: LeaderboardFilters): Promise<Agent[]>

// Pick generation
generatePicks(agentId: string): Promise<AgentPicksResponse>
getTodaysPicks(agentId: string): Promise<AgentPick[]>
getPickHistory(agentId: string, page: number): Promise<AgentPick[]>

// Follow system
followAgent(agentId: string): Promise<void>
unfollowAgent(agentId: string): Promise<void>
getFollowedAgents(): Promise<Agent[]>
```

---

### `useAgents.ts`

```typescript
useMyAgents(): UseQueryResult<Agent[]>
useAgent(id: string): UseQueryResult<Agent>
usePublicAgents(filters: LeaderboardFilters): UseInfiniteQueryResult<Agent[]>
useCreateAgent(): UseMutationResult<Agent, Error, CreateAgentInput>
useUpdateAgent(): UseMutationResult<Agent, Error, UpdateAgentInput>
useDeleteAgent(): UseMutationResult<void, Error, string>
```

---

### `useAgentPicks.ts`

```typescript
useAgentPicks(agentId: string, date: string): UseQueryResult<AgentPick[]>
useGeneratePicks(): UseMutationResult<AgentPicksResponse, Error, string>
usePickHistory(agentId: string): UseInfiniteQueryResult<AgentPick[]>
```
