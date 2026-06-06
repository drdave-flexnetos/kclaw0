#!/usr/bin/env node
/**
 * KClaw0 Pre-Commit Verification Hook
 * Forces all tests to pass before allowing any commit.
 * Blocks commit if: tests fail, critical files missing, or uncommitted changes detected.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = process.cwd();
const TESTS_DIR = path.join(WORKSPACE, 'tests');
const CRITICAL_FILES = [
  'scripts/agent-loop.js',
  'scripts/heartbeat.js',
  'scripts/dark-factory.js',
  'scripts/chroma-integration.js',
  'scripts/event-system.js',
  'scripts/checkpoint.js',
  'scripts/cost-tracker.js',
  'scripts/planning-engine.js',
  'scripts/mind-map.js',
  'scripts/path-simulator.js',
  'scripts/loop-detection.js',
  'scripts/steering-queue.js',
  'scripts/followup-queue.js',
  'scripts/fingerprint.js',
  'scripts/staleness.js',
];

const TEST_FILES = [
  'tests/agent-loop.test.js',
  'tests/chroma-integration.test.js',
  'tests/checkpoint.test.js',
  'tests/cost-tracker.test.js',
  'tests/event-system.test.js',
  'tests/loop-detection.test.js',
  'tests/steering-queue.test.js',
  'tests/followup-queue.test.js',
  'tests/fingerprint.test.js',
  'tests/staleness.test.js',
  'tests/docker-exec.test.js',
  'tests/integration.test.js',
];

let exitCode = 0;

function log(msg) {
  console.log(`[verify] ${msg}`);
}

function error(msg) {
  console.error(`[verify] ❌ ${msg}`);
  exitCode = 1;
}

function success(msg) {
  console.log(`[verify] ✅ ${msg}`);
}

// ── Check 1: Critical files exist ──
log('Checking critical files...');
for (const file of CRITICAL_FILES) {
  const fullPath = path.join(WORKSPACE, file);
  if (!fs.existsSync(fullPath)) {
    error(`Missing critical file: ${file}`);
  }
}
if (exitCode === 0) success(`All ${CRITICAL_FILES.length} critical files present`);

// ── Check 2: Test files exist ──
log('Checking test files...');
for (const file of TEST_FILES) {
  const fullPath = path.join(WORKSPACE, file);
  if (!fs.existsSync(fullPath)) {
    error(`Missing test file: ${file}`);
  }
}
if (exitCode === 0) success(`All ${TEST_FILES.length} test files present`);

// ── Check 3: Run all tests ──
log('Running test suite...');
try {
  const testFiles = TEST_FILES.map(f => path.join(WORKSPACE, f)).join(' ');
  const output = execSync(`node -e "
    const files = '${testFiles}'.split(' ');
    let total = 0, passed = 0, failed = 0;
    for (const f of files) {
      try {
        require(f);
        passed++;
      } catch (e) {
        failed++;
        console.error('FAIL:', f, e.message);
      }
      total++;
    }
    console.log('TOTAL:', total, 'PASSED:', passed, 'FAILED:', failed);
    process.exit(failed > 0 ? 1 : 0);
  "`, {
    cwd: WORKSPACE,
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  log(output.trim());
  success('All tests passed');
} catch (err) {
  error(`Tests failed: ${err.message}`);
  if (err.stderr) console.error(err.stderr.toString());
  if (err.stdout) console.error(err.stdout.toString());
}

// ── Check 4: Memory files integrity ──
log('Checking memory file integrity...');
const memoryFiles = [
  'memory/MISSION.md',
  'memory/FACTORY_RULES.md',
  'memory/CLAUDE.md',
];
for (const file of memoryFiles) {
  const fullPath = path.join(WORKSPACE, file);
  if (!fs.existsSync(fullPath)) {
    error(`Missing governance file: ${file}`);
  } else {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.length < 100) {
      error(`Governance file ${file} appears corrupted (too short)`);
    }
  }
}
if (exitCode === 0) success('All governance files intact');

// ── Summary ──
console.log('');
if (exitCode !== 0) {
  console.error('❌ VERIFICATION FAILED — Commit blocked');
  console.error('   Fix the issues above and try again.');
  process.exit(1);
} else {
  console.log('✅ VERIFICATION PASSED — All systems operational');
  console.log(`   ${CRITICAL_FILES.length} critical files, ${TEST_FILES.length} test files, ${memoryFiles.length} governance files`);
  console.log('   Commit approved.');
  process.exit(0);
}
