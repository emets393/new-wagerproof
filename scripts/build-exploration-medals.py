"""Six approved compass medals, with four true open arcs and curved pixel emblems."""
import math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import medal_studio as s

VARIANTS=[
{'slug':'game-analyst','title':'GAME ANALYST','label':'analyst','tier':'silver','fill':'#8BCD00'},
{'slug':'props-scout','title':'PROPS SCOUT','label':'props','tier':'silver','fill':'#8BCD00'},
{'slug':'trend-explorer','title':'TREND EXPLORER','label':'trends','tier':'silver','fill':'#8BCD00'},
{'slug':'system-builder','title':'SYSTEM BUILDER','label':'systems','tier':'silver','fill':'#8BCD00'},
{'slug':'wagerbot-partner','title':'WAGERBOT PARTNER','label':'chat','tier':'silver','fill':'#8BCD00'},
{'slug':'connected-researcher','title':'CONNECTED RESEARCHER','label':'mcp','tier':'silver','fill':'#8BCD00'},
]

def circle(radius,n=128):return [(radius*math.cos(i*math.tau/n),radius*math.sin(i*math.tau/n)) for i in range(n)]

def pixel_ring(r=.37):
    raw=[(-.6,-1),(.6,-1),(.6,-.8),(.8,-.8),(.8,-.6),(1,-.6),(1,.6),(.8,.6),(.8,.8),(.6,.8),(.6,1),(-.6,1),(-.6,.8),(-.8,.8),(-.8,.6),(-1,.6),(-1,-.6),(-.8,-.6),(-.8,-.8),(-.6,-.8)]
    return [(x*r,y*r) for x,y in raw]

def geometry(root,mats,v):
    parts=[]
    outer=[]
    for i in range(192):
        t=i*math.tau/192
        distance=abs((t+math.pi/4)%(math.pi/2)-math.pi/4)
        radius=1.025+.115*max(0,1-distance/.16)
        outer.append((radius*math.cos(t),radius*math.sin(t)))
    holes=[]
    for q in range(4):
        a=q*math.pi/2+.105;b=(q+1)*math.pi/2-.105
        arc=[a+(b-a)*i/40 for i in range(41)]
        holes.append([(r*math.cos(t),r*math.sin(t)) for r,angles in [(.935,arc),(.735,list(reversed(arc)))] for t in angles])
    parts.append(s.polygon('metal_compass_chassis',outer,-.095,.026,mats['metal'],root,0,holes=holes))
    parts.append(s.disk('acrylic_lime_center',circle(.708),1,.037,.010,mats['acrylic'],root))
    def emblem(name,points,holes=None,top=.086,bottom=.062):
        parts.append(s.polygon('metal_'+name,points,.026,bottom,mats['metal'],root,0 if holes else .006,holes=holes))
        inside=s.core.inset_polygon(points,.014)
        inner_holes=[s.core.inset_polygon(h,-.014) for h in holes or []]
        parts.append(s.polygon('ivory_'+name,inside,bottom-.005,top,mats['ivory'],root,0 if holes else .004,holes=inner_holes))
    def box(name,x,y,w,h,top=.086,bottom=.062):emblem(name,s.rectangle(x,y,w,h,.018),top=top,bottom=bottom)
    label=v['label']
    if label=='analyst':
        # Stepped lens with a single contiguous southeast handle and a real counter.
        ring=pixel_ring(.355)
        ring=[(x-.055,y+.055) for x,y in ring]
        # Add handle as an overlapping cast segment, below the lens enamel.
        handle=[(.145,-.18),(.24,-.13),(.24,-.21),(.31,-.21),(.31,-.28),(.38,-.28),(.38,-.35),(.45,-.35),(.45,-.43),(.37,-.49),(.29,-.42),(.29,-.35),(.22,-.35),(.22,-.28),(.145,-.28)]
        emblem('lens_handle',handle,top=.082,bottom=.060)
        hole=[(x-.055,y+.055) for x,y in pixel_ring(.205)]
        emblem('pixel_lens',ring,[hole])
    elif label=='props':
        emblem('target_outer',pixel_ring(.43),[pixel_ring(.29)])
        emblem('target_center',pixel_ring(.17),[s.rectangle(0,0,.085,.085)])
    elif label=='trends':
        for i,(x,h) in enumerate([(-.34,.20),(-.04,.34),(.26,.49)]):box('chart_bar_'+str(i),x,-.42+h/2,.23,h)
        arrow=[(-.47,-.08),(-.34,-.08),(-.34,0),(-.26,0),(-.26,.08),(-.18,.08),(-.18,.16),(-.10,.16),(-.10,.22),(.04,.22),(.04,.29),(.13,.29),(.13,.37),(.22,.37),(.22,.44),(.13,.44),(.13,.59),(.44,.59),(.44,.28),(.29,.28),(.29,.34),(.22,.34),(.22,.25),(.14,.25),(.14,.17),(.06,.17),(.06,.10),(-.08,.10),(-.08,.03),(-.16,.03),(-.16,-.05),(-.24,-.05),(-.24,-.13),(-.32,-.13),(-.32,-.20),(-.47,-.20)]
        emblem('rising_pixel_arrow',arrow)
    elif label=='systems':
        for i,(y,x) in enumerate([(.30,-.20),(0,.25),(-.30,-.20)]):
            box('slider_rail_'+str(i),0,y,1.02,.105,top=.078,bottom=.055)
            box('slider_knob_'+str(i),x,y,.245,.25,top=.100,bottom=.077)
    elif label=='chat':
        bubble=[(-.48,.34),(-.41,.34),(-.41,.43),(.37,.43),(.37,.35),(.48,.35),(.48,-.17),(.39,-.17),(.39,-.25),(-.11,-.25),(-.11,-.32),(-.23,-.32),(-.23,-.40),(-.39,-.40),(-.39,-.22),(-.48,-.22)]
        emblem('pixel_chat',bubble,[s.rectangle(x,.085,.125,.125) for x in (-.24,0,.24)])
    elif label=='mcp':
        # Two interlocking stepped links, lifted separately to make the overlap legible.
        c=[(-.36,-.03),(-.27,-.03),(-.27,.06),(.07,.06),(.07,-.10),(-.13,-.10),(-.13,-.19),(-.21,-.19),(-.21,-.43),(.02,-.43),(.02,-.32),(.19,-.32),(.19,-.51),(.10,-.60),(-.29,-.60),(-.29,-.52),(-.38,-.52),(-.38,-.13),(-.36,-.13)]
        c=[(x,y+.18) for x,y in c]
        emblem('lower_pixel_link',c)
        upper=[(-x+.01,-y+.03) for x,y in c]
        emblem('upper_pixel_link',upper,top=.115,bottom=.091)
    return parts

if __name__=='__main__':s.run_family('exploration',VARIANTS,geometry)
