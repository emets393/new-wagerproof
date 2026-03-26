#!/usr/bin/env python3
"""
WagerProof Pixel Office v3 – Pokemon RPG-Style 5-Room Map Generator (640x960)

Generates high-detail pixel art matching SNES/GBA RPG interior quality.
Every surface has 3-4 color tones, dark outlines, wood grain, tile grids,
individual book spines, desk accessories, and proper 3D shading.

Rooms:
  1. Entryway     (y: 0-128)
  2. Main Office  (y: 128-448)
  3. Kitchen      (y: 448-672, left: 0-312)
  4. Lounge       (y: 448-672, right: 328-640)
  5. Patio        (y: 704-960)

Output:
  assets/pixel-office/day/office_bg_day.webp
  assets/pixel-office/day/office_fg_day.webp
  assets/pixel-office/day/office_collision.webp
  assets/pixel-office/night/office_bg_night.webp
  assets/pixel-office/night/office_fg_night.webp
"""

from PIL import Image, ImageDraw
from pathlib import Path
import math
import random

random.seed(42)

# ── Output paths ─────────────────────────────────────────────────────
OUT = Path(__file__).resolve().parent.parent / "assets" / "pixel-office"
DAY_DIR = OUT / "day"
NIGHT_DIR = OUT / "night"
for d in [DAY_DIR, NIGHT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

MAP_W, MAP_H = 640, 960

# ══════════════════════════════════════════════════════════════════════
#  COLOR PALETTES — 4 tones per material
# ══════════════════════════════════════════════════════════════════════

OUTLINE = (28, 28, 38, 255)

# Office floors (warm wood planks)
OFF_FLOOR_1 = (162, 128, 88, 255)
OFF_FLOOR_2 = (152, 118, 78, 255)
OFF_FLOOR_3 = (142, 108, 72, 255)
OFF_FLOOR_LIGHT = (175, 142, 102, 255)
OFF_FLOOR_GAP = (98, 72, 48, 255)

# Office walls (thick, dark charcoal)
OFF_WALL_TOP = (72, 72, 88, 255)
OFF_WALL_FRONT = (55, 55, 72, 255)
OFF_WALL_DARK = (42, 42, 58, 255)

# Kitchen floors (tiles with grout)
KIT_FLOOR_1 = (218, 208, 192, 255)
KIT_FLOOR_2 = (208, 198, 182, 255)
KIT_FLOOR_GROUT = (178, 168, 152, 255)
KIT_WALL = (225, 215, 195, 255)
KIT_WALL_DARK = (205, 195, 178, 255)
KIT_WALL_LIGHT = (235, 225, 208, 255)

# Lounge (blue carpet)
LNG_CARPET_1 = (82, 92, 112, 255)
LNG_CARPET_2 = (72, 82, 102, 255)
LNG_CARPET_3 = (92, 102, 122, 255)
LNG_WALL = (68, 78, 98, 255)
LNG_WALL_LIGHT = (78, 88, 108, 255)
LNG_WALL_DARK = (55, 65, 82, 255)

# Patio (wood deck + sky)
PAT_DECK_1 = (155, 132, 95, 255)
PAT_DECK_2 = (145, 122, 88, 255)
PAT_DECK_3 = (135, 112, 78, 255)
PAT_DECK_GAP = (108, 88, 62, 255)
PAT_SKY = (142, 205, 238, 255)
PAT_SKY_LIGHT = (172, 218, 242, 255)
PAT_GRASS = (82, 148, 72, 255)
PAT_GRASS_LIGHT = (98, 165, 85, 255)
PAT_GRASS_DARK = (62, 128, 55, 255)

# Entryway
ENTRY_WALL = (62, 60, 75, 255)
ENTRY_WALL_LIGHT = (72, 70, 85, 255)
ENTRY_WALL_DARK = (50, 48, 62, 255)
ENTRY_FLOOR_1 = (135, 125, 115, 255)
ENTRY_FLOOR_2 = (125, 118, 108, 255)
ENTRY_FLOOR_GROUT = (98, 92, 82, 255)

# Desk wood (4 tones)
DESK_TOP = (148, 118, 78, 255)
DESK_TOP_L = (168, 138, 98, 255)
DESK_TOP_D = (128, 98, 65, 255)
DESK_SIDE = (108, 82, 55, 255)
DESK_SIDE_D = (88, 65, 42, 255)
DESK_GRAIN = (118, 92, 62, 255)

# Monitor
MON_FRAME = (38, 38, 48, 255)
MON_BEZEL = (48, 48, 58, 255)
MON_SCREEN = (48, 172, 168, 255)
MON_SCREEN_L = (68, 195, 192, 255)
MON_SCREEN_D = (32, 142, 138, 255)
MON_STAND = (58, 58, 68, 255)

# Shelf wood (dark)
SHELF = (78, 62, 45, 255)
SHELF_L = (98, 78, 58, 255)
SHELF_D = (58, 45, 32, 255)
SHELF_INT = (42, 35, 28, 255)

# Books (10 colors for spines)
BOOK_COLORS = [
    (195, 62, 55, 255),
    (55, 85, 175, 255),
    (62, 155, 72, 255),
    (215, 185, 55, 255),
    (148, 62, 168, 255),
    (225, 128, 48, 255),
    (178, 72, 108, 255),
    (72, 148, 168, 255),
    (168, 155, 128, 255),
    (88, 88, 98, 255),
]

# Sofa
SOFA_BODY = (128, 105, 78, 255)
SOFA_L = (148, 125, 95, 255)
SOFA_D = (98, 78, 55, 255)
SOFA_CUSHION = (138, 115, 88, 255)

# Metal/appliances
METAL_1 = (205, 208, 215, 255)
METAL_2 = (185, 188, 195, 255)
METAL_3 = (155, 158, 168, 255)
METAL_D = (125, 128, 138, 255)

# Chair
CHAIR_1 = (105, 92, 78, 255)
CHAIR_2 = (88, 75, 62, 255)
CHAIR_D = (68, 58, 48, 255)

# Trees
TREE_1 = (62, 138, 65, 255)
TREE_2 = (48, 118, 52, 255)
TREE_3 = (38, 98, 42, 255)
TREE_4 = (28, 78, 35, 255)
TREE_TRUNK = (92, 68, 45, 255)
TREE_TRUNK_D = (72, 52, 35, 255)

# Accents
MUG_WHITE = (235, 232, 228, 255)
MUG_COFFEE = (118, 82, 48, 255)
KEYBOARD_BODY = (52, 52, 62, 255)
KEYBOARD_KEY = (72, 72, 82, 255)
PAPER_WHITE = (238, 235, 228, 255)
PAPER_SHADOW = (218, 212, 202, 255)
PEN_RED = (195, 62, 52, 255)
PEN_BLUE = (52, 82, 165, 255)
MOUSE_PAD = (48, 48, 62, 255)

# Plant
PLANT_POT = (158, 92, 58, 255)
PLANT_POT_D = (128, 72, 42, 255)
PLANT_POT_L = (178, 112, 75, 255)
PLANT_GREEN = (62, 138, 52, 255)
PLANT_GREEN_L = (82, 168, 65, 255)
PLANT_GREEN_D = (42, 108, 38, 255)
PLANT_GREEN_DD = (32, 82, 28, 255)

# Door
DOOR_FRAME = (78, 62, 48, 255)
DOOR_FRAME_L = (92, 75, 58, 255)
DOOR_WOOD = (138, 108, 72, 255)
DOOR_WOOD_D = (118, 88, 58, 255)

# Welcome mat
WELCOME_MAT = (148, 58, 48, 255)
WELCOME_MAT_D = (118, 42, 35, 255)
WELCOME_MAT_L = (168, 78, 62, 255)

# Vending machine
VENDING_BODY = (52, 52, 65, 255)
VENDING_BODY_L = (62, 62, 75, 255)
VENDING_GLASS = (82, 112, 128, 255)
VENDING_GLASS_L = (108, 138, 155, 255)

# Water cooler
WATER_JUG = (82, 148, 198, 255)
WATER_JUG_L = (108, 172, 218, 255)
WATER_BODY = (228, 225, 220, 255)

# Whiteboard
WHITEBOARD = (238, 235, 230, 255)
WB_FRAME = (172, 172, 180, 255)

# Clock
CLOCK_FACE = (238, 235, 228, 255)
CLOCK_RIM = (128, 108, 82, 255)

# Trash can
TRASH = (115, 118, 125, 255)
TRASH_D = (92, 95, 102, 255)
TRASH_L = (138, 142, 148, 255)

# Bean bag
BB_RED = (158, 72, 58, 255)
BB_RED_L = (178, 92, 75, 255)
BB_RED_D = (128, 55, 42, 255)
BB_BLUE = (62, 108, 158, 255)
BB_BLUE_L = (82, 128, 178, 255)
BB_BLUE_D = (48, 88, 128, 255)

# Rug
RUG_1 = (128, 82, 72, 255)
RUG_L = (148, 98, 85, 255)
RUG_D = (108, 65, 55, 255)
RUG_PAT = (162, 112, 92, 255)

# Floor lamp
LAMP_POLE = (172, 172, 180, 255)
LAMP_SHADE = (238, 222, 178, 255)
LAMP_SHADE_D = (212, 195, 155, 255)

# TV
TV_FRAME = (32, 32, 38, 255)
TV_SCREEN = (52, 108, 168, 255)
TV_SCREEN_L = (82, 138, 198, 255)

# BBQ
BBQ_BODY = (48, 48, 55, 255)
BBQ_BODY_L = (68, 68, 75, 255)
BBQ_LID = (38, 38, 45, 255)
BBQ_LEGS = (88, 88, 98, 255)

# Fire pit
FP_STONE = (132, 125, 115, 255)
FP_STONE_D = (102, 95, 85, 255)
FP_STONE_L = (152, 145, 135, 255)
FP_EMBER = (198, 108, 42, 255)
FP_BRIGHT = (255, 178, 52, 255)
FP_ASH = (58, 52, 48, 255)

# Fence
FENCE_WOOD = (142, 122, 92, 255)
FENCE_D = (112, 95, 72, 255)
FENCE_L = (162, 142, 108, 255)
FENCE_CAP = (152, 132, 102, 255)

# Umbrella
UMB_TOP = (198, 52, 42, 255)
UMB_D = (168, 42, 32, 255)
UMB_STRIPE = (228, 228, 232, 255)
UMB_POLE = (148, 148, 158, 255)

# Picnic table
PICNIC = (132, 108, 78, 255)
PICNIC_D = (112, 88, 62, 255)
PICNIC_L = (152, 128, 95, 255)

# Lounge chair
LC_FRAME = (172, 172, 180, 255)
LC_FABRIC = (232, 222, 202, 255)
LC_DARK = (202, 192, 172, 255)

# Planter box
PLANTER = (122, 98, 68, 255)
PLANTER_D = (102, 78, 52, 255)
PLANTER_L = (142, 118, 85, 255)

# String lights
SL_WIRE = (92, 85, 75, 255)
SL_BULB_DAY = (238, 228, 198, 255)
SL_BULB_NIGHT = (255, 238, 172, 255)

# Glass
GLASS_FRAME = (132, 132, 142, 255)
GLASS_PANE = (172, 198, 218, 100)
GLASS_TINT = (148, 185, 210, 80)

# Counter / Cabinets
COUNTER_TOP = (202, 192, 178, 255)
COUNTER_FRONT = (218, 210, 195, 255)
COUNTER_D = (182, 172, 158, 255)
CAB_FRONT = (192, 182, 168, 255)
CAB_D = (172, 162, 148, 255)
CAB_HANDLE = (152, 152, 162, 255)

# Sink
SINK_BASIN = (175, 180, 188, 255)
SINK_FAUCET = (172, 172, 182, 255)

# Kitchen table / chairs
KIT_TABLE = (192, 172, 142, 255)
KIT_TABLE_D = (172, 152, 122, 255)
KIT_TABLE_L = (212, 192, 162, 255)
KIT_CHAIR = (132, 112, 85, 255)
KIT_CHAIR_D = (112, 92, 68, 255)

# Coffee machine
COFFEE_M = (42, 42, 48, 255)
COFFEE_M_L = (58, 58, 65, 255)
COFFEE_RED = (218, 42, 32, 255)

# Microwave
MW_BODY = (222, 222, 228, 255)
MW_DOOR = (178, 198, 205, 255)
MW_D = (162, 162, 168, 255)

# Fridge
FRIDGE_HANDLE = (152, 152, 162, 255)

# Coffee table
CT_TOP = (112, 85, 62, 255)
CT_TOP_L = (132, 102, 75, 255)
CT_TOP_D = (92, 68, 48, 255)

# Painting
PAINT_FRAME = (112, 88, 58, 255)

# Star
STAR_C = (228, 232, 240, 255)

# Server rack
RACK_BODY = (42, 42, 52, 255)
RACK_PANEL = (52, 52, 62, 255)
RACK_L = (62, 62, 72, 255)
LED_GREEN = (52, 198, 82, 255)
LED_YELLOW = (198, 178, 52, 255)

# Checkered carpet (under desks like reference)
CHECK_1 = (68, 78, 108, 255)
CHECK_2 = (52, 62, 88, 255)
CHECK_3 = (78, 88, 118, 255)
CHECK_LINE = (42, 52, 72, 255)

# Window
WIN_FRAME = (62, 62, 78, 255)
WIN_GLASS = (148, 192, 218, 180)
WIN_GLASS_L = (172, 212, 232, 160)

# Coat rack
COAT_POLE = (82, 65, 48, 255)
COAT_HOOK = (128, 128, 138, 255)


# ══════════════════════════════════════════════════════════════════════
#  DRAWING HELPERS
# ══════════════════════════════════════════════════════════════════════

def px(d, x, y, w, h, color):
    """Draw a filled rectangle (the fundamental pixel block)."""
    if w <= 0 or h <= 0:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def lighter(c, amt=25):
    return (min(255, c[0]+amt), min(255, c[1]+amt), min(255, c[2]+amt), c[3] if len(c) > 3 else 255)


def darker(c, amt=25):
    return (max(0, c[0]-amt), max(0, c[1]-amt), max(0, c[2]-amt), c[3] if len(c) > 3 else 255)


# ── Floor textures ────────────────────────────────────────────────────

def draw_wood_floor(d, x0, y0, w, h, c1, c2, c3, c_light, c_gap, plank_h=12):
    """Draw detailed wood plank floor with grain, gaps, noise, and 3-4 tones."""
    px(d, x0, y0, w, h, c1)
    py = y0
    idx = 0
    tones = [c1, c2, c3, c1, c_light, c2]
    while py < y0 + h:
        ph = min(plank_h, y0 + h - py)
        if ph <= 0:
            break
        tone = tones[idx % len(tones)]
        px(d, x0, py, w, ph, tone)
        # Top edge highlight
        px(d, x0, py, w, 1, c_light)
        # Bottom gap (dark line between planks)
        if py + ph < y0 + h:
            px(d, x0, py + ph - 1, w, 1, c_gap)
        # Grain lines (3-5 per plank for detail)
        for _ in range(random.randint(3, 5)):
            gy = py + random.randint(2, max(3, ph - 3))
            if gy >= py + ph - 1:
                continue
            gx = x0 + random.randint(0, max(1, w // 6))
            gw = random.randint(w // 5, w * 4 // 5)
            grain_c = (c_gap[0]+15, c_gap[1]+12, c_gap[2]+8, 160)
            px(d, gx, gy, gw, 1, grain_c)
        # Secondary lighter grain lines
        for _ in range(random.randint(1, 3)):
            gy = py + random.randint(1, max(2, ph - 2))
            gx = x0 + random.randint(0, max(1, w // 3))
            gw = random.randint(w // 6, w // 2)
            px(d, gx, gy, gw, 1, lighter(tone, 6))
        # Knots (occasional, more frequent)
        if random.random() < 0.25:
            kx = x0 + random.randint(10, max(11, w - 20))
            ky = py + random.randint(2, max(3, ph - 4))
            px(d, kx, ky, 4, 3, c_gap)
            px(d, kx+1, ky+1, 2, 1, darker(c_gap, 15))
        # Pixel noise for texture (scattered individual darker/lighter pixels)
        for _ in range(w // 8):
            nx = x0 + random.randint(0, w - 1)
            ny = py + random.randint(0, max(0, ph - 2))
            if ny < y0 + h:
                nv = random.choice([-8, -5, 5, 8])
                nc = (max(0, min(255, tone[0]+nv)), max(0, min(255, tone[1]+nv)),
                      max(0, min(255, tone[2]+nv)), 255)
                d.point((nx, ny), fill=nc)
        py += plank_h
        idx += 1


def draw_tile_floor(d, x0, y0, w, h, c1, c2, c_grout, tile_size=16):
    """Draw tile floor with visible grout grid and per-tile color variation."""
    px(d, x0, y0, w, h, c1)
    for ty in range(y0, y0 + h, tile_size):
        for tx in range(x0, x0 + w, tile_size):
            tw = min(tile_size, x0 + w - tx)
            th = min(tile_size, y0 + h - ty)
            checker = ((tx - x0) // tile_size + (ty - y0) // tile_size) % 2
            base = c1 if checker == 0 else c2
            # slight random variation
            rv = random.randint(-5, 5)
            fill = (max(0, min(255, base[0]+rv)), max(0, min(255, base[1]+rv)),
                    max(0, min(255, base[2]+rv)), 255)
            px(d, tx, ty, tw, th, fill)
            # highlight top-left edge
            px(d, tx, ty, tw, 1, lighter(fill, 8))
            px(d, tx, ty, 1, th, lighter(fill, 5))
            # shadow bottom-right
            px(d, tx, ty + th - 1, tw, 1, darker(fill, 10))
            px(d, tx + tw - 1, ty, 1, th, darker(fill, 8))
        # Grout row
        if ty + tile_size <= y0 + h:
            px(d, x0, ty + tile_size - 1, w, 1, c_grout)
    # Grout columns
    for tx in range(x0 + tile_size, x0 + w, tile_size):
        px(d, tx - 1, y0, 1, h, c_grout)
    # Pixel noise for texture
    for _ in range(w * h // 40):
        nx = x0 + random.randint(0, w - 1)
        ny = y0 + random.randint(0, h - 1)
        nv = random.choice([-6, -3, 3, 6])
        nc = (max(0, min(255, c1[0]+nv)), max(0, min(255, c1[1]+nv)),
              max(0, min(255, c1[2]+nv)), 255)
        d.point((nx, ny), fill=nc)


def draw_checkered_carpet(d, x0, y0, w, h, c1, c2, c3, c_line, check_size=8):
    """Draw checkered carpet pattern like the reference desks sit on."""
    px(d, x0, y0, w, h, c1)
    for cy in range(y0, y0 + h, check_size):
        for cx in range(x0, x0 + w, check_size):
            cw = min(check_size, x0 + w - cx)
            ch = min(check_size, y0 + h - cy)
            checker = ((cx - x0) // check_size + (cy - y0) // check_size) % 2
            fill = c1 if checker == 0 else c2
            px(d, cx, cy, cw, ch, fill)
    # Grid lines
    for gx in range(x0, x0 + w, check_size):
        px(d, gx, y0, 1, h, c_line)
    for gy in range(y0, y0 + h, check_size):
        px(d, x0, gy, w, 1, c_line)
    # Border highlight
    px(d, x0, y0, w, 2, c3)
    px(d, x0, y0 + h - 2, w, 2, c_line)
    px(d, x0, y0, 2, h, c3)
    px(d, x0 + w - 2, y0, 2, h, c_line)
    # Pixel noise
    for _ in range(w * h // 30):
        nx = x0 + random.randint(0, w - 1)
        ny = y0 + random.randint(0, h - 1)
        nv = random.choice([-5, -3, 3, 5])
        base = c1
        nc = (max(0, min(255, base[0]+nv)), max(0, min(255, base[1]+nv)),
              max(0, min(255, base[2]+nv)), 255)
        d.point((nx, ny), fill=nc)


# ── Thick walls ──────────────────────────────────────────────────────

def draw_thick_wall_h(d, x, y, w, h, top_c, front_c, dark_c, baseboard=True):
    """Draw a thick horizontal wall with top face, front face, and baseboard."""
    # Outline
    px(d, x, y, w, h, OUTLINE)
    # Top face (seen from above)
    top_h = max(4, h // 3)
    px(d, x + 2, y + 2, w - 4, top_h, top_c)
    px(d, x + 2, y + 2, w - 4, 1, lighter(top_c, 12))
    # Front face
    front_h = h - top_h - 4
    px(d, x + 2, y + 2 + top_h, w - 4, front_h, front_c)
    px(d, x + 2, y + h - 3, w - 4, 1, dark_c)
    # Baseboard
    if baseboard:
        px(d, x + 2, y + h - 4, w - 4, 2, dark_c)
        px(d, x + 2, y + h - 2, w - 4, 1, OUTLINE)


def draw_thick_wall_v(d, x, y, w, h, top_c, front_c, dark_c):
    """Draw a thick vertical wall."""
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, front_c)
    px(d, x + 2, y + 2, 2, h - 4, top_c)
    px(d, x + w - 4, y + 2, 2, h - 4, dark_c)


# ── Windows ──────────────────────────────────────────────────────────

def draw_window(d, x, y, w=28, h=14):
    """Draw a window cut into a wall: frame + blue glass + highlights."""
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, WIN_FRAME)
    px(d, x + 3, y + 3, w - 6, h - 6, WIN_GLASS)
    px(d, x + 3, y + 3, w - 6, 2, WIN_GLASS_L)
    # Mullion (cross bar)
    px(d, x + w // 2 - 1, y + 3, 2, h - 6, WIN_FRAME)
    px(d, x + 3, y + h // 2, w - 6, 1, WIN_FRAME)
    # Reflection
    px(d, x + 5, y + 4, 4, 2, (198, 225, 242, 120))


# ── 3D furniture helpers ──────────────────────────────────────────────

def draw_detailed_desk(d, x, y, w=80, h=48):
    """Draw a desk with top face, front face, drawers, wood grain, dark outline."""
    top_h = 12
    front_h = h - top_h
    # 1. Dark outline
    px(d, x, y, w, h, OUTLINE)
    # 2. Top surface
    px(d, x + 2, y + 2, w - 4, top_h - 2, DESK_TOP)
    # 3. Top highlight
    px(d, x + 2, y + 2, w - 4, 2, DESK_TOP_L)
    # 4. Top shadow at bottom edge of top face
    px(d, x + 2, y + top_h - 2, w - 4, 2, DESK_TOP_D)
    # 5. Wood grain on top
    for gy in range(y + 5, y + top_h - 3, 3):
        gx = x + 4 + random.randint(0, 5)
        gw = w - 10 - random.randint(0, 10)
        px(d, gx, gy, gw, 1, DESK_GRAIN)
    # 6. Front face
    px(d, x + 2, y + top_h, w - 4, front_h - 2, DESK_SIDE)
    # 7. Front face shadow strip at bottom
    px(d, x + 2, y + h - 4, w - 4, 2, DESK_SIDE_D)
    # 8. Drawers on front face
    dw = 22
    dh = front_h - 10
    for di, dx_off in enumerate([8, w // 2 + 4]):
        dx2 = x + dx_off
        dy2 = y + top_h + 3
        px(d, dx2, dy2, dw, dh, OUTLINE)
        px(d, dx2 + 1, dy2 + 1, dw - 2, dh - 2, darker(DESK_SIDE, 8))
        px(d, dx2 + 1, dy2 + 1, dw - 2, 1, DESK_SIDE)
        # Handle
        px(d, dx2 + dw // 2 - 3, dy2 + dh // 2, 6, 2, DESK_TOP_D)
    # 9. Desk legs
    px(d, x + 3, y + h - 4, 4, 4, OUTLINE)
    px(d, x + w - 7, y + h - 4, 4, 4, OUTLINE)


def draw_monitor(d, x, y, screen_w=20, screen_h=14):
    """Draw a detailed monitor with screen content, stand, etc."""
    fw = screen_w + 4
    fh = screen_h + 4
    # Stand base
    px(d, x + fw // 2 - 6, y + fh + 3, 12, 3, OUTLINE)
    px(d, x + fw // 2 - 5, y + fh + 4, 10, 1, MON_STAND)
    # Stand neck
    px(d, x + fw // 2 - 2, y + fh, 4, 4, OUTLINE)
    px(d, x + fw // 2 - 1, y + fh + 1, 2, 2, MON_STAND)
    # Frame outline
    px(d, x, y, fw, fh, OUTLINE)
    # Bezel
    px(d, x + 1, y + 1, fw - 2, fh - 2, MON_BEZEL)
    # Screen
    px(d, x + 2, y + 2, screen_w, screen_h, MON_SCREEN)
    # Screen highlight
    px(d, x + 2, y + 2, screen_w, 1, MON_SCREEN_L)
    px(d, x + 2, y + 2, 1, screen_h, lighter(MON_SCREEN, 10))
    # Screen shadow
    px(d, x + 2, y + 2 + screen_h - 1, screen_w, 1, MON_SCREEN_D)
    # Code/content lines
    for i in range(4):
        lw = random.randint(4, screen_w - 6)
        lx = x + 3 + random.randint(0, 3)
        ly = y + 4 + i * 3
        if ly < y + 2 + screen_h - 2:
            px(d, lx, ly, lw, 1, (82, 218, 208, 255))
    # Power LED
    px(d, x + fw // 2, y + fh - 2, 2, 1, (52, 198, 82, 255))


def draw_keyboard(d, x, y):
    """Draw keyboard with individual key rectangles."""
    kw, kh = 16, 6
    px(d, x, y, kw, kh, OUTLINE)
    px(d, x + 1, y + 1, kw - 2, kh - 2, KEYBOARD_BODY)
    # Key rows
    for ky_off in range(0, 4, 2):
        for kx_off in range(0, kw - 4, 3):
            kx2 = x + 2 + kx_off
            ky2 = y + 1 + ky_off
            px(d, kx2, ky2, 2, 1, KEYBOARD_KEY)


def draw_mouse(d, x, y):
    """Draw mouse on mousepad."""
    # Pad
    px(d, x, y, 10, 12, MOUSE_PAD)
    px(d, x, y, 10, 1, lighter(MOUSE_PAD, 10))
    # Mouse body
    px(d, x + 3, y + 3, 5, 7, OUTLINE)
    px(d, x + 4, y + 4, 3, 5, METAL_1)
    px(d, x + 4, y + 4, 3, 1, lighter(METAL_1, 15))
    # Scroll wheel
    px(d, x + 5, y + 5, 1, 2, METAL_D)


def draw_mug(d, x, y):
    """Draw a coffee mug with handle."""
    px(d, x, y, 6, 7, OUTLINE)
    px(d, x + 1, y + 1, 4, 5, MUG_WHITE)
    px(d, x + 1, y + 1, 4, 1, lighter(MUG_WHITE, 10))
    px(d, x + 1, y + 1, 4, 3, MUG_COFFEE)
    # Handle
    px(d, x + 5, y + 2, 3, 4, OUTLINE)
    px(d, x + 6, y + 3, 1, 2, MUG_WHITE)


def draw_papers(d, x, y):
    """Draw stack of papers."""
    # Shadow sheet
    px(d, x + 1, y + 1, 9, 11, PAPER_SHADOW)
    # Top sheet
    px(d, x, y, 9, 11, PAPER_WHITE)
    px(d, x, y, 9, 1, lighter(PAPER_WHITE, 8))
    # Lines
    for i in range(4):
        lw = random.randint(3, 6)
        px(d, x + 1, y + 2 + i * 2, lw, 1, (195, 192, 185, 255))


def draw_pen(d, x, y, color=PEN_RED):
    px(d, x, y, 1, 9, color)
    px(d, x, y, 1, 2, OUTLINE)
    px(d, x, y + 8, 1, 1, darker(color, 30))


def draw_phone(d, x, y):
    px(d, x, y, 5, 8, OUTLINE)
    px(d, x + 1, y + 1, 3, 6, (48, 48, 58, 255))
    px(d, x + 1, y + 1, 3, 5, (72, 112, 132, 255))
    px(d, x + 1, y + 1, 3, 1, (92, 132, 152, 255))


def draw_plant(d, x, y, size=1):
    """Draw a detailed potted plant with multi-tone leaves."""
    pw = 12 * size
    ph = 10 * size
    # Pot
    pot_y = y + 8 * size
    px(d, x + 2 * size, pot_y, pw - 2 * size, ph, OUTLINE)
    px(d, x + 3 * size, pot_y + 1, pw - 4 * size, ph - 2, PLANT_POT)
    px(d, x + 3 * size, pot_y + 1, pw - 4 * size, 1 * size, PLANT_POT_L)
    px(d, x + 3 * size, pot_y + ph - 3, pw - 4 * size, 1, PLANT_POT_D)
    # Soil
    px(d, x + 4 * size, pot_y, pw - 6 * size, 2 * size, (72, 52, 38, 255))
    # Leaves (fluffy multi-tone cluster)
    cx = x + pw // 2
    cy = y + 5 * size
    offsets = [(-5, -1), (5, -1), (0, -5), (-3, -3), (3, -3),
               (-2, 2), (2, 2), (-6, 1), (6, 1), (0, -7)]
    for i, (dx_, dy_) in enumerate(offsets):
        lx = cx + dx_ * size
        ly = cy + dy_ * size
        lw = (4 + random.randint(0, 1)) * size
        lh = (3 + random.randint(0, 1)) * size
        colors = [PLANT_GREEN, PLANT_GREEN_L, PLANT_GREEN_D, PLANT_GREEN_DD]
        c = colors[i % len(colors)]
        px(d, lx, ly, lw, lh, c)
        px(d, lx, ly, lw, 1, lighter(c, 12))
    # Dark center
    px(d, cx - 1, cy - 1, 3, 3, PLANT_GREEN_DD)


def draw_chair_seat(d, x, y):
    """Draw office chair seat (top-down view). Back rendered separately in fg."""
    # Seat (round-ish)
    px(d, x + 1, y + 4, 14, 10, OUTLINE)
    px(d, x + 2, y + 5, 12, 8, CHAIR_1)
    px(d, x + 2, y + 5, 12, 2, lighter(CHAIR_1, 12))
    px(d, x + 2, y + 11, 12, 2, CHAIR_D)
    # Center pole
    px(d, x + 6, y + 12, 4, 3, OUTLINE)
    px(d, x + 7, y + 13, 2, 1, METAL_3)
    # Wheels (5 dot casters)
    for wx, wy in [(x+1, y+14), (x+13, y+14), (x+3, y+16), (x+11, y+16), (x+7, y+17)]:
        px(d, wx, wy, 2, 2, OUTLINE)


def draw_chair_back_fg(d, x, y):
    """Draw just the chair back for the foreground layer."""
    px(d, x, y, 16, 6, OUTLINE)
    px(d, x + 1, y + 1, 14, 4, CHAIR_2)
    px(d, x + 1, y + 1, 14, 1, CHAIR_1)
    px(d, x + 1, y + 4, 14, 1, CHAIR_D)


def draw_bookshelf(d, x, y, w, h, num_shelves=3):
    """Draw bookshelf with individually colored book spines and wood detail."""
    # Outer frame
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, SHELF)
    # Side highlight
    px(d, x + 2, y + 2, 2, h - 4, SHELF_L)
    # Side shadow
    px(d, x + w - 4, y + 2, 2, h - 4, SHELF_D)
    # Interior
    px(d, x + 4, y + 3, w - 8, h - 6, SHELF_INT)
    # Shelves and books
    shelf_h = (h - 6) // num_shelves
    for s in range(num_shelves):
        sy = y + 3 + s * shelf_h
        # Books
        bx = x + 5
        while bx < x + w - 6:
            bw = random.randint(3, 5)
            bh = random.randint(shelf_h - 7, shelf_h - 3)
            if bx + bw > x + w - 6:
                break
            bc = random.choice(BOOK_COLORS)
            by = sy + shelf_h - bh - 3
            px(d, bx, by, bw, bh, bc)
            # Spine highlight (left edge)
            px(d, bx, by, 1, bh, lighter(bc, 30))
            # Spine shadow (right edge)
            px(d, bx + bw - 1, by, 1, bh, darker(bc, 20))
            # Title line
            if bh > 6:
                px(d, bx + 1, by + bh // 3, bw - 2, 1, lighter(bc, 40))
            bx += bw + 1
        # Shelf plank
        plank_y = sy + shelf_h - 3
        px(d, x + 3, plank_y, w - 6, 3, SHELF)
        px(d, x + 3, plank_y, w - 6, 1, SHELF_L)
        px(d, x + 3, plank_y + 2, w - 6, 1, SHELF_D)
    # Top cap
    px(d, x + 2, y + 2, w - 4, 2, SHELF_L)


def draw_vending_machine(d, x, y):
    """Draw vending machine with colored item rows behind glass."""
    w, h = 28, 56
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, VENDING_BODY)
    # Highlight
    px(d, x + 2, y + 2, w - 4, 2, VENDING_BODY_L)
    # Glass window
    px(d, x + 3, y + 5, w - 6, 32, OUTLINE)
    px(d, x + 4, y + 6, w - 8, 30, VENDING_GLASS)
    px(d, x + 4, y + 6, w - 8, 2, VENDING_GLASS_L)
    # Items
    item_colors = [(198, 52, 42, 255), (42, 128, 198, 255),
                   (52, 168, 62, 255), (198, 178, 52, 255),
                   (198, 108, 48, 255), (148, 62, 168, 255)]
    for row in range(4):
        for col in range(3):
            ic = item_colors[(row + col) % len(item_colors)]
            ix = x + 6 + col * 6
            iy = y + 9 + row * 7
            px(d, ix, iy, 4, 5, ic)
            px(d, ix, iy, 4, 1, lighter(ic, 30))
            px(d, ix, iy + 4, 4, 1, darker(ic, 20))
    # Coin slot
    px(d, x + 5, y + 40, w - 10, 10, darker(VENDING_BODY, 12))
    px(d, x + 9, y + 42, 4, 5, METAL_2)
    px(d, x + 9, y + 42, 4, 1, METAL_1)
    # Dispenser
    px(d, x + 5, y + h - 8, w - 10, 5, (28, 28, 35, 255))
    # Top highlight
    px(d, x + 2, y + 2, w - 4, 1, lighter(VENDING_BODY_L, 10))


def draw_water_cooler(d, x, y):
    """Draw water cooler with jug."""
    # Body
    px(d, x, y + 12, 16, 24, OUTLINE)
    px(d, x + 1, y + 13, 14, 22, WATER_BODY)
    px(d, x + 1, y + 13, 14, 1, lighter(WATER_BODY, 8))
    px(d, x + 1, y + 33, 14, 2, darker(WATER_BODY, 15))
    # Jug
    px(d, x + 2, y, 12, 14, OUTLINE)
    px(d, x + 3, y + 1, 10, 12, WATER_JUG)
    px(d, x + 3, y + 1, 10, 2, WATER_JUG_L)
    px(d, x + 3, y + 11, 10, 2, darker(WATER_JUG, 15))
    # Neck
    px(d, x + 5, y + 12, 6, 3, WATER_JUG)
    # Spigots
    px(d, x + 4, y + 20, 4, 3, (198, 52, 42, 255))
    px(d, x + 9, y + 20, 4, 3, (52, 82, 168, 255))


def draw_whiteboard(d, x, y, w=54, h=30):
    """Draw whiteboard with frame and scribble content."""
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, WB_FRAME)
    px(d, x + 4, y + 4, w - 8, h - 8, WHITEBOARD)
    px(d, x + 4, y + 4, w - 8, 1, lighter(WHITEBOARD, 5))
    # Scribbles
    colors = [PEN_RED, PEN_BLUE, (42, 148, 52, 255), OUTLINE]
    for i in range(6):
        c = colors[i % len(colors)]
        sx = x + 6 + random.randint(0, max(1, w - 22))
        sy = y + 6 + random.randint(0, max(1, h - 18))
        sw = random.randint(8, 22)
        px(d, sx, sy, sw, 1, c)
    # Marker tray
    px(d, x + 12, y + h - 5, w - 24, 4, WB_FRAME)
    px(d, x + 12, y + h - 5, w - 24, 1, lighter(WB_FRAME, 10))
    # Markers in tray
    for mi in range(3):
        mc = colors[mi]
        px(d, x + 15 + mi * 8, y + h - 4, 5, 2, mc)


def draw_clock(d, x, y):
    """Draw wall clock."""
    # Approximate circle
    px(d, x + 2, y, 8, 12, OUTLINE)
    px(d, x, y + 2, 12, 8, OUTLINE)
    px(d, x + 1, y + 1, 10, 10, OUTLINE)
    # Face
    px(d, x + 2, y + 1, 8, 10, CLOCK_FACE)
    px(d, x + 1, y + 2, 10, 8, CLOCK_FACE)
    # Hands
    px(d, x + 5, y + 2, 1, 4, OUTLINE)
    px(d, x + 6, y + 5, 3, 1, OUTLINE)
    # Center
    px(d, x + 5, y + 5, 2, 2, OUTLINE)
    # Tick marks
    px(d, x + 5, y + 1, 2, 1, CLOCK_RIM)
    px(d, x + 5, y + 10, 2, 1, CLOCK_RIM)
    px(d, x + 1, y + 5, 1, 2, CLOCK_RIM)
    px(d, x + 10, y + 5, 1, 2, CLOCK_RIM)


def draw_trash_can(d, x, y):
    """Draw trash can with rim and shadow."""
    px(d, x, y, 10, 12, OUTLINE)
    px(d, x + 1, y + 2, 8, 9, TRASH)
    px(d, x + 1, y + 2, 8, 1, TRASH_L)
    px(d, x + 1, y + 9, 8, 2, TRASH_D)
    # Rim
    px(d, x, y, 10, 3, OUTLINE)
    px(d, x + 1, y + 1, 8, 1, METAL_2)


def draw_painting(d, x, y, w=20, h=16):
    """Draw framed painting with abstract art."""
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 1, y + 1, w - 2, h - 2, PAINT_FRAME)
    px(d, x + 3, y + 3, w - 6, h - 6, (72, 108, 148, 255))
    for _ in range(4):
        pc = random.choice(BOOK_COLORS)
        px_ = x + 4 + random.randint(0, max(1, w - 12))
        py_ = y + 4 + random.randint(0, max(1, h - 10))
        px(d, px_, py_, random.randint(3, 6), random.randint(2, 4), pc)


def draw_tree(d, x, y, w=32, h=40):
    """Draw a multi-tone tree with round fluffy shape using ellipses and trunk."""
    # Trunk
    trunk_w = 6
    trunk_x = x + w // 2 - trunk_w // 2
    trunk_h = h // 3
    trunk_y = y + h - trunk_h
    px(d, trunk_x, trunk_y, trunk_w, trunk_h, OUTLINE)
    px(d, trunk_x + 1, trunk_y + 1, trunk_w - 2, trunk_h - 2, TREE_TRUNK)
    px(d, trunk_x + 1, trunk_y + 1, 1, trunk_h - 2, lighter(TREE_TRUNK, 12))
    px(d, trunk_x + trunk_w - 2, trunk_y + 1, 1, trunk_h - 2, TREE_TRUNK_D)
    # Canopy using ellipses for round/fluffy shape
    cx = x + w // 2
    cy = y + h * 2 // 5
    rw = w // 2
    rh = h // 3
    # Dark outline ellipse (largest)
    d.ellipse([cx - rw - 2, cy - rh - 2, cx + rw + 2, cy + rh + 2], fill=OUTLINE)
    # Layered green ellipses (dark to light, smaller each time)
    for shrink, color in [(0, TREE_4), (2, TREE_3), (4, TREE_2), (7, TREE_1)]:
        d.ellipse([cx - rw + shrink, cy - rh + shrink,
                   cx + rw - shrink, cy + rh - shrink], fill=color)
    # Sub-canopy blobs for fluffy look
    for bx_off, by_off, br in [(-rw//2, -rh//3, rw//2), (rw//2, -rh//3, rw//2),
                                 (0, -rh//2, rw//3), (-rw//3, rh//4, rw//3),
                                 (rw//3, rh//4, rw//3)]:
        bcx = cx + bx_off
        bcy = cy + by_off
        d.ellipse([bcx - br, bcy - br//2 - 1, bcx + br, bcy + br//2 + 1], fill=OUTLINE)
        d.ellipse([bcx - br + 1, bcy - br//2, bcx + br - 1, bcy + br//2], fill=TREE_3)
        d.ellipse([bcx - br + 2, bcy - br//2 + 1, bcx + br - 2, bcy + br//2 - 1],
                  fill=TREE_2 if by_off < 0 else TREE_3)
    # Light dapples on top
    for _ in range(6):
        lx = cx + random.randint(-rw // 2, rw // 2)
        ly = cy + random.randint(-rh // 2, rh // 3)
        px(d, lx, ly, 3, 2, lighter(TREE_1, 18))
        px(d, lx + 1, ly - 1, 2, 1, lighter(TREE_1, 25))


def draw_fence(d, x, y, w, h):
    """Draw wooden fence with slats, rails, and post caps."""
    # Horizontal rails
    for ry in [y + 4, y + h - 6]:
        px(d, x, ry, w, 4, OUTLINE)
        px(d, x + 1, ry + 1, w - 2, 2, FENCE_WOOD)
    # Vertical slats
    for sx in range(x, x + w, 12):
        sw = 8
        px(d, sx, y, sw, h, OUTLINE)
        px(d, sx + 1, y + 1, sw - 2, h - 2, FENCE_WOOD)
        px(d, sx + 1, y + 1, 1, h - 2, FENCE_L)
        px(d, sx + sw - 2, y + 1, 1, h - 2, FENCE_D)
        # Wood grain
        px(d, sx + 2, y + h // 3, sw - 4, 1, FENCE_D)
        px(d, sx + 2, y + 2 * h // 3, sw - 4, 1, FENCE_D)
        # Post cap (pointed top)
        px(d, sx + 1, y, sw - 2, 2, FENCE_CAP)


def draw_glass_partition(d, x, y, w, h):
    """Draw glass partition wall with frame."""
    # Frame
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, h - 4, GLASS_FRAME)
    # Glass panes
    px(d, x + 3, y + 3, w - 6, h - 6, GLASS_TINT)
    # Mullions
    mid = x + w // 2
    px(d, mid - 1, y + 3, 2, h - 6, GLASS_FRAME)
    # Reflections
    px(d, x + 5, y + 4, 6, 2, (188, 212, 228, 60))
    px(d, mid + 3, y + 5, 4, 2, (188, 212, 228, 50))


# ── Ceiling lamp ──────────────────────────────────────────────────────

def draw_ceiling_lamp(d, x, y):
    """Draw ceiling lamp fixture on wall (dome shape)."""
    # Mount plate
    px(d, x + 3, y, 6, 3, OUTLINE)
    px(d, x + 4, y + 1, 4, 1, METAL_2)
    # Chain/rod
    px(d, x + 5, y + 3, 2, 4, OUTLINE)
    px(d, x + 5, y + 3, 1, 4, METAL_3)
    # Shade (dome)
    px(d, x, y + 7, 12, 6, OUTLINE)
    px(d, x + 1, y + 8, 10, 4, LAMP_SHADE)
    px(d, x + 1, y + 8, 10, 1, lighter(LAMP_SHADE, 12))
    px(d, x + 1, y + 11, 10, 1, LAMP_SHADE_D)
    # Bulb
    px(d, x + 4, y + 12, 4, 2, (255, 248, 218, 255))


# ══════════════════════════════════════════════════════════════════════
#  ROOM DRAWING FUNCTIONS
# ══════════════════════════════════════════════════════════════════════

def draw_entryway(d):
    """Draw entryway: y 0-128."""
    # Thick top wall (16px)
    draw_thick_wall_h(d, 0, 0, 640, 20, ENTRY_WALL_LIGHT, ENTRY_WALL, ENTRY_WALL_DARK)

    # Door opening in wall (double door frame)
    door_x = 270
    door_w = 100
    # Clear door area
    px(d, door_x, 0, door_w, 20, (82, 78, 92, 255))
    # Door frame pillars
    px(d, door_x, 0, 8, 20, OUTLINE)
    px(d, door_x + 1, 1, 6, 18, DOOR_FRAME)
    px(d, door_x + 1, 1, 6, 2, DOOR_FRAME_L)
    px(d, door_x + door_w - 8, 0, 8, 20, OUTLINE)
    px(d, door_x + door_w - 7, 1, 6, 18, DOOR_FRAME)
    px(d, door_x + door_w - 7, 1, 6, 2, DOOR_FRAME_L)
    # Door panels (open inward)
    px(d, door_x + 10, 2, 35, 16, DOOR_WOOD)
    px(d, door_x + 10, 2, 35, 2, lighter(DOOR_WOOD, 12))
    px(d, door_x + 10, 16, 35, 2, DOOR_WOOD_D)
    # Handle
    px(d, door_x + 42, 9, 3, 4, (198, 178, 108, 255))
    # Second door panel
    px(d, door_x + 55, 2, 35, 16, DOOR_WOOD)
    px(d, door_x + 55, 2, 35, 2, lighter(DOOR_WOOD, 12))
    px(d, door_x + 55, 16, 35, 2, DOOR_WOOD_D)
    px(d, door_x + 57, 9, 3, 4, (198, 178, 108, 255))

    # Floor (transition tile)
    draw_tile_floor(d, 0, 20, 640, 106, ENTRY_FLOOR_1, ENTRY_FLOOR_2,
                    ENTRY_FLOOR_GROUT, 16)

    # Welcome mat with pattern
    mx, my = 285, 40
    mw, mh = 70, 24
    px(d, mx, my, mw, mh, OUTLINE)
    px(d, mx + 1, my + 1, mw - 2, mh - 2, WELCOME_MAT)
    px(d, mx + 1, my + 1, mw - 2, 2, WELCOME_MAT_L)
    px(d, mx + 1, my + mh - 3, mw - 2, 2, WELCOME_MAT_D)
    # Text-like pattern
    for i in range(5):
        px(d, mx + 8 + i * 10, my + 8, 7, 2, WELCOME_MAT_D)
        px(d, mx + 10 + i * 10, my + 12, 5, 2, WELCOME_MAT_D)

    # Side table with plant (left)
    draw_detailed_desk_small(d, 20, 30, 44, 32)
    draw_plant(d, 28, 4, 2)

    # Coat rack (right)
    crx = 575
    px(d, crx + 2, 10, 4, 60, OUTLINE)
    px(d, crx + 3, 11, 2, 58, COAT_POLE)
    # Hooks
    for hy in [22, 34]:
        px(d, crx - 2, hy, 4, 2, OUTLINE)
        px(d, crx - 1, hy, 2, 1, COAT_HOOK)
        px(d, crx + 6, hy, 4, 2, OUTLINE)
        px(d, crx + 7, hy, 2, 1, COAT_HOOK)
    # Hat on hook
    px(d, crx - 4, 18, 10, 5, (82, 62, 48, 255))
    px(d, crx - 3, 16, 8, 3, (92, 72, 55, 255))
    # Jacket
    px(d, crx + 5, 28, 6, 12, (68, 82, 108, 255))

    # Paintings
    draw_painting(d, 80, 2, 24, 16)
    draw_painting(d, 460, 2, 20, 14)

    # Small decorative table (right side)
    draw_detailed_desk_small(d, 520, 40, 38, 28)
    # Vase on it
    px(d, 530, 28, 8, 12, OUTLINE)
    px(d, 531, 29, 6, 10, (148, 128, 172, 255))
    px(d, 531, 29, 6, 2, (168, 148, 192, 255))
    # Flowers
    for fx, fy in [(532, 22), (535, 20), (534, 24)]:
        px(d, fx, fy, 3, 3, (218, 82, 72, 255))
        px(d, fx, fy + 3, 1, 5, PLANT_GREEN_D)

    # Bottom divider wall
    draw_thick_wall_h(d, 0, 112, 640, 16, ENTRY_WALL_LIGHT, ENTRY_WALL,
                      ENTRY_WALL_DARK, baseboard=False)
    # Doorway opening in bottom wall
    px(d, 270, 112, 100, 16, ENTRY_FLOOR_1)


def draw_detailed_desk_small(d, x, y, w=44, h=32):
    """Small side table/desk."""
    top_h = 8
    px(d, x, y, w, h, OUTLINE)
    px(d, x + 2, y + 2, w - 4, top_h - 2, DESK_TOP)
    px(d, x + 2, y + 2, w - 4, 2, DESK_TOP_L)
    px(d, x + 2, y + top_h - 2, w - 4, 2, DESK_TOP_D)
    # Grain
    for gy in range(y + 4, y + top_h - 2, 2):
        px(d, x + 4, gy, w - 8, 1, DESK_GRAIN)
    px(d, x + 2, y + top_h, w - 4, h - top_h - 2, DESK_SIDE)
    px(d, x + 2, y + h - 4, w - 4, 2, DESK_SIDE_D)
    # Legs
    px(d, x + 3, y + h - 3, 3, 3, OUTLINE)
    px(d, x + w - 6, y + h - 3, 3, 3, OUTLINE)


def draw_office(d):
    """Draw main office: y 128-448."""
    y0 = 128
    office_h = 320

    # Back wall (thick, 20px)
    draw_thick_wall_h(d, 0, y0, 640, 20, OFF_WALL_TOP, OFF_WALL_FRONT, OFF_WALL_DARK)

    # Windows in wall
    for wx in [160, 300, 440]:
        draw_window(d, wx, y0 + 2, 32, 16)

    # Floor (wood planks)
    draw_wood_floor(d, 0, y0 + 20, 640, office_h - 20,
                    OFF_FLOOR_1, OFF_FLOOR_2, OFF_FLOOR_3, OFF_FLOOR_LIGHT,
                    OFF_FLOOR_GAP, 14)

    # Checkered carpet areas under desk groups (like reference)
    draw_checkered_carpet(d, 14, y0 + 92, 200, 200, CHECK_1, CHECK_2, CHECK_3, CHECK_LINE, 8)
    draw_checkered_carpet(d, 316, y0 + 92, 200, 200, CHECK_1, CHECK_2, CHECK_3, CHECK_LINE, 8)

    # Wall decorations
    draw_bookshelf(d, 6, y0 + 2, 44, 18, 1)
    draw_bookshelf(d, 54, y0 + 2, 38, 18, 1)
    draw_bookshelf(d, 552, y0 + 2, 38, 18, 1)
    draw_bookshelf(d, 594, y0 + 2, 40, 18, 1)
    draw_whiteboard(d, 250, y0 + 1, 60, 18)
    draw_clock(d, 218, y0 + 3)
    draw_painting(d, 105, y0 + 2, 22, 16)
    draw_painting(d, 400, y0 + 2, 22, 16)
    # Ceiling lamps
    draw_ceiling_lamp(d, 110, y0 + 2)
    draw_ceiling_lamp(d, 420, y0 + 2)
    draw_ceiling_lamp(d, 520, y0 + 2)

    # ── 6 desks (2 rows of 3) ──
    desk_positions = []
    # Left block: 3 desks
    for i, dy in enumerate([y0 + 110, y0 + 175, y0 + 240]):
        dx = 30
        desk_positions.append((dx, dy))
    # Right block: 3 desks
    for i, dy in enumerate([y0 + 110, y0 + 175, y0 + 240]):
        dx = 332
        desk_positions.append((dx, dy))

    for i, (dx, dy) in enumerate(desk_positions):
        # Chair seat (behind desk)
        draw_chair_seat(d, dx + 32, dy - 22)
        # Desk
        draw_detailed_desk(d, dx, dy, 80, 48)
        # Monitor
        draw_monitor(d, dx + 28, dy - 20, 20, 14)
        # Keyboard
        draw_keyboard(d, dx + 24, dy + 3)
        # Mouse + pad
        draw_mouse(d, dx + 58, dy + 2)
        # Mug
        draw_mug(d, dx + 6, dy + 3)
        # Accessories vary per desk
        acc = i % 5
        if acc == 0:
            draw_papers(d, dx + 44, dy + 2)
        elif acc == 1:
            draw_pen(d, dx + 46, dy + 3, PEN_RED)
            draw_pen(d, dx + 49, dy + 2, PEN_BLUE)
        elif acc == 2:
            draw_phone(d, dx + 15, dy + 3)
        elif acc == 3:
            draw_papers(d, dx + 15, dy + 2)
            draw_pen(d, dx + 70, dy + 3)
        else:
            draw_mug(d, dx + 45, dy + 3)

    # Dual monitor desks
    draw_monitor(d, desk_positions[0][0] + 52, desk_positions[0][1] - 18, 18, 12)
    draw_monitor(d, desk_positions[4][0] + 52, desk_positions[4][1] - 18, 18, 12)

    # Vending machine (right wall)
    draw_vending_machine(d, 604, y0 + 30)

    # Water cooler
    draw_water_cooler(d, 530, y0 + 40)

    # Server rack
    rx, ry = 130, y0 + 28
    px(d, rx, ry, 24, 48, OUTLINE)
    px(d, rx + 2, ry + 2, 20, 44, RACK_BODY)
    for rr in range(6):
        ry2 = ry + 4 + rr * 7
        px(d, rx + 3, ry2, 18, 5, RACK_PANEL)
        px(d, rx + 3, ry2, 18, 1, RACK_L)
        px(d, rx + 17, ry2 + 2, 2, 2, LED_GREEN)
        if rr % 2 == 0:
            px(d, rx + 14, ry2 + 2, 2, 2, LED_YELLOW)

    # Plants
    draw_plant(d, 160, y0 + 30, 2)
    draw_plant(d, 520, y0 + 270, 2)
    draw_plant(d, 240, y0 + 270, 1)
    draw_plant(d, 6, y0 + 280, 1)
    draw_plant(d, 626, y0 + 280, 1)

    # Trash cans
    draw_trash_can(d, 120, y0 + 150)
    draw_trash_can(d, 440, y0 + 210)

    # Low storage cabinets / shelving between desk groups (like reference)
    for scx in [220, 522]:
        for scy in [y0 + 100, y0 + 170]:
            # 3D cabinet with green/colored front
            px(d, scx, scy, 90, 28, OUTLINE)
            px(d, scx + 2, scy + 2, 86, 8, SHELF_L)
            px(d, scx + 2, scy + 2, 86, 2, lighter(SHELF_L, 10))
            px(d, scx + 2, scy + 10, 86, 16, SHELF)
            px(d, scx + 2, scy + 24, 86, 2, SHELF_D)
            # Cabinet doors (alternating colors like reference)
            cab_colors = [(108, 148, 72, 255), (128, 168, 88, 255),
                          (92, 128, 62, 255)]
            for ci in range(3):
                cx2 = scx + 4 + ci * 28
                px(d, cx2, scy + 12, 24, 12, OUTLINE)
                cc = cab_colors[ci % 3]
                px(d, cx2 + 1, scy + 13, 22, 10, cc)
                px(d, cx2 + 1, scy + 13, 22, 1, lighter(cc, 15))
                px(d, cx2 + 1, scy + 21, 22, 2, darker(cc, 15))

    # Light circles on floor from ceiling lamps
    for clx in [110, 420, 520]:
        d.ellipse([clx - 15, y0 + 30, clx + 27, y0 + 55],
                  fill=lighter(OFF_FLOOR_1, 6))

    # Hallway divider at bottom
    draw_thick_wall_h(d, 0, y0 + office_h - 16, 640, 16, ENTRY_WALL_LIGHT,
                      ENTRY_WALL, ENTRY_WALL_DARK, baseboard=False)
    # Doorway openings
    px(d, 150, y0 + office_h - 16, 80, 16, OFF_FLOOR_1)
    px(d, 400, y0 + office_h - 16, 80, 16, OFF_FLOOR_1)


def draw_kitchen(d):
    """Draw kitchen: y 448-672, x 0-312."""
    x0, y0, w, h = 0, 448, 312, 224

    # Top wall (thick)
    draw_thick_wall_h(d, x0, y0, w, 20, KIT_WALL_LIGHT, KIT_WALL, KIT_WALL_DARK)

    # Tile floor
    draw_tile_floor(d, x0, y0 + 20, w, h - 20, KIT_FLOOR_1, KIT_FLOOR_2,
                    KIT_FLOOR_GROUT, 16)

    # Overhead shelves on wall
    for si in range(2):
        sx = x0 + 8 + si * 85
        px(d, sx, y0 + 2, 55, 16, OUTLINE)
        px(d, sx + 1, y0 + 3, 53, 14, SHELF)
        px(d, sx + 1, y0 + 3, 53, 1, SHELF_L)
        px(d, sx + 1, y0 + 15, 53, 2, SHELF_D)
        # Mugs/dishes
        for mi in range(4):
            mx = sx + 4 + mi * 12
            px(d, mx, y0 + 6, 6, 8, MUG_WHITE)
            px(d, mx, y0 + 6, 6, 1, lighter(MUG_WHITE, 8))
            px(d, mx, y0 + 13, 6, 1, darker(MUG_WHITE, 15))

    # L-shaped counter along back wall
    counter_y = y0 + 16
    # Horizontal counter
    cnt_w = 195
    px(d, x0 + 4, counter_y, cnt_w, 28, OUTLINE)
    px(d, x0 + 6, counter_y + 2, cnt_w - 4, 8, COUNTER_TOP)
    px(d, x0 + 6, counter_y + 2, cnt_w - 4, 2, lighter(COUNTER_TOP, 10))
    px(d, x0 + 6, counter_y + 8, cnt_w - 4, 2, COUNTER_D)
    # Front face
    px(d, x0 + 6, counter_y + 10, cnt_w - 4, 16, COUNTER_FRONT)
    px(d, x0 + 6, counter_y + 24, cnt_w - 4, 2, darker(COUNTER_FRONT, 15))
    # Cabinets below
    for ci in range(3):
        cx = x0 + 10 + ci * 60
        cab_w = 50
        px(d, cx, counter_y + 12, cab_w, 14, OUTLINE)
        px(d, cx + 1, counter_y + 13, cab_w - 2, 12, CAB_FRONT)
        px(d, cx + 1, counter_y + 13, cab_w - 2, 1, lighter(CAB_FRONT, 10))
        px(d, cx + 1, counter_y + 23, cab_w - 2, 2, CAB_D)
        # Handle
        px(d, cx + cab_w // 2 - 3, counter_y + 18, 6, 2, CAB_HANDLE)

    # Sink
    px(d, x0 + 65, counter_y + 3, 26, 6, OUTLINE)
    px(d, x0 + 66, counter_y + 4, 24, 4, SINK_BASIN)
    px(d, x0 + 66, counter_y + 4, 24, 1, lighter(SINK_BASIN, 10))
    # Faucet
    px(d, x0 + 76, counter_y - 4, 4, 7, SINK_FAUCET)
    px(d, x0 + 73, counter_y - 5, 10, 2, SINK_FAUCET)

    # Coffee machine
    cmx = x0 + 145
    px(d, cmx, counter_y - 12, 16, 14, OUTLINE)
    px(d, cmx + 1, counter_y - 11, 14, 12, COFFEE_M)
    px(d, cmx + 1, counter_y - 11, 14, 1, COFFEE_M_L)
    px(d, cmx + 12, counter_y - 5, 2, 2, COFFEE_RED)
    px(d, cmx + 3, counter_y, 10, 3, (32, 32, 38, 255))

    # Microwave
    mwx = x0 + 105
    px(d, mwx, counter_y - 12, 20, 14, OUTLINE)
    px(d, mwx + 1, counter_y - 11, 18, 12, MW_BODY)
    px(d, mwx + 2, counter_y - 10, 12, 10, MW_DOOR)
    px(d, mwx + 2, counter_y - 10, 12, 1, lighter(MW_DOOR, 10))
    px(d, mwx + 15, counter_y - 8, 2, 5, (42, 42, 48, 255))

    # Fridge
    fx, fy = x0 + 252, y0 + 8
    px(d, fx, fy, 36, 68, OUTLINE)
    px(d, fx + 2, fy + 2, 32, 64, METAL_2)
    px(d, fx + 2, fy + 2, 32, 2, METAL_1)
    px(d, fx + 2, fy + 64, 32, 2, METAL_D)
    # Split line
    px(d, fx + 2, fy + 32, 32, 2, METAL_D)
    # Handles
    px(d, fx + 30, fy + 10, 2, 20, FRIDGE_HANDLE)
    px(d, fx + 30, fy + 36, 2, 24, FRIDGE_HANDLE)
    # Ice dispenser
    px(d, fx + 6, fy + 12, 12, 8, darker(METAL_2, 10))
    px(d, fx + 6, fy + 12, 12, 1, METAL_2)

    # Kitchen table (center)
    tx, ty = x0 + 90, y0 + 120
    # Table
    px(d, tx, ty, 68, 40, OUTLINE)
    px(d, tx + 2, ty + 2, 64, 10, KIT_TABLE)
    px(d, tx + 2, ty + 2, 64, 2, KIT_TABLE_L)
    px(d, tx + 2, ty + 10, 64, 2, KIT_TABLE_D)
    px(d, tx + 2, ty + 12, 64, 26, KIT_TABLE_D)
    px(d, tx + 2, ty + 36, 64, 2, darker(KIT_TABLE_D, 12))
    # Legs
    px(d, tx + 5, ty + 36, 4, 6, OUTLINE)
    px(d, tx + 59, ty + 36, 4, 6, OUTLINE)
    # 4 chairs
    for cx_, cy_ in [(tx - 16, ty + 8), (tx + 70, ty + 8),
                     (tx + 22, ty - 16), (tx + 22, ty + 42)]:
        px(d, cx_, cy_, 14, 14, OUTLINE)
        px(d, cx_ + 1, cy_ + 1, 12, 12, KIT_CHAIR)
        px(d, cx_ + 1, cy_ + 1, 12, 2, lighter(KIT_CHAIR, 12))
        px(d, cx_ + 1, cy_ + 11, 12, 2, KIT_CHAIR_D)
    # Items on table
    draw_mug(d, tx + 10, ty + 3)
    draw_mug(d, tx + 48, ty + 3)
    px(d, tx + 25, ty + 4, 14, 5, PAPER_WHITE)

    # Trash can
    draw_trash_can(d, x0 + 230, y0 + 170)

    # Small plant
    draw_plant(d, x0 + 18, y0 + 180, 1)

    # Water cooler
    draw_water_cooler(d, x0 + 210, y0 + 86)

    # Glass partition along bottom of counter area
    draw_glass_partition(d, x0 + 4, y0 + 48, 80, 8)

    # Additional detail: fruit bowl on table
    px(d, tx + 30, ty + 3, 10, 6, OUTLINE)
    px(d, tx + 31, ty + 4, 8, 4, (228, 218, 188, 255))
    px(d, tx + 33, ty + 4, 3, 3, (198, 42, 38, 255))  # apple
    px(d, tx + 37, ty + 5, 3, 2, (215, 185, 42, 255))  # banana

    # Ceiling lamp in kitchen
    draw_ceiling_lamp(d, x0 + 140, y0 + 2)

    # Right wall divider (thick)
    draw_thick_wall_v(d, 306, y0, 6, h, OFF_WALL_TOP, OFF_WALL_FRONT, OFF_WALL_DARK)
    # Doorway in divider
    px(d, 306, y0 + 80, 6, 60, KIT_FLOOR_1)


def draw_lounge(d):
    """Draw lounge: y 448-672, x 328-640."""
    x0, y0, w, h = 328, 448, 312, 224

    # Top wall (thick)
    draw_thick_wall_h(d, x0, y0, w, 20, LNG_WALL_LIGHT, LNG_WALL, LNG_WALL_DARK)

    # Carpet floor with subtle pattern
    px(d, x0, y0 + 20, w, h - 20, LNG_CARPET_1)
    # Pattern: subtle checkerboard
    for cy in range(y0 + 20, y0 + h, 6):
        for cx in range(x0, x0 + w, 6):
            cw = min(6, x0 + w - cx)
            ch = min(6, y0 + h - cy)
            checker = ((cx - x0) // 6 + (cy - y0) // 6) % 2
            if checker:
                px(d, cx, cy, cw, ch, LNG_CARPET_2)
    # Diamond border around carpet edge
    for ri in range(0, w - 4, 10):
        px(d, x0 + 2 + ri, y0 + 22, 5, 3, LNG_CARPET_3)
        px(d, x0 + 2 + ri, y0 + h - 5, 5, 3, LNG_CARPET_3)
    # Side borders
    for ri in range(0, h - 24, 10):
        px(d, x0 + 2, y0 + 24 + ri, 3, 5, LNG_CARPET_3)
        px(d, x0 + w - 5, y0 + 24 + ri, 3, 5, LNG_CARPET_3)
    # Pixel noise for carpet texture
    for _ in range(w * (h - 20) // 20):
        nx = x0 + random.randint(0, w - 1)
        ny = y0 + 20 + random.randint(0, h - 21)
        nv = random.choice([-6, -3, 3, 6])
        nc = (max(0, min(255, LNG_CARPET_1[0]+nv)), max(0, min(255, LNG_CARPET_1[1]+nv)),
              max(0, min(255, LNG_CARPET_1[2]+nv)), 255)
        d.point((nx, ny), fill=nc)

    # Wall TV
    tvx, tvy = x0 + 100, y0 + 2
    px(d, tvx, tvy, 90, 16, OUTLINE)
    px(d, tvx + 2, tvy + 2, 86, 12, TV_FRAME)
    px(d, tvx + 3, tvy + 3, 84, 10, TV_SCREEN)
    px(d, tvx + 3, tvy + 3, 84, 2, TV_SCREEN_L)
    # Screen content (sports graphic)
    px(d, tvx + 8, tvy + 5, 22, 6, (42, 148, 82, 255))
    px(d, tvx + 35, tvy + 5, 35, 2, (198, 198, 205, 255))
    px(d, tvx + 35, tvy + 8, 30, 2, (178, 178, 185, 255))
    px(d, tvx + 35, tvy + 11, 28, 2, (198, 198, 205, 255))
    px(d, tvx + 70, tvy + 5, 12, 3, (198, 62, 52, 255))

    # Bookshelves
    draw_bookshelf(d, x0 + 250, y0 + 22, 52, 68, 4)
    draw_bookshelf(d, x0 + 6, y0 + 22, 40, 40, 2)

    # Paintings
    draw_painting(d, x0 + 55, y0 + 2, 24, 16)
    draw_painting(d, x0 + 230, y0 + 2, 18, 14)

    # L-shaped sofa
    sx, sy = x0 + 12, y0 + 60
    # Horizontal part
    sofa_w, sofa_h = 120, 36
    px(d, sx, sy, sofa_w, sofa_h, OUTLINE)
    px(d, sx + 2, sy + 2, sofa_w - 4, sofa_h - 4, SOFA_BODY)
    px(d, sx + 2, sy + 2, sofa_w - 4, 2, SOFA_L)
    px(d, sx + 2, sy + sofa_h - 4, sofa_w - 4, 2, SOFA_D)
    # Cushion divisions
    cush_w = (sofa_w - 8) // 3
    for ci in range(3):
        cx = sx + 4 + ci * cush_w
        px(d, cx, sy + 4, cush_w - 2, sofa_h - 10, SOFA_CUSHION)
        px(d, cx, sy + 4, cush_w - 2, 1, SOFA_L)
        # Stitch line
        px(d, cx + cush_w - 2, sy + 4, 1, sofa_h - 10, SOFA_D)
    # Vertical part (L)
    lw, lh = 40, 50
    px(d, sx, sy + sofa_h - 2, lw, lh, OUTLINE)
    px(d, sx + 2, sy + sofa_h, lw - 4, lh - 4, SOFA_BODY)
    px(d, sx + 2, sy + sofa_h, lw - 4, 2, SOFA_L)
    px(d, sx + 4, sy + sofa_h + 4, lw - 8, lh // 2 - 6, SOFA_CUSHION)
    px(d, sx + 4, sy + sofa_h + lh // 2, lw - 8, lh // 2 - 8, SOFA_CUSHION)
    # Armrest
    px(d, sx, sy, 5, sofa_h + lh - 2, OUTLINE)
    px(d, sx + 1, sy + 1, 3, sofa_h + lh - 4, SOFA_D)
    # Throw pillows
    px(d, sx + 10, sy + 6, 12, 10, (158, 112, 92, 255))
    px(d, sx + 10, sy + 6, 12, 2, (178, 132, 112, 255))
    px(d, sx + 90, sy + 7, 14, 9, (92, 122, 152, 255))
    px(d, sx + 90, sy + 7, 14, 2, (112, 142, 172, 255))
    px(d, sx + 6, sy + sofa_h + 8, 10, 8, (148, 98, 78, 255))

    # Coffee table
    ctx, cty = x0 + 70, y0 + 115
    # Rug under coffee table
    rug_x, rug_y = ctx - 15, cty - 10
    rug_w, rug_h = 80, 40
    px(d, rug_x, rug_y, rug_w, rug_h, OUTLINE)
    px(d, rug_x + 1, rug_y + 1, rug_w - 2, rug_h - 2, RUG_1)
    px(d, rug_x + 1, rug_y + 1, rug_w - 2, 2, RUG_L)
    px(d, rug_x + 1, rug_y + rug_h - 3, rug_w - 2, 2, RUG_D)
    # Diamond border pattern
    for ri in range(0, rug_w - 8, 8):
        px(d, rug_x + 3 + ri, rug_y + 3, 5, 2, RUG_PAT)
        px(d, rug_x + 3 + ri, rug_y + rug_h - 5, 5, 2, RUG_PAT)
    for ri in range(0, rug_h - 8, 8):
        px(d, rug_x + 3, rug_y + 3 + ri, 2, 5, RUG_PAT)
        px(d, rug_x + rug_w - 5, rug_y + 3 + ri, 2, 5, RUG_PAT)

    # Coffee table
    px(d, ctx, cty, 55, 22, OUTLINE)
    px(d, ctx + 2, cty + 2, 51, 6, CT_TOP)
    px(d, ctx + 2, cty + 2, 51, 2, CT_TOP_L)
    px(d, ctx + 2, cty + 6, 51, 2, CT_TOP_D)
    px(d, ctx + 2, cty + 8, 51, 12, CT_TOP_D)
    px(d, ctx + 2, cty + 18, 51, 2, darker(CT_TOP_D, 10))
    # Items
    px(d, ctx + 5, cty + 3, 14, 4, (168, 52, 48, 255))  # magazine
    px(d, ctx + 22, cty + 3, 8, 3, (42, 42, 48, 255))    # remote
    px(d, ctx + 35, cty + 3, 5, 4, METAL_2)               # coaster

    # Bean bags
    bx, by = x0 + 160, y0 + 150
    px(d, bx, by + 4, 24, 16, OUTLINE)
    px(d, bx + 2, by, 20, 8, OUTLINE)
    px(d, bx + 1, by + 5, 22, 14, BB_RED)
    px(d, bx + 3, by + 1, 18, 6, BB_RED)
    px(d, bx + 3, by + 1, 18, 2, BB_RED_L)
    px(d, bx + 1, by + 17, 22, 2, BB_RED_D)

    bx2, by2 = x0 + 198, y0 + 160
    px(d, bx2, by2 + 4, 24, 16, OUTLINE)
    px(d, bx2 + 2, by2, 20, 8, OUTLINE)
    px(d, bx2 + 1, by2 + 5, 22, 14, BB_BLUE)
    px(d, bx2 + 3, by2 + 1, 18, 6, BB_BLUE)
    px(d, bx2 + 3, by2 + 1, 18, 2, BB_BLUE_L)
    px(d, bx2 + 1, by2 + 17, 22, 2, BB_BLUE_D)

    # Floor lamp
    lx, ly = x0 + 265, y0 + 130
    px(d, lx + 3, ly + 10, 3, 44, OUTLINE)
    px(d, lx + 4, ly + 11, 1, 42, LAMP_POLE)
    px(d, lx, ly + 52, 10, 4, OUTLINE)
    px(d, lx + 1, ly + 53, 8, 2, LAMP_POLE)
    # Shade
    px(d, lx - 3, ly, 14, 12, OUTLINE)
    px(d, lx - 2, ly + 1, 12, 10, LAMP_SHADE)
    px(d, lx - 2, ly + 1, 12, 2, lighter(LAMP_SHADE, 12))
    px(d, lx - 2, ly + 9, 12, 2, LAMP_SHADE_D)
    # Light circle on floor
    px(d, lx - 8, ly + 56, 24, 12, lighter(LNG_CARPET_1, 8))

    # Side table next to sofa
    stx, sty = sx + sofa_w + 5, sy + 5
    px(d, stx, sty, 20, 22, OUTLINE)
    px(d, stx + 2, sty + 2, 16, 6, CT_TOP)
    px(d, stx + 2, sty + 2, 16, 2, CT_TOP_L)
    px(d, stx + 2, sty + 8, 16, 12, CT_TOP_D)
    # Lamp on side table
    px(d, stx + 6, sty - 6, 8, 8, OUTLINE)
    px(d, stx + 7, sty - 5, 6, 6, LAMP_SHADE)
    px(d, stx + 7, sty - 5, 6, 1, lighter(LAMP_SHADE, 10))

    # Ceiling lamp
    draw_ceiling_lamp(d, x0 + 150, y0 + 2)

    # Plants
    draw_plant(d, x0 + 280, y0 + 190, 1)
    draw_plant(d, x0 + 140, y0 + 180, 2)
    draw_plant(d, x0 + 4, y0 + 180, 2)

    # Bottom wall
    px(d, x0, y0 + h - 2, w, 2, OUTLINE)


def draw_patio_day(d):
    """Draw patio (day): y 704-960."""
    x0, y0, w, h = 0, 704, 640, 256

    # Sky
    px(d, x0, y0, w, 55, PAT_SKY)
    px(d, x0, y0, w, 15, PAT_SKY_LIGHT)
    # Clouds
    for cx, cy in [(60, y0 + 10), (250, y0 + 5), (420, y0 + 12), (560, y0 + 8)]:
        px(d, cx, cy, 45, 8, (228, 238, 248, 180))
        px(d, cx + 5, cy - 5, 35, 7, (232, 242, 252, 160))
        px(d, cx + 12, cy - 8, 22, 5, (238, 248, 255, 140))

    # Trees behind fence
    for tx in [10, 90, 180, 370, 480, 560]:
        tw = random.randint(28, 38)
        th = random.randint(36, 48)
        draw_tree(d, tx, y0 - 5, tw, th)

    # Grass strip
    px(d, x0, y0 + 44, w, 12, PAT_GRASS)
    px(d, x0, y0 + 44, w, 3, PAT_GRASS_LIGHT)
    px(d, x0, y0 + 53, w, 3, PAT_GRASS_DARK)
    # Grass blades
    for gx in range(x0, x0 + w, 4):
        gh = random.randint(1, 3)
        px(d, gx, y0 + 44 - gh, 1, gh, PAT_GRASS_LIGHT)

    # Fence
    draw_fence(d, x0, y0 + 30, w, 24)

    # Deck floor
    draw_wood_floor(d, x0, y0 + 56, w, h - 56,
                    PAT_DECK_1, PAT_DECK_2, PAT_DECK_3,
                    lighter(PAT_DECK_1, 10), PAT_DECK_GAP, 12)

    # Sliding glass door at top center
    gdx = 240
    px(d, gdx, y0 + 56, 160, 44, OUTLINE)
    px(d, gdx + 3, y0 + 59, 154, 38, GLASS_FRAME)
    px(d, gdx + 5, y0 + 61, 72, 34, GLASS_PANE)
    px(d, gdx + 5, y0 + 61, 72, 4, lighter(GLASS_PANE[:3] + (140,), 15))
    px(d, gdx + 83, y0 + 61, 72, 34, GLASS_PANE)
    px(d, gdx + 83, y0 + 61, 72, 4, lighter(GLASS_PANE[:3] + (140,), 15))
    # Mullion
    px(d, gdx + 78, y0 + 59, 4, 38, GLASS_FRAME)
    # Handle
    px(d, gdx + 75, y0 + 76, 3, 8, METAL_2)
    px(d, gdx + 82, y0 + 76, 3, 8, METAL_2)

    # BBQ grill
    bx, by = 40, y0 + 108
    # Legs
    px(d, bx + 5, by + 24, 3, 20, BBQ_LEGS)
    px(d, bx + 36, by + 24, 3, 20, BBQ_LEGS)
    px(d, bx + 5, by + 38, 34, 2, BBQ_LEGS)
    # Body
    px(d, bx, by + 8, 44, 18, OUTLINE)
    px(d, bx + 2, by + 10, 40, 14, BBQ_BODY)
    px(d, bx + 2, by + 10, 40, 2, BBQ_BODY_L)
    px(d, bx + 2, by + 22, 40, 2, darker(BBQ_BODY, 10))
    # Lid
    px(d, bx, by, 44, 10, OUTLINE)
    px(d, bx + 2, by + 2, 40, 6, BBQ_LID)
    px(d, bx + 2, by + 2, 40, 1, BBQ_BODY_L)
    # Handle
    px(d, bx + 16, by - 2, 12, 3, OUTLINE)
    px(d, bx + 17, by - 1, 10, 1, METAL_2)
    # Side shelf
    px(d, bx + 44, by + 12, 16, 5, METAL_2)
    px(d, bx + 44, by + 12, 16, 1, METAL_1)
    # Thermometer
    px(d, bx + 20, by + 3, 4, 4, (218, 42, 32, 255))

    # Picnic table
    ptx, pty = 180, y0 + 150
    # Table top
    px(d, ptx, pty, 90, 24, OUTLINE)
    px(d, ptx + 2, pty + 2, 86, 8, PICNIC)
    px(d, ptx + 2, pty + 2, 86, 2, PICNIC_L)
    px(d, ptx + 2, pty + 8, 86, 2, PICNIC_D)
    # Front face
    px(d, ptx + 2, pty + 10, 86, 12, PICNIC_D)
    px(d, ptx + 2, pty + 20, 86, 2, darker(PICNIC_D, 12))
    # Grain
    for gy in range(pty + 4, pty + 8, 2):
        px(d, ptx + 5, gy, 80, 1, darker(PICNIC, 10))
    # Benches
    px(d, ptx + 5, pty + 26, 80, 6, OUTLINE)
    px(d, ptx + 6, pty + 27, 78, 4, PICNIC)
    px(d, ptx + 6, pty + 27, 78, 1, PICNIC_L)
    px(d, ptx + 5, pty - 12, 80, 6, OUTLINE)
    px(d, ptx + 6, pty - 11, 78, 4, PICNIC)
    px(d, ptx + 6, pty - 11, 78, 1, PICNIC_L)
    # Legs
    px(d, ptx + 15, pty + 22, 4, 14, OUTLINE)
    px(d, ptx + 71, pty + 22, 4, 14, OUTLINE)
    # Items on table
    draw_mug(d, ptx + 15, pty - 5)
    draw_mug(d, ptx + 65, pty - 5)
    px(d, ptx + 35, pty + 3, 18, 5, (198, 52, 42, 255))  # plate

    # Lounge chairs + umbrella
    for ci, lcx in enumerate([410, 500]):
        lcy = y0 + 140
        px(d, lcx, lcy, 54, 28, OUTLINE)
        px(d, lcx + 2, lcy + 2, 50, 24, LC_FRAME)
        px(d, lcx + 4, lcy + 4, 46, 20, LC_FABRIC)
        px(d, lcx + 4, lcy + 4, 46, 2, lighter(LC_FABRIC, 10))
        px(d, lcx + 4, lcy + 22, 46, 2, LC_DARK)
        # Stripes
        for si in range(5):
            px(d, lcx + 6 + si * 9, lcy + 7, 5, 14, (218, 208, 188, 255))
        # Head rest
        px(d, lcx + 2, lcy - 8, 22, 10, OUTLINE)
        px(d, lcx + 3, lcy - 7, 20, 8, LC_FABRIC)
        px(d, lcx + 3, lcy - 7, 20, 2, lighter(LC_FABRIC, 8))

    # Umbrella
    ux, uy = 450, y0 + 98
    px(d, ux + 20, uy + 12, 3, 54, UMB_POLE)
    # Canopy
    px(d, ux, uy, 44, 14, OUTLINE)
    px(d, ux + 1, uy + 1, 42, 12, UMB_TOP)
    px(d, ux + 1, uy + 1, 42, 2, lighter(UMB_TOP, 15))
    px(d, ux + 1, uy + 11, 42, 2, UMB_D)
    # Stripes
    for ri in range(0, 42, 10):
        px(d, ux + 1 + ri, uy + 3, 5, 8, UMB_STRIPE)

    # Fire pit
    fpx, fpy = 330, y0 + 200
    px(d, fpx, fpy, 34, 20, OUTLINE)
    px(d, fpx + 2, fpy + 2, 30, 16, FP_STONE)
    px(d, fpx + 2, fpy + 2, 30, 2, FP_STONE_L)
    px(d, fpx + 2, fpy + 16, 30, 2, FP_STONE_D)
    # Stone texture
    for si in range(4):
        sx = fpx + 4 + si * 7
        px(d, sx, fpy + 3, 5, 1, FP_STONE_D)
    # Inner
    px(d, fpx + 5, fpy + 5, 24, 10, FP_ASH)
    # Embers
    px(d, fpx + 8, fpy + 7, 5, 4, FP_EMBER)
    px(d, fpx + 15, fpy + 6, 6, 5, FP_BRIGHT)
    px(d, fpx + 22, fpy + 8, 4, 3, FP_EMBER)
    px(d, fpx + 12, fpy + 8, 3, 2, (255, 218, 108, 255))

    # Planter boxes
    for pbx, pby in [(8, y0 + 210), (580, y0 + 210), (130, y0 + 220)]:
        px(d, pbx, pby, 44, 18, OUTLINE)
        px(d, pbx + 2, pby + 2, 40, 14, PLANTER)
        px(d, pbx + 2, pby + 2, 40, 2, PLANTER_L)
        px(d, pbx + 2, pby + 14, 40, 2, PLANTER_D)
        # Dirt
        px(d, pbx + 3, pby + 2, 38, 3, (82, 58, 42, 255))
        # Plants
        for pi in range(5):
            ppx = pbx + 5 + pi * 8
            px(d, ppx, pby - 8, 5, 10, PLANT_GREEN)
            px(d, ppx, pby - 8, 5, 2, PLANT_GREEN_L)
            px(d, ppx + 1, pby - 11, 3, 4, PLANT_GREEN_L)

    # Bottom fence
    draw_fence(d, 0, y0 + 240, 640, 20)


def draw_patio_night_sky(d):
    """Replace patio sky with night sky."""
    x0, y0 = 0, 704
    px(d, x0, y0, 640, 55, (18, 22, 42, 255))
    # Stars
    for _ in range(25):
        sx = random.randint(0, 639)
        sy = y0 + random.randint(2, 50)
        px(d, sx, sy, 1, 1, STAR_C)
    for _ in range(6):
        sx = random.randint(0, 639)
        sy = y0 + random.randint(2, 48)
        px(d, sx, sy, 2, 2, STAR_C)
    # Moon
    px(d, 540, y0 + 5, 12, 12, (238, 235, 218, 200))
    px(d, 542, y0 + 3, 8, 8, (248, 245, 228, 220))


# ══════════════════════════════════════════════════════════════════════
#  FOREGROUND LAYER
# ══════════════════════════════════════════════════════════════════════

def draw_foreground_day(d):
    """Draw day foreground: chair backs + string lights."""
    # Chair backs for the 6 office desks
    desk_positions = [
        (30, 128 + 110), (30, 128 + 175), (30, 128 + 240),
        (332, 128 + 110), (332, 128 + 175), (332, 128 + 240),
    ]
    for dx, dy in desk_positions:
        draw_chair_back_fg(d, dx + 31, dy - 22)

    # String lights across patio
    y_wire = 716
    for x in range(0, 640):
        sag = int(4 * math.sin(x * math.pi / 80))
        d.point((x, y_wire + sag), fill=SL_WIRE)
    for bx in range(20, 640, 38):
        sag = int(4 * math.sin(bx * math.pi / 80))
        by = y_wire + sag + 1
        px(d, bx - 1, by, 3, 5, OUTLINE)
        px(d, bx, by + 1, 1, 3, SL_BULB_DAY)


def draw_foreground_night(d):
    """Draw night foreground: glowing string lights + chair backs."""
    # Chair backs
    desk_positions = [
        (30, 128 + 110), (30, 128 + 175), (30, 128 + 240),
        (332, 128 + 110), (332, 128 + 175), (332, 128 + 240),
    ]
    for dx, dy in desk_positions:
        draw_chair_back_fg(d, dx + 31, dy - 22)

    # String lights with glow
    y_wire = 716
    for x in range(0, 640):
        sag = int(4 * math.sin(x * math.pi / 80))
        d.point((x, y_wire + sag), fill=SL_WIRE)
    for bx in range(20, 640, 38):
        sag = int(4 * math.sin(bx * math.pi / 80))
        by = y_wire + sag + 1
        _draw_glow(d, bx, by + 2, 12, (255, 235, 168, 35))
        px(d, bx - 1, by, 3, 5, OUTLINE)
        px(d, bx, by + 1, 1, 3, SL_BULB_NIGHT)


# ══════════════════════════════════════════════════════════════════════
#  NIGHT OVERLAY
# ══════════════════════════════════════════════════════════════════════

def _draw_glow(draw, cx, cy, radius, color):
    """Draw soft circular glow."""
    r, g, b, base_a = color
    for dist in range(radius, 0, -1):
        alpha = int(base_a * (1 - dist / radius))
        if alpha <= 0:
            continue
        x0 = cx - dist
        y0 = cy - dist
        size = dist * 2
        draw.rectangle([x0, y0, x0 + size, y0 + size],
                       fill=(r, g, b, alpha))


def create_night_version(day_img):
    """Create night version from day image."""
    night = day_img.copy()
    night_draw = ImageDraw.Draw(night)

    # Replace patio sky
    draw_patio_night_sky(night_draw)

    # Dark overlay
    overlay = Image.new("RGBA", (MAP_W, MAP_H), (0, 8, 25, 130))
    night = Image.alpha_composite(night, overlay)

    # Glow layer
    glow_layer = Image.new("RGBA", (MAP_W, MAP_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)

    # Monitor glows
    desk_positions = [
        (30, 128 + 110), (30, 128 + 175), (30, 128 + 240),
        (332, 128 + 110), (332, 128 + 175), (332, 128 + 240),
    ]
    for dx, dy in desk_positions:
        _draw_glow(gd, dx + 40, dy - 10, 25, (42, 168, 162, 50))

    # Dual monitor extra
    _draw_glow(gd, 82, 218, 20, (42, 168, 162, 40))
    _draw_glow(gd, 384, 238 + 128, 20, (42, 168, 162, 40))

    # TV glow
    _draw_glow(gd, 328 + 145, 458, 40, (52, 108, 168, 45))

    # Floor lamp glow
    _draw_glow(gd, 328 + 268, 580, 30, (255, 220, 160, 50))

    # Fire pit glow
    _draw_glow(gd, 347, 704 + 210, 45, (255, 180, 80, 45))
    _draw_glow(gd, 347, 704 + 210, 18, (255, 200, 100, 60))

    # Coffee machine LED
    _draw_glow(gd, 157, 460, 10, (218, 42, 32, 40))

    # Server rack LEDs
    for rr in range(6):
        ry2 = 128 + 32 + rr * 7
        _draw_glow(gd, 148, ry2, 6, (52, 198, 82, 50))

    # Vending machine
    _draw_glow(gd, 618, 128 + 58, 20, (82, 108, 118, 35))

    # Ceiling lamps warm glow
    for clx in [110, 420, 520]:
        _draw_glow(gd, clx + 6, 128 + 15, 20, (255, 240, 200, 40))

    night = Image.alpha_composite(night, glow_layer)

    # Brighten fire embers
    nd = ImageDraw.Draw(night)
    fpx, fpy = 330, 704 + 200
    px(nd, fpx + 8, fpy + 7, 6, 4, (255, 168, 42, 255))
    px(nd, fpx + 15, fpy + 6, 7, 5, (255, 198, 62, 255))
    px(nd, fpx + 12, fpy + 8, 4, 3, (255, 228, 128, 255))

    # Night windows -> dark blue
    for wx in [160, 300, 440]:
        px(nd, wx + 3, 128 + 5, 26, 10, (22, 28, 48, 200))

    return night


# ══════════════════════════════════════════════════════════════════════
#  COLLISION MAP
# ══════════════════════════════════════════════════════════════════════

def create_collision_map():
    """Generate collision map: black = blocked, transparent = walkable."""
    coll = Image.new("RGBA", (MAP_W, MAP_H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(coll)
    BLACK = (0, 0, 0, 255)

    # Walls
    # Top entryway wall
    px(cd, 0, 0, 640, 20, BLACK)
    # Clear door opening
    px(cd, 270, 0, 100, 20, (0, 0, 0, 0))
    # Bottom entryway wall
    px(cd, 0, 112, 640, 16, BLACK)
    px(cd, 270, 112, 100, 16, (0, 0, 0, 0))

    # Office walls
    px(cd, 0, 128, 640, 20, BLACK)
    px(cd, 0, 128 + 304, 640, 16, BLACK)
    px(cd, 150, 128 + 304, 80, 16, (0, 0, 0, 0))
    px(cd, 400, 128 + 304, 80, 16, (0, 0, 0, 0))

    # Kitchen / Lounge walls
    px(cd, 0, 448, 312, 20, BLACK)
    px(cd, 328, 448, 312, 20, BLACK)
    px(cd, 306, 448, 6, 224, BLACK)
    px(cd, 306, 448 + 80, 6, 60, (0, 0, 0, 0))

    # Bottom lounge wall
    px(cd, 328, 672 - 2, 312, 2, BLACK)

    # Patio fences
    px(cd, 0, 704 + 30, 640, 24, BLACK)
    px(cd, 0, 704 + 240, 640, 20, BLACK)

    # ── Furniture ──

    # Entryway furniture
    px(cd, 20, 30, 44, 32, BLACK)   # side table
    px(cd, 573, 10, 8, 60, BLACK)   # coat rack
    px(cd, 520, 40, 38, 28, BLACK)  # right table

    # Office desks (6)
    for dx, dy in [(30, 128+110), (30, 128+175), (30, 128+240),
                   (332, 128+110), (332, 128+175), (332, 128+240)]:
        px(cd, dx, dy, 80, 48, BLACK)

    # Office misc
    px(cd, 604, 128+30, 28, 56, BLACK)   # vending machine
    px(cd, 530, 128+40, 16, 36, BLACK)   # water cooler
    px(cd, 130, 128+28, 24, 48, BLACK)   # server rack
    px(cd, 6, 128+2, 88, 18, BLACK)      # bookshelves left
    px(cd, 552, 128+2, 82, 18, BLACK)    # bookshelves right

    # Kitchen furniture
    px(cd, 4, 448+16, 195, 28, BLACK)    # counter
    px(cd, 252, 448+8, 36, 68, BLACK)    # fridge
    px(cd, 90, 448+120, 68, 40, BLACK)   # table
    px(cd, 210, 448+86, 16, 36, BLACK)   # water cooler

    # Lounge furniture
    px(cd, 340, 448+60, 120, 86, BLACK)  # sofa L
    px(cd, 398, 448+115, 55, 22, BLACK)  # coffee table
    px(cd, 488, 448+150, 24, 20, BLACK)  # bean bag 1
    px(cd, 526, 448+160, 24, 20, BLACK)  # bean bag 2
    px(cd, 578, 448+22, 52, 68, BLACK)   # bookshelves
    px(cd, 334, 448+22, 40, 40, BLACK)   # small bookshelf
    px(cd, 593, 448+130, 14, 56, BLACK)  # floor lamp

    # Patio furniture
    px(cd, 40, 704+108, 60, 38, BLACK)      # BBQ
    px(cd, 180, 704+138, 90, 40, BLACK)      # picnic table
    px(cd, 410, 704+132, 54, 36, BLACK)      # lounge chair 1
    px(cd, 500, 704+132, 54, 36, BLACK)      # lounge chair 2
    px(cd, 330, 704+200, 34, 20, BLACK)      # fire pit
    for pbx in [8, 580, 130]:
        px(cd, pbx, 704+210, 44, 18, BLACK)  # planter boxes

    # Sliding glass door frame (blocked)
    px(cd, 240, 704+56, 160, 44, BLACK)
    # But the opening is walkable
    px(cd, 260, 704+56, 120, 44, (0, 0, 0, 0))

    return coll


# ══════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════

def main():
    print("Generating WagerProof Pixel Office v3 (High-detail Pokemon RPG style)...")

    # ── Day background ──
    day_bg = Image.new("RGBA", (MAP_W, MAP_H), (0, 0, 0, 255))
    d = ImageDraw.Draw(day_bg)

    print("  Drawing entryway...")
    draw_entryway(d)

    print("  Drawing main office...")
    draw_office(d)

    # Hallway between office and kitchen/lounge
    draw_tile_floor(d, 0, 448 - 16, 640, 16, ENTRY_FLOOR_1, ENTRY_FLOOR_2,
                    ENTRY_FLOOR_GROUT, 16)

    print("  Drawing kitchen...")
    draw_kitchen(d)

    print("  Drawing lounge...")
    draw_lounge(d)

    # Hallway between kitchen/lounge and patio
    draw_tile_floor(d, 0, 672, 640, 32, ENTRY_FLOOR_1, ENTRY_FLOOR_2,
                    ENTRY_FLOOR_GROUT, 16)
    px(d, 0, 702, 640, 2, OUTLINE)

    print("  Drawing patio (day)...")
    draw_patio_day(d)

    # ── Day foreground ──
    day_fg = Image.new("RGBA", (MAP_W, MAP_H), (0, 0, 0, 0))
    draw_foreground_day(ImageDraw.Draw(day_fg))

    # ── Night background ──
    print("  Creating night version...")
    night_bg = create_night_version(day_bg)

    # ── Night foreground ──
    night_fg = Image.new("RGBA", (MAP_W, MAP_H), (0, 0, 0, 0))
    draw_foreground_night(ImageDraw.Draw(night_fg))

    # ── Collision map ──
    print("  Generating collision map...")
    collision = create_collision_map()

    # ── Save ──
    paths = [
        (day_bg, DAY_DIR / "office_bg_day.webp"),
        (day_fg, DAY_DIR / "office_fg_day.webp"),
        (collision, DAY_DIR / "office_collision.webp"),
        (night_bg, NIGHT_DIR / "office_bg_night.webp"),
        (night_fg, NIGHT_DIR / "office_fg_night.webp"),
    ]
    for img, path in paths:
        print(f"  Saving {path}...")
        img.save(str(path), "WEBP", lossless=True)

    # Report file sizes
    print("\nFile sizes:")
    for _, path in paths:
        size = path.stat().st_size
        print(f"  {path.name}: {size / 1024:.1f} KB")

    print("\nDone! All assets generated.")


if __name__ == "__main__":
    main()
