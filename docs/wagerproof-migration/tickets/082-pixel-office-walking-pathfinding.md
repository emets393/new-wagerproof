# Ticket #082 — Pixel office walking pathfinding deferred

**Status:** resolved
**Filed by:** Pixel office porter
**Filed:** 2026-05-24
**Closed:** 2026-06-07
**Affects screen / file:** `wagerproof-mobile/components/agents/PixelOffice.tsx` (lines 315-418) → `wagerproof-ios-native/Wagerproof/Features/Agents/Components/PixelOffice*.swift`

## Resolution (2026-06-07)

The full RN simulation is now ported to SpriteKit and driven from
`PixelOfficeScene.update(_:)`:

- `PixelOfficePathfinding` (in `PixelOfficeAssets.swift`) holds the 27×25
  `COLLISION_GRID`, the blocked-tile set, and an 8-directional `aStar()` with
  diagonal corner-cutting prevention — a direct port of `aStarPath()`.
- `PixelOfficePoints` builds the desk/idle/meeting `ClaimablePoint` set
  (`ALL_POINTS`) + the `byKey` lookup; the scene claims/releases points so two
  agents never target the same spot.
- Agents spawn at random IDLE/MEETING/DESK spots; a staggered (0.6 + i·0.4s)
  forced route walks each to its station, and a 5s timer churns a random
  agent's state — mirroring RN's `setInterval(5000)`.
- `stepAgents(dt:)` ports the RN `updateAgents` loop: tile-based smooth
  movement at 110 px/s, final exact-approach segment, per-segment facing →
  walk-animation-key derivation, and fps-gated frame cycling.
- Laptop open/close occupancy is keyed off the claimed desk seat, and the
  night monitor-glow particle field is ported (coffee/fire branches included
  for parity).

One intentional deviation: RN's staggered initial `setAgentState`
early-returns when the spawn state already equals the target (a no-op for real
agents), so they only drift via the 5s interval. The Swift port *forces* the
first route so agents actually walk to their stations on load.

## What we couldn't ship in scope

The RN PixelOffice runs an A* pathfinder over a 27×25 tile-grid collision map. Agents spawn at random IDLE/MEETING/DESK points, then receive staggered state assignments (`working`, `thinking`, `done`, `idle`) every 5 seconds. Each assignment claims a destination point, computes an A* path through walkable tiles, and tweens the sprite along the path at 110 px/sec with an 8-directional walk animation.

The Swift port ships the **visual office scene faithfully** — background, foreground overlay, day/night + standard/future floor swaps, per-desk laptop occupancy, 8 avatar sprite sheets with all 18 animation cycles (idle/walk/sit_idle/sit_work × 4 directions, plus done_dance and alert_jump). But it **spawns every agent directly at its assigned bullpen desk** (DESK_POINTS[0..7]) and only animates the seated sit/work/idle/done/error states in place. Walking is fully absent.

## Why

- The walking pathfinder needs the parsed 25-row collision grid (`COLLISION_GRID` in RN source), an 8-direction A* implementation with diagonal corner-cutting prevention, smooth per-tile interpolation, dynamic point claiming/releasing with collision avoidance against other agents, and per-segment facing updates tied to the walk-animation sprite keys.
- All of that infrastructure (~250 lines) lands cleanly in a follow-up because the asset pipeline, sprite-sheet cropping, animation-state machine, and SKScene scaffolding are already in place.
- Seated-only is a complete, visually-rich port for the **typical user state** (agents have generated picks today → state = `done` → seated at desk pulsing the front_done_dance anim). The "agents wandering around the office" motion only kicks in for inactive states (idle/thinking transitions).

## Impact

Agents on the iOS office never leave their assigned desks. The static composition still tells the story — "your agency is at work" — but loses the ambient motion that makes the RN scene feel alive. No data fidelity is lost; this is purely cosmetic motion.

## Acceptance criteria

- Port `aStarPath()` and `COLLISION_GRID` from PixelOffice.tsx into a `PixelOfficeNavigation.swift` helper.
- Wire `PixelOfficeAgentNode` to a per-agent state machine that picks new claimable points every 5 seconds (matching RN's `setInterval(5000)`).
- Tween sprites along the A* path with `SKAction.sequence` of `SKAction.move(to:duration:)` per waypoint.
- Update `animKey` per segment from facing direction (front/back/left/right × walk).
- Release the claimed point on departure; re-acquire on arrival.

## Linked code

- `// FIDELITY-WAIVER #082` in `Wagerproof/Features/Agents/Components/PixelOffice.swift` (top doc-comment).

## Notes

The seated-only port already exercises every other code path the walker needs: facing-direction → animation-key mapping, per-frame texture cycling, name tag updates on state change, and laptop occupancy. The walker just needs to call `PixelOfficeAgentNode.applyAnimation(_:)` mid-path and update the node's position.
