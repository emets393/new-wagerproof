"""Shared curved WagerProof medal authoring and actual-USDZ review studio.

All heights are offsets from the approved bowed surface. The shield builders
remain untouched. New polygons refine long edges only, then use analytic cap
normals so curved insignia do not need uniform, very dense tessellation.
"""
import bpy, bmesh, math, sys, json, importlib.util
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
import numpy as np

REPO=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('shield_reference',Path(__file__).with_name('build-first-agent-medal.py'))
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
dome=core.dome
material=core.material
RADIUS=core.RADIUS
WEIGHT=core.HORIZONTAL_CURVATURE_WEIGHT
CENTER=core.CENTER_Z
TIERS={'bronze':'#D89B5D','silver':'#E0E5E8','gold':'#F2C675'}

def polygon(name,points,bottom_offset,top_offset,mat,root,bevel=.008,holes=None):
    loops=[points]+list(holes or [])
    flat=[[Vector((x,y,0)) for x,y in loop] for loop in loops]
    coords=[p for loop in loops for p in loop]; n=len(coords)
    lookup={(round(x,8),round(y,8)):i for i,(x,y) in enumerate(coords)}
    tris=tessellate_polygon(flat)
    caps=[tuple(p if isinstance(p,int) else lookup[(round(p.x,8),round(p.y,8))] for p in tri) for tri in tris]
    verts=[(x,y,z) for z in (bottom_offset,top_offset) for x,y in coords]
    faces=caps+[tuple(n+i for i in f) for f in caps]
    offset=0
    for loop in loops:
        size=len(loop)
        faces.extend((offset+i,offset+(i+1)%size,n+offset+(i+1)%size,n+offset+i) for i in range(size));offset+=size
    obj=core.mesh(name,verts,faces,mat,root)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    if bevel:
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.dissolve_limit(bm,angle_limit=.0001,verts=list(bm.verts),edges=list(bm.edges))
        bm.to_mesh(obj.data);bm.free()
        mod=obj.modifiers.new('Manufactured edge','BEVEL');mod.width=bevel;mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    # Split each selected edge once and share its midpoint across both faces.
    # Explicit 0/1/2/3-edge triangle cases preserve manifold topology even at
    # tiny bevel corners, unlike partial bmesh subdivide_edges operations.
    bm.verts.ensure_lookup_table();bm.verts.index_update()
    vertices=[v.co.copy() for v in bm.verts]
    triangles=[tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    for _ in range(6):
        mids={}
        for face in triangles:
            for a,b in zip(face,face[1:]+face[:1]):
                key=tuple(sorted((a,b)))
                if key not in mids and (vertices[a]-vertices[b]).length>.075:
                    mids[key]=len(vertices);vertices.append((vertices[a]+vertices[b])*.5)
        if not mids:break
        refined=[]
        for a,b,c in triangles:
            ab=mids.get(tuple(sorted((a,b))));bc=mids.get(tuple(sorted((b,c))));ca=mids.get(tuple(sorted((c,a))))
            count=sum(m is not None for m in (ab,bc,ca))
            if count==0:refined.append((a,b,c))
            elif count==3:refined.extend([(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)])
            elif count==1:
                if bc is not None:a,b,c,ab=b,c,a,bc
                elif ca is not None:a,b,c,ab=c,a,b,ca
                refined.extend([(a,ab,c),(ab,b,c)])
            else:
                if ab is None:a,b,c,ab,bc=b,c,a,bc,ca
                elif bc is None:a,b,c,ab,bc=c,a,b,ca,ab
                refined.extend([(b,bc,ab),(a,ab,c),(ab,bc,c)])
        triangles=refined
    data=bpy.data.meshes.new(name+'_conforming')
    data.from_pydata(vertices,[],triangles);data.update()
    old=obj.data;obj.data=data;data.materials.append(mat)
    if old.users==0:bpy.data.meshes.remove(old)
    bm=bmesh.new();bm.from_mesh(obj.data)
    for face in bm.faces:face.smooth=True
    for edge in bm.edges:edge.smooth=True
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    normals=[n.vector.copy() for n in obj.data.corner_normals]
    for loop in obj.data.loops:
        z=obj.data.vertices[loop.vertex_index].co.z
        if abs(z-top_offset)<1e-5:normals[loop.index]=Vector((0,0,1))
        elif abs(z-bottom_offset)<1e-5:normals[loop.index]=Vector((0,0,-1))
    for v in obj.data.vertices:v.co.z+=dome(v.co.x,v.co.y)
    obj.data.update();transport=[]
    for loop,norm in zip(obj.data.loops,normals):
        x,y,_=obj.data.vertices[loop.vertex_index].co
        den=math.sqrt(RADIUS*RADIUS-WEIGHT*x*x-y*y)
        transport.append(Vector((norm.x+WEIGHT*x/den*norm.z,norm.y+y/den*norm.z,norm.z)).normalized())
    obj.data.normals_split_custom_set(transport)
    obj['surface_top_offset']=top_offset;obj['surface_bottom_offset']=bottom_offset
    return obj

def ring(name,contour,profiles,mat,root):
    return core.ring(name,contour,profiles,mat,root)

def disk(name,contour,scale,top_offset,bottom_offset,mat,root):
    # Polygon tessellation handles concave contours without a potentially folded radial fan.
    return polygon(name,[(x*scale,y*scale) for x,y in contour],bottom_offset,top_offset,mat,root,.005)

def rectangle(x,y,w,h,chamfer=0):
    a,b=x-w/2,y-h/2;c=min(chamfer,w/2,h/2)
    return [(a+c,b),(a+w-c,b),(a+w,b+c),(a+w,b+h-c),(a+w-c,b+h),(a+c,b+h),(a,b+h-c),(a,b+c)] if c else [(a,b),(a+w,b),(a+w,b+h),(a,b+h)]

# Collegiate block numerals matching the approved chamfered, slab-style sheets.
GLYPHS={
'1':([(.12,0),(.61,0),(.61,.18),(.46,.18),(.46,1),(.22,1),(.04,.82),(.04,.64),(.23,.64),(.23,.18),(.12,.18)],[]),
'0':(rectangle(.325,.5,.65,1,.12),[rectangle(.325,.5,.21,.56,.025)]),
'2':([(.10,1),(.54,1),(.65,.89),(.65,.60),(.25,.26),(.25,.20),(.65,.20),(.65,0),(0,0),(0,.31),(.42,.67),(.42,.8),(.23,.8),(.23,.67),(0,.67),(0,.89)],[]),
'3':([(.1,1),(.55,1),(.65,.9),(.65,.6),(.55,.5),(.65,.4),(.65,.1),(.55,0),(.10,0),(0,.10),(0,.29),(.23,.29),(.23,.20),(.42,.20),(.42,.40),(.26,.40),(.26,.60),(.42,.60),(.42,.80),(.23,.80),(.23,.71),(0,.71),(0,.90)],[]),
'5':([(.02,1),(.65,1),(.65,.80),(.24,.80),(.24,.62),(.54,.62),(.65,.51),(.65,.12),(.53,0),(.12,0),(0,.12),(0,.29),(.23,.29),(.23,.20),(.42,.20),(.43,.25),(.43,.39),(.38,.43),(.02,.43)],[]),
'+':([(.22,.2),(.43,.2),(.43,.4),(.63,.4),(.63,.6),(.43,.6),(.43,.8),(.22,.8),(.22,.6),(.02,.6),(.02,.4),(.22,.4)],[])
}

def number(text,center,width,height,root,mats):
    parts=[]; advance=.76; total=(len(text)-1)*advance+.65
    scale=min(width/total,height); cx,cy=center
    def add_glyph(ch,i):
        if ch=='%':
            # Two hollow square counters and a diagonal stroke, all matching the bow.
            shapes=[(rectangle(.16,.78,.28,.40,.025),[rectangle(.16,.78,.10,.19,.008)]),
                    (rectangle(.51,.22,.28,.40,.025),[rectangle(.51,.22,.10,.19,.008)]),
                    ([(.04,.04),(.19,0),(.64,.96),(.49,1)],[])]
        else:shapes=[GLYPHS[ch]]
        for j,(outer,holes) in enumerate(shapes):
            fit=lambda loop:[(cx+(x+i*advance-total/2)*scale,cy+(y-.5)*scale) for x,y in loop]
            outline=fit(outer);inner=[fit(h) for h in holes]
            tag=f'number_{text.replace("+","plus").replace("%","pct")}_{i}_{j}'
            parts.append(polygon('metal_'+tag,outline,.002,.062,mats['metal'],root,.006,holes=inner))
            face=core.inset_polygon(outline,.014)
            holes_face=[core.inset_polygon(h,-.014) for h in inner]
            parts.append(polygon('ivory_'+tag,face,.057,.085,mats['ivory'],root,.004,holes=holes_face))
    for i,ch in enumerate(text):add_glyph(ch,i)
    return parts

def make_mats(variant):
    metal=TIERS[variant['tier']]
    return {'metal':material('Polished '+variant['tier'],metal,1,.22),'satin':material('Satin '+variant['tier'],metal,1,.38),
            'acrylic':material('Colored acrylic',variant.get('fill','#8BCD00'),0,.085,1),
            'ivory':material('Warm ivory enamel','#FFE4B8',0,.27,.35),'charcoal':material('Charcoal','#161D23',0,.23,.25),
            'etch':material('Preview inscription','#30271E',0,.6)}

def audit_export(path,parts):
    from pxr import Usd,UsdGeom,UsdLux,UsdShade
    stage=Usd.Stage.Open(str(path));assert UsdGeom.GetStageUpAxis(stage)=='Y'
    prims=list(stage.Traverse());meshes=[p for p in prims if p.IsA(UsdGeom.Mesh)]
    assert len(meshes)==len(parts)
    assert not any(p.HasAPI(UsdLux.LightAPI) or p.IsA(UsdGeom.Camera) or 'preview_' in p.GetName() for p in prims)
    for p in meshes:
        mesh=UsdGeom.Mesh(p)
        assert np.isfinite(np.asarray(mesh.GetPointsAttr().Get())).all()
        assert np.isfinite(np.asarray(mesh.GetNormalsAttr().Get())).all()
        mat,_=UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial();assert mat
    return {'usd_y_up':True,'mesh_roles_count':len(meshes),'finite_vertices_normals':True,'materials_bound':True,'no_studio_or_sample_text':True}

def run_family(family,variants,geometry):
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    preview='--preview' in args
    selected=args[args.index('--variant')+1] if '--variant' in args else None
    chosen=[v for v in variants if not selected or selected in (v['slug'],str(v['label']))]
    assert chosen,selected
    folder=REPO/'artifacts/achievements'/family;folder.mkdir(parents=True,exist_ok=True)
    for index,v in enumerate(chosen):
        out=folder/v['slug'];renders=out/'renders';renders.mkdir(parents=True,exist_ok=True)
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        prefix=''.join(s.title() for s in v['slug'].split('-'))
        root=bpy.data.objects.new(prefix,None);bpy.context.collection.objects.link(root);root.rotation_euler.x=math.pi/2
        mats=make_mats(v);parts=geometry(root,mats,v)
        checks=core.verify(parts)
        front=bpy.data.objects.new(prefix+'_Front_Frame',None);bpy.context.collection.objects.link(front);front.parent=root
        anchors=[root,front]
        core.PREFIX=prefix;core.AWARD_TITLE=v['title'];core.OUT=out;core.RENDERS=renders
        for label,y,w,h in [('Engraving',-.04,1.1,.55),('Name',.17,1.12,.115),('Caption',-.04,1.08,.102),('Date',-.25,.86,.09)]:
            anchors.append(core.anchor(prefix+'_Back_'+label,y,w,h,root))
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts+anchors:obj.select_set(True)
        bpy.context.view_layer.objects.active=root
        core.EXPORT=out/(v['slug']+'.usdz');core.export_selected()
        export_audit=audit_export(core.EXPORT,parts)
        cams=core.setup_studio();scene=bpy.context.scene
        scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=32 if preview else 48
        scene.render.resolution_x=900 if preview else 1100;scene.render.resolution_y=scene.render.resolution_x
        scene.camera=cams['angle']
        core.sample_engraving(root,mats['etch']);bpy.ops.file.pack_all()
        master=out/(v['slug']+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(master))
        # Every delivered image is an actual-USDZ proof, never a surrogate render.
        for obj in list(bpy.data.objects):
            if obj.type not in {'LIGHT','CAMERA'}:bpy.data.objects.remove(obj,do_unlink=True)
        bpy.ops.wm.usd_import(filepath=str(core.EXPORT))
        imported=[o for o in bpy.context.scene.objects if o.type=='MESH']
        imported_checks=core.verify(imported)
        assert len(imported_checks)==len(checks)
        re_root=bpy.data.objects[prefix]
        core.sample_engraving(re_root,bpy.data.materials.get('Preview inscription'))
        views=['angle','top'] if preview else ['front','angle']+(['top','back'] if index==0 else [])
        for view in views:
            scene.camera=cams[view];scene.render.filepath=str(renders/('usdz-'+view+'.png'))
            bpy.ops.render.render(write_still=True)
        manifest={'id':v['slug'],'family':family,'title':v['title'],'label':v['label'],'tier':v['tier'],'frame_prefix':prefix,
                  'asset':core.EXPORT.name,'editable_master':master.name,'curvature':{'radius':RADIUS,'horizontal_weight':WEIGHT,'center_z':CENTER},
                  'all_front_details_curved':True,'preview_text_in_export':False,'parts':checks,'export_checks':export_audit,
                  'validation':{'source_closed_outward':True,'reimport_closed_outward':True,'actual_usdz_views':views},'usdz_bytes':core.EXPORT.stat().st_size}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        print('VARIANT_COMPLETE',v['slug'],core.EXPORT.stat().st_size,flush=True)
    if not selected:
        lines=[f'# {family.title()} medals','', 'Actual Blender models and reimported USDZ renders. Bodies, reverse, and front details share the approved bow.','']
        for v in variants:
            slug=v['slug'];lines.extend([f'## {v["title"]}','',f'![{v["title"]}]({slug}/renders/usdz-angle.png)','',f'[Blender]({slug}/{slug}.blend) · [USDZ]({slug}/{slug}.usdz)',''])
        lines+=['Review assets only. Runtime integration and device testing remain later work.','']
        (folder/'family-review.md').write_text('\n'.join(lines))
        (folder/'catalog.json').write_text(json.dumps(variants,indent=2)+'\n')
