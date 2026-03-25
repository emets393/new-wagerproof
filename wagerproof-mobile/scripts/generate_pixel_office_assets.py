from PIL import Image, ImageDraw
from pathlib import Path
import random

OUT = Path('/Users/chrishabib/Documents/new-wagerproof/wagerproof-mobile/assets/pixel-office-original')
CHAR_DIR = OUT / 'characters'
OFFICE_DIR = OUT / 'office'
OBJ_DIR = OUT / 'objects'

for d in [OUT, CHAR_DIR, OFFICE_DIR, OBJ_DIR]:
    d.mkdir(parents=True, exist_ok=True)

random.seed(7)

W, H = 640, 384
T = 16

def px_rect(draw, x, y, w, h, c):
    draw.rectangle([x, y, x+w-1, y+h-1], fill=c)

def draw_floor(bg):
    d = ImageDraw.Draw(bg)
    base = (188, 199, 222, 255)
    line = (172, 183, 205, 255)
    d.rectangle([0, 0, W, H], fill=base)
    for x in range(0, W, T):
        d.line([(x, 0), (x, H)], fill=line)
    for y in range(0, H, T):
        d.line([(0, y), (W, y)], fill=line)

    for _ in range(180):
        x = random.randint(0, W-2)
        y = random.randint(0, H-2)
        c = random.choice([(194, 206, 228, 255), (180, 191, 214, 255), (196, 210, 232, 255)])
        d.point((x, y), fill=c)


def draw_desk(draw, x, y, w=96, h=48):
    px_rect(draw, x, y, w, h, (144, 118, 92, 255))
    px_rect(draw, x+2, y+2, w-4, h-4, (158, 130, 102, 255))
    px_rect(draw, x+6, y+8, w-12, 4, (108, 84, 66, 255))
    px_rect(draw, x+4, y+h-8, 6, 8, (108, 84, 66, 255))
    px_rect(draw, x+w-10, y+h-8, 6, 8, (108, 84, 66, 255))


def draw_monitor(draw, x, y):
    px_rect(draw, x, y, 26, 18, (70, 78, 98, 255))
    px_rect(draw, x+2, y+2, 22, 12, (82, 173, 214, 255))
    px_rect(draw, x+11, y+14, 4, 4, (56, 60, 78, 255))
    px_rect(draw, x+8, y+18, 10, 2, (46, 50, 65, 255))


def draw_plant(draw, x, y):
    px_rect(draw, x+5, y+14, 12, 10, (95, 95, 105, 255))
    for i in range(6):
        px_rect(draw, x+8+i, y+8-random.randint(0, 6), 2, 8+random.randint(0, 2), (68, 142, 86, 255))


def draw_sofa(draw, x, y):
    px_rect(draw, x, y+8, 92, 28, (87, 98, 124, 255))
    px_rect(draw, x+2, y+10, 88, 16, (103, 117, 146, 255))
    px_rect(draw, x+8, y, 76, 12, (92, 104, 132, 255))


def draw_rug(draw, x, y, w=208, h=92):
    px_rect(draw, x, y, w, h, (208, 191, 153, 255))
    px_rect(draw, x+2, y+2, w-4, h-4, (221, 205, 166, 255))
    for xx in range(x+8, x+w-8, 12):
        px_rect(draw, xx, y+6, 4, h-12, (213, 197, 158, 255))


def build_office():
    bg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    coll = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    df = ImageDraw.Draw(fg)
    dc = ImageDraw.Draw(coll)

    draw_floor(bg)

    px_rect(d, 0, H-84, W, 84, (201, 204, 214, 255))
    px_rect(d, 0, H-84, W, 4, (168, 172, 182, 255))

    desks = [
        (52, 70), (168, 70), (284, 70),
        (52, 146), (168, 146),
        (402, 90), (512, 90),
        (404, 250), (516, 250),
    ]
    for x, y in desks:
        draw_desk(d, x, y)
        draw_monitor(d, x+34, y+14)
        dc.rectangle([x, y, x+95, y+47], fill=(0, 0, 0, 255))

    draw_rug(d, 380, 232, 236, 114)
    draw_sofa(d, 448, 300)
    dc.rectangle([448, 308, 539, 336], fill=(0, 0, 0, 255))

    plants = [(24, 32), (602, 36), (350, 26), (588, 280)]
    for x, y in plants:
        draw_plant(d, x, y)
        dc.rectangle([x+5, y+14, x+17, y+24], fill=(0, 0, 0, 255))

    px_rect(d, 200, 18, 76, 28, (232, 238, 251, 255))
    px_rect(d, 286, 18, 76, 28, (232, 238, 251, 255))
    px_rect(d, 372, 18, 140, 28, (232, 238, 251, 255))
    px_rect(d, 374, 20, 136, 24, (108, 116, 164, 255))
    px_rect(d, 378, 24, 54, 16, (129, 194, 219, 255))
    px_rect(d, 438, 24, 68, 16, (196, 205, 236, 255))

    px_rect(df, 372, 220, 2, 128, (142, 126, 103, 220))
    px_rect(df, 374, 220, 246, 2, (142, 126, 103, 220))
    px_rect(df, 0, H-84, W, 3, (166, 170, 182, 255))

    bg.save(OFFICE_DIR / 'office_map_bg.webp', lossless=True)
    fg.save(OFFICE_DIR / 'office_map_fg.webp', lossless=True)
    coll.save(OFFICE_DIR / 'office_collision.webp', lossless=True)


def draw_agent_frame(img, ox, oy, palette, facing='down', step=0, state='idle'):
    d = ImageDraw.Draw(img)
    skin, hair, shirt, pants, accent = palette
    bob = 1 if step == 1 and state in ('walk', 'work') else 0
    px_rect(d, ox+10, oy+24, 12, 3, (40, 44, 56, 140))
    px_rect(d, ox+11, oy+4+bob, 10, 8, skin)
    px_rect(d, ox+10, oy+2+bob, 12, 3, hair)
    px_rect(d, ox+10, oy+12+bob, 12, 8, shirt)

    if state == 'error':
        px_rect(d, ox+21, oy+2, 3, 3, (220, 80, 84, 255))
    elif state == 'done':
        px_rect(d, ox+7, oy+2, 3, 3, (88, 188, 106, 255))
    elif state == 'work':
        px_rect(d, ox+21, oy+2, 3, 3, accent)

    if facing in ('left', 'right'):
        arm_x = ox+8 if facing == 'left' else ox+22
        px_rect(d, arm_x, oy+13+bob, 2, 5, skin)
    else:
        px_rect(d, ox+8, oy+13+bob, 2, 5, skin)
        px_rect(d, ox+22, oy+13+bob, 2, 5, skin)

    if state == 'walk' and step in (0,2):
        px_rect(d, ox+11, oy+20+bob, 4, 7, pants)
        px_rect(d, ox+17, oy+19+bob, 4, 8, pants)
    elif state == 'walk' and step == 1:
        px_rect(d, ox+11, oy+19+bob, 4, 8, pants)
        px_rect(d, ox+17, oy+20+bob, 4, 7, pants)
    else:
        px_rect(d, ox+11, oy+20+bob, 4, 7, pants)
        px_rect(d, ox+17, oy+20+bob, 4, 7, pants)


def make_sheet(name, palette):
    fw, fh = 32, 32
    states = ['idle', 'walk', 'work', 'error', 'done']
    dirs = ['down', 'left', 'right', 'up']
    rows = len(states) * len(dirs)
    cols = 3
    img = Image.new('RGBA', (fw*cols, fh*rows), (0,0,0,0))
    r = 0
    for st in states:
        for dr in dirs:
            for c in range(cols):
                draw_agent_frame(img, c*fw, r*fh, palette, facing=dr, step=c, state=st)
            r += 1
    img.save(CHAR_DIR / f'{name}_sheet.webp', lossless=True)


def make_laptop(direction='front', opened=False):
    img = Image.new('RGBA', (32, 24), (0,0,0,0))
    d = ImageDraw.Draw(img)
    body = (94, 100, 116, 255)
    key = (78, 83, 98, 255)
    glow = (104, 196, 226, 255)

    if direction in ('front', 'back'):
        px_rect(d, 6, 14, 20, 5, key)
        px_rect(d, 4, 18, 24, 3, body)
        if opened:
            px_rect(d, 7, 6, 18, 10, body)
            px_rect(d, 9, 8, 14, 6, glow)
    else:
        px_rect(d, 8, 14, 16, 5, key)
        px_rect(d, 6, 18, 20, 3, body)
        if opened:
            if direction == 'left':
                px_rect(d, 10, 6, 10, 10, body)
                px_rect(d, 11, 8, 7, 6, glow)
            else:
                px_rect(d, 12, 6, 10, 10, body)
                px_rect(d, 14, 8, 7, 6, glow)

    suffix = 'open' if opened else 'close'
    img.save(OBJ_DIR / f'office_laptop_{direction}_{suffix}.webp', lossless=True)


def make_preview():
    preview = Image.new('RGBA', (960, 560), (230, 235, 245, 255))
    bg = Image.open(OFFICE_DIR / 'office_map_bg.webp').convert('RGBA')
    fg = Image.open(OFFICE_DIR / 'office_map_fg.webp').convert('RGBA')
    scene = bg.copy()

    a1 = Image.open(CHAR_DIR / 'agent_alpha_sheet.webp').convert('RGBA')
    a2 = Image.open(CHAR_DIR / 'agent_beta_sheet.webp').convert('RGBA')
    a3 = Image.open(CHAR_DIR / 'agent_gamma_sheet.webp').convert('RGBA')

    f1 = a1.crop((32, 0, 64, 32))
    f2 = a2.crop((32, 32, 64, 64))
    f3 = a3.crop((32, 64, 64, 96))

    scene.alpha_composite(f1, (110, 124))
    scene.alpha_composite(f2, (448, 110))
    scene.alpha_composite(f3, (530, 270))
    scene.alpha_composite(fg, (0,0))

    preview.alpha_composite(scene.resize((800, 480), Image.NEAREST), (28, 20))
    dr = ImageDraw.Draw(preview)
    dr.rectangle([28, 508, 932, 542], fill=(204, 214, 234, 255))
    dr.text((36, 516), 'WagerProof Pixel Office - Original First Pass (bg/fg/collision + avatars + laptops)', fill=(48, 58, 82, 255))

    preview.save(OUT / 'preview.webp', lossless=True)


build_office()

palettes = {
    'agent_alpha': ((248, 208, 176, 255), (92, 56, 42, 255), (90, 139, 226, 255), (64, 76, 96, 255), (84, 212, 224, 255)),
    'agent_beta': ((232, 184, 150, 255), (56, 52, 72, 255), (116, 190, 110, 255), (54, 74, 88, 255), (106, 228, 152, 255)),
    'agent_gamma': ((255, 221, 186, 255), (200, 126, 82, 255), (218, 132, 92, 255), (70, 66, 86, 255), (236, 175, 86, 255)),
    'agent_delta': ((209, 163, 132, 255), (44, 42, 48, 255), (165, 132, 230, 255), (56, 62, 84, 255), (178, 132, 245, 255)),
}
for name, pal in palettes.items():
    make_sheet(name, pal)

for d in ['front', 'back', 'left', 'right']:
    make_laptop(d, opened=False)
    make_laptop(d, opened=True)

make_preview()

manifest = OUT / 'README_ASSETS.txt'
manifest.write_text(
    'Original pixel art asset pack generated for WagerProof.\\n'
    'Files:\\n'
    '- office/office_map_bg.webp\\n'
    '- office/office_map_fg.webp\\n'
    '- office/office_collision.webp\\n'
    '- objects/office_laptop_{front,back,left,right}_{open,close}.webp\\n'
    '- characters/agent_{alpha,beta,gamma,delta}_sheet.webp\\n'
    '- preview.webp\\n'
    '\\n'
    'Sprite sheet layout: 3 columns x 20 rows, frame 32x32.\\n'
    'Rows grouped by state (idle, walk, work, error, done), each with directions (down, left, right, up).\\n'
)

print('generated', OUT)
