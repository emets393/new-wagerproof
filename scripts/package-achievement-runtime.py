"""Package approved medal exports into bounded-size iOS family resources.

Run with Blender -b --python this-script.py [-- --family getting-started].
Masters are never modified. Collapse LODs transfer original corner normals.
"""
import bpy, bmesh, json, math, sys, shutil, ast
from pathlib import Path
from mathutils import Vector
from pxr import Usd, UsdGeom, UsdShade, UsdLux

REPO=Path(__file__).resolve().parents[1]
ASSETS=REPO/'artifacts/achievements'
OUT=REPO/'wagerproof-ios-native/Wagerproof/Resources/Achievements'
sys.path.insert(0,str(Path(__file__).resolve().parent))
import medal_studio as studio

def families():
    result={'getting-started':[ASSETS/s/'manifest.json' for s in ['first-agent','first-follow','first-picks']]}
    for family in ['experience','streaks','performance','leaderboard','exploration']:
        result[family]=sorted((ASSETS/family).glob('*/manifest.json'))
    return result

def rebuild_follow_emblem(root,meshes):
    # Reuse exact approved contours/materials/heights with the newer conforming
    # tessellator. The very dense original cap mesh cannot safely collapse.
    keep=[o for o in meshes if any(tag in o.name for tag in ['shield_back','shield_frame','lime_face','rear_border'])]
    for o in meshes:
        if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
    tree=ast.parse((REPO/'scripts/build-first-follow-medal.py').read_text())
    func=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='emblem')
    namespace={'core':studio.core}
    exec(compile(ast.Module(body=[func],type_ignores=[]),'approved-follow-emblem','exec'),namespace)
    mats=studio.make_mats({'tier':'bronze'})
    mats['highlight']=studio.material('Pixel hair highlights','#858B8D',.25,.29)
    original=studio.core.prism
    def prism(name,points,bottom,top,mat,parent,bevel=.006):
        base=bottom(0,0) if callable(bottom) else bottom
        return studio.polygon(name,points,base-studio.CENTER,top-studio.CENTER,mat,parent,bevel)
    try:
        studio.core.prism=prism
        additions=namespace['emblem'](root,mats)
    finally:studio.core.prism=original
    studio.core.verify(additions)
    return keep+additions

def optimize(obj,ratio):
    count=len(obj.data.polygons)
    # Thin cutout chassis and crown edge bevels need their original topology.
    if count<20000 or 'chassis' in obj.name or 'satin_ticket_reverse' in obj.name:return count,count
    offsets=[v.co.z-studio.dome(v.co.x,v.co.y) for v in obj.data.vertices]
    high=max(offsets);low=min(offsets)
    source=obj.copy();source.data=obj.data.copy();bpy.context.collection.objects.link(source)
    source.name='temporary_normal_source'
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Runtime curved-surface LOD','DECIMATE')
    mod.ratio=max(256/count,ratio);mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    transfer=obj.modifiers.new('Preserve approved shading','DATA_TRANSFER')
    transfer.object=source;transfer.use_loop_data=True;transfer.data_types_loops={'CUSTOM_NORMAL'}
    transfer.loop_mapping='POLYINTERP_NEAREST'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    # The planar caps were intentionally shaded with exact dome normals in
    # the masters. Nearest-surface transfer alone blends their bevel boundary.
    normals=[n.vector.copy() for n in obj.data.corner_normals]
    for face in obj.data.polygons:
        off=[obj.data.vertices[obj.data.loops[i].vertex_index].co.z-studio.dome(obj.data.vertices[obj.data.loops[i].vertex_index].co.x,obj.data.vertices[obj.data.loops[i].vertex_index].co.y) for i in face.loop_indices]
        sign=1 if max(abs(v-high) for v in off)<.0015 else (-1 if max(abs(v-low) for v in off)<.0015 else 0)
        if sign:
            for i in face.loop_indices:
                x,y,_=obj.data.vertices[obj.data.loops[i].vertex_index].co
                den=math.sqrt(studio.RADIUS**2-studio.WEIGHT*x*x-y*y)
                normals[i]=Vector((sign*studio.WEIGHT*x/den,sign*y/den,sign)).normalized()
    obj.data.normals_split_custom_set(normals)
    bpy.data.objects.remove(source,do_unlink=True)
    bm=bmesh.new();bm.from_mesh(obj.data)
    assert all(e.is_manifold for e in bm.edges),(obj.name,'LOD open edge')
    assert bm.calc_volume(signed=True)>0,(obj.name,'LOD inverted')
    bm.free()
    print('LOD_MESH',obj.name,count,len(obj.data.polygons),flush=True)
    return count,len(obj.data.polygons)

def package(family,paths):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    container=bpy.data.objects.new('AchievementFamily',None);bpy.context.collection.objects.link(container)
    records=[];roots=[]
    for path in paths:
        d=json.loads(path.read_text());prefix=d['frame_prefix']
        before=set(bpy.data.objects)
        bpy.ops.wm.usd_import(filepath=str(path.parent/d['asset']))
        added=set(bpy.data.objects)-before;root=bpy.data.objects[prefix]
        root.parent=container;roots.append(root)
        meshes=[o for o in added if o.type=='MESH']
        source_faces=sum(len(o.data.polygons) for o in meshes)
        if prefix=='FirstFollow':meshes=rebuild_follow_emblem(root,meshes)
        total=sum(len(o.data.polygons) for o in meshes)
        ratio=min(1,22000/total)
        counts=[(len(o.data.polygons),len(o.data.polygons)) for o in meshes] if prefix=='FirstFollow' else [optimize(o,ratio) for o in meshes]
        assert all(bpy.data.objects.get(prefix+'_Back_'+suffix) for suffix in ['Name','Caption','Date'])
        imagepath=path.parent/'renders/usdz-front.png'
        if not imagepath.exists():imagepath=path.parent/'renders/front.png'
        image=bpy.data.images.load(str(imagepath),check_existing=False)
        image.scale(384,384);image.file_format='PNG';image.filepath_raw=str(OUT/f'achievement_{prefix}.png');image.save()
        bpy.data.images.remove(image)
        records.append({'frame_prefix':prefix,'source':str(path.relative_to(REPO)),
                        'original_faces':source_faces,'runtime_faces':sum(x[1] for x in counts),
                        'contour_retessellated':prefix=='FirstFollow'})
    bpy.ops.object.select_all(action='DESELECT')
    for o in [container]+list(container.children_recursive):o.select_set(True)
    bpy.context.view_layer.objects.active=container
    export=OUT/(family+'.usdz');studio.core.EXPORT=export;studio.core.export_selected()
    stage=Usd.Stage.Open(str(export));assert UsdGeom.GetStageUpAxis(stage)=='Y'
    prims=list(stage.Traverse())
    for r in records:assert any(p.GetName()==r['frame_prefix'] for p in prims)
    assert not any(p.IsA(UsdGeom.Camera) or p.HasAPI(UsdLux.LightAPI) or 'preview_' in p.GetName() for p in prims)
    for p in prims:
        if p.IsA(UsdGeom.Mesh):
            assert UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]
            assert UsdGeom.Mesh(p).GetNormalsAttr().Get()
    # Render the actual packaged representative beside its original evidence.
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.wm.usd_import(filepath=str(export))
    cams=studio.core.setup_studio();scene=bpy.context.scene
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=40
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.camera=cams['angle']
    representatives=records if family=='getting-started' else records[:1]
    for index,representative in enumerate(representatives):
        for r in records:
            root=bpy.data.objects[r['frame_prefix']]
            for o in [root]+list(root.children_recursive):o.hide_render=r['frame_prefix']!=representative['frame_prefix']
        name=family if index==0 else representative['frame_prefix']
        scene.render.filepath=str(OUT/'verification'/(name+'-runtime-angle.png'))
        bpy.ops.render.render(write_still=True)
    report={'family':family,'bytes':export.stat().st_size,'variants':records,'checks':{'y_up':True,'material_bindings':True,'corner_normals':True,'no_studio':True,'lod_closed_outward':True}}
    (OUT/'verification'/(family+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    print('RUNTIME_FAMILY',family,export.stat().st_size,flush=True)

def main():
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'verification').mkdir(exist_ok=True)
    skybox=OUT/'achievement_studio.skybox';skybox.mkdir(exist_ok=True)
    shutil.copy2(ASSETS/'studio/studio.hdr',skybox/'studio.hdr')
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    chosen=args[args.index('--family')+1] if '--family' in args else None
    for family,paths in families().items():
        if not chosen or chosen==family:package(family,paths)

if __name__=='__main__':main()
