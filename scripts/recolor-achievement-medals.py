"""Material-only revision of approved masters and exports. Reuses verified meshes."""
import bpy,sys,json,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import medal_studio as s
from medal_palette import apply,PALETTES
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'artifacts/achievements';R=ROOT/'wagerproof-ios-native/Wagerproof/Resources/Achievements';REVIEW=A/'palette-review';REVIEW.mkdir(exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
# Material-only backups are the untouched delivered runtime archives and thumbnails.
backup=A/'revisions/pre-family-colors.zip'
if not backup.exists():
 with zipfile.ZipFile(backup,'w',zipfile.ZIP_STORED) as z:
  for p in list(R.glob('*.usdz'))+list(R.glob('*.png')):z.write(p,p.name)
if '--masters' in args:
 for path in sorted(A.rglob('manifest.json')):
  if 'revisions' in path.parts:continue
  d=json.loads(path.read_text())
  if 'frame_prefix' not in d:continue
  master=path.parent/d.get('editable_master',path.stem+'.blend')
  if not master.exists():continue
  bpy.ops.wm.open_mainfile(filepath=str(master));apply()
  bpy.ops.wm.save_as_mainfile(filepath=str(master),check_existing=False)
  root=bpy.data.objects[d['frame_prefix']];bpy.ops.object.select_all(action='DESELECT')
  for o in [root]+list(root.children_recursive):
   if not o.name.startswith('preview_'):o.select_set(True)
  s.core.EXPORT=path.parent/d['asset'];s.core.export_selected()
  d['family_palette']=PALETTES[__import__('medal_palette').PREFIXES[d['frame_prefix']]]
  if isinstance(d.get('palette'),dict):d['palette']['acrylic']=d['family_palette']['primary']
  path.write_text(json.dumps(d,indent=2)+'\n');print('MASTER_COLORED',d['frame_prefix'],flush=True)
else:
 for family in PALETTES:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  p=R/(family+'.usdz');bpy.ops.wm.usd_import(filepath=str(p));apply()
  bpy.ops.object.select_all(action='SELECT');s.core.EXPORT=p;s.core.export_selected()
  # Reimport export so review and thumbnails prove shipped material bindings.
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.wm.usd_import(filepath=str(p))
  roots=[o for o in bpy.context.scene.objects if o.name in __import__('medal_palette').PREFIXES]
  cams=s.core.setup_studio();scene=bpy.context.scene;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.samples=20
  for index,root in enumerate(roots):
   for other in roots:
    for o in [other]+list(other.children_recursive):o.hide_render=other!=root
   scene.camera=cams['front'];scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.filepath=str(R/('achievement_'+root.name+'.png'));bpy.ops.render.render(write_still=True)
   # Update the source front proof used by future runtime repackaging.
   for manifest in A.rglob('manifest.json'):
    d=json.loads(manifest.read_text())
    if d.get('frame_prefix')==root.name:
     import shutil
     shutil.copy2(scene.render.filepath,manifest.parent/'renders/usdz-front.png');break
   if index==0:
    scene.camera=cams['angle'];scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.filepath=str(REVIEW/(family+'.png'));bpy.ops.render.render(write_still=True)
  print('FAMILY_COLORED',family,flush=True)
 (REVIEW/'palettes.json').write_text(json.dumps(PALETTES,indent=2)+'\n')
