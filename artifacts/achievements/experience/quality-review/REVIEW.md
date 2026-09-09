# Ticket punch-out correction

Scope is the user-requested punch-out transition fix only. No crown changes, new ornament, palette changes, or numeral changes were made in this pass.

The earlier four variants had a hard tangent break where each vertical side entered its elliptical notch. This produced pinched highlights and small jagged-looking lips. The corrected outline retains the same central ellipse and maximum cut depth, with short tangent-continuous cubic fillets at entry and exit. The reverse, acrylic, front rim and rear border use the same corrected outline and continue following the approved global bow.

| Asset | Finding | Fix | Evidence |
| --- | --- | --- | --- |
| Bronze 10 | Pinched highlights at both notch lips | Smooth entry/exit fillets | [Before](before/experience-10-angle.png), [After](../experience-10/renders/usdz-angle.png) |
| Silver 50 | Hard notch shoulder seams especially visible in silver | Smooth entry/exit fillets | [Before](before/experience-50-angle.png), [After](../experience-50/renders/usdz-angle.png) |
| Gold 100 | Same shared notch tangent break | Smooth entry/exit fillets | [Before](before/experience-100-angle.png), [After](../experience-100/renders/usdz-angle.png) |
| Gold 500 | Same shared notch tangent break | Smooth entry/exit fillets | [Before](before/experience-500-angle.png), [After](../experience-500/renders/usdz-angle.png) |

The previous aesthetic assessment was too generous about these transitions. Automated manifold checks did not identify their visual quality issue.

Final validation: all four packed masters and USDZs regenerated. Source and reimported meshes passed closed/outward checks; exports passed Y-up orientation, finite normals/points, material binding, and studio/sample-text exclusion checks. Actual USDZ front/angle views were inspected across all four; bronze 10 top/back confirms continuous cuts through the reverse and preserved curved construction.
