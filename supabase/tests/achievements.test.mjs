// npm install --prefix /private/tmp/wagerproof-achievement-sql-test @electric-sql/pglite
// node supabase/tests/achievements.test.mjs
import { readFile } from 'node:fs/promises';
import { PGlite } from '/private/tmp/wagerproof-achievement-sql-test/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
  for (const path of ['supabase/tests/achievements-fixture.sql','supabase/migrations/20260910120000_user_achievements.sql','supabase/tests/achievements-behavior.sql','supabase/migrations/20260911120000_expand_user_achievements.sql','supabase/migrations/20260911121000_achievement_agent_creation_history.sql','supabase/tests/achievements-expansion.sql']) {
    await db.exec(await readFile(path,'utf8'));
    console.log('PASS',path);
  }
} finally { await db.close(); }
