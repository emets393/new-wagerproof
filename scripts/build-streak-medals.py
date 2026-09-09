"""Four approved Winning Streaks flame medals, using the shared curved studio."""
import importlib.util
from pathlib import Path
import bpy

spec = importlib.util.spec_from_file_location('medal_studio', Path(__file__).with_name('medal_studio.py'))
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)

VARIANTS = [
    {'slug':'streak-3','title':'3 WIN STREAK','label':'3','tier':'bronze','fill':'#FF7100'},
    {'slug':'streak-5','title':'5 WIN STREAK','label':'5','tier':'silver','fill':'#FF7100'},
    {'slug':'streak-10','title':'10 WIN STREAK','label':'10','tier':'gold','fill':'#FF7100'},
    {'slug':'streak-15','title':'15 WIN STREAK','label':'15','tier':'gold','fill':'#FF7100'},
]


def path(segments, steps=14):
    points=[]
    for a,b,c,d in segments:
        for index in range(steps):
            t=index/steps
            points.append(tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in (0,1)))
    return points


OUTLINE = path([
    ((.15,1.08),(.28,1.01),(.49,.76),(.45,.55)),
    ((.45,.55),(.44,.42),(.38,.34),(.39,.27)),
    ((.39,.27),(.45,.42),(.58,.52),(.64,.55)),
    ((.64,.55),(.59,.31),(.65,.16),(.77,-.04)),
    ((.77,-.04),(.97,-.39),(.92,-.71),(.69,-.88)),
    ((.69,-.88),(.45,-1.07),(-.43,-1.09),(-.69,-.88)),
    ((-.69,-.88),(-.94,-.67),(-.94,-.33),(-.80,-.08)),
    ((-.80,-.08),(-.64,.18),(-.51,.36),(-.52,.60)),
    ((-.52,.60),(-.39,.51),(-.28,.37),(-.26,.25)),
    ((-.26,.25),(-.26,.55),(.02,.67),(.11,.87)),
    ((.11,.87),(.15,.96),(.14,1.03),(.15,1.08)),
])
CENTER = path([
    ((.19,.90),(.34,.74),(.41,.59),(.32,.37)),
    ((.32,.37),(.23,.15),(.25,-.02),(.43,-.23)),
    ((.43,-.23),(.68,-.51),(.65,-.73),(.47,-.84)),
    ((.47,-.84),(.20,-.97),(-.33,-.96),(-.51,-.78)),
    ((-.51,-.78),(-.69,-.55),(-.40,-.35),(-.29,-.10)),
    ((-.29,-.10),(-.20,.08),(-.27,.29),(-.07,.50)),
    ((-.07,.50),(.07,.66),(.19,.76),(.19,.90)),
])
LEFT = path([
    ((-.50,.43),(-.43,.33),(-.36,.18),(-.37,.04)),
    ((-.37,.04),(-.39,-.12),(-.57,-.27),(-.63,-.43)),
    ((-.63,-.43),(-.67,-.51),(-.67,-.59),(-.66,-.64)),
    ((-.66,-.64),(-.82,-.44),(-.82,-.22),(-.70,-.02)),
    ((-.70,-.02),(-.60,.15),(-.51,.27),(-.50,.43)),
])
RIGHT = path([
    ((.60,.38),(.53,.27),(.46,.14),(.47,.01)),
    ((.47,.01),(.48,-.15),(.65,-.28),(.72,-.48)),
    ((.72,-.48),(.80,-.28),(.76,-.12),(.67,.04)),
    ((.67,.04),(.60,.18),(.57,.29),(.60,.38)),
])


def geometry(root, mats, variant):
    parts=[]
    parts.append(studio.polygon('satin_flame_reverse',OUTLINE,-.095,-.025,mats['satin'],root,.009))
    chassis=studio.polygon('metal_flame_chassis',OUTLINE,-.026,.028,mats['metal'],root,.009,holes=[CENTER,LEFT,RIGHT])
    amber=studio.material('Amber acrylic side cells','#FFBF12',0,.085,1)
    # Tessellate all three windows into one cast chassis before curving. Acrylic closes each pocket;
    # the reverse remains solid for personalization, not a through-hole design.
    for label,contour,mat in [('center',CENTER,mats['acrylic']),('left',LEFT,amber),('right',RIGHT,amber)]:
        parts.append(studio.polygon('acrylic_'+label+'_cell',contour,-.025,.008,mat,root,.008))
    parts.append(chassis)
    parts += studio.number(variant['label'],(0,-.47),.91 if len(variant['label'])>1 else .66,.73,root,mats)
    return parts

studio.run_family('streaks',VARIANTS,geometry)
