"""Shared, sRGB family palettes. Geometry, tier metals and engraving remain unchanged."""
import bpy
PALETTES={
 'getting-started':dict(primary='#008B48',secondary='#25BB78',enamel='#D3F4E2',name='Emerald / jade'),
 'experience':dict(primary='#175BC5',secondary='#4FADED',enamel='#D2E9FF',name='Sapphire / ice'),
 'streaks':dict(primary='#E74712',secondary='#FFAB25',enamel='#FFF0CF',name='Ember / amber'),
 'performance':dict(primary='#763AB9',secondary='#B47BE5',enamel='#EBDDFF',name='Amethyst / lilac'),
 'leaderboard':dict(primary='#AA1644',secondary='#E64C70',enamel='#FFE5E9',name='Ruby / rose'),
 'exploration':dict(primary='#008D94',secondary='#45CABB',enamel='#CCFFF0',name='Teal / aqua'),
}
PREFIXES={'FirstAgent':'getting-started','FirstFollow':'getting-started','FirstPicks':'getting-started',
 **{f'Experience{n}':'experience' for n in [10,50,100,500]},
 **{f'Streak{n}':'streaks' for n in [3,5,10,15]},
 **{n:'performance' for n in ['FirstWin','Plus10Units','Plus25Units','Consistent']},
 **{n:'leaderboard' for n in ['Top100','Top10','NumberOne']},
 **{n:'exploration' for n in ['GameAnalyst','PropsScout','TrendExplorer','SystemBuilder','WagerbotPartner','ConnectedResearcher']}}
def linear(h):
 vals=[int(h[i:i+2],16)/255 for i in (1,3,5)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)
def apply(objects=None):
 count=0
 for obj in list(objects if objects is not None else bpy.context.scene.objects):
  if obj.type!='MESH':continue
  ancestor=obj;family=None
  while ancestor:
   family=PREFIXES.get(ancestor.name.split('.')[0])
   if family:break
   ancestor=ancestor.parent
  if not family:continue
  p=PALETTES[family];name=obj.name.lower();color=None
  if name.startswith('acrylic'):
   side=family in ['streaks','leaderboard'] and ('left' in name or 'right' in name)
   color=p['secondary'] if side else p['primary']
  elif name.startswith('ivory'):
   if family=='getting-started':
    if 'pixel_check' in name:color=p['enamel']
   else:
    color=p['secondary'] if family=='exploration' and ('lower_pixel_link' in name or 'slider_rail' in name) else p['enamel']
  if not color:continue
  for slot in obj.material_slots:
   old=slot.material
   if not old:continue
   key='Palette_'+family+'_'+color[1:]
   mat=bpy.data.materials.get(key)
   if not mat:
    mat=old.copy();mat.name=key
    shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if shader:shader.inputs['Base Color'].default_value=(*linear(color),1)
    mat.diffuse_color=(*linear(color),1)
   slot.material=mat
  count+=1
 return count
