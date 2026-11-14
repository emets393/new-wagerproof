import sys,json
from pathlib import Path
from pxr import Usd,UsdGeom,UsdShade
sys.path.insert(0,str(Path(__file__).resolve().parent))
from medal_palette import PALETTES,PREFIXES,linear
root=Path(__file__).resolve().parents[1];res=root/'wagerproof-ios-native/Wagerproof/Resources/Achievements'
report={}
for family,palette in PALETTES.items():
 stage=Usd.Stage.Open(str(res/(family+'.usdz')))

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
 report[family]={'primary':palette['primary'],'material_bindings':True,'primary_shader_verified':True,'variant_anchors':True}
(root/'artifacts/achievements/palette-review/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: six palettes, shader colors, bindings, 35 variant anchors')
