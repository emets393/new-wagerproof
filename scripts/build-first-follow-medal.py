"""First Follow emblem on the shared approved WagerProof shield master."""
import importlib.util
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('shield_core', Path(__file__).with_name('build-first-agent-medal.py'))
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
core.configure_variant('first_follow', 'FirstFollow', 'FIRST FOLLOW')


def emblem(root, mats):
    parts = []
    cyan = core.material('Pale cyan eye accent', '#A4DAD4', 0, .27, .35)
    silhouette = [(-4.5,8),(4.5,8),(4.5,7),(5.5,7),(5.5,6),(6.5,6),(6.5,3),(7.5,3),(7.5,-2),(5.5,-2),(5.5,-3),(4.5,-3),(4.5,-4),(3.5,-4),(3.5,-5),(-3.5,-5),(-3.5,-4),(-4.5,-4),(-4.5,-3),(-5.5,-3),(-5.5,-2),(-7.5,-2),(-7.5,3),(-6.5,3),(-6.5,6),(-5.5,6),(-5.5,7),(-4.5,7)]
    face = [(-6.5,.6),(-5.5,.6),(-5.5,-.8),(-4.5,-.8),(-4.5,1),(4.5,1),(4.5,-.8),(5.5,-.8),(5.5,.6),(6.5,.6),(6.5,-1.7),(5.4,-1.7),(5.4,-2.7),(4.4,-2.7),(4.4,-3.7),(3.4,-3.7),(3.4,-4.6),(-3.4,-4.6),(-3.4,-3.7),(-4.4,-3.7),(-4.4,-2.7),(-5.4,-2.7),(-5.4,-1.7),(-6.5,-1.7)]
    pixel = .0495
    for label, cx, cy, top in [('left', -.325, -.025, .185), ('right', .305, -.105, .231)]:
        coords = lambda points: [(cx+x*pixel, cy+y*pixel) for x,y in points]
        shape = coords(silhouette)
        parts.append(core.prism('metal_'+label+'_head_outline', shape,
                                lambda x,y: core.dome(x,y)+.002, top, mats['metal'],root,.005))
        parts.append(core.prism('charcoal_'+label+'_hair',core.inset_polygon(shape,.013),top-.004,top+.012,mats['charcoal'],root,.003))
        parts.append(core.prism('ivory_'+label+'_face',coords(face),top+.009,top+.020,mats['ivory'],root,.003))
        def box(name,x,y,w,h,material,z):
            contour=coords([(x-w/2,y-h/2),(x+w/2,y-h/2),(x+w/2,y+h/2),(x-w/2,y+h/2)])
            return core.prism(name,contour,z-.009,z,material,root,.002)
        if label=='left':
            for index,x in enumerate((-3.2,0,3.2)):
                parts.append(box('highlight_left_hair_'+str(index),x,4.8,1.85,1.55,mats['highlight'],top+.018))
        else:
            # Cap's approved small stepped ivory mark, physically raised enamel.
            mark=[(-1.45,5.5),(-.5,5.5),(-.5,3.8),(1.3,3.8),(1.3,4.6),(2.1,4.6),(2.1,2.95),(-1.45,2.95)]
            parts.append(core.prism('ivory_right_cap_mark',coords(mark),top+.011,top+.021,mats['ivory'],root,.002))
        for index,x in enumerate((-2.15,2.15)):
            parts.append(box('charcoal_'+label+'_eye_'+str(index),x,-.7,1.05,1.5,mats['charcoal'],top+.027))
            if label == 'right':
                parts.append(box('ivory_cyan_eye_accent_'+str(index),x,-1.65,1.35,.25,cyan,top+.026))
        parts.append(box('charcoal_'+label+'_mouth',0,-3.2,2.4,.8,mats['charcoal'],top+.027))
    return parts

core.create_emblem = emblem
if '--proof' in sys.argv:
    core.proof()
elif '--reexport' in sys.argv:
    core.reexport()
else:
    core.build()
