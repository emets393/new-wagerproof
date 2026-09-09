"""Four Performance medals on the approved curved clipped-diamond master."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import medal_studio as studio

VARIANTS = [
    dict(slug='first-win', title='FIRST WIN', label='1', tier='bronze', fill='#8BCD00'),
    dict(slug='plus-10-units', title='+10 UNITS', label='+10', tier='silver', fill='#8BCD00'),
    dict(slug='plus-25-units', title='+25 UNITS', label='+25', tier='gold', fill='#8BCD00'),
    dict(slug='consistent', title='CONSISTENT', label='55%', tier='gold', fill='#8BCD00'),
]


def rounded(points, fraction=.10, steps=5):
    result=[]
    for i,p in enumerate(points):
        prev,after=points[i-1],points[(i+1)%len(points)]
        a=tuple(p[j]+(prev[j]-p[j])*fraction for j in (0,1))
        b=tuple(p[j]+(after[j]-p[j])*fraction for j in (0,1))
        for k in range(steps+1):
            t=k/steps
            result.append(tuple((1-t)**2*a[j]+2*(1-t)*t*p[j]+t*t*b[j] for j in (0,1)))
    return result


def geometry(root,mats,variant):
    contour=rounded([(-.10,1),(-1,.10),(-1,-.10),(-.10,-1),
                     (.10,-1),(1,-.10),(1,.10),(.10,1)],.12)
    parts=[studio.disk('satin_diamond_back',contour,.986,-.025,-.095,mats['satin'],root),
           studio.ring('metal_diamond_frame',contour,
             [(.850,-.030),(.850,.008),(.855,.020),(.867,.028),(.982,.028),
              (.997,.013),(1,-.016),(.997,-.073),(.985,-.102),(.962,-.102),(.958,-.06)],mats['metal'],root),
           studio.disk('acrylic_diamond_face',contour,.851,.008,-.030,mats['acrylic'],root),
           studio.ring('satin_diamond_rear_border',contour,
             [(.915,-.095),(.918,-.098),(.927,-.098),(.930,-.095),(.927,-.091),(.918,-.091)],mats['satin'],root)]
    # Small raised chevron boundaries divide the glossy face into three fields.
    # Kept in every variant, with the wide numerals naturally occluding their center.
    for side in (-1,1):
        path=[(.624,.31),(.325,.011),(.325,-.011),(.624,-.31),
              (.646,-.288),(.358,0),(.646,.288)]
        points=[(side*x,y) for x,y in path]
        parts.append(studio.polygon('metal_diamond_divider_'+str(side).replace('-','left'),
                     points,-.006,.027,mats['metal'],root,.004))
    width,height=(.64,1.08) if variant['label']=='1' else (1.22,.48)
    parts.extend(studio.number(variant['label'],(0,0),width,height,root,mats))
    return parts


if __name__=='__main__':
    studio.run_family('performance',VARIANTS,geometry)
