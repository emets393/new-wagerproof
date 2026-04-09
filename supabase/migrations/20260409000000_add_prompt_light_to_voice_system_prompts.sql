-- Add prompt_light column for friendly-mode system prompt.
-- The existing `prompt` column stores the spicy/default prompt;
-- `prompt_light` stores the family-safe friendly prompt.
-- Edge function picks the right one based on the `rudeness` parameter.

ALTER TABLE voice_system_prompts
  ADD COLUMN IF NOT EXISTS prompt_light text;

COMMENT ON COLUMN voice_system_prompts.prompt_light IS
  'Friendly-mode system prompt (family-safe). Used when rudeness=friendly.';
