"""Blender: split verified iOS runtime families into native Android GLBs.
Run: blender -b --python scripts/export-android-achievement-models.py
Reuses authored geometry and names; no remodeling or camera/light export.
"""
import bpy,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'wagerproof-ios-native/Wagerproof/Resources/Achievements'
OUT=ROOT/'wagerproof-android-native/app/src/main/assets/achievements'
OUT.mkdir(parents=True,exist_ok=True)
s=(ROOT/'wagerproof-ios-native/WagerproofKit/Sources/WagerproofModels/Achievement.swift').read_text()
rows=re.findall(r'\.init\(id: "([^"]+)", title: "([^"]+)", group: \.(\w+), variantRoot: "([^"]+)"',s)
for group in dict.fromkeys(r[2] for r in rows):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 family='getting-started' if group=='gettingStarted' else group
 bpy.ops.wm.usd_import(filepath=str(SRC/(family+'.usdz')))
 for id,title,g,prefix in rows:
  if g!=group:continue
  obj=bpy.data.objects[prefix]
  bpy.ops.object.select_all(action='DESELECT')
  for o in [obj]+list(obj.children_recursive):o.select_set(True)
  bpy.context.view_layer.objects.active=obj
  bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_animations=False)
  print('EXPORTED',id,flush=True)
print('PASS exported',len(rows),'models',flush=True)
