"""Read the delivered First Agent USDZ independently using Blender's USD reader.

Blender -b --python-exit-code 1 --python scripts/verify-first-agent-medal.py
"""
from collections import Counter
import json
import math
import sys
import numpy as np
from pathlib import Path
from pxr import Gf, Usd, UsdGeom, UsdLux, UsdShade

OUT = Path(__file__).resolve().parents[1] / 'artifacts/achievements/first-agent'
if '--asset-dir' in sys.argv:
    OUT = Path(sys.argv[sys.argv.index('--asset-dir')+1]).resolve()
manifest = json.loads((OUT / 'manifest.json').read_text())
prefix = manifest.get('frame_prefix', 'FirstAgent')
stage = Usd.Stage.Open(str(OUT / manifest['asset']))
assert stage, 'USDZ could not be opened'
assert UsdGeom.GetStageUpAxis(stage) == 'Y', 'Expected exported Y-up'
prims = list(stage.Traverse())
assert not any(p.HasAPI(UsdLux.LightAPI) or 'Light' in p.GetTypeName()
               or p.IsA(UsdGeom.Camera) for p in prims), 'Unexpected light or camera prim'
assert not any(any(token in str(p.GetPath()).lower() for token in ('preview', 'studio', 'camera', 'light'))
               for p in prims if p.IsA(UsdGeom.Xform) and not p.GetName().startswith('highlight_')), 'Unexpected studio/preview nodes'
cache = UsdGeom.XformCache()

def transform(name):
    matches = [p for p in prims if p.GetName() == name and p.IsA(UsdGeom.Xform)]
    assert len(matches) == 1, (name, 'missing or ambiguous anchor')
    return cache.GetLocalToWorldTransform(matches[0])

front = transform(prefix + '_Front_Frame')
assert (front.TransformDir(Gf.Vec3d(0, 0, 1)) - Gf.Vec3d(0, 0, 1)).GetLength() < 1e-5
assert (front.TransformDir(Gf.Vec3d(0, 1, 0)) - Gf.Vec3d(0, 1, 0)).GetLength() < 1e-5
anchors = {}
curve = manifest['curvature']
for suffix in ('Engraving', 'Name', 'Caption', 'Date'):
    matrix = transform(prefix + '_Back_' + suffix)
    assert (matrix.TransformDir(Gf.Vec3d(0, 0, 1)) - Gf.Vec3d(0, 0, -1)).GetLength() < 1e-5
    position = matrix.ExtractTranslation()
    x, y, z = position
    rear_z = curve['center_z'] + math.sqrt(curve['radius']**2 - curve.get('horizontal_weight', 1)*x*x - y*y) - curve['radius'] - curve['shell_thickness']
    assert abs(z - rear_z) < 1e-5, (suffix, z, rear_z)
    anchors[suffix] = list(position)

expected_shaders = {'metal': (1, 0), 'satin': (1, 0), 'acrylic': (0, 1),
                    'ivory': (0, .35), 'charcoal': (0, .25), 'highlight': (.25, 0)}
parts = {}
for prim in prims:
    if not prim.IsA(UsdGeom.Mesh):
        continue
    name = prim.GetParent().GetName()
    assert name in manifest['parts'], ('unexpected mesh', str(prim.GetPath()))
    assert name not in parts, (name, 'duplicate part mesh')
    mesh = UsdGeom.Mesh(prim)
    points = list(mesh.GetPointsAttr().Get())
    assert points and all(math.isfinite(c) for p in points for c in p)
    if name == 'satin_shield_back':
        world = cache.GetLocalToWorldTransform(prim)
        # Verify the changed horizontal bow on the exported surface, not just
        # centerline text anchors (where horizontal weight has no effect).
        for point in points:
            x, y, z = world.Transform(Gf.Vec3d(point))
            surface = curve['center_z'] + math.sqrt(curve['radius']**2 - curve.get('horizontal_weight', 1)*x*x - y*y) - curve['radius']
            assert min(abs(z-(surface-curve['shell_thickness'])), abs(z-(surface-.025))) < 1e-5, ('backing curve mismatch', x, y, z)
    if manifest.get('revision', 0) >= 4 and name not in {'satin_shield_back', 'metal_shield_frame', 'acrylic_lime_face', 'satin_rear_border'}:
        world = cache.GetLocalToWorldTransform(prim)
        offsets = []
        xs = []
        for point in points:
            x, y, z = world.Transform(Gf.Vec3d(point))
            surface = curve['center_z'] + math.sqrt(curve['radius']**2 - curve['horizontal_weight']*x*x - y*y) - curve['radius']
            offsets.append(z-surface); xs.append(x)
        # A complete cap follows the bow at a constant relief offset, including
        # many interior vertices. Flat caps only touch that surface at the edge.
        front_offset = max(offsets)
        cap_x = {round(x, 5) for x, offset in zip(xs, offsets) if abs(offset-front_offset) < 2e-5}
        assert len(cap_x) >= 8, (name, 'front cap does not follow shared bow')
    normals = mesh.GetNormalsAttr().Get()
    assert len(normals) and np.isfinite(np.asarray(normals)).all()
    counts = list(mesh.GetFaceVertexCountsAttr().Get())
    indices = list(mesh.GetFaceVertexIndicesAttr().Get())
    assert sum(counts) == len(indices) and all(n >= 3 for n in counts)
    assert all(0 <= i < len(points) for i in indices)
    if all(n == 3 for n in counts):
        triangles = np.asarray(indices, dtype=np.int64).reshape(-1, 3)
        xyz = np.asarray(points, dtype=np.float64)
        a, b, c = xyz[triangles[:,0]], xyz[triangles[:,1]], xyz[triangles[:,2]]
        volume = float(np.einsum('ij,ij->i', a, np.cross(b,c)).sum()/6)
        edge_pairs = np.concatenate((triangles[:,[0,1]], triangles[:,[1,2]], triangles[:,[2,0]]))
        edge_pairs.sort(axis=1)
        _, occurrences = np.unique(edge_pairs, axis=0, return_counts=True)
        assert (occurrences == 2).all(), (name, 'open/nonmanifold indexed topology')
    else:
        edges = Counter()
        volume = 0.0
        offset = 0
        for count in counts:
            face = indices[offset:offset + count]
            offset += count
            for a, b in zip(face, face[1:] + face[:1]):
                edges[tuple(sorted((a, b)))] += 1
            a = Gf.Vec3d(points[face[0]])
            for i in range(1, count - 1):
                b, c = Gf.Vec3d(points[face[i]]), Gf.Vec3d(points[face[i + 1]])
                volume += Gf.Dot(a, Gf.Cross(b, c)) / 6
        assert all(n == 2 for n in edges.values()), (name, 'open/nonmanifold indexed topology')
    assert volume > 0, (name, 'nonpositive signed volume')
    bound, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
    assert bound, (name, 'missing material')
    shaders = [UsdShade.Shader(p) for p in Usd.PrimRange(bound.GetPrim())
               if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetIdAttr().Get() == 'UsdPreviewSurface']
    assert len(shaders) == 1, (name, 'expected one preview shader')
    shader = shaders[0]
    role = name.split('_', 1)[0]
    finish = {key: shader.GetInput(key).Get() for key in ('metallic', 'clearcoat', 'roughness')}
    for key, expected in zip(('metallic', 'clearcoat'), expected_shaders[role]):
        assert finish[key] is not None and abs(finish[key] - expected) < 1e-5, (name, key, finish)
    print('Verified', name, flush=True)
    parts[name] = {'vertices': len(points), 'polygons': len(counts), 'closed_outward': True,
                   'signed_volume': round(volume, 9), 'shader': finish}
assert set(parts) == set(manifest['parts']), 'Missing or duplicate mesh roles'
report = {'asset': manifest['asset'], 'status': 'passed', 'up_axis': 'Y', 'curved_backing_surface': 'passed',
          'front_and_rear_frames': 'passed', 'rear_surface_anchors': anchors,
          'no_preview_geometry': True, 'parts': parts}
(OUT / 'usdz-independent-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': 'passed', 'meshes': len(parts), 'report': str(OUT / 'usdz-independent-verification.json')}))
