# Pixel Office — Room-by-Room Design Spec

> High-fidelity pixel-art office layout for WagerProof Agent HQ.
> Map size: 640×960 px (32px tile grid = 20×30 tiles). Rendered at 2× on device.
> Viewed top-down isometric-ish (¾ view like classic RPGs).
> Camera: single scrollable map, no room transitions.

---

## Floor Plan Overview

The map reads **top-to-bottom** as the user scrolls. The layout feels like walking into a real startup office:

```
┌──────────────────────────────────────────┐
│            ENTRYWAY / LOBBY              │  rows 0-3
│  front door, welcome mat, coat hooks     │
├──────────────────────────────────────────┤
│                                          │
│            MAIN OFFICE                   │  rows 4-13
│  6 desks, monitors, chairs, plants,      │
│  windows along top wall, whiteboard      │
│                                          │
├────────────────────┬─────────────────────┤
│                    │                     │
│     KITCHEN        │     LOUNGE          │  rows 14-21
│  fridge, counter,  │  couches, TV,       │
│  coffee station,   │  coffee table,      │
│  table, water      │  plants, bookshelf  │
│  cooler            │                     │
│                    │                     │
├────────────────────┴─────────────────────┤
│                                          │
│          BACKYARD PATIO                  │  rows 22-29
│  grill, picnic table, string lights,     │
│  lounge chairs, planter boxes, fence     │
│                                          │
└──────────────────────────────────────────┘
```

---

## 1. ENTRYWAY / LOBBY (rows 0-3, y: 0-96)

The first thing you see. Sets the tone — this is a legit operation.

### Furniture & Objects
| Object | Tile Position | Size (tiles) | Description |
|--------|--------------|-------------|-------------|
| Front door | center top (col 9-10, row 0) | 2×1 | Double glass doors, slightly ajar. Frosted glass with "WP" logo etched |
| Welcome mat | center (col 9-10, row 1) | 2×1 | Dark green mat, "AGENT HQ" text in pixel font |
| Coat rack | left wall (col 1, row 1-2) | 1×2 | Wooden rack with 2-3 jackets hanging. One sports jersey |
| Umbrella stand | next to coat rack (col 2, row 2) | 1×1 | 2 umbrellas poking out |
| Shoe tray | right of door (col 12, row 1) | 2×1 | A few pairs of shoes |
| Wall clock | center top wall (col 10, row 0) | 1×1 | Analog clock showing ~9:15 |
| Bulletin board | left wall (col 0, row 1-2) | 1×2 | Pinned notes, a calendar, a "Pick of the Week" card |
| Floor | full width | — | Hardwood planks running horizontal |
| Overhead light | center ceiling | 2×1 | Warm pendant light |
| Small plant | right of door (col 13, row 1) | 1×1 | Potted succulent on a small table |

### Agent Activities
- **Arriving**: Agent walks through front door, pauses at welcome mat, proceeds to office
- **Leaving**: Agent walks from office to door (end-of-day animation)
- **Checking bulletin**: Agent stands at bulletin board, reads for a few seconds

### Ambient Details
- Door has a subtle open/close animation potential
- Light spills in from the glass doors (lighter floor tiles near door)
- A small "OPEN" sign glows green in the door window

---

## 2. MAIN OFFICE (rows 4-13, y: 128-416)

The heart of the operation. This is where agents do their work — analyzing data, building models, reviewing picks.

### Layout Sub-zones
- **Left block**: 3 desks in a row (cols 1-9)
- **Right block**: 3 desks in a row (cols 11-19)
- **Center aisle**: Walking path between blocks (cols 9-11)
- **Back wall**: Windows, whiteboard, server rack

### Furniture & Objects
| Object | Tile Position | Size (tiles) | Description |
|--------|--------------|-------------|-------------|
| Desk 1 | col 1-3, row 5-6 | 3×2 | L-shaped desk, monitor, keyboard, mouse, coffee mug |
| Desk 2 | col 4-6, row 5-6 | 3×2 | Straight desk, dual monitors, headphones on hook |
| Desk 3 | col 7-9, row 5-6 | 3×2 | Standing desk (raised), single ultrawide monitor, energy drink |
| Desk 4 | col 11-13, row 5-6 | 3×2 | Standard desk, monitor, notebook, pen cup |
| Desk 5 | col 14-16, row 5-6 | 3×2 | Messy desk — papers, 2 monitors, snack wrapper |
| Desk 6 | col 17-19, row 5-6 | 3×2 | Clean minimal desk, laptop only, small plant |
| Office chair ×6 | behind each desk | 1×1 | Ergonomic chairs, different colors matching agent accent |
| Whiteboard | back wall center (col 8-12, row 4) | 5×1 | Scribbles: "NFL Week 4", tally marks, a drawn chart, "DO NOT ERASE" |
| Server rack | back wall right (col 17-19, row 4) | 3×1 | Blinking green/blue LEDs, cable mess behind |
| Windows ×4 | back wall (col 1-3, 5-7, 13-15, 17-19, row 4) | 3×1 each | Tall windows, daylight streaming in, city skyline silhouette visible |
| Large plant | corners (col 0 row 4, col 19 row 4) | 1×1 each | Tall fiddle-leaf fig in terracotta pot |
| Ceiling lights ×3 | evenly spaced | 2×1 each | Long fluorescent panels (subtle glow overlay) |
| Trash can | near aisle (col 10, row 8) | 1×1 | Small office bin |
| Printer | right wall (col 19, row 8) | 1×1 | Small desktop printer, blinking light |
| Filing cabinet | left wall (col 0, row 7) | 1×2 | Metal 3-drawer cabinet, slightly open top drawer |
| Motivational poster | left wall (col 0, row 5) | 1×1 | "Trust the Model" with a graph icon |
| Wall-mounted TV | right wall (col 19, row 5) | 1×1 | Small monitor showing live scores ticker |

### Desk Detail (per desk)
Each desk is unique but shares base elements:
- **Monitor(s)**: 1-2 screens showing charts/data (static pixel art on screen)
- **Keyboard + mouse**: Small detail in front of monitor
- **Chair**: Rolled up to desk when agent is seated, pushed back when away
- **Personal item**: Each desk has one unique item (coffee mug, energy drink, headphones, plant, stress ball, snack)
- **Cable**: A thin line from monitor to desk edge (pixel detail)

### Agent Activities
- **Working**: Seated at assigned desk, typing animation. Monitor shows activity (subtle screen flicker)
- **Thinking**: Seated but leaned back, hand-on-chin pose. Thought bubble with "..." or small icons
- **Reviewing picks**: Standing at whiteboard, writing/erasing
- **Printing**: Walking to printer, waiting, grabbing paper
- **Stretching**: Standing up from desk, quick stretch animation at desk
- **Water cooler chat**: Two agents meet in the aisle, small chat bubbles appear

### Ambient Details
- Monitors emit faint glow on desk surface
- Server rack LEDs blink in a pattern
- Sunlight from windows creates lighter floor patches
- One desk always has a steaming coffee mug (tiny steam particles)

---

## 3. KITCHEN (rows 14-21, y: 448-672, left half cols 0-9)

Where agents refuel. Cozy but functional — the kind of startup kitchen that's slightly too small for the team.

### Furniture & Objects
| Object | Tile Position | Size (tiles) | Description |
|--------|--------------|-------------|-------------|
| Refrigerator | left wall (col 0, row 14-15) | 1×2 | Stainless steel, magnets on door (tiny sports logos), slightly open glow when accessed |
| Kitchen counter | along top wall (col 1-5, row 14) | 5×1 | Granite-style counter with backsplash tiles. Has a fruit bowl, cutting board |
| Coffee station | counter right end (col 6-7, row 14) | 2×1 | Espresso machine (premium!), mug rack with 4 colorful mugs, small sugar/cream containers |
| Microwave | on counter (col 3, row 14) | 1×1 | Small microwave, digital clock display |
| Sink | counter center (col 4, row 14) | 1×1 | Small sink with faucet, one mug sitting in it |
| Kitchen table | center (col 3-6, row 17-18) | 4×2 | Round table with 4 chairs around it. Salt/pepper shakers in center |
| Chairs ×4 | around table | 1×1 each | Simple wooden chairs |
| Water cooler | right side (col 8, row 16) | 1×1 | Blue jug on top, small cups dispenser. Bubble animation when used |
| Snack shelf | right wall (col 9, row 15-16) | 1×2 | Open shelving with boxes, protein bars, chips |
| Paper towel roll | on counter (col 2, row 14) | tiny | Mounted roll |
| Trash/recycling | left wall bottom (col 0, row 18) | 1×1 | Two small bins side by side |
| Kitchen rug | under table | 4×2 | Checkered pattern, slightly worn |
| Hanging pot rack | above counter (decorative) | — | 2-3 pans hanging from ceiling rack |
| Chalkboard menu | wall (col 5, row 14) | 1×1 | "Today's Brew: Dark Roast" in chalk font |
| Small window | top wall (col 1-2, row 14) | 2×1 | Window above counter, herb plants on sill |

### Agent Activities
- **Getting coffee**: Agent walks to coffee station, waits 2 sec (brewing animation), walks away with mug
- **Getting water**: Agent at water cooler, fills cup, drinks, tosses cup
- **Eating lunch**: Agent sits at kitchen table, eating animation (fork/spoon motion)
- **Raiding snacks**: Agent at snack shelf, grabs something, walks away
- **Socializing**: 2-3 agents at kitchen table, chat bubbles, laughing
- **Microwaving**: Agent at microwave, waits, ding sound effect potential
- **Checking fridge**: Agent opens fridge (door swing animation), looks, closes

### Ambient Details
- Coffee machine has a tiny red "ready" light
- Steam rises from the coffee station periodically
- Water cooler bubbles occasionally
- Kitchen has warmer floor tiles (terracotta/linoleum look vs hardwood)

---

## 4. LOUNGE (rows 14-21, y: 448-672, right half cols 11-19)

The chill zone. Agents decompress here after big wins (or losses). Game day viewing happens here too.

### Furniture & Objects
| Object | Tile Position | Size (tiles) | Description |
|--------|--------------|-------------|-------------|
| L-shaped couch | center-left (col 11-14, row 16-18) | 4×3 | Dark leather sectional, 3 cushions, throw pillows in team colors |
| Coffee table | in front of couch (col 12-14, row 19) | 3×1 | Low wooden table, a few remotes, sports magazine, coaster |
| Large TV | top wall (col 14-16, row 14) | 3×1 | Wall-mounted flatscreen. Shows game highlights / ESPN-style ticker. Glowing screen |
| TV stand/console | below TV (col 14-16, row 15) | 3×1 | Media console with gaming controllers, streaming box, a trophy |
| Bookshelf | right wall (col 19, row 15-18) | 1×4 | Tall bookshelf: strategy books, a few sports trophies, framed photo, small globe |
| Bean bag ×2 | scattered (col 16, row 18; col 17, row 19) | 1×1 each | One green, one blue. Casual seating |
| Floor lamp | corner (col 11, row 14) | 1×1 | Tall arc lamp with warm glow |
| Tall plant | corner (col 19, row 14) | 1×1 | Monstera in a woven basket pot |
| Small side table | next to couch arm (col 11, row 16) | 1×1 | A drink and phone charging on it |
| Rug | under coffee table/couch area | 4×3 | Shag rug, neutral/warm tones |
| Wall art ×2 | top wall (col 11-12, row 14; col 17-18, row 14) | 2×1 each | One: vintage sports poster. Two: abstract data visualization art |
| Windows ×2 | right wall (col 19, row 16-17) | 1×2 | Tall windows with blinds half-drawn |
| Ceiling fan | center (decorative) | — | Slow-spinning fan blades overhead |
| Mini fridge | under TV console (col 16, row 15) | 1×1 | Small dorm-style fridge with drinks |
| Arcade cabinet | corner (col 18-19, row 19) | 2×1 | Retro arcade machine with glowing screen |

### Agent Activities
- **Watching TV**: Agent on couch, eyes toward TV, relaxed posture. Reacts to game events (fist pump, head drop)
- **Celebrating win**: 2-3 agents on couch, high-fives, confetti particles
- **Mourning loss**: Agent alone on bean bag, slumped posture, rain cloud particle
- **Reading**: Agent on couch with book/magazine, calm idle
- **Gaming**: Agent at arcade cabinet, button mashing animation
- **Chatting**: Agents on couch together, alternating chat bubbles
- **Napping**: Agent on bean bag, Z's floating up (after a late night or blowout loss)
- **Watching highlights**: Agent standing near TV, pointing at screen

### Ambient Details
- TV screen changes periodically (different "channels" — scores, highlights, talking heads)
- Floor lamp creates a warm circle of light on the floor
- Arcade cabinet has a faint attract-mode glow
- Throw pillows are in the user's agents' accent colors (nice personalization touch)

---

## 5. BACKYARD PATIO (rows 22-29, y: 704-928)

The outdoor escape. Glass sliding doors from the kitchen/lounge lead out here. Different floor texture (stone/wood deck), sky visible, string lights overhead.

### Furniture & Objects
| Object | Tile Position | Size (tiles) | Description |
|--------|--------------|-------------|-------------|
| Sliding glass door | center top (col 8-11, row 22) | 4×1 | Double slider, open during the day. Frame visible |
| Wooden deck floor | full area | — | Horizontal wood plank texture, slightly weathered |
| BBQ grill | right side (col 16-17, row 23) | 2×1 | Charcoal grill, closed lid. Smoke particles when "active" |
| Picnic table | center (col 7-11, row 25-26) | 5×2 | Long wooden table with 2 bench seats. Papers/tablets on it for outdoor meetings |
| String lights | overhead decoration | full width | Warm bulbs strung across the patio in a zigzag pattern. Glow at night |
| Lounge chairs ×2 | left side (col 2-3, row 24; col 4-5, row 24) | 2×1 each | Reclined deck chairs with cushions |
| Umbrella/shade | over lounge chairs (col 2-5, row 23) | 4×1 | Large patio umbrella providing shade circle |
| Planter boxes ×3 | along fence/edges | 2×1 each | Wooden planters with herbs, flowers, small tomato plant |
| Fence | along bottom and sides | full perimeter | Wooden privacy fence, 1 tile high. Peek of trees/sky above |
| Cornhole set | right side (col 14-15, row 27) | 2×1 | Two angled boards with bean bags. Recreation! |
| Outdoor speaker | on fence post (col 0, row 24) | 1×1 | Small Bluetooth speaker, music note particles when active |
| Cooler | near grill (col 18, row 24) | 1×1 | Red cooler with lid. Cold drinks |
| Fire pit | center-bottom (col 8-10, row 28) | 3×1 | Stone circle fire pit, warm glow + ember particles at night |
| Adirondack chairs ×3 | around fire pit | 1×1 each | Classic wooden chairs facing the pit |
| Dog bed | corner (col 1, row 28) | 1×1 | Cozy dog bed (maybe a sleeping pixel dog!) |
| Potted tree | corners | 1×1 | Small trees in large pots at patio corners |
| Sky/horizon | above fence line | — | Gradient sky: blue in day, orange at sunset, dark at night. City skyline silhouette |

### Agent Activities
- **Grilling**: Agent at BBQ, flipping burgers animation. Smoke particles rise
- **Outdoor meeting**: 2-4 agents at picnic table, tablets/papers, discussing (chat bubbles with chart icons)
- **Sunbathing/relaxing**: Agent on lounge chair, sunglasses on, idle
- **Playing cornhole**: 2 agents taking turns tossing bags. Simple arc animation
- **Fire pit hangout**: Agents in Adirondack chairs around fire. Evening activity. Warm glow
- **Petting the dog**: Agent crouches at dog bed, pet animation
- **Listening to music**: Agent near speaker, bobbing head, music notes float
- **Having a drink**: Agent opens cooler, grabs drink, sits down
- **Gardening**: Agent at planter box, watering or picking herbs

### Ambient Details
- String lights twinkle with slight random flicker
- Fire pit embers drift upward at night
- BBQ smoke drifts to the right (wind direction)
- Sky color shifts with time of day (tied to device clock)
- Trees/bushes behind fence sway slightly
- A bird occasionally sits on the fence (1-pixel detail)

---

## Transition Zones & Pathways

### Hallway / Corridor (rows 12-14, between office and kitchen/lounge)
- Short walkway connecting the main office to the lower areas
- Floor transitions from hardwood to tile
- A doorway/archway marks the transition
- Small hall table with a vase of flowers
- Fire extinguisher on wall (detail)

### Kitchen-to-Patio Door (row 22)
- Sliding glass door, open during day, closed at night
- Floor transitions from tile to wood deck
- A "step down" visual (patio is 1 pixel lower conceptually)
- A doormat outside the sliding door

---

## Day/Night System

The office has **two distinct visual modes** driven by the device's local time. Each mode is a separate set of map layers (bg + fg), not a runtime tint — this keeps pixel art crisp and intentional.

### Daytime (6 AM – 7 PM)

**Lighting**: Bright, natural light. Sun streams through windows casting light patches on floors.

| Element | Daytime Appearance |
|---------|-------------------|
| Windows | Blue sky visible, bright light spilling onto floor tiles |
| Office | Well-lit, overhead fluorescents on but unnoticeable (natural light dominates) |
| Kitchen | Warm and inviting, window above counter shows daylight, herb plants bright green |
| Lounge | Natural light from side windows, TV screen less prominent against ambient light |
| Patio | Full sun. Blue sky gradient. Umbrella casts shadow circle. Planter boxes lush. Bright deck |
| String lights | Visible but not glowing (bulbs off, just the wire) |
| Fire pit | Unlit — just the stone ring and ash |
| Monitor screens | Visible but not glowing — ambient light washes them out slightly |
| Server rack | LEDs visible but subtle — room is bright |
| Floor | Light patches under windows. Warm hardwood tones |

**Agent behavior weighting (day)**:
- 60% Main Office (working), 15% Kitchen, 15% Lounge, 10% Patio

### Nighttime (7 PM – 6 AM)

**Lighting**: Dark base with warm pools of light from lamps, monitors, string lights, fire pit.

| Element | Nighttime Appearance |
|---------|---------------------|
| Windows | Dark blue/black outside, city lights twinkling (1-2px dots), moonlight subtle |
| Office | Dark floor, bright monitor glow pools on each active desk. Server rack LEDs prominent (green/blue blink). Overhead lights emit warm downward cones |
| Kitchen | Counter has under-cabinet warm glow. Fridge has edge glow when closed. Coffee station red "ready" light visible. Window shows dark sky |
| Lounge | Floor lamp creates warm arc of light. TV screen is the dominant light source — blue/white glow on couch and floor. Arcade cabinet glows in corner |
| Patio | String lights ON — warm golden glow along each bulb, casting small light circles on deck. Fire pit LIT — orange/red glow, ember particles, warm light on surrounding chairs. Sky is dark blue/purple gradient with stars (tiny 1px white dots). City skyline has lit windows |
| String lights | Warm yellow glow, each bulb a 2-3px bright spot with 4px glow radius |
| Fire pit | Animated — orange core, ember particles drifting up, warm light radius on deck |
| Monitor screens | Bright — primary light source at desks. Blue/white glow visible on desk surface and agent face |
| Server rack | LEDs very visible — rhythmic green/blue pattern in the dark |
| Floor | Dark base. Pools of warm light under lamps, cool light under monitors |

**Agent behavior weighting (night)**:
- 30% Main Office (late grinders), 10% Kitchen, 40% Lounge (TV/chill), 20% Patio (fire pit)

### Implementation: Two Asset Sets

Rather than runtime overlays, we render two complete map layer sets:

```
assets/pixel-office/
├── day/
│   ├── office_bg_day.webp      # Background: floors, walls, sky, static objects
│   ├── office_fg_day.webp      # Foreground: upper walls, overhangs, treetops
│   └── office_objects_day.webp # Mid-layer: furniture (optional, can merge into bg)
├── night/
│   ├── office_bg_night.webp    # Same layout, dark palette + light pools baked in
│   ├── office_fg_night.webp    # Foreground with string light glow, lamp cones
│   └── office_objects_night.webp
└── characters/
    └── avatar_0-7.webp         # Characters don't change — same sprites day/night
```

**Switching logic** in `PixelOffice.tsx`:
```typescript
const hour = new Date().getHours();
const isNight = hour >= 19 || hour < 6;
const bgSource = isNight ? require('@/assets/pixel-office/night/office_bg_night.webp')
                         : require('@/assets/pixel-office/day/office_bg_day.webp');
const fgSource = isNight ? require('@/assets/pixel-office/night/office_fg_night.webp')
                         : require('@/assets/pixel-office/day/office_fg_day.webp');
```

### Particle Effects by Time

| Particle | Day | Night |
|----------|-----|-------|
| Coffee steam | Yes (kitchen) | Yes (kitchen) |
| Monitor glow | Subtle | Strong (visible light pool) |
| Fire pit embers | No (unlit) | Yes — orange dots drifting up |
| String light twinkle | No | Yes — random subtle flicker |
| Server LEDs | Subtle | Prominent blink pattern |
| Dust motes | Yes (in window light beams) | No |
| Firefly | No | Yes (patio, rare, 1-2 dots) |

---

## Debug Page

A comprehensive debug/testing page accessible from **Secret Settings** allows developers to:

### Controls
1. **Time Override**: Slider or picker to force day/night (bypasses device clock)
2. **Room Selector**: Scroll to and highlight a specific room
3. **Agent Controls**:
   - Number of agents (1-6)
   - Force all agents to a specific state (idle, working, thinking, done, error)
   - Force a specific agent to a specific activity (e.g., "Agent 2 → grilling")
   - Trigger arrival/departure animations
4. **Activity Catalog**: Grid of all available activities — tap to assign to selected agent
5. **Lighting Preview**: Toggle day ↔ night instantly
6. **Particle Preview**: Toggle individual particle systems on/off
7. **Map Overlay**: Show tile grid, interaction points, pathfinding zones

### Route
`/pixel-office-debug`

Root-level route (not in modals group). Accessible from Secret Settings → "Pixel Office Debug" item. There is also `/asset-library` for browsing pixel art assets.

---

## Full Time-of-Day Schedule (granular, for activity weighting)

| Time | Lighting Mode | Primary Activity Zone | Secondary | Notes |
|------|--------------|----------------------|-----------|-------|
| 6-8 AM | Day (sunrise warmth) | Kitchen (coffee) | Entryway (arriving) | Agents trickle in |
| 8 AM-12 PM | Day (full bright) | Main Office | Kitchen (quick coffee) | Peak productivity |
| 12-1 PM | Day (warm) | Kitchen (lunch) | Lounge | Lunch break |
| 1-5 PM | Day (standard) | Main Office | Patio (afternoon break) | Back to work |
| 5-7 PM | Day→Night transition | Lounge (wind down) | Patio (golden hour) | End of day |
| 7-10 PM | Night | Lounge (TV) | Patio (fire pit) | Evening chill |
| 10 PM-6 AM | Night (deep) | Main Office (few) | Lounge (napping) | Night owls only |

---

## Activity Distribution by State

How agents distribute across rooms based on their current state:

| Agent State | Primary Room | Secondary Room | Rare Room |
|-------------|-------------|----------------|-----------|
| Working | Main Office (desk) | — | — |
| Thinking | Main Office (whiteboard) | Patio (picnic table) | Lounge (couch) |
| Done (picks ready) | Lounge (celebrating) | Kitchen (coffee) | Patio (relaxing) |
| Idle (autopilot on, waiting) | Kitchen | Lounge | Patio |
| Off (autopilot off) | Lounge (bean bag) | Patio (lounge chair) | Kitchen (snacking) |
| Post-win | Lounge (TV/couch) | Patio (grill/fire pit) | Kitchen (celebrating) |
| Post-loss | Office (re-analyzing) | Lounge (alone on bean bag) | Patio (fire pit, quiet) |

---

## Object Interaction Points

Each interactive object has a defined "stand point" — the tile an agent moves to when interacting:

```
ENTRYWAY:
  coat_rack:    { x: 32,  y: 48,  activity: 'arriving' }
  bulletin:     { x: 0,   y: 48,  activity: 'reading' }

OFFICE:
  desk_1-6:     { x: varies, y: varies, activity: 'working' }  // 6 positions
  whiteboard:   { x: 288, y: 128, activity: 'thinking' }
  printer:      { x: 608, y: 256, activity: 'printing' }
  server_rack:  { x: 576, y: 128, activity: 'checking_servers' }

KITCHEN:
  coffee:       { x: 208, y: 448, activity: 'getting_coffee' }
  water_cooler: { x: 256, y: 512, activity: 'getting_water' }
  fridge:       { x: 0,   y: 464, activity: 'checking_fridge' }
  table_seat_1: { x: 112, y: 544, activity: 'eating' }
  table_seat_2: { x: 176, y: 544, activity: 'eating' }
  table_seat_3: { x: 112, y: 576, activity: 'socializing' }
  table_seat_4: { x: 176, y: 576, activity: 'socializing' }
  snack_shelf:  { x: 288, y: 496, activity: 'snacking' }
  microwave:    { x: 96,  y: 448, activity: 'microwaving' }

LOUNGE:
  couch_left:   { x: 368, y: 528, activity: 'watching_tv' }
  couch_center: { x: 416, y: 528, activity: 'watching_tv' }
  couch_right:  { x: 464, y: 528, activity: 'chatting' }
  bean_bag_1:   { x: 512, y: 576, activity: 'napping' }
  bean_bag_2:   { x: 544, y: 608, activity: 'reading' }
  arcade:       { x: 592, y: 608, activity: 'gaming' }
  bookshelf:    { x: 608, y: 496, activity: 'reading' }

PATIO:
  grill:        { x: 528, y: 736, activity: 'grilling' }
  picnic_seat_1:{ x: 224, y: 800, activity: 'outdoor_meeting' }
  picnic_seat_2:{ x: 352, y: 800, activity: 'outdoor_meeting' }
  lounge_chair_1:{ x: 80, y: 768, activity: 'relaxing' }
  lounge_chair_2:{ x: 160, y: 768, activity: 'relaxing' }
  cornhole:     { x: 448, y: 864, activity: 'playing' }
  fire_pit_1:   { x: 256, y: 896, activity: 'fire_hangout' }
  fire_pit_2:   { x: 320, y: 896, activity: 'fire_hangout' }
  fire_pit_3:   { x: 288, y: 928, activity: 'fire_hangout' }
  dog_bed:      { x: 32,  y: 896, activity: 'petting_dog' }
  speaker:      { x: 0,   y: 768, activity: 'listening' }
  cooler:       { x: 576, y: 768, activity: 'getting_drink' }
```

---

## Pixel Art Asset Requirements

### Map Layers (3 layers, composited)
1. **Background** (`office_bg.webp`): Floor tiles, walls, sky, all static surfaces
2. **Object layer** (`office_objects.webp`): Furniture, decorations — things characters walk behind/in front of
3. **Foreground** (`office_fg.webp`): Upper walls, overhangs, string lights, tree canopy — always renders on top

### Tile Palette
- **Office floor**: Warm hardwood (#8B7355 base, #6B5B45 shadow)
- **Kitchen floor**: Light tile (#C4B8A8 base, #A89888 grout)
- **Lounge floor**: Same hardwood as office, with rug overlay
- **Patio floor**: Weathered wood deck (#9B8B6B base, #7B6B4B gaps)
- **Walls**: Light gray (#D8D4CC) with subtle texture
- **Outdoor**: Green grass peek (#5B8B3B) behind fence, blue sky (#87CEEB → #4A90C4 gradient)

### New Sprite Animations Needed
Current: 18 animation states. Add:
- `front_coffee` / `left_coffee` — holding and sipping a mug
- `front_eat` — eating at table
- `front_celebrate` — fist pump / arms up
- `front_sad` — slumped, head down
- `front_grill` — flipping/tending grill
- `front_read` — holding book/tablet
- `front_game` — playing arcade (button presses)
- `front_sleep` — Z's, head on desk or in bean bag

---

## Summary: Object Count

| Room | Objects | Interaction Points | Agent Capacity |
|------|---------|-------------------|----------------|
| Entryway | 10 | 2 | 1-2 |
| Main Office | 20+ | 8 (6 desks + whiteboard + printer) | 6 |
| Kitchen | 15 | 8 | 4 |
| Lounge | 16 | 7 | 4 |
| Patio | 15 | 9 | 5 |
| **Total** | **~76** | **~34** | **6 simultaneously** |
