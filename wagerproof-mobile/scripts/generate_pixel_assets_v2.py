#!/usr/bin/env python3
"""
WagerProof Pixel Office – High-Quality Asset Generator v2
Generates 8 character sprite sheets (48x64 frames, 8 cols x 9 rows)
with 18 animation states, plus a detailed office environment.

Matches the pixel-agent-desk repo spec for 1:1 engine compatibility.
"""

from PIL import Image, ImageDraw
from pathlib import Path
import math, random

random.seed(42)

# ── Output paths ──────────────────────────────────────────────────
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'pixel-office'
CHAR_DIR = OUT / 'characters'
OFFICE_DIR = OUT / 'office' / 'map'
OBJ_DIR = OUT / 'office' / 'ojects'  # match original repo spelling
SHARED_DIR = OUT / 'shared'
for d in [CHAR_DIR, OFFICE_DIR, OBJ_DIR, SHARED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Constants ─────────────────────────────────────────────────────
FW, FH = 48, 64          # frame size
COLS, ROWS = 8, 9        # sheet layout  (72 frames)
TILE = 32                 # office tile size
MAP_W, MAP_H = 640, 768  # office map pixel size (20x24 tiles)

# ── Color helpers ─────────────────────────────────────────────────
def shade(color, factor):
    """Lighten (factor>1) or darken (factor<1) an RGBA color."""
    r, g, b, a = color
    return (
        max(0, min(255, int(r * factor))),
        max(0, min(255, int(g * factor))),
        max(0, min(255, int(b * factor))),
        a,
    )

def lighter(c): return shade(c, 1.25)
def darker(c):  return shade(c, 0.75)
def shadow(c):  return shade(c, 0.60)

# ── Drawing primitives ────────────────────────────────────────────
def px(draw, x, y, w, h, c):
    """Draw a filled rectangle (pixel block)."""
    if w <= 0 or h <= 0: return
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

def px_outline(draw, x, y, w, h, fill, outline, border=1):
    """Draw a filled rect with outline."""
    px(draw, x, y, w, h, outline)
    px(draw, x + border, y + border, w - border*2, h - border*2, fill)

def ellipse_px(draw, cx, cy, rx, ry, c):
    """Draw a filled ellipse."""
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=c)

# ═══════════════════════════════════════════════════════════════════
#  CHARACTER DRAWING
# ═══════════════════════════════════════════════════════════════════

# Character palettes: (skin, skin_shadow, hair, shirt, shirt_dark, pants, pants_dark, shoes, eye, accent)
CHAR_PALETTES = [
    {  # 0 - Blue analyst
        'skin': (245, 210, 178, 255), 'skin_s': (220, 182, 148, 255),
        'hair': (62, 42, 32, 255), 'hair_s': (42, 28, 20, 255),
        'shirt': (65, 120, 210, 255), 'shirt_s': (48, 90, 170, 255),
        'pants': (55, 65, 85, 255), 'pants_s': (40, 48, 65, 255),
        'shoes': (45, 42, 40, 255), 'eye': (32, 32, 32, 255),
        'accent': (85, 180, 230, 255), 'hair_style': 'short',
    },
    {  # 1 - Green strategist
        'skin': (235, 195, 155, 255), 'skin_s': (205, 165, 128, 255),
        'hair': (42, 38, 55, 255), 'hair_s': (28, 24, 38, 255),
        'shirt': (72, 168, 104, 255), 'shirt_s': (52, 135, 78, 255),
        'pants': (50, 68, 82, 255), 'pants_s': (38, 52, 65, 255),
        'shoes': (58, 48, 42, 255), 'eye': (28, 28, 28, 255),
        'accent': (110, 220, 145, 255), 'hair_style': 'messy',
    },
    {  # 2 - Orange quant
        'skin': (252, 218, 185, 255), 'skin_s': (225, 190, 155, 255),
        'hair': (165, 95, 55, 255), 'hair_s': (130, 72, 38, 255),
        'shirt': (235, 135, 65, 255), 'shirt_s': (200, 108, 48, 255),
        'pants': (62, 58, 78, 255), 'pants_s': (48, 44, 62, 255),
        'shoes': (52, 45, 40, 255), 'eye': (35, 30, 25, 255),
        'accent': (255, 180, 60, 255), 'hair_style': 'wavy',
    },
    {  # 3 - Purple data scientist
        'skin': (215, 170, 140, 255), 'skin_s': (185, 142, 115, 255),
        'hair': (35, 32, 42, 255), 'hair_s': (22, 20, 28, 255),
        'shirt': (148, 108, 210, 255), 'shirt_s': (118, 82, 178, 255),
        'pants': (52, 55, 72, 255), 'pants_s': (38, 40, 55, 255),
        'shoes': (48, 42, 38, 255), 'eye': (25, 25, 25, 255),
        'accent': (180, 140, 245, 255), 'hair_style': 'curly',
    },
    {  # 4 - Red risk analyst
        'skin': (248, 215, 182, 255), 'skin_s': (222, 188, 155, 255),
        'hair': (78, 45, 28, 255), 'hair_s': (55, 32, 18, 255),
        'shirt': (210, 72, 72, 255), 'shirt_s': (178, 55, 55, 255),
        'pants': (58, 62, 75, 255), 'pants_s': (42, 46, 58, 255),
        'shoes': (42, 38, 35, 255), 'eye': (30, 28, 28, 255),
        'accent': (245, 100, 85, 255), 'hair_style': 'spiky',
    },
    {  # 5 - Teal ML engineer
        'skin': (240, 205, 170, 255), 'skin_s': (212, 178, 142, 255),
        'hair': (52, 48, 62, 255), 'hair_s': (35, 32, 45, 255),
        'shirt': (52, 172, 168, 255), 'shirt_s': (38, 138, 135, 255),
        'pants': (55, 60, 78, 255), 'pants_s': (40, 45, 60, 255),
        'shoes': (50, 44, 40, 255), 'eye': (28, 28, 32, 255),
        'accent': (75, 210, 205, 255), 'hair_style': 'long',
    },
    {  # 6 - Gold sports analyst
        'skin': (230, 188, 148, 255), 'skin_s': (200, 160, 122, 255),
        'hair': (142, 108, 72, 255), 'hair_s': (110, 82, 52, 255),
        'shirt': (218, 178, 62, 255), 'shirt_s': (185, 148, 45, 255),
        'pants': (60, 55, 70, 255), 'pants_s': (45, 40, 55, 255),
        'shoes': (55, 48, 42, 255), 'eye': (32, 28, 22, 255),
        'accent': (255, 210, 80, 255), 'hair_style': 'flat',
    },
    {  # 7 - Navy lead
        'skin': (250, 220, 190, 255), 'skin_s': (225, 195, 162, 255),
        'hair': (45, 35, 28, 255), 'hair_s': (30, 22, 16, 255),
        'shirt': (55, 68, 115, 255), 'shirt_s': (40, 52, 90, 255),
        'pants': (48, 50, 65, 255), 'pants_s': (35, 38, 50, 255),
        'shoes': (40, 36, 32, 255), 'eye': (22, 22, 22, 255),
        'accent': (82, 105, 165, 255), 'hair_style': 'parted',
    },
]


def draw_head(d, cx, cy, pal, facing, bob=0):
    """Draw head with face at center (cx, cy+bob), direction-aware."""
    skin, skin_s = pal['skin'], pal['skin_s']
    hair, hair_s = pal['hair'], pal['hair_s']
    eye = pal['eye']
    style = pal['hair_style']

    y = cy + bob
    # -- Head base (rounded square shape) --
    px(d, cx-6, y-5, 12, 11, skin)       # main face
    px(d, cx-7, y-4, 14, 9, skin)        # slightly wider mid
    px(d, cx-5, y-6, 10, 1, skin)        # top round
    px(d, cx-5, y+6, 10, 1, skin)        # chin round
    # Skin shadow on one side
    if facing == 'left':
        px(d, cx+4, y-3, 3, 7, skin_s)
    elif facing == 'right':
        px(d, cx-7, y-3, 3, 7, skin_s)
    else:
        px(d, cx-6, y+4, 12, 2, skin_s)  # jaw shadow

    # -- Hair --
    if style == 'short':
        px(d, cx-7, y-7, 14, 5, hair)
        px(d, cx-8, y-6, 1, 3, hair)
        px(d, cx+7, y-6, 1, 3, hair)
        px(d, cx-6, y-8, 12, 2, hair_s)
    elif style == 'messy':
        px(d, cx-7, y-8, 14, 5, hair)
        px(d, cx-8, y-6, 2, 4, hair)
        px(d, cx+7, y-7, 2, 3, hair_s)
        px(d, cx-5, y-9, 3, 2, hair)
        px(d, cx+3, y-9, 2, 1, hair_s)
    elif style == 'wavy':
        px(d, cx-7, y-7, 14, 4, hair)
        px(d, cx-8, y-5, 2, 5, hair)
        px(d, cx+7, y-5, 2, 5, hair_s)
        px(d, cx-6, y-8, 12, 2, hair)
        px(d, cx-8, y-3, 1, 2, hair_s)
    elif style == 'curly':
        px(d, cx-8, y-8, 16, 5, hair)
        px(d, cx-8, y-4, 2, 4, hair)
        px(d, cx+7, y-4, 2, 4, hair_s)
        px(d, cx-6, y-9, 4, 2, hair)
        px(d, cx+2, y-9, 5, 1, hair_s)
    elif style == 'spiky':
        px(d, cx-7, y-7, 14, 4, hair)
        px(d, cx-5, y-10, 2, 4, hair)
        px(d, cx-1, y-11, 2, 4, hair_s)
        px(d, cx+3, y-10, 2, 3, hair)
        px(d, cx+6, y-8, 2, 2, hair_s)
    elif style == 'long':
        px(d, cx-7, y-7, 14, 4, hair)
        px(d, cx-8, y-5, 2, 10, hair)
        px(d, cx+7, y-5, 2, 10, hair_s)
        px(d, cx-6, y-8, 12, 2, hair)
    elif style == 'flat':
        px(d, cx-7, y-7, 14, 4, hair)
        px(d, cx-7, y-8, 14, 2, hair_s)
    elif style == 'parted':
        px(d, cx-7, y-7, 14, 4, hair)
        px(d, cx-1, y-8, 2, 2, hair_s)
        px(d, cx-7, y-5, 2, 3, hair)
        px(d, cx+6, y-5, 2, 3, hair_s)
        px(d, cx-6, y-8, 12, 2, hair)

    # -- Face features (direction-dependent) --
    if facing == 'down' or facing == 'front':
        # Eyes
        px(d, cx-4, y-1, 2, 2, (255,255,255,255))  # white left
        px(d, cx+2, y-1, 2, 2, (255,255,255,255))  # white right
        px(d, cx-3, y, 1, 1, eye)                    # pupil left
        px(d, cx+3, y, 1, 1, eye)                    # pupil right
        # Mouth
        px(d, cx-1, y+3, 2, 1, darker(skin))
    elif facing == 'up' or facing == 'back':
        pass  # back of head, no face
    elif facing == 'left':
        px(d, cx-4, y-1, 2, 2, (255,255,255,255))
        px(d, cx-4, y, 1, 1, eye)
        px(d, cx-6, y+3, 1, 1, darker(skin))
    elif facing == 'right':
        px(d, cx+2, y-1, 2, 2, (255,255,255,255))
        px(d, cx+3, y, 1, 1, eye)
        px(d, cx+5, y+3, 1, 1, darker(skin))


def draw_body_standing(d, cx, cy, pal, facing, bob=0, arm_pose='idle'):
    """Draw torso + arms for standing pose."""
    shirt, shirt_s = pal['shirt'], pal['shirt_s']
    skin, skin_s = pal['skin'], pal['skin_s']
    y = cy + bob

    # -- Torso --
    px(d, cx-7, y, 14, 12, shirt)            # main torso
    px(d, cx-6, y, 1, 12, shirt_s)           # left edge shadow
    px(d, cx+6, y, 1, 12, lighter(shirt))    # right highlight
    # Collar detail
    px(d, cx-3, y, 6, 2, lighter(shirt))
    px(d, cx-1, y, 2, 3, skin)               # neck/collar opening

    # -- Arms --
    if facing in ('down', 'front', 'up', 'back'):
        if arm_pose == 'idle':
            # Both arms at sides
            px(d, cx-10, y+1, 3, 8, shirt)
            px(d, cx-10, y+9, 3, 3, skin)
            px(d, cx+7, y+1, 3, 8, shirt_s)
            px(d, cx+7, y+9, 3, 3, skin_s)
        elif arm_pose == 'walk_a':
            px(d, cx-10, y-1, 3, 8, shirt)
            px(d, cx-10, y+7, 3, 3, skin)
            px(d, cx+7, y+3, 3, 8, shirt_s)
            px(d, cx+7, y+11, 3, 2, skin_s)
        elif arm_pose == 'walk_b':
            px(d, cx-10, y+3, 3, 8, shirt)
            px(d, cx-10, y+11, 3, 2, skin)
            px(d, cx+7, y-1, 3, 8, shirt_s)
            px(d, cx+7, y+7, 3, 3, skin_s)
        elif arm_pose == 'work':
            # Arms forward for typing
            px(d, cx-10, y+1, 3, 6, shirt)
            px(d, cx-10, y+7, 3, 2, skin)
            px(d, cx-8, y+8, 5, 2, skin)  # hands forward
            px(d, cx+7, y+1, 3, 6, shirt_s)
            px(d, cx+7, y+7, 3, 2, skin_s)
            px(d, cx+4, y+8, 5, 2, skin_s)
    elif facing == 'left':
        if arm_pose == 'idle':
            px(d, cx-6, y+1, 3, 8, shirt_s)
            px(d, cx-6, y+9, 3, 3, skin_s)
        elif arm_pose == 'walk_a':
            px(d, cx-6, y-1, 3, 9, shirt_s)
            px(d, cx-6, y+8, 3, 3, skin_s)
        elif arm_pose == 'walk_b':
            px(d, cx-6, y+3, 3, 9, shirt_s)
            px(d, cx-6, y+12, 3, 2, skin_s)
        elif arm_pose == 'work':
            px(d, cx-6, y+1, 3, 6, shirt_s)
            px(d, cx-9, y+7, 6, 2, skin_s)
    elif facing == 'right':
        if arm_pose == 'idle':
            px(d, cx+4, y+1, 3, 8, shirt)
            px(d, cx+4, y+9, 3, 3, skin)
        elif arm_pose == 'walk_a':
            px(d, cx+4, y-1, 3, 9, shirt)
            px(d, cx+4, y+8, 3, 3, skin)
        elif arm_pose == 'walk_b':
            px(d, cx+4, y+3, 3, 9, shirt)
            px(d, cx+4, y+12, 3, 2, skin)
        elif arm_pose == 'work':
            px(d, cx+4, y+1, 3, 6, shirt)
            px(d, cx+4, y+7, 6, 2, skin)


def draw_legs_standing(d, cx, cy, pal, facing, step=0):
    """Draw legs for standing/walking pose."""
    pants, pants_s = pal['pants'], pal['pants_s']
    shoes = pal['shoes']
    y = cy

    if step == 0:  # neutral
        px(d, cx-5, y, 4, 10, pants)
        px(d, cx+1, y, 4, 10, pants_s)
        px(d, cx-6, y+10, 5, 3, shoes)
        px(d, cx+1, y+10, 5, 3, shoes)
    elif step == 1:  # left forward
        px(d, cx-6, y, 4, 12, pants)
        px(d, cx+1, y+2, 4, 8, pants_s)
        px(d, cx-7, y+12, 5, 3, shoes)
        px(d, cx+1, y+10, 5, 3, shoes)
    elif step == 2:  # right forward
        px(d, cx-5, y+2, 4, 8, pants)
        px(d, cx+2, y, 4, 12, pants_s)
        px(d, cx-5, y+10, 5, 3, shoes)
        px(d, cx+2, y+12, 5, 3, shoes)
    elif step == 3:  # neutral variant (slight)
        px(d, cx-5, y+1, 4, 9, pants)
        px(d, cx+1, y+1, 4, 9, pants_s)
        px(d, cx-6, y+10, 5, 3, shoes)
        px(d, cx+1, y+10, 5, 3, shoes)


def draw_legs_sitting(d, cx, cy, pal, facing):
    """Draw legs for sitting pose (bent at knees)."""
    pants, pants_s = pal['pants'], pal['pants_s']
    shoes = pal['shoes']
    y = cy

    if facing in ('down', 'front'):
        px(d, cx-5, y, 4, 5, pants)
        px(d, cx+1, y, 4, 5, pants_s)
        # Bent forward legs
        px(d, cx-6, y+5, 5, 4, pants)
        px(d, cx+1, y+5, 5, 4, pants_s)
        px(d, cx-6, y+9, 5, 3, shoes)
        px(d, cx+1, y+9, 5, 3, shoes)
    elif facing in ('up', 'back'):
        px(d, cx-5, y, 4, 5, pants)
        px(d, cx+1, y, 4, 5, pants_s)
        px(d, cx-5, y+5, 4, 3, pants)
        px(d, cx+1, y+5, 4, 3, pants_s)
        px(d, cx-5, y+8, 4, 3, shoes)
        px(d, cx+1, y+8, 4, 3, shoes)
    elif facing == 'left':
        px(d, cx-4, y, 6, 5, pants)
        px(d, cx-6, y+5, 5, 4, pants_s)
        px(d, cx-7, y+9, 5, 3, shoes)
    elif facing == 'right':
        px(d, cx-2, y, 6, 5, pants)
        px(d, cx+2, y+5, 5, 4, pants_s)
        px(d, cx+2, y+9, 5, 3, shoes)


def draw_shadow(d, cx, y):
    """Ground shadow ellipse."""
    ellipse_px(d, cx, y, 8, 2, (0, 0, 0, 50))


def draw_character_frame(img, ox, oy, pal, facing, anim, frame_idx):
    """
    Draw a single character frame at pixel offset (ox, oy).
    anim: 'idle', 'walk', 'sit_idle', 'sit_work', 'done_dance', 'alert_jump'
    frame_idx: 0-3
    """
    d = ImageDraw.Draw(img)
    cx = ox + FW // 2   # center x
    head_cy = oy + 16   # head center y
    body_cy = oy + 26   # body top y
    legs_cy = oy + 38   # legs top y
    shadow_y = oy + 55  # shadow y

    bob = 0
    arm_pose = 'idle'
    leg_step = 0
    sitting = False

    if anim == 'idle':
        bob = [0, 0, -1, 0][frame_idx]
        arm_pose = 'idle'
        leg_step = 0
    elif anim == 'walk':
        bob = [0, -1, 0, -1][frame_idx]
        arm_pose = ['idle', 'walk_a', 'idle', 'walk_b'][frame_idx]
        leg_step = frame_idx
    elif anim == 'sit_idle':
        sitting = True
        bob = [0, 0, -1, 0][frame_idx]
    elif anim == 'sit_work':
        sitting = True
        bob = [0, -1, 0, -1][frame_idx]
        arm_pose = 'work'
    elif anim == 'done_dance':
        bob = [0, -3, 0, -3][frame_idx]
        arm_pose = ['walk_a', 'walk_b', 'walk_a', 'walk_b'][frame_idx]
        leg_step = frame_idx
    elif anim == 'alert_jump':
        bob = [0, -4, -2, 0][frame_idx]
        arm_pose = ['idle', 'walk_a', 'walk_b', 'idle'][frame_idx]
        leg_step = [0, 1, 2, 0][frame_idx]

    # Draw shadow
    draw_shadow(d, cx, shadow_y)

    if sitting:
        # Chair hint
        chair_c = (85, 90, 105, 200)
        if facing in ('down', 'front'):
            px(d, cx-8, body_cy+8+bob, 16, 3, chair_c)
        elif facing in ('up', 'back'):
            px(d, cx-8, body_cy+6+bob, 16, 3, chair_c)
            px(d, cx-7, body_cy-2+bob, 14, 8, chair_c)  # chair back
        elif facing == 'left':
            px(d, cx-2, body_cy+8+bob, 10, 3, chair_c)
        elif facing == 'right':
            px(d, cx-8, body_cy+8+bob, 10, 3, chair_c)

        # Sitting: body is lower, legs are bent
        draw_legs_sitting(d, cx, legs_cy + 2 + bob, pal, facing)
        draw_body_standing(d, cx, body_cy + 2 + bob, pal, facing, 0, arm_pose)
        draw_head(d, cx, head_cy + 2 + bob, pal, facing, 0)
    else:
        draw_legs_standing(d, cx, legs_cy + bob, pal, facing, leg_step)
        draw_body_standing(d, cx, body_cy + bob, pal, facing, 0, arm_pose)
        draw_head(d, cx, head_cy + bob, pal, facing, 0)


def make_sprite_sheet(avatar_idx, pal):
    """
    Generate a sprite sheet: 8 cols x 9 rows.
    Layout matches pixel-agent-desk:
      Row 0: front_idle (4f) + front_walk (4f)
      Row 1: front_sit_idle (4f) + front_sit_work (4f)
      Row 2: left_idle (4f) + left_walk (4f)
      Row 3: left_sit_idle (4f) + left_sit_work (4f)
      Row 4: right_idle (4f) + right_walk (4f)
      Row 5: right_sit_idle (4f) + right_sit_work (4f)
      Row 6: back_idle (4f) + back_walk (4f)
      Row 7: back_sit_idle (4f) + back_sit_work (4f)
      Row 8: front_done_dance (4f) + front_alert_jump (4f)
    """
    sheet_w = COLS * FW  # 384
    sheet_h = ROWS * FH  # 576
    img = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    # (row, col_offset, facing, anim)
    animations = [
        # Row 0
        (0, 0, 'down', 'idle'),      (0, 4, 'down', 'walk'),
        # Row 1
        (1, 0, 'down', 'sit_idle'),   (1, 4, 'down', 'sit_work'),
        # Row 2
        (2, 0, 'left', 'idle'),      (2, 4, 'left', 'walk'),
        # Row 3
        (3, 0, 'left', 'sit_idle'),   (3, 4, 'left', 'sit_work'),
        # Row 4
        (4, 0, 'right', 'idle'),     (4, 4, 'right', 'walk'),
        # Row 5
        (5, 0, 'right', 'sit_idle'),  (5, 4, 'right', 'sit_work'),
        # Row 6
        (6, 0, 'up', 'idle'),        (6, 4, 'up', 'walk'),
        # Row 7
        (7, 0, 'up', 'sit_idle'),     (7, 4, 'up', 'sit_work'),
        # Row 8
        (8, 0, 'down', 'done_dance'), (8, 4, 'down', 'alert_jump'),
    ]

    for row, col_off, facing, anim in animations:
        for f in range(4):
            ox = (col_off + f) * FW
            oy = row * FH
            draw_character_frame(img, ox, oy, pal, facing, anim, f)

    img.save(CHAR_DIR / f'avatar_{avatar_idx}.webp', lossless=True)
    print(f'  avatar_{avatar_idx}.webp ({sheet_w}x{sheet_h})')


# ═══════════════════════════════════════════════════════════════════
#  OFFICE ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════

# Office color scheme – WagerProof dark/professional theme
FLOOR_BASE   = (42, 46, 58, 255)
FLOOR_LINE   = (48, 52, 65, 255)
FLOOR_ACCENT = (38, 42, 55, 255)
WALL_TOP     = (55, 60, 78, 255)
WALL_TRIM    = (65, 72, 92, 255)
DESK_WOOD    = (82, 68, 55, 255)
DESK_WOOD_L  = (98, 82, 68, 255)
DESK_WOOD_D  = (65, 52, 42, 255)
DESK_METAL   = (92, 98, 110, 255)
MONITOR_BODY = (48, 52, 62, 255)
MONITOR_SCREEN = (32, 178, 170, 255)   # WagerProof teal
MONITOR_OFF  = (55, 62, 78, 255)
PLANT_POT    = (102, 88, 72, 255)
PLANT_GREEN  = (58, 148, 82, 255)
PLANT_GREEN2 = (72, 168, 98, 255)
CARPET_A     = (52, 48, 72, 255)
CARPET_B     = (58, 55, 82, 255)
CHAIR_BODY   = (72, 78, 95, 255)
CHAIR_DARK   = (58, 62, 78, 255)
SOFA_BODY    = (72, 65, 95, 255)
SOFA_LIGHT   = (88, 78, 112, 255)
WHITEBOARD   = (225, 230, 240, 255)
GLASS_WALL   = (120, 145, 175, 80)


def draw_tile_floor(d):
    """Draw textured dark tile floor."""
    d.rectangle([0, 0, MAP_W, MAP_H], fill=FLOOR_BASE)
    # Grid lines
    for x in range(0, MAP_W, TILE):
        d.line([(x, 0), (x, MAP_H)], fill=FLOOR_LINE, width=1)
    for y in range(0, MAP_H, TILE):
        d.line([(0, y), (MAP_W, y)], fill=FLOOR_LINE, width=1)
    # Subtle noise
    for _ in range(300):
        x = random.randint(0, MAP_W-1)
        y = random.randint(0, MAP_H-1)
        c = random.choice([FLOOR_ACCENT, lighter(FLOOR_BASE)])
        d.point((x, y), fill=c)


def draw_wall_top(d):
    """Draw the top wall with trim."""
    px(d, 0, 0, MAP_W, 24, WALL_TOP)
    px(d, 0, 24, MAP_W, 3, WALL_TRIM)
    # Wall texture
    for x in range(0, MAP_W, 8):
        px(d, x, 0, 1, 24, darker(WALL_TOP))


def draw_office_desk(d, x, y, w=80, h=44, has_monitor=True):
    """Draw a detailed desk with wood grain."""
    # Desk top surface
    px(d, x, y, w, h, DESK_WOOD)
    px(d, x+1, y+1, w-2, 2, DESK_WOOD_L)  # top highlight
    px(d, x+1, y+h-3, w-2, 2, DESK_WOOD_D)  # bottom shadow
    # Wood grain
    for gx in range(x+4, x+w-4, 6):
        px(d, gx, y+4, 1, h-8, DESK_WOOD_D)
    # Legs
    px(d, x+2, y+h, 4, 6, DESK_METAL)
    px(d, x+w-6, y+h, 4, 6, DESK_METAL)
    # Drawer handle
    px(d, x+w//2-4, y+h-6, 8, 1, DESK_METAL)

    if has_monitor:
        draw_office_monitor(d, x + w//2 - 12, y + 6)


def draw_office_monitor(d, x, y):
    """Draw a detailed monitor."""
    # Monitor body
    px(d, x, y, 24, 16, MONITOR_BODY)
    px(d, x+1, y+1, 22, 13, MONITOR_SCREEN)
    # Screen content lines (code-like)
    for ly in range(y+3, y+12, 2):
        lw = random.randint(6, 16)
        c = lighter(MONITOR_SCREEN) if random.random() > 0.5 else (52, 195, 188, 255)
        px(d, x+3, ly, lw, 1, c)
    # Stand
    px(d, x+10, y+16, 4, 3, MONITOR_BODY)
    px(d, x+7, y+19, 10, 2, DESK_METAL)


def draw_office_chair(d, x, y, facing='down'):
    """Draw an office chair."""
    # Wheels
    px(d, x+1, y+14, 2, 2, CHAIR_DARK)
    px(d, x+9, y+14, 2, 2, CHAIR_DARK)
    # Seat
    px(d, x, y+8, 12, 6, CHAIR_BODY)
    # Back
    if facing == 'up':
        px(d, x+1, y, 10, 8, CHAIR_BODY)
        px(d, x+2, y+1, 8, 6, CHAIR_DARK)
    elif facing == 'down':
        px(d, x+1, y+8, 10, 2, CHAIR_DARK)


def draw_office_plant(d, x, y, size='medium'):
    """Draw a detailed potted plant."""
    # Pot
    pw = 12 if size == 'medium' else 8
    ph = 10 if size == 'medium' else 7
    px(d, x+2, y+16, pw, ph, PLANT_POT)
    px(d, x+3, y+16, pw-2, 2, lighter(PLANT_POT))
    # Leaves
    if size == 'medium':
        for i in range(7):
            lx = x + 3 + random.randint(0, 8)
            ly = y + random.randint(0, 12)
            lw = random.randint(3, 5)
            lh = random.randint(4, 8)
            c = random.choice([PLANT_GREEN, PLANT_GREEN2, darker(PLANT_GREEN)])
            px(d, lx, ly, lw, lh, c)
    else:
        for i in range(4):
            lx = x + 2 + random.randint(0, 4)
            ly = y + 4 + random.randint(0, 8)
            px(d, lx, ly, 3, 6, random.choice([PLANT_GREEN, PLANT_GREEN2]))


def draw_rug_area(d, x, y, w, h):
    """Draw a carpet/rug area."""
    px(d, x, y, w, h, CARPET_A)
    px(d, x+2, y+2, w-4, h-4, CARPET_B)
    # Pattern
    for rx in range(x+6, x+w-6, 8):
        for ry in range(y+6, y+h-6, 8):
            px(d, rx, ry, 2, 2, CARPET_A)


def draw_sofa(d, x, y):
    """Draw a sofa/couch."""
    px(d, x, y+8, 72, 24, SOFA_BODY)
    px(d, x+2, y+10, 68, 14, SOFA_LIGHT)
    # Back
    px(d, x+4, y, 64, 10, SOFA_BODY)
    px(d, x+6, y+2, 60, 6, SOFA_LIGHT)
    # Armrests
    px(d, x, y+4, 6, 28, SOFA_BODY)
    px(d, x+66, y+4, 6, 28, SOFA_BODY)
    # Cushion lines
    px(d, x+24, y+10, 1, 14, SOFA_BODY)
    px(d, x+46, y+10, 1, 14, SOFA_BODY)


def draw_whiteboard(d, x, y, w=64, h=24):
    """Draw a whiteboard on the wall."""
    px(d, x, y, w, h, WHITEBOARD)
    px(d, x+1, y+1, w-2, h-2, (240, 244, 250, 255))
    # Content scribbles
    for _ in range(4):
        sx = x + 4 + random.randint(0, w-16)
        sy = y + 4 + random.randint(0, h-10)
        sw = random.randint(8, 20)
        c = random.choice([(180, 60, 60, 180), (60, 120, 180, 180), (60, 150, 80, 180)])
        px(d, sx, sy, sw, 1, c)


def draw_coffee_machine(d, x, y):
    """Draw a coffee machine."""
    px(d, x, y+4, 14, 16, (78, 82, 95, 255))
    px(d, x+1, y+5, 12, 8, (52, 55, 68, 255))
    px(d, x+2, y+6, 4, 4, (210, 180, 140, 255))  # coffee display
    px(d, x+4, y+14, 6, 4, (65, 68, 80, 255))     # drip tray
    px(d, x+1, y, 12, 4, (88, 92, 108, 255))       # top
    # Cup
    px(d, x+5, y+16, 4, 4, (230, 230, 235, 255))


def draw_server_rack(d, x, y):
    """Draw a small server/equipment rack."""
    px(d, x, y, 20, 32, (52, 56, 68, 255))
    px(d, x+1, y+1, 18, 30, (42, 46, 58, 255))
    # Server units with blinking lights
    for i in range(4):
        sy = y + 3 + i * 7
        px(d, x+2, sy, 16, 5, (55, 58, 72, 255))
        px(d, x+3, sy+1, 2, 1, (52, 210, 100, 255))  # green LED
        px(d, x+6, sy+1, 2, 1, (52, 210, 100, 255))
        px(d, x+3, sy+3, 10, 1, (62, 65, 78, 255))    # vent lines


def draw_bookshelf(d, x, y):
    """Draw a bookshelf against a wall."""
    px(d, x, y, 40, 48, (58, 50, 42, 255))  # frame
    px(d, x+2, y+2, 36, 44, (48, 42, 35, 255))  # interior
    # Shelves
    for sy in [y+12, y+24, y+36]:
        px(d, x+2, sy, 36, 2, (62, 54, 45, 255))
    # Books (colored spines)
    book_colors = [(180,60,60,255),(60,100,180,255),(60,150,80,255),(180,140,60,255),(140,60,160,255)]
    for shelf_y in [y+2, y+14, y+26]:
        bx = x + 4
        for _ in range(5):
            bw = random.randint(4, 7)
            bh = random.randint(8, 10)
            c = random.choice(book_colors)
            px(d, bx, shelf_y + (10-bh), bw, bh, c)
            bx += bw + 1
            if bx > x + 34:
                break


def draw_tv_screen(d, x, y, w=48, h=32):
    """Draw a wall-mounted TV / big screen."""
    px(d, x, y, w, h, (38, 42, 52, 255))  # bezel
    px(d, x+2, y+2, w-4, h-6, (22, 28, 38, 255))  # screen
    # Scoreboard-style content
    px(d, x+4, y+4, w-8, 2, MONITOR_SCREEN)
    px(d, x+4, y+8, 12, 1, (200, 200, 210, 255))
    px(d, x+4, y+11, 12, 1, (200, 200, 210, 255))
    px(d, x+20, y+8, 8, 1, (220, 80, 80, 255))
    px(d, x+20, y+11, 8, 1, (80, 200, 100, 255))
    # Stand
    px(d, x + w//2 - 2, y + h - 4, 4, 4, (52, 56, 68, 255))


def draw_water_cooler(d, x, y):
    """Draw a water cooler."""
    px(d, x+2, y, 8, 6, (140, 180, 220, 255))  # jug
    px(d, x+3, y+1, 6, 4, (170, 210, 240, 255))
    px(d, x+1, y+6, 10, 14, (210, 215, 225, 255))  # body
    px(d, x+2, y+7, 8, 2, (190, 195, 205, 255))
    px(d, x+3, y+20, 6, 2, (160, 165, 175, 255))  # base


def draw_arcade_cabinet(d, x, y):
    """Draw a small arcade cabinet."""
    px(d, x, y+4, 18, 32, (45, 42, 68, 255))   # body
    px(d, x+1, y, 16, 6, (55, 52, 78, 255))      # top
    px(d, x+2, y+6, 14, 12, (22, 28, 38, 255))   # screen
    # Screen glow
    px(d, x+4, y+8, 10, 8, (32, 178, 170, 180))
    px(d, x+6, y+10, 3, 3, (255, 220, 80, 255))   # game char
    # Controls
    px(d, x+3, y+20, 12, 4, (35, 32, 55, 255))
    px(d, x+5, y+21, 2, 2, (220, 60, 60, 255))    # button
    px(d, x+9, y+21, 2, 2, (60, 120, 220, 255))   # button


def draw_trophy_case(d, x, y):
    """Draw a trophy display case."""
    px(d, x, y, 36, 40, (62, 55, 48, 255))     # wood frame
    px(d, x+2, y+2, 32, 36, (35, 40, 52, 255))  # glass
    # Shelves
    px(d, x+2, y+14, 32, 2, (55, 48, 42, 255))
    px(d, x+2, y+26, 32, 2, (55, 48, 42, 255))
    # Trophies
    px(d, x+6, y+4, 4, 10, (218, 178, 62, 255))   # gold trophy
    px(d, x+4, y+11, 8, 2, (218, 178, 62, 255))
    px(d, x+16, y+6, 4, 8, (192, 192, 200, 255))   # silver
    px(d, x+14, y+11, 8, 2, (192, 192, 200, 255))
    px(d, x+26, y+4, 4, 10, (178, 128, 58, 255))   # bronze
    px(d, x+8, y+16, 6, 8, (218, 178, 62, 255))    # small cup
    px(d, x+20, y+18, 8, 6, (52, 210, 100, 255))   # green star


def draw_standing_lamp(d, x, y):
    """Draw a standing floor lamp."""
    px(d, x+3, y, 6, 4, (210, 195, 160, 200))   # shade (warm glow)
    px(d, x+5, y+4, 2, 18, (82, 78, 72, 255))   # pole
    px(d, x+3, y+22, 6, 2, (72, 68, 62, 255))   # base


def build_office_maps():
    """Build all office map layers — 640x768 (20x24 tiles)."""
    bg = Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0))
    fg = Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0))
    coll = Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0))
    coord = Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0))
    laptop_map = Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0))

    db = ImageDraw.Draw(bg)
    df = ImageDraw.Draw(fg)
    dc = ImageDraw.Draw(coll)
    dz = ImageDraw.Draw(coord)
    dl = ImageDraw.Draw(laptop_map)

    # ── Floor ──
    draw_tile_floor(db)

    # ── Top wall ──
    draw_wall_top(db)
    dc.rectangle([0, 0, MAP_W-1, 26], fill=(0, 0, 0, 255))

    # ════════════════════════════════════════════════════
    #  UPPER ZONE: WORK AREA (y: 30–380)
    # ════════════════════════════════════════════════════

    # -- Desks: 3 columns x 2 rows on the left --
    desk_positions = [
        (40, 60), (160, 60), (280, 60),
        (40, 160), (160, 160), (280, 160),
    ]
    for dx, dy in desk_positions:
        draw_office_desk(db, dx, dy, 80, 44)
        draw_office_chair(db, dx + 34, dy + 50, 'up')
        dc.rectangle([dx, dy, dx+79, dy+49], fill=(0, 0, 0, 255))
        dz.rectangle([dx, dy+20, dx+79, dy+49], fill=(0, 0, 255, 255))
        dl.rectangle([dx+28, dy+8, dx+52, dy+22], fill=(0, 255, 255, 255))

    # -- Right side: Research lab area --
    # Glass partition
    px(db, 390, 27, 3, 200, WALL_TRIM)
    px(df, 393, 30, 2, 190, GLASS_WALL)
    dc.rectangle([390, 27, 392, 226], fill=(0, 0, 0, 255))

    # Research desks (right of partition)
    research_desks = [(420, 70), (540, 70)]
    for dx, dy in research_desks:
        draw_office_desk(db, dx, dy, 80, 44)
        draw_office_chair(db, dx + 34, dy + 50, 'up')
        dc.rectangle([dx, dy, dx+79, dy+49], fill=(0, 0, 0, 255))
        dz.rectangle([dx, dy+20, dx+79, dy+49], fill=(0, 0, 255, 255))
        dl.rectangle([dx+28, dy+8, dx+52, dy+22], fill=(0, 255, 255, 255))

    # Big screen / war room display on right wall
    draw_tv_screen(db, 565, 30, 60, 36)
    dc.rectangle([565, 30, 624, 65], fill=(0, 0, 0, 255))

    # Whiteboard in research area
    draw_whiteboard(db, 420, 2, 80, 22)

    # Server rack
    draw_server_rack(db, 410, 160)
    dc.rectangle([410, 160, 429, 191], fill=(0, 0, 0, 255))

    # -- Whiteboards on top wall (left side) --
    draw_whiteboard(db, 80, 2, 72, 22)
    draw_whiteboard(db, 168, 2, 72, 22)

    # -- WagerProof logo display --
    px(db, 260, 2, 110, 22, (35, 45, 60, 255))
    px(db, 262, 4, 106, 18, (28, 38, 52, 255))
    px(db, 266, 8, 44, 10, MONITOR_SCREEN)
    px(db, 316, 8, 48, 10, (52, 62, 78, 255))

    # -- Plants along top wall --
    for px_pos, py_pos in [(12, 28), (370, 28), (608, 28)]:
        draw_office_plant(db, px_pos, py_pos, 'medium')
        dc.rectangle([px_pos+2, py_pos+16, px_pos+14, py_pos+26], fill=(0, 0, 0, 255))

    # Small desk plants
    for px_pos, py_pos in [(130, 58), (250, 58), (510, 58)]:
        draw_office_plant(db, px_pos, py_pos, 'small')

    # -- Open corridor between upper and lower zones --
    # Hallway divider line (subtle)
    px(db, 0, 275, MAP_W, 2, (52, 56, 68, 255))

    # ════════════════════════════════════════════════════
    #  MIDDLE ZONE: HALLWAY / CORRIDOR (y: 280–400)
    # ════════════════════════════════════════════════════

    # Trophy case on left wall
    draw_trophy_case(db, 20, 290)
    dc.rectangle([20, 290, 55, 329], fill=(0, 0, 0, 255))

    # Bookshelf
    draw_bookshelf(db, 70, 286)
    dc.rectangle([70, 286, 109, 333], fill=(0, 0, 0, 255))

    # Standing lamps
    draw_standing_lamp(db, 130, 290)
    draw_standing_lamp(db, 500, 290)

    # Water cooler
    draw_water_cooler(db, 155, 296)
    dc.rectangle([156, 296, 165, 318], fill=(0, 0, 0, 255))

    # Hallway idle zones (green)
    dz.rectangle([170, 290, 380, 370], fill=(0, 255, 0, 255))
    dz.rectangle([400, 290, 490, 370], fill=(0, 255, 0, 255))

    # ════════════════════════════════════════════════════
    #  LOWER ZONE: BREAK ROOM & LOUNGE (y: 400–760)
    # ════════════════════════════════════════════════════

    # Carpet area for break room
    draw_rug_area(db, 30, 420, 280, 200)

    # Break room wall section
    px(db, 0, 400, MAP_W, 3, (55, 60, 78, 255))
    # Doorway gaps (no collision in doorways)
    px(db, 180, 400, 60, 3, FLOOR_BASE)
    px(db, 440, 400, 60, 3, FLOOR_BASE)

    # Sofa area (left side)
    draw_sofa(db, 60, 460)
    dc.rectangle([60, 464, 131, 494], fill=(0, 0, 0, 255))

    # Coffee table
    px(db, 80, 510, 48, 24, DESK_WOOD)
    px(db, 81, 511, 46, 2, DESK_WOOD_L)
    dc.rectangle([80, 510, 127, 533], fill=(0, 0, 0, 255))

    # Second sofa facing first
    draw_sofa(db, 60, 550)
    dc.rectangle([60, 554, 131, 584], fill=(0, 0, 0, 255))

    # Arcade cabinet
    draw_arcade_cabinet(db, 230, 440)
    dc.rectangle([230, 444, 247, 475], fill=(0, 0, 0, 255))

    # Standing lamp near arcade
    draw_standing_lamp(db, 260, 440)

    # Kitchen / counter area (right side lower)
    px(db, 400, 420, 220, 36, DESK_WOOD)
    px(db, 401, 421, 218, 2, DESK_WOOD_L)
    px(db, 401, 452, 218, 2, DESK_WOOD_D)
    dc.rectangle([400, 420, 619, 455], fill=(0, 0, 0, 255))

    # Coffee machine on counter
    draw_coffee_machine(db, 430, 404)
    # Second coffee machine
    draw_coffee_machine(db, 460, 404)

    # Water cooler near kitchen
    draw_water_cooler(db, 540, 406)
    dc.rectangle([541, 406, 550, 428], fill=(0, 0, 0, 255))

    # Bar stools
    for sx in [420, 460, 500, 540, 580]:
        px(db, sx, 460, 10, 8, CHAIR_BODY)
        px(db, sx+3, 468, 4, 6, CHAIR_DARK)

    # Right side lounge - meeting table
    px(db, 420, 530, 80, 48, DESK_WOOD)
    px(db, 421, 531, 78, 2, DESK_WOOD_L)
    dc.rectangle([420, 530, 499, 577], fill=(0, 0, 0, 255))

    # Chairs around meeting table
    for cx, cy in [(428, 520), (468, 520), (428, 582), (468, 582)]:
        px(db, cx, cy, 12, 10, CHAIR_BODY)

    # TV on the break room wall
    draw_tv_screen(db, 100, 410, 56, 32)
    dc.rectangle([100, 410, 155, 441], fill=(0, 0, 0, 255))

    # Plants in lower area
    for px_pos, py_pos in [(20, 420), (310, 440), (598, 460), (20, 620), (340, 580)]:
        draw_office_plant(db, px_pos, py_pos, 'medium')
        dc.rectangle([px_pos+2, py_pos+16, px_pos+14, py_pos+26], fill=(0, 0, 0, 255))

    # Bookshelf in break room
    draw_bookshelf(db, 270, 470)
    dc.rectangle([270, 470, 309, 517], fill=(0, 0, 0, 255))

    # Lower idle zones
    dz.rectangle([140, 440, 220, 600], fill=(0, 255, 0, 255))
    dz.rectangle([340, 480, 400, 620], fill=(0, 255, 0, 255))
    dz.rectangle([510, 480, 600, 600], fill=(0, 255, 0, 255))

    # ════════════════════════════════════════════════════
    #  BOTTOM AREA: Open space (y: 620–760)
    # ════════════════════════════════════════════════════

    # More open floor space
    dz.rectangle([40, 620, 600, 740], fill=(0, 255, 0, 255))

    # A few scattered decorations
    draw_standing_lamp(db, 40, 640)
    draw_standing_lamp(db, 600, 640)

    # Small rug area
    draw_rug_area(db, 200, 650, 240, 80)

    # Bottom floor line
    px(df, 0, MAP_H - 2, MAP_W, 2, (35, 38, 48, 255))

    # ── Save ──
    bg.save(OFFICE_DIR / 'office_bg_32.webp', lossless=True)
    fg.save(OFFICE_DIR / 'office_fg_32.webp', lossless=True)
    coll.save(OFFICE_DIR / 'office_collision.webp', lossless=True)
    coord.save(OFFICE_DIR / 'office_xy.webp', lossless=True)
    laptop_map.save(OBJ_DIR / 'office_laptop.webp', lossless=True)

    print(f'  Office maps: {MAP_W}x{MAP_H} ({MAP_W//TILE}x{MAP_H//TILE} tiles)')


# ═══════════════════════════════════════════════════════════════════
#  LAPTOP OBJECTS
# ═══════════════════════════════════════════════════════════════════

def make_laptop(direction, opened):
    """Generate laptop sprite for a given direction and state."""
    img = Image.new('RGBA', (32, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body = (62, 68, 82, 255)
    body_l = (72, 78, 95, 255)
    key = (52, 55, 68, 255)
    screen = MONITOR_SCREEN
    screen_frame = (48, 52, 62, 255)

    if direction in ('front', 'back'):
        # Base/keyboard
        px(d, 5, 14, 22, 5, key)
        px(d, 4, 18, 24, 3, body)
        px(d, 5, 14, 22, 1, body_l)  # edge highlight
        if opened:
            px(d, 6, 4, 20, 11, screen_frame)
            px(d, 7, 5, 18, 8, screen)
            # Screen content
            px(d, 9, 7, 8, 1, lighter(screen))
            px(d, 9, 9, 12, 1, lighter(screen))
    elif direction == 'left':
        px(d, 8, 14, 16, 5, key)
        px(d, 6, 18, 20, 3, body)
        if opened:
            px(d, 3, 4, 12, 12, screen_frame)
            px(d, 4, 5, 10, 9, screen)
    elif direction == 'right':
        px(d, 8, 14, 16, 5, key)
        px(d, 6, 18, 20, 3, body)
        if opened:
            px(d, 17, 4, 12, 12, screen_frame)
            px(d, 18, 5, 10, 9, screen)

    suffix = 'open' if opened else 'close'
    img.save(OBJ_DIR / f'office_laptop_{direction}_{suffix}.webp', lossless=True)


# ═══════════════════════════════════════════════════════════════════
#  JSON CONFIGS (matching pixel-agent-desk format)
# ═══════════════════════════════════════════════════════════════════

import json

def write_configs():
    """Write sprite-frames.json and avatars.json."""
    # Avatar list
    avatars = [f'avatar_{i}.webp' for i in range(8)]
    with open(SHARED_DIR / 'avatars.json', 'w') as f:
        json.dump(avatars, f, indent=2)

    # Sprite frame definitions (matching original repo exactly)
    frames = {
        'front_idle':      [0, 1, 2, 3],
        'front_walk':      [4, 5, 6, 7],
        'front_sit_idle':  [8, 9, 10, 11],
        'front_sit_work':  [12, 13, 14, 15],
        'left_idle':       [16, 17, 18, 19],
        'left_walk':       [20, 21, 22, 23],
        'left_sit_idle':   [24, 25, 26, 27],
        'left_sit_work':   [28, 29, 30, 31],
        'right_idle':      [32, 33, 34, 35],
        'right_walk':      [36, 37, 38, 39],
        'right_sit_idle':  [40, 41, 42, 43],
        'right_sit_work':  [44, 45, 46, 47],
        'back_idle':       [48, 49, 50, 51],
        'back_walk':       [52, 53, 54, 55],
        'back_sit_idle':   [56, 57, 58, 59],
        'back_sit_work':   [60, 61, 62, 63],
        'front_done_dance':[64, 65, 66, 67],
        'front_alert_jump':[68, 69, 70, 71],
    }
    with open(SHARED_DIR / 'sprite-frames.json', 'w') as f:
        json.dump(frames, f, indent=2)

    print(f'  avatars.json, sprite-frames.json')


# ═══════════════════════════════════════════════════════════════════
#  PREVIEW
# ═══════════════════════════════════════════════════════════════════

def make_preview():
    """Generate a composite preview image."""
    pw, ph = 960, 600
    preview = Image.new('RGBA', (pw, ph), (28, 32, 42, 255))

    # Load and scale office bg
    bg = Image.open(OFFICE_DIR / 'office_bg_32.webp').convert('RGBA')
    bg_scaled = bg.resize((MAP_W * 2, MAP_H * 2), Image.NEAREST)

    # Paste characters on the office
    scene = bg.copy()
    for i in range(min(4, len(CHAR_PALETTES))):
        sheet = Image.open(CHAR_DIR / f'avatar_{i}.webp').convert('RGBA')
        # Extract front_idle frame 0
        frame = sheet.crop((0, 0, FW, FH))
        # Place at different positions
        positions = [(120, 180), (200, 180), (450, 130), (460, 290)]
        scene.alpha_composite(frame, positions[i])

    fg = Image.open(OFFICE_DIR / 'office_fg_32.webp').convert('RGBA')
    scene.alpha_composite(fg)

    scene_scaled = scene.resize((800, 480), Image.NEAREST)
    preview.alpha_composite(scene_scaled, (80, 20))

    # Character strip at bottom
    for i in range(8):
        sheet = Image.open(CHAR_DIR / f'avatar_{i}.webp').convert('RGBA')
        frame = sheet.crop((0, 0, FW, FH))
        frame_big = frame.resize((FW*2, FH*2), Image.NEAREST)
        preview.alpha_composite(frame_big, (40 + i * 110, 510))

    preview.save(OUT / 'preview.webp', lossless=True)
    print(f'  preview.webp')


# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print('Generating WagerProof Pixel Office assets v2...')
    print()

    print('Characters (8 avatars, 48x64 frames, 8x9 grid):')
    for i, pal in enumerate(CHAR_PALETTES):
        make_sprite_sheet(i, pal)

    print()
    print('Office environment:')
    build_office_maps()

    print()
    print('Laptop objects:')
    for direction in ['front', 'back', 'left', 'right']:
        make_laptop(direction, opened=False)
        make_laptop(direction, opened=True)
    print('  8 laptop sprites')

    print()
    print('Config files:')
    write_configs()

    print()
    print('Preview:')
    make_preview()

    print()
    print(f'All assets written to: {OUT}')
    print(f'Total: 8 character sheets + 4 office maps + 8 laptops + 2 configs + 1 preview')
