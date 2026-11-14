"""Agent Squad and Full Lineup: approved pixel head and shield with milestone numeral."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import medal_studio as s
VARIANTS = [
    {'slug': 'agent-squad', 'title': 'AGENT SQUAD', 'label': '3', 'tier': 'silver'},
    {'slug': 'full-lineup', 'title': 'FULL LINEUP', 'label': '5', 'tier': 'gold'},
]
def geometry(root,mats,variant):
    contour=s.core.shield_contour()
    parts=[s.disk('satin_shield_back',contour,.986,-.025,-.095,mats['satin'],root),
      s.ring('metal_shield_frame',contour,[(.850,-.030),(.850,.008),(.855,.020),(.867,.028),(.982,.028),(.997,.013),(1,-.016),(.997,-.073),(.985,-.102),(.962,-.102),(.958,-.06)],mats['metal'],root),
      s.disk('acrylic_lime_face',contour,.851,.008,-.030,mats['acrylic'],root),
      s.ring('satin_rear_border',contour,[(.915,-.095),(.918,-.098),(.927,-.098),(.930,-.095),(.927,-.091),(.918,-.091)],mats['satin'],root)]
    mats['highlight']=s.material('Pixel hair highlights','#858B8D',.25,.29)
    original=s.core.prism
    def fitted(name,points,bottom,top,mat,parent,bevel=.006):
        base=bottom(0,0) if callable(bottom) else bottom
        return s.polygon(name,[(x*.68,y*.68+.23) for x,y in points],base-s.CENTER,top-s.CENTER,mat,parent,bevel*.68)
    try:
        s.core.prism=fitted
        parts.extend(s.core.create_emblem(root,mats))
    finally:s.core.prism=original
    parts.extend(s.number(variant['label'],(0,-.40),.36,.36,root,mats))
    return parts
if __name__=='__main__':s.run_family('getting-started',VARIANTS,geometry)
