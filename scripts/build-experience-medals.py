"""Seven Agent Experience milestones on the approved curved ticket."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from medal_studio import ring, disk, number, run_family

VARIANTS = [
    {'slug': 'experience-10', 'title': '10 GRADED PICKS', 'label': '10', 'tier': 'bronze', 'fill': '#8BCD00'},
    {'slug': 'experience-50', 'title': '50 GRADED PICKS', 'label': '50', 'tier': 'bronze', 'fill': '#8BCD00'},
    {'slug': 'experience-100', 'title': '100 GRADED PICKS', 'label': '100', 'tier': 'silver', 'fill': '#8BCD00'},
    {'slug': 'experience-500', 'title': '500 GRADED PICKS', 'label': '500', 'tier': 'silver', 'fill': '#8BCD00'},
    {'slug': 'experience-1000', 'title': '1,000 GRADED PICKS', 'label': '1000', 'tier': 'gold', 'fill': '#8BCD00'},
    {'slug': 'experience-2500', 'title': '2,500 GRADED PICKS', 'label': '2500', 'tier': 'gold', 'fill': '#8BCD00'},
    {'slug': 'experience-5000', 'title': '5,000 GRADED PICKS', 'label': '5000', 'tier': 'gold', 'fill': '#8BCD00'},
]

def ticket_contour():
    """Broad rounded/chamfered ticket with one open notch per side."""
    points=[]
    def line(a,b,steps=1):
        for i in range(steps):
            t=i/steps
            points.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t))
    def bezier(a,b,c,d,steps=10):
        for i in range(steps):
            t=i/steps
            points.append(tuple((1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k] for k in (0,1)))
    def notch(side):
        # Keep the approved elliptical center/depth, rounding only its entry
        # and exit so each sidewall joins the cut with a continuous tangent.
        theta=math.radians(70)
        x=.94-.235*math.cos(theta);y=.25*math.sin(theta)
        control=(x+.18*.235*math.sin(theta),y+.18*.25*math.cos(theta))
        mirror=lambda p:(side*p[0],side*p[1])
        bezier(mirror((.94,.30)),mirror((.94,.26)),mirror(control),mirror((x,y)))
        for i in range(32):
            t=theta-2*theta*i/32
            points.append(mirror((.94-.235*math.cos(t),.25*math.sin(t))))
        bezier(mirror((x,-y)),mirror((control[0],-control[1])),mirror((.94,-.26)),mirror((.94,-.30)))
    # Trace clockwise, then reverse for the studio's outward-wound convention.
    corners=[(-.74,1.00),(.74,1.00),(.94,.80),(.94,.30)]
    for a,b in zip(corners,corners[1:]): line(a,b)
    notch(1)
    corners=[(.94,-.30),(.94,-.80),(.74,-1.00),(-.74,-1.00),(-.94,-.80),(-.94,-.30)]
    for a,b in zip(corners,corners[1:]): line(a,b)
    notch(-1)
    corners=[(-.94,.30),(-.94,.80),(-.74,1.00)]
    for a,b in zip(corners,corners[1:]): line(a,b)
    return list(reversed(points))

def geometry(root,mats,variant):
    contour=ticket_contour()
    # Rings need longitudinal samples for the bow, while cap tessellation must
    # receive no redundant collinear points or its side seams become open.
    ring_contour=[]
    for i,a in enumerate(contour):
        b=contour[(i+1)%len(contour)]
        steps=max(1,math.ceil(math.dist(a,b)/.045))
        for j in range(steps):
            t=j/steps
            ring_contour.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t))
    parts=[disk('satin_ticket_reverse',contour,.986,-.025,-.095,mats['satin'],root)]
    parts.append(ring('metal_ticket_perimeter',ring_contour,[
        (.850,-.030),(.850,.008),(.855,.020),(.867,.028),
        (.982,.028),(.997,.013),(1,-.016),(.997,-.073),
        (.985,-.102),(.962,-.102),(.958,-.060),
    ],mats['metal'],root))
    parts.append(disk('acrylic_ticket_inset',contour,.851,.008,-.030,mats['acrylic'],root))
    parts.append(ring('satin_rear_border',ring_contour,[
        (.915,-.095),(.918,-.098),(.927,-.098),(.930,-.095),
        (.927,-.091),(.918,-.091),
    ],mats['satin'],root))
    parts.extend(number(variant['label'],(0,0),1.16,.94,root,mats))
    return parts

if __name__=='__main__':
    run_family('experience',VARIANTS,geometry)
