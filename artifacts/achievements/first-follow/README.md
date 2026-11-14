# First Follow

Approved two-head pixel emblem on the shared Getting Started shield. The shell, materials, studio, curvature, and engraving use `scripts/build-first-agent-medal.py`; this variant supplies only its two-head geometry through `scripts/build-first-follow-medal.py`.

- Editable source: `first-follow.blend`, with packed studio dependencies.
- Runtime export: `first-follow.usdz`, without sample lettering or studio lights.
- Actual source renders: `renders/front.png`, `angle.png`, `profile.png`, `back.png`.
- Actual exported-model renders: corresponding `renders/usdz-*.png`.
- Geometry/material report: `usdz-independent-verification.json`.
- Reimport report: `usd-reimport-verification.json`.

Use `FirstFollow_Front_Frame` and `FirstFollow_Back_Name/Caption/Date` for runtime orientation and personalized text. Rear lettering must follow the spherical surface described in `manifest.json`; locked awards have no inscription. Preview name/date are excluded from USDZ.

The cap agent has pale cyan eye accents named `ivory_cyan_eye_accent_*`. They use ivory enamel shader settings with color `#A4DAD4`; preserve this more-specific color role before a generic `ivory_` runtime recolor. Head meshes use stable left/right role names. Emblem caps, facial details, and bronze bases follow the same convex surface as the shield.

Build with Blender `-b --python-exit-code 1 --python scripts/build-first-follow-medal.py`, followed by `-- --proof` for exported-model renders. Run `scripts/verify-first-agent-medal.py -- --asset-dir artifacts/achievements/first-follow` through Blender for independent USD checks.
