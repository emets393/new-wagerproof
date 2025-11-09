# Value Finds Integration - Remaining Steps

## Status: Partially Complete

### ✅ Completed
1. Database migration with new columns (high_value_badges, page_header_data, editor_cards)
2. OpenAI Structured Outputs JSON schema created
3. Edge Function updated to use Structured Outputs and store all three formats
4. System prompts updated for three-output format
5. HighValueBadge component created
6. PageHeaderValueFinds component created
7. ValueFindEditorCard component created
8. AIValueFindsPreview component created
9. AI Settings page updated with preview functionality
10. Service layer updated with new functions
11. NFL page updated with PageHeaderValueFinds component integration
12. Value Finds data fetching added to NFL page

### 🔄 Remaining Tasks

#### 1. Add HighValueBadge to NFLGameCard

**File**: `src/components/NFLGameCard.tsx`

Add optional prop to the interface:
```typescript
interface NFLGameCardProps {
  // ... existing props ...
  highValueBadge?: {
    recommended_pick: string;
    confidence: number;
    tooltip_text: string;
  };
}
```

In the card header/title area, add:
```typescript
{highValueBadge && (
  <HighValueBadge
    pick={highValueBadge.recommended_pick}
    confidence={highValueBadge.confidence}
    tooltipText={highValueBadge.tooltip_text}
  />
)}
```

Import HighValueBadge:
```typescript
import { HighValueBadge } from './HighValueBadge';
```

#### 2. Pass Badge Data to NFLGameCard in NFL.tsx

**File**: `src/pages/NFL.tsx`

In the NFLGameCard component usage (around line 1123), add:
```typescript
<NFLGameCard
  // ... existing props ...
  highValueBadge={highValueBadges.get(prediction.training_key || prediction.unique_id)}
>
```

#### 3. Integrate into College Football Page

**File**: `src/pages/CollegeFootball.tsx`

Follow the same pattern as NFL:

1. Add imports:
```typescript
import { getHighValueBadges, getPageHeaderData } from '@/services/aiCompletionService';
import { PageHeaderValueFinds } from '@/components/PageHeaderValueFinds';
```

2. Add state:
```typescript
const [highValueBadges, setHighValueBadges] = useState<Map<string, any>>(new Map());
const [pageHeaderData, setPageHeaderData] = useState<{ summary_text: string; compact_picks: any[] } | null>(null);
```

3. Add useEffect to fetch data:
```typescript
useEffect(() => {
  const fetchValueFinds = async () => {
    try {
      const [badges, headerData] = await Promise.all([
        getHighValueBadges('cfb'),
        getPageHeaderData('cfb'),
      ]);

      const badgesMap = new Map();
      badges.forEach(badge => {
        badgesMap.set(badge.game_id, badge);
      });
      
      setHighValueBadges(badgesMap);
      setPageHeaderData(headerData);
    } catch (error) {
      debug.error('Error fetching value finds:', error);
    }
  };

  fetchValueFinds();
}, []);
```

4. Add PageHeaderValueFinds before game cards
5. Pass badge data to CFBGameCard

#### 4. Update CFBGameCard Component

**File**: `src/components/CFBGameCard.tsx`

Same updates as NFLGameCard:
- Add highValueBadge optional prop
- Import and render HighValueBadge component in card header

#### 5. Update Editors Picks Page

**File**: `src/pages/EditorsPicks.tsx`

Replace the current ValueFindsSection with editor cards:

1. Add imports:
```typescript
import { getEditorCards } from '@/services/aiCompletionService';
import { ValueFindEditorCard } from '@/components/ValueFindEditorCard';
```

2. Add state:
```typescript
const [nflEditorCards, setNflEditorCards] = useState<any[]>([]);
const [cfbEditorCards, setCfbEditorCards] = useState<any[]>([]);
```

3. Fetch editor cards:
```typescript
useEffect(() => {
  const fetchEditorCards = async () => {
    try {
      const [nflCards, cfbCards] = await Promise.all([
        getEditorCards('nfl'),
        getEditorCards('cfb'),
      ]);
      
      setNflEditorCards(nflCards);
      setCfbEditorCards(cfbCards);
    } catch (error) {
      debug.error('Error fetching editor cards:', error);
    }
  };

  fetchEditorCards();
}, []);
```

4. Replace ValueFindsSection components with:
```typescript
{/* NFL Value Finds */}
{nflEditorCards.length > 0 && (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-2xl font-bold">NFL Value Finds</h2>
      <Badge>AI Powered</Badge>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {nflEditorCards.map((card, index) => (
        <ValueFindEditorCard
          key={index}
          gameId={card.game_id}
          matchup={card.matchup}
          betType={card.bet_type}
          recommendedPick={card.recommended_pick}
          confidence={card.confidence}
          keyFactors={card.key_factors}
          explanation={card.explanation}
        />
      ))}
    </div>
  </div>
)}

{/* CFB Value Finds */}
{cfbEditorCards.length > 0 && (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-2xl font-bold">College Football Value Finds</h2>
      <Badge>AI Powered</Badge>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cfbEditorCards.map((card, index) => (
        <ValueFindEditorCard
          key={index}
          gameId={card.game_id}
          matchup={card.matchup}
          betType={card.bet_type}
          recommendedPick={card.recommended_pick}
          confidence={card.confidence}
          keyFactors={card.key_factors}
          explanation={card.explanation}
        />
      ))}
    </div>
  </div>
)}
```

## Testing Checklist

After completing the remaining tasks:

1. [ ] Generate a test analysis in AI Settings for NFL
2. [ ] Verify preview shows all three tabs correctly
3. [ ] Publish the analysis
4. [ ] Check NFL page:
   - [ ] Page header appears at top
   - [ ] High value badges appear on correct game cards
   - [ ] Badges have correct tooltip content
5. [ ] Check Editors Picks page:
   - [ ] Editor cards display with all information
   - [ ] Cards are styled correctly
6. [ ] Repeat for CFB
7. [ ] Test unpublish functionality
8. [ ] Verify unpublished finds don't show to regular users
9. [ ] Test regenerate functionality

## Game ID Mapping Notes

From NFL.tsx debug logs, predictions use:
- `training_key` - Primary identifier
- `unique_id` - Alternative identifier

The AI should return `game_id` matching one of these. When fetching badges/cards, use:
```typescript
highValueBadges.get(prediction.training_key || prediction.unique_id)
```

## Next Steps After Integration

1. Test with real game data
2. Fine-tune system prompts based on output quality
3. Set up Discord webhook integration for published finds
4. Configure cron jobs for automated analysis
5. Monitor OpenAI API costs and adjust as needed

