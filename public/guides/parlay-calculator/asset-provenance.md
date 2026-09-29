# Parlay calculator assets

No AI imagery. Both files are compositions of a real screenshot of this page's calculator.

Screenshot: headless Chrome (Puppeteer from this repo's devDependencies), September 28, 2026. The locally built page `dist/guides/parlay-calculator/index.html` was served on localhost, set to the light theme, at a 1180 px viewport and device scale factor 2. The three default legs (-110, -110, +150, $10 stake) were left as rendered, and the optional "Other side" fields were typed as -110, -110 and -170 so the no-vig results show. The three caveat notes under the form were hidden for the capture; nothing else was edited. Element screenshot of `.parlay-calc`: 2160x1674 PNG, SHA-256 fa82bae7016d4e6a554fd8bec93a3a28e668642f6f88d27ad25c4f7ded70a055 (kept in the session scratchpad, not committed).

Every number visible in the screenshot is the calculator's own output: payout $91.12, profit $81.12, +811, 9.1116, 10.98% implied, fair 9.71%, +930 (10.2963), fair payout $102.96, EV -$1.15, vig 11.51%.

Composition: a static HTML layout rendered by the same headless Chrome at exact output size. Background is a flat CSS gradient and grid in WagerProof forest green; the WagerProof app icon is `/guides/brand/wagerproof-app-icon-v1.png`; type is the site's Nunito variable font from `/guides/brand/`. Title "Parlay Calculator" and the line "Odds, payout and the true probability once the vig is removed." are set as live text.

Derivatives (cwebp q86):
- parlay-calculator-title-card-v1.webp, 1672x941: screenshot scaled to 980 px wide, bleeding off the right edge.
- parlay-calculator-social-v1.webp, 1200x630: separate render of the same layout at 1200x630, screenshot 700 px wide.

Both were inspected visually; the title and the payout block are fully inside each frame. To regenerate after a UI change, re-capture and bump to -v2 rather than overwriting.
