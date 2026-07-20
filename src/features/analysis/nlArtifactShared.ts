/**
 * Shared machinery for building the NL-extraction artifacts (dimension catalog + structured-output
 * schema) from any sport's dimension record. Each sport's prompt file supplies its own system-prompt
 * copy (rules/examples ARE sport-specific), but the catalog rendering and the output JSON schema are
 * generated here so they cannot drift between sports. See filterSchemaPrompt.ts (NFL) for the pattern.
 */
import type { EngineDimension } from './sportFilterEngine';

export interface DimensionSpec {
  key: string;
  group: string;
  label: string;
  kind: EngineDimension['kind'];
  valueForm: string;
  aliases?: readonly string[];
  availableForBetTypes?: readonly string[];
  requires?: { key: string; value: string };
}

export interface CatalogOptions {
  /** optionSource → human description of the multiselect value form. */
  multiselectDescriptions: Record<string, string>;
  /** per-dimension-key override for `text` kinds (e.g. time formats). */
  textDescriptions?: Record<string, string>;
}

function valueForm(key: string, dim: EngineDimension, opts: CatalogOptions): string {
  switch (dim.kind) {
    case 'numRange': {
      const bounds = dim.boundsByBetType
        ? Object.values(dim.boundsByBetType)
        : [[dim.min, dim.max] as const];
      const lo = Math.min(...bounds.map((b) => b![0]));
      const hi = Math.max(...bounds.map((b) => b![1]));
      return `[min, max] numbers within [${lo}, ${hi}], step ${dim.step}`;
    }
    case 'pctRange': return '[min, max] percent numbers 0–100 (NOT a 0–1 fraction)';
    case 'scalarMax': return `a single number 0–${dim.max} (upper bound; ${dim.max} = no limit)`;
    case 'scalarMin': return `a single number 0–${dim.max} (lower bound; 0 = no limit)`;
    case 'enum': {
      const vals = dim.options.map(([v]) => v).filter((v) => v !== 'any');
      return dim.dynamic
        ? `an exact ${dim.label} name (validated against the loaded list); or "any" to clear`
        : `one of: ${vals.map((v) => `"${v}"`).join(', ')}; or "any" to clear`;
    }
    case 'tristate': return 'true, false, or null (null = clear)';
    case 'multiselect':
      return opts.multiselectDescriptions[dim.optionSource] ?? 'array of allowed values';
    case 'mlOdds': return `American odds number (≥ +100 or ≤ −100), or "" to clear (${key})`;
    case 'text': return opts.textDescriptions?.[key] ?? 'a string (or "" to clear)';
  }
}

/** Ordered dimension catalog for one sport. Deterministic. */
export function buildDimensionSpec(
  dimensions: Record<string, EngineDimension>,
  groupOrder: readonly string[],
  opts: CatalogOptions,
): DimensionSpec[] {
  const out: DimensionSpec[] = [];
  for (const group of groupOrder) {
    for (const key of Object.keys(dimensions)) {
      const dim = dimensions[key];
      if (dim.group !== group) continue;
      out.push({
        key,
        group: dim.group,
        label: dim.label,
        kind: dim.kind,
        valueForm: valueForm(key, dim, opts),
        aliases: dim.aliases,
        availableForBetTypes: dim.availability?.betTypes ? [...dim.availability.betTypes] : undefined,
        requires: dim.availability?.requires
          ? { key: String(dim.availability.requires.key), value: dim.availability.requires.equals }
          : undefined,
      });
    }
  }
  return out;
}

/** Render the "DIMENSIONS:" block exactly the way the NFL prompt always has. */
export function renderDimensionLines(spec: DimensionSpec[]): string[] {
  const lines: string[] = [];
  let currentGroup = '';
  for (const d of spec) {
    if (d.group !== currentGroup) { currentGroup = d.group; lines.push('', `[${d.group}]`); }
    const parts = [`• ${d.key} — ${d.label}: ${d.valueForm}`];
    if (d.availableForBetTypes) parts.push(`(only for markets: ${d.availableForBetTypes.join(', ')})`);
    if (d.requires) parts.push(`(requires ${d.requires.key}="${d.requires.value}")`);
    if (d.aliases?.length) parts.push(`— phrasing: ${d.aliases.join(', ')}`);
    lines.push(parts.join(' '));
  }
  return lines;
}

/** Structured-output JSON schema for the model's patch (OpenAI-strict). Identical for all sports —
 *  the per-sport reducer configs are the real validators. */
export const PATCH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ops', 'couldnt_map', 'ambiguous'],
  properties: {
    ops: {
      type: 'array',
      description: 'Filter operations to apply. Only include dimensions the user is changing.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'dimension', 'value'],
        properties: {
          op: { type: 'string', enum: ['set', 'clear'] },
          dimension: { type: 'string' },
          value: {
            description: 'The value for a "set" op (typed: array for ranges/teams, string for enums, number for scalars, boolean for toggles); null for "clear".',
            anyOf: [
              { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' },
              { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
            ],
          },
        },
      },
    },
    couldnt_map: {
      type: 'array', description: 'Requests that no supported dimension can express (name the nearest supported alternative).',
      items: { type: 'string' },
    },
    ambiguous: {
      type: 'array', description: 'Requests too vague to turn into a concrete filter (ask the user to clarify).',
      items: { type: 'string' },
    },
  },
} as const;
