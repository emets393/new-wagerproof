#!/usr/bin/env python3
"""Build the HD Agent HQ sprite sheets (avatar_hd_0…7.png) from PixelLab character exports.

Each sheet uses the same 8×9 frame layout as the legacy avatar_N sheets (see PixelAnim in
PixelOfficeAssets.swift), with 96×96 art-px cells and the feet 10 px above each cell's bottom
(PixelOfficeGeo.hdFootFromBottom). Missing animations fall back to the direction's rotation with a
small bob, so a character can ship before every animation has been generated.

    python3 scripts/build_hd_agent_sheets.py            # all characters whose export is ready
    python3 scripts/build_hd_agent_sheets.py 0 3        # just these sprite indices

Three sheets per character:
- avatar_hd_N       office sheet. Working agents stand at their desks, so the sit-work rows hold a standing
                    typing loop (PixelLab's "sitting" animations came back as a shuffling standing pose).
- avatar_hd_fx_N    avatar emotes, 9 cols x 5 rows (standby, happy, celebrate, sigh, facepalm), 96 px cells.
- avatar_hd_desk_N  the "Laptop Research" state seated at a desk: typing + researching, 9 x 2, 112 px cells.
"""
import io, json, os, sys, urllib.request, urllib.error, zipfile
from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'WagerproofKit', 'Sources', 'WagerproofDesign', 'Resources', 'PixelOffice')
CELL, FOOT = 96, 10
# PixelLab character ids for sprite indices 0…7 (original office workers styled after the legacy sheets)
IDS = {0: '32239962-d224-4243-accb-2de348548e43', 1: '14acbb1c-cbd3-44c1-a559-d7a3444c13ef', 2: 'd445bbcb-5c25-4aa7-8782-d142cb2e65e4',
       3: '2add81d4-3549-4da4-86b7-8d9dc517168f', 4: 'f971ad67-d408-4799-a135-3cfa45bd0220', 5: 'e73dc4e9-7427-418d-b018-219695f6b205',
       6: 'add69433-595a-40f4-a92c-95cfd2b8c784', 7: '82893c2a-5d25-468a-89a9-ec2144932821'}

def fetch(cid):
    try:
        return zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(f'https://api.pixellab.ai/mcp/characters/{cid}/download', timeout=60).read()))
    except urllib.error.HTTPError as e:
        if e.code == 423: return None      # jobs still running for this character
        raise

def strip_shadow(im):
    """Remove a floor shadow PixelLab sometimes bakes under the feet (one flat grey that spans wider than
    the feet and fills the bottom row). The scene draws its own contact shadow."""
    bb = im.getbbox()
    if not bb: return im
    px = im.load()
    bottom = [px[x, bb[3] - 1] for x in range(bb[0], bb[2]) if px[x, bb[3] - 1][3] > 40]
    if not bottom: return im
    c = max(set(p[:3] for p in bottom), key=lambda k: sum(p[:3] == k for p in bottom))
    near = lambda p: p[3] > 40 and max(abs(p[i] - c[i]) for i in range(3)) <= 6
    if max(c) - min(c) > 24 or sum(near(p) for p in bottom) < 0.8 * len(bottom): return im
    band = range(max(bb[1], bb[3] - 10), bb[3])
    shadow_x = [x for y in band for x in range(bb[0], bb[2]) if near(px[x, y])]
    body_x = [x for y in band for x in range(bb[0], bb[2]) if px[x, y][3] > 40 and not near(px[x, y])]
    if not body_x or (max(shadow_x) - min(shadow_x)) < (max(body_x) - min(body_x)) + 4: return im
    out = im.copy(); po = out.load()
    for y in band:
        for x in range(bb[0], bb[2]):
            if near(px[x, y]): po[x, y] = (0, 0, 0, 0)
    return out

EMOTES = ['standby', 'happy', 'celebrate', 'sigh', 'facepalm']   # avatar_hd_fx_N rows, in AgentEmote order
DESK = ['type', 'research']                                      # avatar_hd_desk_N rows
DESK_CELL = 112

def build(idx, z):
    states = {s['folder']: s['frames'] for s in json.loads(z.read('metadata.json'))['states']}
    meta = states.get('Idle') or next(iter(states.values()))
    img = lambda p: strip_shadow(Image.open(io.BytesIO(z.read(p))).convert('RGBA'))
    raw = lambda p: Image.open(io.BytesIO(z.read(p))).convert('RGBA')
    rot = {d: img(p) for d, p in meta['rotations'].items()}
    anims = meta.get('animations', {})
    def anim(names, d, load=img):
        # Exact names; PixelLab suffixes a repeated name with "-<group>" (e.g. "type-fe529116").
        for want in names:
            for name, dirs in anims.items():
                if (name == want or name.startswith(want + '-')) and d in dirs:
                    return [load(p) for p in dirs[d]]
        return None
    w, h = rot['south'].size
    foot = rot['south'].getbbox()[3]
    dx, dy = (CELL - w) // 2, (CELL - FOOT) - foot
    def cell(im, lift=0):
        # Custom (v3) clips render on a canvas grown around the character (92 → 104); it stays centred,
        # so shift by half the growth to keep the feet on the same line.
        c = Image.new('RGBA', (CELL, CELL))
        ox, oy = (im.width - w) // 2, (im.height - h) // 2
        c.paste(im, (dx - ox, dy - oy + lift), im)
        return c
    def bob(im, lifts): return [cell(im, l) for l in lifts]
    opp = {'south': 'north', 'north': 'south', 'east': 'west', 'west': 'east'}
    def head(im):     # top 20 px of the figure: face vs hair is what tells front from back
        t = im.getbbox()[1]
        return im.crop((0, t, w, t + 20))
    def diff(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b).convert('L')).mean)
    def floor_px(im): # opaque pixels around the feet; a baked-in shadow roughly doubles this
        a = im.getchannel('A').crop((0, foot - 5, w, foot + 3))
        return sum(1 for v in a.getdata() if v > 40)
    def clean(f, d):
        # PixelLab templates sometimes emit a frame facing the wrong way (a back view inside a front walk)
        # or with a baked-in floor shadow; drop those and loop the good frames instead.
        keep = [x for x in f if x.size == (w, h) and x.getbbox()
                and (d in ('east', 'west') or diff(head(x), head(rot[d])) < diff(head(x), head(rot[opp[d]])))
                and floor_px(x) <= floor_px(rot[d]) * 1.5 + 6]
        if not keep: return None
        while len(keep) < 4: keep = keep + keep
        return [cell(x) for x in keep[:4]]
    def idle(d):
        f = anim(['idle'], d)
        return (f and clean(f, d)) or bob(rot[d], [0, 0, -1, -1])
    def walk(d):
        f = anim(['walk'], d)
        return (f and clean(f, d)) or bob(rot[d], [0, -1, 0, -1])
    def tail(names, d, picks, fallback):
        # Custom v3 clips open on the rotation pose (frame 0) and settle into the action; loops use later frames.
        f = anim(names, d)
        return [cell(f[i]) for i in picks] if f and len(f) > max(picks) else fallback
    front_work = tail(['type_s', 'type2'], 'south', [5, 6, 7, 8], idle('south'))
    back_work = tail(['type_n2', 'type_n', 'type'], 'north', [5, 6, 7, 8], idle('north'))
    done = tail(['celebrate'], 'south', [3, 4, 5, 6], bob(rot['south'], [0, -4, -7, -4]))
    rows = [idle('south') + walk('south'), idle('south') + front_work,
            idle('west') + walk('west'), idle('west') + idle('west'),
            idle('east') + walk('east'), idle('east') + idle('east'),
            idle('north') + walk('north'), idle('north') + back_work,
            done + bob(rot['south'], [0, -6, 0, -6])]
    save(rows, CELL, f'avatar_hd_{idx}.png')

    # Avatar emotes: every clip is 9 frames (the rotation + 8 animated), one row each.
    fx = []
    for name in EMOTES:
        f = anim([name], 'south')
        fx.append([cell(x) for x in f[:9]] if f and len(f) >= 9 else [cell(rot['south'])] * 9)
    save(fx, CELL, f'avatar_hd_fx_{idx}.png')

    # A regenerated state lands as "Laptop_Research_2" etc.; the newest one wins.
    desk_folders = sorted((f for f in states if f.startswith('Laptop_Research')), key=lambda f: (len(f), f))
    desk = states[desk_folders[-1]] if desk_folders else None
    if desk:
        dan = desk.get('animations', {})
        raw = lambda p: scrub_logo(strip_floor(Image.open(io.BytesIO(z.read(p))).convert('RGBA')))
        still = raw(desk['rotations']['south'])
        def desk_clip(want):
            for name, dirs in dan.items():
                if (name == want or name.startswith(want + '-')) and 'south' in dirs:
                    return [raw(p) for p in dirs['south']][:9]
            return None
        drows = []
        for name in DESK:
            f = desk_clip(name) or [still] * 9
            f = (f + [f[-1]] * 9)[:9]
            drows.append([pad(x, DESK_CELL) for x in f])
        save(drows, DESK_CELL, f'avatar_hd_desk_{idx}.png')
    have = [k for k in ['idle', 'walk', 'type_s', 'type2', 'type_n', 'type'] + EMOTES if any(n == k or n.startswith(k + '-') for n in anims)]
    print(f'avatar_hd_{idx}: {", ".join(have) or "rotations only"}' + ('; desk: ' + ', '.join(desk.get('animations', {})) if desk else ''))

def strip_floor(im):
    """Remove a flat grey floor plate some seated states stand the desk on (it spans the whole desk, so
    strip_shadow's wider-than-the-feet test can't see it). Rows are cleared from the bottom up while
    that one grey still dominates them; desk legs and shoes survive."""
    bb = im.getbbox()
    if not bb: return im
    px = im.load()
    bottom = [px[x, bb[3] - 1][:3] for x in range(bb[0], bb[2]) if px[x, bb[3] - 1][3] > 40]
    if not bottom: return im
    c = max(set(bottom), key=bottom.count)
    near = lambda p: p[3] > 40 and max(abs(p[i] - c[i]) for i in range(3)) <= 6
    if max(c) - min(c) > 24 or bottom.count(c) < 0.8 * len(bottom): return im
    out = im.copy(); po = out.load()
    for y in range(bb[3] - 1, bb[1], -1):
        row = [px[x, y] for x in range(bb[0], bb[2]) if px[x, y][3] > 40]
        if not row or sum(near(p) for p in row) < 0.3 * len(row): break
        for x in range(bb[0], bb[2]):
            if near(px[x, y]): po[x, y] = (0, 0, 0, 0)
    return out

def scrub_logo(im):
    """Paint the laptop lid plain. The seated states sometimes draw a brand logo (an Apple) on the lid;
    anything much brighter or darker than the lid's silver, inside its edges, takes the lid colour."""
    w, h = im.size
    px = im.load()
    grey = lambda p: p[3] > 200 and max(p[:3]) - min(p[:3]) < 20 and 140 <= sum(p[:3]) / 3 <= 225
    pts = [(x, y) for y in range(int(h * 0.35), int(h * 0.75)) for x in range(w) if grey(px[x, y])]
    if len(pts) < 150: return im
    # The lid is the widest run of silver rows; take the rows where silver spans most of that width.
    rows = {}
    for x, y in pts: rows.setdefault(y, []).append(x)
    widest = max(len(v) for v in rows.values())
    lid_rows = [y for y, v in rows.items() if len(v) >= widest * 0.6]
    y0, y1 = min(lid_rows), max(lid_rows)
    xs = [x for y in lid_rows for x in rows[y]]
    x0, x1 = min(xs), max(xs)
    vals = sorted(sum(px[x, y][:3]) / 3 for x, y in pts if y0 <= y <= y1)
    mid = vals[len(vals) // 2]
    lid = next(px[x, y] for x, y in pts if y0 <= y <= y1 and abs(sum(px[x, y][:3]) / 3 - mid) < 3)
    out = im.copy(); po = out.load()
    for y in range(y0 + 3, y1 - 2):
        for x in range(x0 + 4, x1 - 3):
            p = px[x, y]
            if p[3] > 200 and abs(sum(p[:3]) / 3 - mid) > 22: po[x, y] = lid
    return out

def pad(im, size):
    c = Image.new('RGBA', (size, size))
    c.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return c

def save(rows, size, name):
    sheet = Image.new('RGBA', (size * max(len(r) for r in rows), size * len(rows)))
    for r, row in enumerate(rows):
        for c, im in enumerate(row): sheet.alpha_composite(im, (c * size, r * size))
    sheet.save(os.path.join(OUT, name), optimize=True)

if __name__ == '__main__':
    want = [int(a) for a in sys.argv[1:]] or sorted(IDS)
    for i in want:
        z = fetch(IDS[i])
        if z is None: print(f'avatar_hd_{i}: export not ready (jobs running) — skipped'); continue
        build(i, z)
