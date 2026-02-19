/**
 * Extracts dominant colors from ESPN NCAAB team logos and writes them
 * to the ncaab_team_mapping table as primary_color / secondary_color.
 *
 * Usage:  node scripts/populate-ncaab-team-colors.mjs
 */
import Vibrant from 'node-vibrant';
import { createClient } from '@supabase/supabase-js';

const CFB_SUPABASE_URL = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const CFB_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';

const supabase = createClient(CFB_SUPABASE_URL, CFB_SUPABASE_KEY);

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function isUsable(rgb) {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  // Too white
  if (r > 220 && g > 220 && b > 220) return false;
  // Too black
  if (r < 15 && g < 15 && b < 15) return false;
  // Too gray (low saturation)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 50 && (max - min) < 25) return false;
  return true;
}

async function extractColors(imageUrl) {
  try {
    const palette = await Vibrant.from(imageUrl).getPalette();

    // Collect candidates in priority order
    const candidates = [
      palette.Vibrant,
      palette.DarkVibrant,
      palette.LightVibrant,
      palette.Muted,
      palette.DarkMuted,
      palette.LightMuted,
    ].filter(swatch => swatch && isUsable(swatch.rgb));

    if (candidates.length === 0) return null;

    const primary = rgbToHex(...candidates[0].rgb);

    // For secondary, pick the most different color
    let secondary = primary;
    if (candidates.length > 1) {
      let bestDiff = 0;
      const [pr, pg, pb] = candidates[0].rgb;
      for (let i = 1; i < candidates.length; i++) {
        const [cr, cg, cb] = candidates[i].rgb;
        const diff = Math.abs(pr - cr) + Math.abs(pg - cg) + Math.abs(pb - cb);
        if (diff > bestDiff) {
          bestDiff = diff;
          secondary = rgbToHex(...candidates[i].rgb);
        }
      }
    }

    return { primary, secondary };
  } catch (err) {
    console.error(`  ❌ Failed to extract: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('📊 Fetching ncaab_team_mapping...');
  const { data: teams, error } = await supabase
    .from('ncaab_team_mapping')
    .select('api_team_id, espn_team_id, team_abbrev');

  if (error) {
    console.error('Failed to fetch teams:', error);
    process.exit(1);
  }

  console.log(`Found ${teams.length} teams`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const team of teams) {
    if (!team.espn_team_id) {
      skipped++;
      continue;
    }

    const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.espn_team_id}.png`;
    const colors = await extractColors(logoUrl);

    if (!colors) {
      console.log(`  ⚠️  ${team.team_abbrev || team.api_team_id}: no usable colors from ${logoUrl}`);
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('ncaab_team_mapping')
      .update({
        primary_color: colors.primary,
        secondary_color: colors.secondary,
      })
      .eq('api_team_id', team.api_team_id);

    if (updateError) {
      // Column might not exist yet
      if (updateError.message.includes('column') || updateError.code === '42703') {
        console.error('❌ Columns primary_color/secondary_color do not exist yet. Creating them...');
        console.error('   Run this SQL first:');
        console.error('   ALTER TABLE ncaab_team_mapping ADD COLUMN IF NOT EXISTS primary_color TEXT;');
        console.error('   ALTER TABLE ncaab_team_mapping ADD COLUMN IF NOT EXISTS secondary_color TEXT;');
        process.exit(1);
      }
      console.error(`  ❌ ${team.team_abbrev}: update failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✅ ${team.team_abbrev || team.api_team_id}: ${colors.primary} / ${colors.secondary}`);
      updated++;
    }
  }

  console.log(`\n📊 Done: ${updated} updated, ${skipped} skipped (no espn_id), ${failed} failed`);
}

main();
