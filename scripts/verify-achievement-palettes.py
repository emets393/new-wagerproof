import sys,json,zipfile
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade
sys.path.insert(0,str(Path(__file__).resolve().parent))
from medal_palette import PALETTES,PREFIXES,linear
root=Path(__file__).resolve().parents[1];res=root/'wagerproof-ios-native/Wagerproof/Resources/Achievements';before=Path('/tmp/wagerproof-original-palettes');before.mkdir(exist_ok=True)
with zipfile.ZipFile(root/'artifacts/achievements/revisions/pre-family-colors.zip') as z:
 for family in PALETTES:(before/(family+'.usdz')).write_bytes(z.read(family+'.usdz'))
def signature(stage):
 return sorted((p.GetName(),len(UsdGeom.Mesh(p).GetPointsAttr().Get()),len(UsdGeom.Mesh(p).GetFaceVertexCountsAttr().Get())) for p in stage.Traverse() if p.IsA(UsdGeom.Mesh))
report={}
for family,palette in PALETTES.items():
 stage=Usd.Stage.Open(str(res/(family+'.usdz')));old=Usd.Stage.Open(str(before/(family+'.usdz')))

 # Blender may suffix internal mesh datablock names during USD round-trip.
 assert sorted((a,b) for _,a,b in signature(stage))==sorted((a,b) for _,a,b in signature(old)),family
 assert UsdGeom.GetStageUpAxis(stage)=='Y'
 names={p.GetName() for p in stage.Traverse()}
 for prefix,f in PREFIXES.items():
  if f==family:assert prefix in names and prefix+'_Back_Name' in names
 colors=[]
 for p in stage.Traverse():
  if p.IsA(UsdGeom.Mesh):assert UsdShade.MaterialBindingAPI(p).ComputeBoundMaterial()[0]
  if p.IsA(UsdShade.Shader):
   v=UsdShade.Shader(p).GetInput('diffuseColor').Get()
   if v is not None:colors.append(tuple(v))
 expected=linear(palette['primary'])
 assert any(max(abs(a-b) for a,b in zip(c,expected))<1e-5 for c in colors),family
 report[family]={'primary':palette['primary'],'mesh_counts_unchanged':True,'material_bindings':True,'primary_shader_verified':True,'variant_anchors':True}
(root/'artifacts/achievements/palette-review/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: six palettes, shader colors, bindings, 24 variant anchors and unchanged mesh counts')
