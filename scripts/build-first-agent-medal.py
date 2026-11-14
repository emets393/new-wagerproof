"""Build the approved First Agent medal with Blender 5.2.

Run from any directory:
  Blender -b --python-exit-code 1 --python scripts/build-first-agent-medal.py
  Add --preview for a small first-pass render, --proof for USDZ reimport renders.

The shield and reverse share a shallow bow with more wrap around the vertical
axis. The stepped agent face
has curved minted caps and a matching curved underside. All paths belong to WagerProof;
the Honeydew studio HDR is copied into artifacts/achievements/studio first.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / 'artifacts/achievements/first-agent'
RENDERS = OUT / 'renders'
EXPORT = OUT / 'first-agent.usdz'
MASTER = OUT / 'first-agent.blend'
ASSET_ID = 'first_agent'
PREFIX = 'FirstAgent'
AWARD_TITLE = 'FIRST AGENT'
PREVIEW = '--preview' in sys.argv
PROOF = '--proof' in sys.argv
EXPORT_ONLY = '--export-only' in sys.argv
for folder in (OUT, RENDERS):
    folder.mkdir(parents=True, exist_ok=True)

RADIUS = 5.6
HORIZONTAL_CURVATURE_WEIGHT = 3.8
CENTER_Z = .135
THICKNESS = .095

def dome(x, y):
    # More wrap around the vertical (Y) axis; preserve the top-to-bottom bow.
    return CENTER_Z + math.sqrt(RADIUS * RADIUS - HORIZONTAL_CURVATURE_WEIGHT*x*x - y*y) - RADIUS

def rear(x, y):
    return dome(x, y) - THICKNESS

def linear(hex_value):
    channels = [int(hex_value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in channels)

def material(name, color, metallic, roughness, coat=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear(color), 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = .065
    mat.diffuse_color = (*linear(color), 1)
    return mat

def orient_normals(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()

def mesh(name, vertices, faces, mat, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    data.materials.append(mat)
    orient_normals(obj)
    for face in data.polygons:
        face.use_smooth = True
    return obj

def finish(obj, bevel=0):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    if bevel:
        # Coplanar tessellation edges otherwise clamp the bevel on pixel caps.
        bm=bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.dissolve_limit(bm,angle_limit=.0001,verts=list(bm.verts),edges=list(bm.edges))
        bm.to_mesh(obj.data); bm.free()
        mod = obj.modifiers.new('Small manufactured edge bevel', 'BEVEL')
        mod.width = bevel; mod.segments = 4
        bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Planar minted cap normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True; mod.weight = 75
    bpy.ops.object.modifier_apply(modifier=mod.name)
    orient_normals(obj)
    return obj

def shield_contour():
    # Cubic segments preserve the approved broad shoulders and soft low point.
    segments = [
        ((0, 1.03), (.15, 1.03), (.61, .88), (.81, .79)),
        ((.81, .79), (.91, .75), (.94, .70), (.94, .57)),
        ((.94, .57), (.95, .22), (.90, -.20), (.75, -.46)),
        ((.75, -.46), (.57, -.76), (.22, -.97), (.07, -1.055)),
        ((.07, -1.055), (.025, -1.08), (-.025, -1.08), (-.07, -1.055)),
        ((-.07, -1.055), (-.22, -.97), (-.57, -.76), (-.75, -.46)),
        ((-.75, -.46), (-.90, -.20), (-.95, .22), (-.94, .57)),
        ((-.94, .57), (-.94, .70), (-.91, .75), (-.81, .79)),
        ((-.81, .79), (-.61, .88), (-.15, 1.03), (0, 1.03)),
    ]
    result = []
    for p0, p1, p2, p3 in segments:
        for k in range(24):
            t = k / 24
            result.append(tuple((1-t)**3*p0[i] + 3*(1-t)**2*t*p1[i] + 3*(1-t)*t*t*p2[i] + t**3*p3[i] for i in (0, 1)))
    return list(reversed(result))

def ring(name, contour, profiles, mat, root):
    # Closed section of the frame, swept along the shield outline.
    n = len(contour)
    verts = [(x*scale, y*scale, dome(x*scale, y*scale)+z) for scale,z in profiles for x,y in contour]
    faces = []
    for layer in range(len(profiles)):
        nxt = (layer+1) % len(profiles)
        for i in range(n):
            j = (i+1) % n
            faces.append((layer*n+i, layer*n+j, nxt*n+j, nxt*n+i))
    return mesh(name, verts, faces, mat, root)

def curved_disk(name, contour, scale, top, bottom, mat, root):
    # Radial tessellation makes both broad faces truly curved, with no flat ngon.
    n = len(contour); steps = 24
    verts = [(0, 0, top(0,0,0))]
    for k in range(1, steps+1):
        t = k/steps
        verts.extend((x*scale*t, y*scale*t, top(x*scale*t,y*scale*t,t)) for x,y in contour)
    back_center = len(verts)
    verts.append((0,0,bottom(0,0)))
    for k in range(1,steps+1):
        t = k/steps
        verts.extend((x*scale*t,y*scale*t,bottom(x*scale*t,y*scale*t)) for x,y in contour)
    faces = []
    for center in (0, back_center):
        for i in range(n):
            faces.append((center,center+1+i,center+1+(i+1)%n))
        for k in range(steps-1):
            start = center+1+k*n
            for i in range(n):
                j=(i+1)%n
                faces.append((start+i,start+j,start+n+j,start+n+i))
    front_edge=1+(steps-1)*n; back_edge=back_center+1+(steps-1)*n
    for i in range(n):
        j=(i+1)%n
        faces.append((front_edge+i,back_edge+i,back_edge+j,front_edge+j))
    return mesh(name,verts,faces,mat,root)

def inset_polygon(points, distance):
    # Constant-distance miter inset retains right-angle pixel steps.
    area=sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))
    points = points if area>0 else list(reversed(points))
    result=[]
    for i,p in enumerate(points):
        a=Vector(points[i-1]); b=Vector(p); c=Vector(points[(i+1)%len(points)])
        u=(b-a).normalized(); v=(c-b).normalized()
        n1=Vector((-u.y,u.x)); n2=Vector((-v.y,v.x))
        bis=n1+n2
        result.append(tuple(b+bis*(distance/max(1e-9,bis.dot(n1)))))
    return result

def prism(name, points, bottom, top, mat, root, bevel=.006):
    n=len(points)
    # Triangulate in 2D before extrusion, so concave stepped contours keep caps.
    flat=[Vector((x,y,0)) for x,y in points]
    tris=tessellate_polygon([flat])
    lookup={(round(p.x,8),round(p.y,8)):i for i,p in enumerate(flat)}
    cap=[tuple(p if isinstance(p,int) else lookup[(round(p.x,8),round(p.y,8))] for p in tri) for tri in tris]
    base = bottom(0, 0) if callable(bottom) else bottom
    verts=[(x,y,base) for x,y in points]+[(x,y,top) for x,y in points]
    faces=cap+[tuple(n+i for i in face) for face in cap]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj = finish(mesh(name,verts,faces,mat,root),bevel)
    # Bend the complete minted layer after beveling. Dense cap triangles are
    # necessary: moving only contour vertices leaves large flat cap facets.
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=8, use_grid_fill=True)
    for face in bm.faces: face.smooth = True
    for edge in bm.edges: edge.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    # Transport pre-bend corner normals by the deformation Jacobian. This
    # gives broad caps continuous curvature without triangle-shaped highlights.
    normals = [n.vector.copy() for n in obj.data.corner_normals]
    for loop in obj.data.loops:
        z = obj.data.vertices[loop.vertex_index].co.z
        if abs(z-top) < 1e-5: normals[loop.index] = Vector((0, 0, 1))
        elif abs(z-base) < 1e-5: normals[loop.index] = Vector((0, 0, -1))
    for vertex in obj.data.vertices:
        vertex.co.z += dome(vertex.co.x, vertex.co.y) - CENTER_Z
    obj.data.update()
    transformed = []
    for loop, normal in zip(obj.data.loops, normals):
        x, y, _ = obj.data.vertices[loop.vertex_index].co
        denom = math.sqrt(RADIUS*RADIUS-HORIZONTAL_CURVATURE_WEIGHT*x*x-y*y)
        transformed.append(Vector((normal.x + HORIZONTAL_CURVATURE_WEIGHT*x/denom*normal.z,
                                   normal.y + y/denom*normal.z, normal.z)).normalized())
    obj.data.normals_split_custom_set(transformed)
    obj['conforms_to_shield'] = True
    obj['front_surface_offset'] = top - CENTER_Z
    obj['back_surface_offset'] = base - CENTER_Z
    return obj

def anchor(name, y, width, height, root):
    obj=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(obj)
    obj.parent=root; obj.location=(0,y,rear(0,y)); obj.rotation_euler=(0,math.pi,0)
    obj['text_width']=width; obj['text_height']=height; obj.empty_display_size=.08
    return obj

def sample_engraving(root, etch):
    font=bpy.data.fonts.load('/Library/Fonts/SF-Pro-Rounded-Bold.otf')
    samples=[]
    for label,text,y,width,height in [('Name','YOUR NAME',.17,1.12,.115),('Caption',AWARD_TITLE,-.04,1.08,.102),('Date','SEP 2026',-.25,.86,.090)]:
        curve=bpy.data.curves.new('Sample '+label,'FONT'); curve.body=text; curve.font=font
        curve.size=1; curve.extrude=.002; curve.resolution_u=6
        obj=bpy.data.objects.new('preview_engraving_'+label,curve); bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active=obj; obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj=bpy.context.object
        low=Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
        high=Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
        scale=min(width/(high.x-low.x),height/(high.y-low.y))
        for vertex in obj.data.vertices:
            x=-(vertex.co.x-(low.x+high.x)/2)*scale
            yy=y+(vertex.co.y-(low.y+high.y)/2)*scale
            vertex.co=(x,yy,rear(x,yy)-.0015-(vertex.co.z-low.z)*scale)
        obj.parent=root; obj.data.materials.append(etch); orient_normals(obj)
        obj['preview_only']=True; samples.append(obj)
        obj.select_set(False)
    return samples

def setup_studio():
    scene=bpy.context.scene
    env=bpy.data.images.load(str(REPO/'artifacts/achievements/studio/studio.hdr'))
    world=bpy.data.worlds.new('WagerProof medal studio'); world.use_nodes=True; scene.world=world
    nodes=world.node_tree.nodes; tex=nodes.new('ShaderNodeTexEnvironment'); tex.image=env
    world.node_tree.links.new(tex.outputs['Color'],nodes.get('Background').inputs['Color'])
    nodes.get('Background').inputs['Strength'].default_value=.65
    for name,position,power,w,h in [('Key',(-3,-4,3),180,2,3),('Fill',(3,-3,.7),75,1.4,3),('Back',(2,3,3),230,3,4)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='RECTANGLE'; data.size=w; data.size_y=h
        obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
        obj.location=position; obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'; scene.cycles.samples=40 if PREVIEW else 80
    scene.cycles.use_denoising=True; scene.cycles.adaptive_threshold=.03
    scene.cycles.device='CPU'
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.05
    cams={}
    for name,pos in [('front',(0,-8,.05)),('angle',(3.2,-8,1.4)),('profile',(8,-1.3,.3)),('back',(0,8,.15)),('top',(0,-2.3,8))]:
        data=bpy.data.cameras.new(name); data.type='ORTHO'; data.ortho_scale=2.55
        obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
        obj.location=pos; obj.rotation_euler=(Vector((0,0,-.015))-obj.location).to_track_quat('-Z','Y').to_euler()
        cams[name]=obj
    return cams

def render(cams, prefix=''):
    scene=bpy.context.scene
    for name,cam in cams.items():
        if PREVIEW and name not in ('angle','profile','top'): continue
        scene.camera=cam; scene.render.resolution_x=900 if PREVIEW else 1200
        scene.render.resolution_y=scene.render.resolution_x; scene.render.resolution_percentage=100
        scene.render.filepath=str(RENDERS/f'{prefix}{name}.png')
        bpy.ops.render.render(write_still=True)

def verify(objects):
    checks={}
    for obj in objects:
        if obj.type!='MESH': continue
        bm=bmesh.new(); bm.from_mesh(obj.data)
        bad=sum(not edge.is_manifold for edge in bm.edges)
        volume=bm.calc_volume(signed=True)
        assert bad==0,(obj.name,'nonmanifold',bad)
        assert volume>0,(obj.name,'inverted',volume)
        checks[obj.name]={'vertices':len(bm.verts),'faces':len(bm.faces),'nonmanifold_edges':bad,'volume':volume}
        bm.free()
    return checks

def export_selected():
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from medal_palette import apply
    apply(bpy.context.selected_objects)
    # Blender exports a generated DomeLight even with selected_objects_only
    # unless world conversion is explicitly disabled. Assets ship no studio.
    bpy.ops.wm.usd_export(filepath=str(EXPORT),selected_objects_only=True,export_materials=True,
        generate_preview_surface=True,convert_orientation=True,convert_world_material=False,
        export_lights=False,export_cameras=False,
        export_global_forward_selection='NEGATIVE_Z',export_global_up_selection='Y')

def reexport():
    bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    bpy.ops.object.select_all(action='DESELECT')
    root=bpy.data.objects[PREFIX]
    for obj in [root]+list(root.children_recursive):
        if not obj.name.startswith('preview_'): obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    export_selected()
    print('FIRST_AGENT_REEXPORTED',str(EXPORT),flush=True)

def create_emblem(root, mats):
    parts=[]
    # Pixel contours reproduce the approved avatar_0 concept, not a generic robot.
    pixel=.079; y_shift=-.11
    outline=[(-4.5,8),(4.5,8),(4.5,7),(5.5,7),(5.5,6),(6.5,6),(6.5,3),(7.5,3),(7.5,-2),(5.5,-2),(5.5,-3),(4.5,-3),(4.5,-4),(3.5,-4),(3.5,-5),(-3.5,-5),(-3.5,-4),(-4.5,-4),(-4.5,-3),(-5.5,-3),(-5.5,-2),(-7.5,-2),(-7.5,3),(-6.5,3),(-6.5,6),(-5.5,6),(-5.5,7),(-4.5,7)]
    coords=lambda points:[(x*pixel,y*pixel+y_shift) for x,y in points]
    shape=coords(outline)
    parts.append(prism('metal_agent_head_outline',shape,lambda x,y:dome(x,y)+.002,.197,mats['metal'],root,.008))
    parts.append(prism('charcoal_agent_hair',inset_polygon(shape,.020),.186,.211,mats['charcoal'],root,.005))
    face=coords([(-6.5,.6),(-5.5,.6),(-5.5,-.8),(-4.5,-.8),(-4.5,1),(4.5,1),(4.5,-.8),(5.5,-.8),(5.5,.6),(6.5,.6),(6.5,-1.7),(5.4,-1.7),(5.4,-2.7),(4.4,-2.7),(4.4,-3.7),(3.4,-3.7),(3.4,-4.6),(-3.4,-4.6),(-3.4,-3.7),(-4.4,-3.7),(-4.4,-2.7),(-5.4,-2.7),(-5.4,-1.7),(-6.5,-1.7)])
    parts.append(prism('ivory_agent_face',face,.202,.218,mats['ivory'],root,.005))
    def box(name,cx,cy,w,h,mat,z):
        poly=coords([(cx-w/2,cy-h/2),(cx+w/2,cy-h/2),(cx+w/2,cy+h/2),(cx-w/2,cy+h/2)])
        return prism(name,poly,z-.012,z,mat,root,.003)
    for i,x in enumerate((-3.2,0,3.2)):
        parts.append(box(f'highlight_hair_pixel_{i}',x,4.8,1.85,1.55,mats['highlight'],.219))
    for i,x in enumerate((-2.15,2.15)):
        parts.append(box(f'charcoal_eye_{i}',x,-.7,1,1.75,mats['charcoal'],.225))
    parts.append(box('charcoal_pixel_mouth',0,-3.2,2.65,.8,mats['charcoal'],.225))
    return parts

def configure_variant(asset_id, prefix, title):
    """Reuse the verified shield/studio while a sibling supplies its emblem."""
    global ASSET_ID, PREFIX, AWARD_TITLE, OUT, RENDERS, EXPORT, MASTER
    ASSET_ID, PREFIX, AWARD_TITLE = asset_id, prefix, title
    slug = asset_id.replace('_', '-')
    OUT = REPO / 'artifacts/achievements' / slug
    RENDERS = OUT / 'renders'
    EXPORT = OUT / (slug + '.usdz')
    MASTER = OUT / (slug + '.blend')
    RENDERS.mkdir(parents=True, exist_ok=True)

def build():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    mats={
        'metal':material('Bronze | polished frame','#D89B5D',1,.22),
        'satin':material('Bronze | satin reverse','#D89B5D',1,.38),
        'acrylic':material('Lime acrylic','#8BCD00',0,.085,1),
        'ivory':material('Warm ivory face','#FFE4B8',0,.27,.35),
        'charcoal':material('Charcoal hair and eyes','#161D23',0,.23,.25),
        'highlight':material('Pixel hair highlights','#858B8D',.25,.29),
        'etch':material('Preview inscription','#30271E',0,.6),
    }
    root=bpy.data.objects.new(PREFIX,None); bpy.context.collection.objects.link(root)
    root.rotation_euler.x=math.pi/2
    root['sphere_radius']=RADIUS; root['center_z']=CENTER_Z; root['shell_thickness']=THICKNESS
    root['horizontal_curvature_weight']=HORIZONTAL_CURVATURE_WEIGHT
    root['description']=AWARD_TITLE + ': approved bronze shield; global convex shell, matching curved reverse.'
    contour=shield_contour(); parts=[]
    parts.append(curved_disk('satin_shield_back',contour,.986,lambda x,y,t:dome(x,y)-.025,rear,mats['satin'],root))
    # The rear rim sits .007 proud of the backing; coincident surfaces cause
    # striped reflections after USD triangulation near the shield shoulders.
    parts.append(ring('metal_shield_frame',contour,[(.850,-.030),(.850,.008),(.855,.020),(.867,.028),(.982,.028),(.997,.013),(1,-.016),(.997,-.073),(.985,-.102),(.962,-.102),(.958,-.06)],mats['metal'],root))
    parts.append(curved_disk('acrylic_lime_face',contour,.851,lambda x,y,t:dome(x,y)+.008-.020*t**12,lambda x,y:dome(x,y)-.030,mats['acrylic'],root))
    # Thin reverse inset border follows exactly the same bow as the shield.
    parts.append(ring('satin_rear_border',contour,[(.915,-.095),(.918,-.098),(.927,-.098),(.930,-.095),(.927,-.091),(.918,-.091)],mats['satin'],root))

    parts.extend(create_emblem(root,mats))
    frame=bpy.data.objects.new(f'{PREFIX}_Front_Frame',None); bpy.context.collection.objects.link(frame); frame.parent=root
    anchors=[root,frame,anchor(f'{PREFIX}_Back_Engraving',-.04,1.15,.55,root)]
    for name,y,w,h in [('Name',.17,1.12,.115),('Caption',-.04,1.08,.102),('Date',-.25,.86,.09)]:
        anchors.append(anchor(PREFIX+'_Back_'+name,y,w,h,root))
    checks=verify(parts)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts+anchors: obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    export_selected()
    bpy.ops.object.select_all(action='DESELECT')
    samples=sample_engraving(root,mats['etch'])
    cams=setup_studio(); bpy.context.scene.camera=cams['angle']
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
    manifest={
        'id':ASSET_ID,'frame_prefix':PREFIX,'family':'getting_started','tier':'bronze','revision':4,
        'asset':EXPORT.name,'editable_master':MASTER.name,
        'coordinates':'+X right, +Y up, +Z front; exported Y-up',
        'curvature':{'type':'ellipsoidal','radius':RADIUS,'horizontal_weight':HORIZONTAL_CURVATURE_WEIGHT,'center_z':CENTER_Z,'shell_thickness':THICKNESS,'rear_formula':'center_z + sqrt(radius^2-horizontal_weight*x^2-y^2) - radius - shell_thickness'},
        'engraving':{'preview_text_in_export':False,'name_anchor':f'{PREFIX}_Back_Name','caption_anchor':f'{PREFIX}_Back_Caption','date_anchor':f'{PREFIX}_Back_Date','rear_rotation_y_degrees':180},
        'front_emblems':'All layers conform to the shared shield surface, including caps and facial details',
        'parts':checks,'palette':{'metal':'#D89B5D','acrylic':'#8BCD00','ivory':'#FFE4B8','charcoal':'#161D23','highlight':'#858B8D'},
        'source_reference':"../references/" + ASSET_ID.replace('_','-') + '-approved.png',
        'validation':{'source_meshes_closed_outward':True,'usdz_reimport':'pending'},
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    render(cams)
    print('FIRST_AGENT_BUILT',str(MASTER),str(EXPORT),flush=True)

def proof():
    bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    for obj in list(bpy.data.objects):
        if obj.type not in {'LIGHT','CAMERA'}: bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.wm.usd_import(filepath=str(EXPORT))
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    assert not any('preview_' in obj.name for obj in meshes)
    checks=verify(meshes)
    names={obj.name for obj in bpy.context.scene.objects}
    for name in (f'{PREFIX}_Front_Frame',f'{PREFIX}_Back_Name',f'{PREFIX}_Back_Caption',f'{PREFIX}_Back_Date'):
        assert name in names,(name,'missing anchor')
    root=bpy.data.objects.get(PREFIX)
    assert root is not None
    # Reimported USD is Z-up again in Blender. Front frame remains the authority.
    sample_engraving(root,bpy.data.materials.get('Preview inscription'))
    cams={name:bpy.data.objects[name] for name in ('front','angle','profile','back','top')}
    render(cams,'usdz-')
    report={'closed_outward_meshes':checks,'anchors_present':True,'sample_text_in_export':False,'usdz_bytes':EXPORT.stat().st_size}
    (OUT/'usd-reimport-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    manifest=json.loads((OUT/'manifest.json').read_text()); manifest['validation']['usdz_reimport']='passed'
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('FIRST_AGENT_USDZ_VERIFIED',json.dumps(report),flush=True)

if __name__ == '__main__':
    reexport() if EXPORT_ONLY else proof() if PROOF else build()
