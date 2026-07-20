/**
 * Regenerates the nl-filter-patch Edge Function artifacts from the single sources of truth:
 *   schema.json      ← filterSchemaPrompt.ts      (NFL)
 *   schema.cfb.json  ← filterSchemaPromptCfb.ts   (CFB)
 *   schema.mlb.json  ← filterSchemaPromptMlb.ts   (MLB)
 *   reducer.gen.mjs  ← scripts/nl-reducer-entry.ts (shared engine + per-sport configs/normalizers)
 * Run after ANY schema/prompt change, then redeploy. Parity tests fail if artifacts are stale.
 *
 *   npx tsx scripts/gen-nl-filter-schema.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { buildNlFilterArtifact } from '../src/features/analysis/filterSchemaPrompt';
import { buildCfbNlFilterArtifact } from '../src/features/analysis/filterSchemaPromptCfb';
import { buildMlbNlFilterArtifact } from '../src/features/analysis/filterSchemaPromptMlb';

const here = dirname(fileURLToPath(import.meta.url));
const fn = (f: string) => resolve(here, '../supabase/functions/nl-filter-patch/', f);

for (const [file, artifact] of [
  ['schema.json', buildNlFilterArtifact()],
  ['schema.cfb.json', buildCfbNlFilterArtifact()],
  ['schema.mlb.json', buildMlbNlFilterArtifact()],
] as const) {
  writeFileSync(fn(file), JSON.stringify(artifact, null, 2) + '\n');
  console.log(`wrote ${file} — systemPrompt ${artifact.systemPrompt.length} chars`);
}

execSync('npx esbuild scripts/nl-reducer-entry.ts --bundle --format=esm --platform=neutral --outfile=supabase/functions/nl-filter-patch/reducer.gen.mjs', { stdio: 'inherit' });
