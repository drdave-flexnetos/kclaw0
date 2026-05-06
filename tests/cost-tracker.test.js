/**
 * Cost Tracker Test Suite — KClaw0 Type B (Skill) Upgrade
 *
 * Run: node tests/cost-tracker.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Point the module at a temporary log path so we don't clobber real data
const TMP_LOG = path.join(__dirname, '.test-cost-log.ndjson');

// Inject custom log path by monkey-patching the module's internal
const ct = require('../scripts/cost-tracker.js');
const originalLogPath = path.resolve(__dirname, '..', 'memory', 'cost-log.ndjson');

function swapLogPath(tmpPath) {
  // Re-require to get a fresh module instance with its own closure
  delete require.cache[require.resolve('../scripts/cost-tracker.js')];
  const fresh = require('../scripts/cost-tracker.js');
  // Replace the module's internal LOG_PATH by rewriting the file via override
  return fresh;
}

// Because the module closes over LOG_PATH at load time, we can't change it
// without rewriting the file.  Instead we run tests in a clean workspace
// and simply use the default path, clearing it before/after.
function resetLog() {
  if (fs.existsSync(originalLogPath)) fs.unlinkSync(originalLogPath);
}

function readLogLines() {
  if (!fs.existsSync(originalLogPath)) return [];
  return fs
    .readFileSync(originalLogPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    resetLog();
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assertApprox(a, b, epsilon = 1e-9) {
  if (Math.abs(a - b) > epsilon) {
    throw new Error(`Expected ${a} ≈ ${b}`);
  }
}

// ── 1. record() stores a well-formed entry ────────────────────────────────
test('record() stores a well-formed entry', () => {
  const entry = ct.record({
    sessionId: 'sess-a',
    turnIndex: 1,
    model: 'kimi-k2p6',
    inputTokens: 1000,
    outputTokens: 500,
    task: 'test',
  });
  assert.strictEqual(entry.sessionId, 'sess-a');
  assert.strictEqual(entry.turnIndex, 1);
  assert.strictEqual(entry.model, 'kimi-k2p6');
  assert.strictEqual(entry.inputTokens, 1000);
  assert.strictEqual(entry.outputTokens, 500);
  assert.strictEqual(entry.task, 'test');
  assert.ok(entry.timestamp);
  assert.ok(typeof entry.inputCost === 'number');
  assert.ok(typeof entry.outputCost === 'number');
  assert.ok(typeof entry.totalCost === 'number');

  const lines = readLogLines();
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].sessionId, 'sess-a');
});

// ── 2. record() computes correct costs for kimi-k2p6 ──────────────────────
test('record() computes correct costs for kimi-k2p6', () => {
  const entry = ct.record({
    sessionId: 'sess-b',
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    model: 'kimi-k2p6',
  });
  assertApprox(entry.inputCost, 1.0); // $1.00 per 1M input
  assertApprox(entry.outputCost, 3.0); // $3.00 per 1M output
  assertApprox(entry.totalCost, 4.0);
});

// ── 3. record() computes correct costs for kimi-k2p5 ──────────────────────
test('record() computes correct costs for kimi-k2p5', () => {
  const entry = ct.record({
    sessionId: 'sess-c',
    inputTokens: 2_000_000,
    outputTokens: 2_000_000,
    model: 'kimi-k2p5',
  });
  assertApprox(entry.inputCost, 1.0); // $0.50 per 1M → 2M = $1.00
  assertApprox(entry.outputCost, 3.0); // $1.50 per 1M → 2M = $3.00
  assertApprox(entry.totalCost, 4.0);
});

// ── 4. record() falls back to default pricing for unknown models ────────────
test('record() falls back to default pricing for unknown models', () => {
  const entry = ct.record({
    sessionId: 'sess-d',
    inputTokens: 1_000_000,
    outputTokens: 0,
    model: 'unknown-model',
  });
  assertApprox(entry.inputCost, 1.0);
  assertApprox(entry.outputCost, 0.0);
  assertApprox(entry.totalCost, 1.0);
});

// ── 5. sessionSummary() aggregates by session ───────────────────────────────
test('sessionSummary() aggregates by session', () => {
  ct.record({ sessionId: 'sess-e', inputTokens: 1000, outputTokens: 200 });
  ct.record({ sessionId: 'sess-e', inputTokens: 2000, outputTokens: 400 });
  ct.record({ sessionId: 'other', inputTokens: 500, outputTokens: 100 });

  const sum = ct.sessionSummary('sess-e');
  assert.strictEqual(sum.requests, 2);
  assert.strictEqual(sum.totalInputTokens, 3000);
  assert.strictEqual(sum.totalOutputTokens, 600);
  assert.strictEqual(sum.totalTokens, 3600);
  assertApprox(sum.totalCost, 0.0048); // (3000*1 + 600*3)/1e6 = 0.0048
  assert.deepStrictEqual(sum.models, ['kimi-k2p6']);
  assert.strictEqual(sum.entries.length, 2);
});

// ── 6. sessionSummary() returns null when no records ────────────────────────
test('sessionSummary() returns null when no records', () => {
  resetLog();
  const sum = ct.sessionSummary('nonexistent');
  assert.strictEqual(sum, null);
});

// ── 7. totalCost() sums across all sessions ─────────────────────────────────
test('totalCost() sums across all sessions', () => {
  resetLog();
  ct.record({ sessionId: 's1', inputTokens: 1_000_000, outputTokens: 0 });
  ct.record({ sessionId: 's2', inputTokens: 2_000_000, outputTokens: 0 });
  assertApprox(ct.totalCost(), 3.0);
});

// ── 8. budgetCheck() status thresholds ─────────────────────────────────────
test('budgetCheck() status thresholds', () => {
  resetLog();
  // empty → safe
  let check = ct.budgetCheck(10.0);
  assert.strictEqual(check.status, 'safe');

  // 50 % → safe
  ct.record({ sessionId: 's3', inputTokens: 5_000_000, outputTokens: 0 });
  check = ct.budgetCheck(10.0);
  assert.strictEqual(check.status, 'safe');

  // 85 % → warn
  ct.record({ sessionId: 's4', inputTokens: 3_500_000, outputTokens: 0 });
  check = ct.budgetCheck(10.0);
  assert.strictEqual(check.status, 'warn');

  // 100 % → danger
  ct.record({ sessionId: 's5', inputTokens: 1_500_000, outputTokens: 0 });
  check = ct.budgetCheck(10.0);
  assert.strictEqual(check.status, 'danger');
  assert.strictEqual(check.remaining, 0);
});

// ── 9. exportReport() JSON contains sessions and entries ───────────────────
test('exportReport() JSON contains sessions and entries', () => {
  resetLog();
  ct.record({ sessionId: 'rep-a', inputTokens: 1000, outputTokens: 100 });
  ct.record({ sessionId: 'rep-b', inputTokens: 2000, outputTokens: 200 });

  const json = ct.exportReport('json');
  const report = JSON.parse(json);
  assert.ok(report.generatedAt);
  assert.strictEqual(report.totalRequests, 2);
  assert.strictEqual(report.sessions.length, 2);
  assert.ok(report.entries.length, 2);
});

// ── 10. exportReport() CSV format ────────────────────────────────────────────
test('exportReport() CSV format', () => {
  resetLog();
  ct.record({ sessionId: 'csv-a', inputTokens: 100, outputTokens: 50 });

  const csv = ct.exportReport('csv');
  const lines = csv.split('\n');
  assert.ok(lines[0].includes('timestamp'));
  assert.ok(lines[0].includes('sessionId'));
  assert.ok(lines[1].includes('csv-a'));
});

// ── 11. exportReport() Markdown format ───────────────────────────────────────
test('exportReport() Markdown format', () => {
  resetLog();
  ct.record({ sessionId: 'md-a', inputTokens: 100, outputTokens: 50 });

  const md = ct.exportReport('md');
  assert.ok(md.includes('# Cost Report'));
  assert.ok(md.includes('md-a'));
});

// ── 12. exportReport() throws on invalid format ──────────────────────────────
test('exportReport() throws on invalid format', () => {
  assert.throws(() => ct.exportReport('xml'), /Unsupported export format/);
});

// ── 13. reset() clears the log ───────────────────────────────────────────────
test('reset() clears the log', () => {
  ct.record({ sessionId: 'del', inputTokens: 100, outputTokens: 50 });
  assert.ok(fs.existsSync(originalLogPath));
  const cleared = ct.reset();
  assert.strictEqual(cleared, true);
  assert.ok(!fs.existsSync(originalLogPath));
  assert.strictEqual(ct.reset(), false); // nothing to clear
});

// ── 14. getPricing() returns correct maps ────────────────────────────────────
test('getPricing() returns correct maps', () => {
  assert.deepStrictEqual(ct.getPricing('kimi-k2p6'), { input: 1.0, output: 3.0 });
  assert.deepStrictEqual(ct.getPricing('kimi-k2p5'), { input: 0.5, output: 1.5 });
  assert.deepStrictEqual(ct.getPricing('unknown'), { input: 1.0, output: 3.0 });
});

// ── 15. record() throws on invalid input ─────────────────────────────────────
test('record() throws on invalid input', () => {
  assert.throws(() => ct.record(null), /expects an object/);
  assert.throws(() => ct.record('string'), /expects an object/);
});

// ── Summary ──────────────────────────────────────────────────────────────────

resetLog();
console.log(`\nCost Tracker Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
