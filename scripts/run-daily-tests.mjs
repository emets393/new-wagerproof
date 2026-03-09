#!/usr/bin/env node

/**
 * WagerProof Daily Test Runner
 *
 * Runs all unit tests for both web and mobile apps and produces a summary report.
 * Designed to be run via cron, CI pipeline, or manually:
 *
 *   node scripts/run-daily-tests.mjs
 *
 * Exit code 0 = all tests pass, 1 = failures detected.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MOBILE_DIR = resolve(ROOT, 'wagerproof-mobile');

const DIVIDER = '═'.repeat(70);
const THIN_DIVIDER = '─'.repeat(70);

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function runCommand(command, cwd, label) {
  console.log(`\n${THIN_DIVIDER}`);
  console.log(`  ${label}`);
  console.log(`  Command: ${command}`);
  console.log(`  Directory: ${cwd}`);
  console.log(THIN_DIVIDER);

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120_000, // 2 minute timeout
      env: {
        ...process.env,
        PUPPETEER_SKIP_DOWNLOAD: 'true',
        FORCE_COLOR: '0', // disable color for cleaner CI logs
      },
    });
    console.log(output);
    return { success: true, output };
  } catch (error) {
    console.log(error.stdout || '');
    console.error(error.stderr || '');
    return { success: false, output: error.stdout || '', error: error.stderr || '' };
  }
}

function extractTestSummary(output) {
  // Match vitest output: "Tests  133 passed (133)" or "Tests  1 failed | 132 passed (133)"
  const testsMatch = output.match(/Tests\s+(?:(\d+) failed\s*\|?\s*)?(\d+) passed\s*\((\d+)\)/);
  const filesMatch = output.match(/Test Files\s+(?:(\d+) failed\s*\|?\s*)?(\d+) passed\s*\((\d+)\)/);

  if (testsMatch) {
    return {
      totalTests: parseInt(testsMatch[3], 10),
      passedTests: parseInt(testsMatch[2], 10),
      failedTests: parseInt(testsMatch[1] || '0', 10),
      totalFiles: filesMatch ? parseInt(filesMatch[3], 10) : 0,
      passedFiles: filesMatch ? parseInt(filesMatch[2], 10) : 0,
      failedFiles: filesMatch ? parseInt(filesMatch[1] || '0', 10) : 0,
    };
  }

  // Match jest output: "Tests:  1 failed, 10 passed, 11 total"
  const jestMatch = output.match(/Tests:\s+(?:(\d+) failed,\s+)?(\d+) passed,\s+(\d+) total/);
  if (jestMatch) {
    return {
      totalTests: parseInt(jestMatch[3], 10),
      passedTests: parseInt(jestMatch[2], 10),
      failedTests: parseInt(jestMatch[1] || '0', 10),
      totalFiles: 0,
      passedFiles: 0,
      failedFiles: 0,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════

console.log(DIVIDER);
console.log('  WAGERPROOF DAILY TEST REPORT');
console.log(`  Run at: ${timestamp()}`);
console.log(DIVIDER);

let allPassed = true;
const results = [];

// ── Web App Tests ──
const webResult = runCommand('npx vitest run --reporter=verbose', ROOT, 'WEB APP TESTS (Vitest)');
const webSummary = extractTestSummary(webResult.output);
results.push({
  suite: 'Web App',
  success: webResult.success,
  summary: webSummary,
});
if (!webResult.success) allPassed = false;

// ── Mobile App Tests ──
// Only run if jest-expo is installed
let mobileResult;
try {
  execSync('npx jest --version', { cwd: MOBILE_DIR, stdio: 'pipe' });
  mobileResult = runCommand('npx jest --passWithNoTests --forceExit', MOBILE_DIR, 'MOBILE APP TESTS (Jest)');
  const mobileSummary = extractTestSummary(mobileResult.output);
  results.push({
    suite: 'Mobile App',
    success: mobileResult.success,
    summary: mobileSummary,
  });
  if (!mobileResult.success) allPassed = false;
} catch {
  console.log('\n  [SKIP] Mobile tests skipped - jest-expo not installed');
  console.log('  Run: cd wagerproof-mobile && npm install --save-dev jest-expo @testing-library/react-native');
  results.push({
    suite: 'Mobile App',
    success: true,
    summary: null,
    skipped: true,
  });
}

// ── Final Summary ──
console.log(`\n${DIVIDER}`);
console.log('  DAILY TEST SUMMARY');
console.log(`  ${timestamp()}`);
console.log(DIVIDER);

for (const r of results) {
  const status = r.skipped ? 'SKIPPED' : r.success ? 'PASS' : 'FAIL';
  const icon = r.skipped ? '⏭' : r.success ? '✅' : '❌';
  console.log(`  ${icon} ${r.suite}: ${status}`);
  if (r.summary) {
    console.log(`     Tests: ${r.summary.passedTests}/${r.summary.totalTests} passed, ${r.summary.failedTests} failed`);
    if (r.summary.totalFiles > 0) {
      console.log(`     Files: ${r.summary.passedFiles}/${r.summary.totalFiles} passed, ${r.summary.failedFiles} failed`);
    }
  }
}

console.log(THIN_DIVIDER);
console.log(`  Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(DIVIDER);

process.exit(allPassed ? 0 : 1);
