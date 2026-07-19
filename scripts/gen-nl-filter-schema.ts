/**
 * Regenerates supabase/functions/nl-filter-patch/schema.json from the single source of truth
 * (src/features/analysis/filterSchemaPrompt.ts). Run after ANY filterSchema/prompt change, then
 * redeploy the function. The parity test (filterSchemaPrompt.test.ts) fails if this is stale.
 *
 *   npx tsx scripts/gen-nl-filter-schema.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNlFilterArtifact } from '../src/features/analysis/filterSchemaPrompt';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../supabase/functions/nl-filter-patch/schema.json');
const artifact = buildNlFilterArtifact();
writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n');
console.log(`wrote ${out} — systemPrompt ${artifact.systemPrompt.length} chars`);

// Also refresh the reducer bundle the Edge Function's server-side validate mode uses.
import { execSync } from 'node:child_process';
execSync('npx esbuild scripts/nl-reducer-entry.ts --bundle --format=esm --platform=neutral --outfile=supabase/functions/nl-filter-patch/reducer.gen.mjs', { stdio: 'inherit' });
