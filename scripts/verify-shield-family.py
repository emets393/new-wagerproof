"""Verify all shield exports share the exact same curved body and finishes.

Run after each standalone asset passes verify-first-agent-medal.py.
Blender -b --python-exit-code 1 --python scripts/verify-shield-family.py
"""
from pathlib import Path
import hashlib
import json
from pxr import Usd, UsdGeom, UsdShade

ROOT = Path(__file__).resolve().parents[1] / 'artifacts/achievements'
SHARED = {'satin_shield_back', 'metal_shield_frame', 'acrylic_lime_face', 'satin_rear_border'}
baseline = None
report = {}
for slug in ('first-agent', 'first-follow', 'first-picks'):
    folder = ROOT / slug
    manifest = json.loads((folder / 'manifest.json').read_text())
    assert manifest['curvature']['horizontal_weight'] == 3.8
    stage = Usd.Stage.Open(str(folder / manifest['asset']))
    assert stage
    parts = {}
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh) or prim.GetParent().GetName() not in SHARED:
            continue
        mesh = UsdGeom.Mesh(prim)
        mat, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
        shaders = [UsdShade.Shader(p) for p in Usd.PrimRange(mat.GetPrim())
                   if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetIdAttr().Get() == 'UsdPreviewSurface']
        assert len(shaders) == 1
        shader = shaders[0]
        values = {
            'points': [list(v) for v in mesh.GetPointsAttr().Get()],
            'counts': list(mesh.GetFaceVertexCountsAttr().Get()),
            'indices': list(mesh.GetFaceVertexIndicesAttr().Get()),
            'normals': [list(v) for v in mesh.GetNormalsAttr().Get()],
            'color': list(shader.GetInput('diffuseColor').Get()),
            'finish': [shader.GetInput(key).Get() for key in ('metallic', 'roughness', 'clearcoat')],
        }
        parts[prim.GetParent().GetName()] = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()
    assert set(parts) == SHARED
    if baseline is None:
        baseline = parts
    else:
        assert parts == baseline, (slug, 'shared shield geometry/material mismatch')
    report[slug] = {'shared_part_hashes': parts, 'curve': manifest['curvature'], 'status': 'passed'}
(ROOT / 'shield-family-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS: three shield variants have identical curved bodies, normals, and finishes')
