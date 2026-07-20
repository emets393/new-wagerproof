import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNlFilterArtifact, buildNflDimensionSpec } from './filterSchemaPrompt';
import { buildCfbNlFilterArtifact, buildCfbDimensionSpec } from './filterSchemaPromptCfb';
import { buildMlbNlFilterArtifact, buildMlbDimensionSpec } from './filterSchemaPromptMlb';
import { NFL_DIMENSION_KEYS } from './filterSchema';
import { CFB_DIMENSION_KEYS } from './filterSchemaCfb';
import { MLB_DIMENSION_KEYS } from './filterSchemaMlb';

const ARTIFACT_PATH = resolve(process.cwd(), 'supabase/functions/nl-filter-patch/schema.json');

describe('nl-filter-patch schema.json parity', () => {
  it('the committed Edge Function artifact matches the source of truth (regenerate if this fails)', () => {
    const committed = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
    const fresh = JSON.parse(JSON.stringify(buildNlFilterArtifact()));
    expect(committed).toEqual(fresh);
  });

  it('the dimension catalog covers every filter dimension exactly once', () => {
    const spec = buildNflDimensionSpec();
    const specKeys = spec.map((d) => d.key).sort();
    const schemaKeys = [...NFL_DIMENSION_KEYS].sort();
    expect(specKeys).toEqual(schemaKeys);
    expect(new Set(specKeys).size).toBe(specKeys.length); // no duplicates
  });

  it('the output schema is OpenAI-strict compliant (all object props required)', () => {
    const { outputSchema } = buildNlFilterArtifact();
    const opItem = outputSchema.properties.ops.items;
    expect(opItem.additionalProperties).toBe(false);
    expect(new Set(opItem.required)).toEqual(new Set(Object.keys(opItem.properties)));
    expect(new Set(outputSchema.required)).toEqual(new Set(Object.keys(outputSchema.properties)));
  });
});

describe('per-sport artifact parity (regenerate schema.*.json + redeploy if these fail)', () => {
  const cases = [
    ['schema.cfb.json', buildCfbNlFilterArtifact],
    ['schema.mlb.json', buildMlbNlFilterArtifact],
  ] as const;
  for (const [file, build] of cases) {
    it(`${file} matches its source`, () => {
      const committed = JSON.parse(readFileSync(resolve(process.cwd(), 'supabase/functions/nl-filter-patch/', file), 'utf8'));
      expect(committed).toEqual(JSON.parse(JSON.stringify(build())));
    });
  }
  it('CFB/MLB catalogs cover every dimension exactly once', () => {
    expect(buildCfbDimensionSpec().map((d) => d.key).sort()).toEqual([...CFB_DIMENSION_KEYS].sort());
    expect(buildMlbDimensionSpec().map((d) => d.key).sort()).toEqual([...MLB_DIMENSION_KEYS].sort());
  });
});
