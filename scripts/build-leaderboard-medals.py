"""Three approved crown medals, with curved panels, band and ivory numerals."""
import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import medal_studio as s
VARIANTS=[
{'slug':'top-100','title':'TOP 100','label':'100','tier':'bronze','fill':'#8BCD00'},
{'slug':'top-10','title':'TOP 10','label':'10','tier':'silver','fill':'#8BCD00'},
{'slug':'number-one','title':'NUMBER ONE','label':'1','tier':'gold','fill':'#007B3B'},
]

def soften(points,f=.12,n=5):
    result=[]
    for i,p in enumerate(points):
        a=points[i-1];b=points[(i+1)%len(points)]
        a=tuple(p[k]+(a[k]-p[k])*f for k in (0,1));b=tuple(p[k]+(b[k]-p[k])*f for k in (0,1))
        for j in range(n+1):
            t=j/n;result.append(tuple((1-t)**2*a[k]+2*t*(1-t)*p[k]+t*t*b[k] for k in (0,1)))
    return result

def cell_border(name,outer,inner,mat,root):
    """Closed beveled rim; matched loops preserve the thin hollow cell."""
    pairs=[]
    for i,a in enumerate(outer):
        j=(i+1)%len(outer);b=outer[j]
        count=max(1,math.ceil(math.dist(a,b)/.045))
        for k in range(count):
            t=k/count
            pairs.append((tuple(a[d]*(1-t)+b[d]*t for d in (0,1)),
                          tuple(inner[i][d]*(1-t)+inner[j][d]*t for d in (0,1))))
    profiles=[(0,.032),(0,.060),(.12,.069),(.88,.069),(1,.060),(1,.032)]
    verts=[]
    for t,z in profiles:
        for a,b in pairs:
            x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            verts.append((x,y,s.dome(x,y)+z))
    n=len(pairs);faces=[]
    for layer in range(len(profiles)):
        nxt=(layer+1)%len(profiles)
        for i in range(n):
            j=(i+1)%n
            faces.append((layer*n+i,layer*n+j,nxt*n+j,nxt*n+i))
    return s.core.mesh(name,verts,faces,mat,root)

def geometry(root,mats,v):
    contour=soften([(0,1.03),(.43,.48),(.50,.43),(.57,.46),(.94,.74),(1.035,.64),(1.035,.055),(.94,-.07),(.87,-.25),(.87,-.69),(.77,-.83),(-.77,-.83),(-.87,-.69),(-.87,-.25),(-.94,-.07),(-1.035,.055),(-1.035,.64),(-.94,.74),(-.57,.46),(-.50,.43),(-.43,.48)],.12)
    parts=[s.polygon('satin_crown_reverse',contour,-.095,-.026,mats['satin'],root,.01),
           s.polygon('metal_crown_chassis',contour,-.030,.028,mats['metal'],root,.014)]
    center=soften([(0,.86),(.335,.43),(.268,.005),(-.268,.005),(-.335,.43)],.13)
    left=soften([(-.92,.56),(-.58,.31),(-.42,-.085),(-.79,-.19),(-.86,-.02),(-.94,.07)],.13)
    right=[(-x,y) for x,y in reversed(left)]
    for name,poly in [('center',center),('left',left),('right',right)]:
        area=sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))
        if area<0:poly=list(reversed(poly))
        hole=s.core.inset_polygon(poly,.025)
        acrylic=s.core.inset_polygon(poly,.023)
        parts.append(cell_border('metal_crown_cell_'+name,poly,hole,mats['metal'],root))
        parts.append(s.polygon('acrylic_crown_'+name,acrylic,.027,.055,mats['acrylic'],root,.006))
    top=[(x,-.15+.18*(1-(x/.85)**2)) for x in [(-.85+i*1.7/32) for i in range(33)]]
    band=top+[(.85,-.67),(.75,-.79),(-.75,-.79),(-.85,-.67)]
    parts.append(s.polygon('metal_crown_band',band,.027,.041,mats['metal'],root,.01))
    parts+=s.number(v['label'],(0,-.415),1.22,.61,root,mats)
    return parts
if __name__=='__main__':s.run_family('leaderboard',VARIANTS,geometry)
