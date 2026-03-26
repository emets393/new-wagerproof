/**
 * Agent HQ v2 — Object Manifest
 *
 * Every placeable object in the pixel office with its position,
 * dimensions, and render layer. Coordinates are in map-space pixels
 * (640x960 map, 32px grid = 20x30 tiles).
 *
 * Layers:
 *  - 'bg'    → drawn after floor, before characters (under everything)
 *  - 'depth' → Y-sorted with characters (furniture characters walk behind)
 *  - 'fg'    → drawn after characters (tree canopies, overhangs)
 *
 * Room zones (for reference):
 *  - Patio:      {x:16,  y:16,  w:288, h:144}
 *  - CEO Office: {x:336, y:16,  w:288, h:224}
 *  - Hallway:    {x:288, y:160, w:64,  h:640}
 *  - Kitchen:    {x:16,  y:168, w:272, h:232}
 *  - Utility:    {x:16,  y:400, w:160, h:168}
 *  - Conference: {x:352, y:280, w:272, h:320}
 *  - Bullpen:    {x:16,  y:568, w:272, h:224}
 *  - Lobby:      {x:16,  y:800, w:608, h:80}
 *  - Path:       {x:240, y:880, w:160, h:80}
 */

export interface MapObject {
  id: string;
  asset: any; // require() reference
  x: number;  // left edge in map coords
  y: number;  // top edge in map coords
  w: number;  // width in map coords
  h: number;  // height in map coords
  layer: 'bg' | 'depth' | 'fg';
  depthY?: number; // for depth layer: Y value for sorting with characters
}

// ── Asset requires (static for Metro bundler) ──
const assets = {
  // Furniture — Patio
  lattice_fence: require('@/assets/pixel-office/objects/furniture/lattice_fence.png'),
  bean_bag_yellow: require('@/assets/pixel-office/objects/furniture/bean_bag_yellow.png'),
  // Plants
  evergreen_tree: require('@/assets/pixel-office/objects/plants/evergreen_tree.png'),
  hydrangea: require('@/assets/pixel-office/objects/plants/hydrangea.png'),
  palm_tall: require('@/assets/pixel-office/objects/plants/palm_tall.png'),
  potted_plant_small: require('@/assets/pixel-office/objects/plants/potted_plant_small.png'),
  // Furniture — Kitchen
  kitchen_counter: require('@/assets/pixel-office/objects/furniture/kitchen_counter.png'),
  dining_table: require('@/assets/pixel-office/objects/furniture/dining_table.png'),
  dining_chair: require('@/assets/pixel-office/objects/furniture/dining_chair.png'),
  water_cooler: require('@/assets/pixel-office/objects/furniture/water_cooler.png'),
  // Furniture — CEO Office
  executive_desk: require('@/assets/pixel-office/objects/furniture/executive_desk.png'),
  green_sofa: require('@/assets/pixel-office/objects/furniture/green_sofa.png'),
  coffee_table_rug: require('@/assets/pixel-office/objects/furniture/coffee_table_rug.png'),
  bookshelf: require('@/assets/pixel-office/objects/furniture/bookshelf.png'),
  tv_wall: require('@/assets/pixel-office/objects/furniture/tv_wall.png'),
  // Furniture — Conference
  conference_table: require('@/assets/pixel-office/objects/furniture/conference_table.png'),
  conference_chair: require('@/assets/pixel-office/objects/furniture/conference_chair.png'),
  whiteboard: require('@/assets/pixel-office/objects/furniture/whiteboard.png'),
  // Furniture — Bullpen
  desk_bullpen: require('@/assets/pixel-office/objects/furniture/desk_bullpen.png'),
  monitor_dual: require('@/assets/pixel-office/objects/furniture/monitor_dual.png'),
  swivel_chair: require('@/assets/pixel-office/objects/furniture/swivel_chair.png'),
  // Furniture — Utility
  printer: require('@/assets/pixel-office/objects/furniture/printer.png'),
  filing_cabinet: require('@/assets/pixel-office/objects/furniture/filing_cabinet.png'),
};

// ══════════════════════════════════════════════════════════════
// MAP LAYOUT (640x960, matching new room zone definitions)
//
// Y 16-160:   Patio (left), CEO Office (right)
// Y 160-400:  Kitchen (left), Hallway (center), CEO lower
// Y 280-600:  Conference Room (right)
// Y 400-568:  Utility (left)
// Y 568-792:  Bullpen (left)
// Y 800-880:  Lobby
// Y 880-960:  Outdoor path / grass
// ══════════════════════════════════════════════════════════════

export const MAP_OBJECTS: MapObject[] = [
  // ─── PATIO (top-left: x:16, y:16, w:288, h:144) ───
  { id: 'fence_top', asset: assets.lattice_fence, x: 24, y: 20, w: 120, h: 28, layer: 'bg' },
  { id: 'fence_top2', asset: assets.lattice_fence, x: 160, y: 20, w: 120, h: 28, layer: 'bg' },
  { id: 'bean_bag_1', asset: assets.bean_bag_yellow, x: 48, y: 56, w: 28, h: 28, layer: 'depth', depthY: 84 },
  { id: 'bean_bag_2', asset: assets.bean_bag_yellow, x: 112, y: 64, w: 28, h: 28, layer: 'depth', depthY: 92 },
  { id: 'hydrangea_1', asset: assets.hydrangea, x: 20, y: 48, w: 40, h: 40, layer: 'depth', depthY: 88 },
  { id: 'hydrangea_2', asset: assets.hydrangea, x: 200, y: 44, w: 40, h: 40, layer: 'depth', depthY: 84 },
  { id: 'palm_patio', asset: assets.palm_tall, x: 256, y: 32, w: 32, h: 56, layer: 'depth', depthY: 88 },
  { id: 'plant_patio', asset: assets.potted_plant_small, x: 160, y: 80, w: 24, h: 24, layer: 'depth', depthY: 104 },

  // ─── OUTDOOR TREES (around canvas edges) ───
  { id: 'tree_tl1', asset: assets.evergreen_tree, x: -16, y: -16, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_tl2', asset: assets.evergreen_tree, x: 48, y: -24, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_tr1', asset: assets.evergreen_tree, x: 576, y: -16, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_br1', asset: assets.evergreen_tree, x: 544, y: 888, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_br2', asset: assets.evergreen_tree, x: 480, y: 900, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_bl1', asset: assets.evergreen_tree, x: -16, y: 888, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_bl2', asset: assets.evergreen_tree, x: 56, y: 900, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_r1', asset: assets.evergreen_tree, x: 580, y: 400, w: 64, h: 64, layer: 'fg' },
  { id: 'tree_l1', asset: assets.evergreen_tree, x: -20, y: 480, w: 64, h: 64, layer: 'fg' },

  // ─── CEO OFFICE (top-right: x:336, y:16, w:288, h:224) ───
  { id: 'exec_desk', asset: assets.executive_desk, x: 384, y: 40, w: 88, h: 44, layer: 'depth', depthY: 84 },
  { id: 'ceo_sofa', asset: assets.green_sofa, x: 380, y: 112, w: 88, h: 44, layer: 'depth', depthY: 156 },
  { id: 'ceo_coffee', asset: assets.coffee_table_rug, x: 408, y: 164, w: 44, h: 44, layer: 'depth', depthY: 208 },
  { id: 'ceo_bookshelf', asset: assets.bookshelf, x: 572, y: 24, w: 44, h: 56, layer: 'depth', depthY: 80 },
  { id: 'ceo_tv', asset: assets.tv_wall, x: 508, y: 20, w: 56, h: 28, layer: 'bg' },
  { id: 'ceo_plant', asset: assets.potted_plant_small, x: 584, y: 96, w: 24, h: 24, layer: 'depth', depthY: 120 },
  { id: 'palm_ceo', asset: assets.palm_tall, x: 344, y: 24, w: 28, h: 56, layer: 'depth', depthY: 80 },

  // ─── KITCHEN / BREAK ROOM (left: x:16, y:168, w:272, h:232) ───
  { id: 'kitchen_ctr', asset: assets.kitchen_counter, x: 24, y: 176, w: 112, h: 80, layer: 'depth', depthY: 256 },
  { id: 'dtable_1', asset: assets.dining_table, x: 80, y: 288, w: 44, h: 44, layer: 'depth', depthY: 332 },
  { id: 'dchair_1', asset: assets.dining_chair, x: 64, y: 272, w: 28, h: 28, layer: 'depth', depthY: 300 },
  { id: 'dchair_2', asset: assets.dining_chair, x: 108, y: 272, w: 28, h: 28, layer: 'depth', depthY: 300 },
  { id: 'dchair_3', asset: assets.dining_chair, x: 64, y: 328, w: 28, h: 28, layer: 'depth', depthY: 356 },
  { id: 'dchair_4', asset: assets.dining_chair, x: 108, y: 328, w: 28, h: 28, layer: 'depth', depthY: 356 },
  { id: 'water_clr', asset: assets.water_cooler, x: 160, y: 200, w: 28, h: 28, layer: 'depth', depthY: 228 },
  { id: 'kitchen_plant', asset: assets.potted_plant_small, x: 248, y: 176, w: 24, h: 24, layer: 'depth', depthY: 200 },

  // ─── UTILITY ROOM (left: x:16, y:400, w:160, h:168) ───
  { id: 'printer_1', asset: assets.printer, x: 24, y: 416, w: 40, h: 40, layer: 'depth', depthY: 456 },
  { id: 'fcab_1', asset: assets.filing_cabinet, x: 72, y: 408, w: 28, h: 44, layer: 'depth', depthY: 452 },
  { id: 'fcab_2', asset: assets.filing_cabinet, x: 108, y: 408, w: 28, h: 44, layer: 'depth', depthY: 452 },
  { id: 'plant_util', asset: assets.potted_plant_small, x: 24, y: 512, w: 24, h: 24, layer: 'depth', depthY: 536 },

  // ─── CONFERENCE ROOM (right: x:352, y:280, w:272, h:320) ───
  { id: 'conf_table', asset: assets.conference_table, x: 400, y: 420, w: 112, h: 72, layer: 'depth', depthY: 492 },
  // Chairs around table
  { id: 'cc_l1', asset: assets.conference_chair, x: 372, y: 428, w: 28, h: 28, layer: 'depth', depthY: 456 },
  { id: 'cc_l2', asset: assets.conference_chair, x: 372, y: 460, w: 28, h: 28, layer: 'depth', depthY: 488 },
  { id: 'cc_r1', asset: assets.conference_chair, x: 512, y: 428, w: 28, h: 28, layer: 'depth', depthY: 456 },
  { id: 'cc_r2', asset: assets.conference_chair, x: 512, y: 460, w: 28, h: 28, layer: 'depth', depthY: 488 },
  { id: 'cc_t1', asset: assets.conference_chair, x: 416, y: 396, w: 28, h: 28, layer: 'depth', depthY: 424 },
  { id: 'cc_t2', asset: assets.conference_chair, x: 476, y: 396, w: 28, h: 28, layer: 'depth', depthY: 424 },
  { id: 'cc_b1', asset: assets.conference_chair, x: 416, y: 492, w: 28, h: 28, layer: 'depth', depthY: 520 },
  { id: 'cc_b2', asset: assets.conference_chair, x: 476, y: 492, w: 28, h: 28, layer: 'depth', depthY: 520 },
  { id: 'conf_wb', asset: assets.whiteboard, x: 360, y: 296, w: 44, h: 28, layer: 'depth', depthY: 324 },
  { id: 'conf_tv', asset: assets.tv_wall, x: 424, y: 288, w: 56, h: 28, layer: 'bg' },
  { id: 'conf_bookshelf', asset: assets.bookshelf, x: 568, y: 320, w: 44, h: 56, layer: 'depth', depthY: 376 },
  { id: 'conf_plant', asset: assets.potted_plant_small, x: 580, y: 392, w: 24, h: 24, layer: 'depth', depthY: 416 },

  // ─── BULLPEN (bottom-left: x:16, y:568, w:272, h:224) ───
  { id: 'bdesk_1', asset: assets.desk_bullpen, x: 32, y: 584, w: 88, h: 56, layer: 'depth', depthY: 640 },
  { id: 'bdesk_2', asset: assets.desk_bullpen, x: 152, y: 584, w: 88, h: 56, layer: 'depth', depthY: 640 },
  { id: 'bdesk_3', asset: assets.desk_bullpen, x: 32, y: 672, w: 88, h: 56, layer: 'depth', depthY: 728 },
  { id: 'bdesk_4', asset: assets.desk_bullpen, x: 152, y: 672, w: 88, h: 56, layer: 'depth', depthY: 728 },
  { id: 'bmon_1', asset: assets.monitor_dual, x: 52, y: 584, w: 44, h: 28, layer: 'depth', depthY: 612 },
  { id: 'bmon_2', asset: assets.monitor_dual, x: 172, y: 584, w: 44, h: 28, layer: 'depth', depthY: 612 },
  { id: 'bmon_3', asset: assets.monitor_dual, x: 52, y: 672, w: 44, h: 28, layer: 'depth', depthY: 700 },
  { id: 'bmon_4', asset: assets.monitor_dual, x: 172, y: 672, w: 44, h: 28, layer: 'depth', depthY: 700 },
  { id: 'bchair_1', asset: assets.swivel_chair, x: 60, y: 636, w: 28, h: 28, layer: 'depth', depthY: 664 },
  { id: 'bchair_2', asset: assets.swivel_chair, x: 180, y: 636, w: 28, h: 28, layer: 'depth', depthY: 664 },
  { id: 'bchair_3', asset: assets.swivel_chair, x: 60, y: 724, w: 28, h: 28, layer: 'depth', depthY: 752 },
  { id: 'bchair_4', asset: assets.swivel_chair, x: 180, y: 724, w: 28, h: 28, layer: 'depth', depthY: 752 },
];
