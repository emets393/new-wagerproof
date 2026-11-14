"""First Picks pixel-check emblem on the shared approved Getting Started shield."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('wagerproof_shield', Path(__file__).with_name('build-first-agent-medal.py'))
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
core.configure_variant('first_picks', 'FirstPicks', 'FIRST PICKS')


def create_emblem(root, mats):
    # One continuous stepped check; bronze support follows the existing bow.
    pixels = [(-5,1),(-3,1),(-3,0),(-2,0),(-2,-1),(-1,-1),
              (-1,0),(0,0),(0,1),(1,1),(1,2),(2,2),(2,3),(3,3),
              (3,4),(4,4),(4,5),(6,5),(6,3),(5,3),(5,2),(4,2),
              (4,1),(3,1),(3,0),(2,0),(2,-1),(1,-1),(1,-2),
              (0,-2),(0,-3),(-1,-3),(-1,-4),(-3,-4),(-3,-3),
              (-4,-3),(-4,-2),(-5,-2)]
    shape = [((x-.5)*.108, (y-.5)*.108+.02) for x,y in pixels]
    root['description'] = 'First Picks pixel check on the shared convex bronze shield.'
    return [
        core.prism('metal_pixel_check_outline', shape,
                   lambda x,y:core.dome(x,y)+.002, .197, mats['metal'], root, .006),
        core.prism('ivory_pixel_check_face', core.inset_polygon(shape,.024),
                   .188, .218, mats['ivory'], root, .004),
    ]


core.create_emblem = create_emblem
if __name__ == '__main__':
    core.reexport() if core.EXPORT_ONLY else core.proof() if core.PROOF else core.build()
