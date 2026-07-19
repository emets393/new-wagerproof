import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNlFilterArtifact, buildNflDimensionSpec } from './filterSchemaPrompt';
import { NFL_DIMENSION_KEYS } from './filterSchema';

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
