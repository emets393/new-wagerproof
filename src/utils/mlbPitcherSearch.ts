/** Accent/case folding so "Jose" matches "José", "Suarez" matches "Suárez", etc. */
export function foldSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function pitcherMatchesQuery(
  pitcher: { name: string; team?: string | null },
  query: string,
): boolean {
  const q = foldSearchText(query.trim());
  if (!q) return true;
  if (foldSearchText(pitcher.name).includes(q)) return true;
  if (pitcher.team && foldSearchText(pitcher.team).includes(q)) return true;
  return false;
}

/** Rank matches: prefix on any name token first, then substring, then small typos. */
export function filterPitchers<T extends { name: string; team?: string | null }>(
  pitchers: T[],
  query: string,
  limit = 40,
): T[] {
  const q = foldSearchText(query.trim());
  if (!q) return pitchers.slice(0, limit);

  const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const scored: { p: T; score: number }[] = [];
  for (const p of pitchers) {
    const name = foldSearchText(p.name);
    const team = p.team ? foldSearchText(p.team) : '';
    let score = Infinity;
    if (name.includes(q) || (team && team.includes(q))) {
      const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);
      if (name.startsWith(q) || tokens.some((t) => t.startsWith(q))) score = 0;
      else if (tokens.some((t) => t.includes(q))) score = 1;
      else score = 2;
    } else if (qTokens.length >= 2) {
      // Christopher Sanchez → Cristopher Sánchez (1-char first-name typo)
      const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);
      if (tokens.length >= 2) {
        let total = 0;
        let ok = true;
        for (const qt of qTokens) {
          let best = Infinity;
          for (const ct of tokens) {
            const d = tokenEditDistance(qt, ct);
            if (d < best) best = d;
          }
          const maxTok = qt.length >= 8 ? 2 : qt.length >= 5 ? 1 : 0;
          if (best > maxTok) { ok = false; break; }
          total += best;
        }
        if (ok && total <= 2) score = 3 + total;
      }
    }
    if (score !== Infinity) scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((s) => s.p);
}

function tokenEditDistance(a: string, b: string): number {
  if (a === b || b.startsWith(a) || a.startsWith(b)) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
