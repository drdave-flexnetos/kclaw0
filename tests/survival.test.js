/**
 * KClaw0 Survival System — Test Suite
 * Budget / Lifecycle Enforcement — Type C (Agent Loop) Upgrade — P3
 *
 * Run: node tests/survival.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Test Harness
// ============================================================================

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(`${msg} Expected truthy, got ${value}`);
  }
}

function assertFalse(value, msg = '') {
  if (value) {
    throw new Error(`${msg} Expected falsy, got ${value}`);
  }
}

function assertApprox(actual, expected, epsilon = 1e-9, msg = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${msg} Expected ${expected} ±${epsilon}, got ${actual}`);
  }
}

function assertThrows(fn, expectedMsg = '') {
  try {
    fn();
    throw new Error(`Expected to throw${expectedMsg ? ` (${expectedMsg})` : ''}, but did not`);
  } catch (err) {
    if (expectedMsg && !err.message.includes(expectedMsg)) {
      throw new Error(`Expected error containing "${expectedMsg}", got: ${err.message}`);
    }
  }
}

// ============================================================================
// Setup / Teardown
// ============================================================================

const TEST_DIR = path.join(os.tmpdir(), `kclaw0-survival-test-${Date.now()}`);
const MEMORY_DIR = path.join(TEST_DIR, 'memory');
const COST_LOG_PATH = path.join(MEMORY_DIR, 'cost-log.ndjson');
const STATE_PATH = path.join(MEMORY_DIR, 'survival-state.json');

let survival;
let mockEvents = [];

function setup() {
  // Create test workspace
  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  // Set env to use test directory
  process.env.KCLAW0_SURVIVAL_STATE = STATE_PATH;

  // Change CWD so module resolves paths correctly
  const originalCwd = process.cwd();
  process.chdir(TEST_DIR);

  // Clear require cache and load fresh
  delete require.cache[require.resolve('../scripts/survival.js')];
  survival = require('../scripts/survival.js');

  // Reset internal state
  survival._resetState();
  survival._clearAlerts();

  // Mock event system
  mockEvents = [];
  survival._setEventSystem({
    emit: (eventType, data, metadata) => {
      mockEvents.push({ eventType, data, metadata });
    },
  });

  return originalCwd;
}

function teardown(originalCwd) {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  delete process.env.KCLAW0_SURVIVAL_STATE;
  process.chdir(originalCwd);
}

// ============================================================================
// Helpers
// ============================================================================

function writeCostLog(entries) {
  const lines = entries.map((e) => JSON.stringify(e));
  fs.writeFileSync(COST_LOG_PATH, lines.join('\n') + '\n', 'utf8');
}

function clearCostLog() {
  if (fs.existsSync(COST_LOG_PATH)) {
    fs.unlinkSync(COST_LOG_PATH);
  }
}

function todayStr() {
  return new Date().toISOString().substring(0, 10);
}

function monthStr() {
  return new Date().toISOString().substring(0, 7);
}

// ============================================================================
// Tests
// ============================================================================

function runTests() {
  console.log('\nKClaw0 Survival System Tests\n==============================\n');

  const originalCwd = setup();

  // ── Test 1: setBudget() stores budget in state ─────────────────────────
  test('setBudget() stores budget in state', () => {
    const budget = survival.setBudget(50, 500);
    assertEqual(budget.dailyUsd, 50);
    assertEqual(budget.monthlyUsd, 500);
    assertTrue(budget.updatedAt, 'Should have updatedAt');

    // Verify persisted
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    assertEqual(state.budget.dailyUsd, 50);
    assertEqual(state.budget.monthlyUsd, 500);
  });

  // ── Test 2: checkBudget() returns safe when no cost log ─────────────────
  test('checkBudget() returns safe when no cost log', () => {
    survival.setBudget(100, 1000);
    clearCostLog();
    const result = survival.checkBudget();
    assertEqual(result.status, 'safe');
    assertEqual(result.dailyCost, 0);
    assertEqual(result.monthlyCost, 0);
    assertEqual(result.totalCost, 0);
    assertEqual(result.recommendedTier, 'normal');
  });

  // ── Test 3: checkBudget() returns safe when under warning threshold ───
  test('checkBudget() returns safe when under warning threshold', () => {
    survival.setBudget(100, 1000);
    clearCostLog();
    // Spend $50 daily (50% of $100) → safe
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 50, sessionId: 's1' },
    ]);
    const result = survival.checkBudget();
    assertEqual(result.status, 'safe');
    assertApprox(result.dailyPct, 0.50, 0.01);
    assertEqual(result.recommendedTier, 'normal');
  });

  // ── Test 4: checkBudget() returns warning at 70% threshold ─────────────
  test('checkBudget() returns warning at 70% threshold', () => {
    survival.setBudget(100, 1000);
    clearCostLog();
    // Spend $75 daily (75% of $100) → warning
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 75, sessionId: 's1' },
    ]);
    const result = survival.checkBudget();
    assertEqual(result.status, 'warning');
    assertApprox(result.dailyPct, 0.75, 0.01);
    assertEqual(result.recommendedTier, 'conservative');
  });

  // ── Test 5: checkBudget() returns critical at 90% threshold ──────────────
  test('checkBudget() returns critical at 90% threshold', () => {
    survival.setBudget(100, 1000);
    clearCostLog();
    // Spend $95 daily (95% of $100) → critical
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 95, sessionId: 's1' },
    ]);
    const result = survival.checkBudget();
    assertEqual(result.status, 'critical');
    assertApprox(result.dailyPct, 0.95, 0.01);
    assertEqual(result.recommendedTier, 'emergency');
  });

  // ── Test 6: checkBudget() considers monthly budget ─────────────────────
  test('checkBudget() considers monthly budget', () => {
    survival.setBudget(1000, 100); // Low monthly budget
    clearCostLog();
    // Spend $80 monthly (80% of $100) → warning via monthly
    writeCostLog([
      { timestamp: `${monthStr()}-01T10:00:00Z`, totalCost: 80, sessionId: 's1' },
    ]);
    const result = survival.checkBudget();
    assertEqual(result.status, 'warning');
    assertApprox(result.monthlyPct, 0.80, 0.01);
  });

  // ── Test 7: getTier() and setTier() work correctly ─────────────────────
  test('getTier() and setTier() work correctly', () => {
    survival._resetState();
    assertEqual(survival.getTier(), 'normal');

    survival.setTier('conservative');
    assertEqual(survival.getTier(), 'conservative');

    survival.setTier('emergency');
    assertEqual(survival.getTier(), 'emergency');

    // Check history
    const state = survival._loadState();
    assertTrue(state.history.length >= 2, 'Should have history entries');
    assertEqual(state.history[0].from, 'normal');
    assertEqual(state.history[0].to, 'conservative');
  });

  // ── Test 8: setTier() validates tier name ──────────────────────────────
  test('setTier() validates tier name', () => {
    assertThrows(() => survival.setTier('invalid'), 'Invalid tier');
    assertThrows(() => survival.setTier(''), 'Invalid tier');
  });

  // ── Test 9: isFeatureEnabled() reflects tier capabilities ──────────────
  test('isFeatureEnabled() reflects tier capabilities', () => {
    survival._resetState();
    survival.setTier('normal');
    assertTrue(survival.isFeatureEnabled('subagents'));
    assertTrue(survival.isFeatureEnabled('exec'));
    assertTrue(survival.isFeatureEnabled('llm_call'));

    survival.setTier('conservative');
    assertFalse(survival.isFeatureEnabled('subagents'));
    assertTrue(survival.isFeatureEnabled('llm_call'));
    assertTrue(survival.isFeatureEnabled('memory_write'));

    survival.setTier('emergency');
    assertFalse(survival.isFeatureEnabled('subagents'));
    assertFalse(survival.isFeatureEnabled('exec'));
    assertFalse(survival.isFeatureEnabled('llm_call'));
    assertFalse(survival.isFeatureEnabled('memory_write'));
  });

  // ── Test 10: getCapabilityMap() returns full map ───────────────────────
  test('getCapabilityMap() returns full capability map', () => {
    survival.setTier('conservative');
    const map = survival.getCapabilityMap();
    assertEqual(map.tier, 'conservative');
    assertFalse(map.capabilities.subagents);
    assertTrue(map.capabilities.llm_call);
    assertTrue(map.capabilities.memory_write);
    assertTrue(map.capabilities.file_write);
    assertFalse(map.capabilities.exec);
  });

  // ── Test 11: alertOnThreshold() registers and fires callback ───────────
  test('alertOnThreshold() registers and fires callback', () => {
    survival._resetState();
    survival._clearAlerts();
    survival.setBudget(100, 1000);
    clearCostLog();

    let triggered = null;
    const id = survival.alertOnThreshold(10, (alert) => {
      triggered = alert;
    }, 'daily');

    assertTrue(id.startsWith('alert-'), 'Alert ID should start with alert-');
    assertEqual(survival.listAlerts().length, 1);

    // Write cost log exceeding threshold
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 15, sessionId: 's1' },
    ]);

    survival.evaluateAlerts();

    assertTrue(triggered !== null, 'Callback should have been called');
    assertEqual(triggered.thresholdUsd, 10);
    assertApprox(triggered.currentCost, 15, 0.01);
    assertTrue(triggered.exceeded);
    assertEqual(triggered.scope, 'daily');
  });

  // ── Test 12: alertOnThreshold() validates arguments ────────────────────
  test('alertOnThreshold() validates arguments', () => {
    assertThrows(() => survival.alertOnThreshold(-5, () => {}), 'positive number');
    assertThrows(() => survival.alertOnThreshold(10, 'not-a-function'), 'function');
    assertThrows(() => survival.alertOnThreshold(10, () => {}, 'weekly'), 'Invalid scope');
  });

  // ── Test 13: removeAlert() removes an alert ────────────────────────────
  test('removeAlert() removes an alert', () => {
    survival._clearAlerts();
    const id = survival.alertOnThreshold(20, () => {}, 'daily');
    assertEqual(survival.listAlerts().length, 1);
    const removed = survival.removeAlert(id);
    assertTrue(removed);
    assertEqual(survival.listAlerts().length, 0);
  });

  // ── Test 14: check() auto-downgrades tier on budget pressure ───────────
  test('check() auto-downgrades tier on budget pressure', () => {
    survival._resetState();
    survival.setBudget(100, 1000);
    clearCostLog();

    // Start at normal
    assertEqual(survival.getTier(), 'normal');

    // Exceed warning threshold → should downgrade to conservative
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 80, sessionId: 's1' },
    ]);
    const result = survival.check();
    assertEqual(result.tierAction, 'downgrade');
    assertEqual(survival.getTier(), 'conservative');
  });

  // ── Test 15: check() auto-downgrades to emergency on critical ──────────
  test('check() auto-downgrades to emergency on critical', () => {
    survival._resetState();
    survival.setBudget(100, 1000);
    clearCostLog();

    // Exceed critical threshold → should downgrade to emergency
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 95, sessionId: 's1' },
    ]);
    const result = survival.check();
    assertEqual(result.tierAction, 'downgrade');
    assertEqual(survival.getTier(), 'emergency');
    assertTrue(result.actions.some((a) => a.includes('EMERGENCY')));
  });

  // ── Test 16: check() does NOT upgrade from emergency automatically ──────
  test('check() does NOT upgrade from emergency automatically', () => {
    survival._resetState();
    survival.setBudget(100, 1000);
    clearCostLog();

    // Force emergency tier
    survival.setTier('emergency');

    // Clear cost log (safe now) — but should stay in emergency
    writeCostLog([]);
    const result = survival.check();
    assertEqual(result.tierAction, 'none');
    assertEqual(survival.getTier(), 'emergency');
  });

  // ── Test 17: enforce() returns correct blocked/allowed lists ───────────
  test('enforce() returns correct blocked/allowed lists', () => {
    survival._resetState();
    survival.setTier('conservative');
    const result = survival.enforce();
    assertEqual(result.tier, 'conservative');
    assertFalse(result.canSpawnSubagents);
    assertTrue(result.canCallLLM);
    assertTrue(result.canWriteMemory);
    assertFalse(result.canExecute);
    assertTrue(result.blocked.includes('subagents'));
    assertTrue(result.blocked.includes('exec'));
    assertTrue(result.allowed.includes('llm_call'));
  });

  // ── Test 18: enforce() in emergency blocks everything ───────────────────
  test('enforce() in emergency blocks everything', () => {
    survival.setTier('emergency');
    const result = survival.enforce();
    assertEqual(result.tier, 'emergency');
    assertEqual(result.blocked.length, 7, 'All 7 features should be blocked');
    assertEqual(result.allowed.length, 0, 'Nothing should be allowed');
    assertFalse(result.canSpawnSubagents);
    assertFalse(result.canCallLLM);
    assertFalse(result.canWriteMemory);
    assertFalse(result.canExecute);
  });

  // ── Test 19: report() generates comprehensive report ────────────────────
  test('report() generates comprehensive report', () => {
    survival._resetState();
    survival.setBudget(100, 1000);
    clearCostLog();
    writeCostLog([
      { timestamp: `${todayStr()}T10:00:00Z`, totalCost: 25, sessionId: 's1' },
    ]);
    survival.setTier('normal');

    const r = survival.report();
    assertTrue(r.generatedAt, 'Should have generatedAt');
    assertEqual(r.budget.daily.limit, 100);
    assertApprox(r.budget.daily.spent, 25, 0.01);
    assertApprox(r.budget.daily.remaining, 75, 0.01);
    assertEqual(r.tier.current, 'normal');
    assertTrue(r.capabilities.subagents);
    assertTrue(r.recommendations.length > 0, 'Should have recommendations');
    assertTrue(r.conwayReference, 'Should reference Conway Automaton');
  });

  // ── Test 20: event logging via mock event-system ──────────────────────
  test('event logging via mock event-system', () => {
    survival._resetState();
    mockEvents = [];
    survival.setBudget(50, 500);
    assertTrue(mockEvents.length > 0, 'Should have logged budget_set event');
    assertEqual(mockEvents[0].eventType, 'budget_set');
    assertEqual(mockEvents[0].data.dailyUsd, 50);
    assertEqual(mockEvents[0].metadata.source, 'survival-system');
  });

  // ── Test 21: tier change event logging ────────────────────────────────
  test('tier change event logging', () => {
    survival._resetState();
    mockEvents = [];
    survival.setTier('conservative');
    const tierEvents = mockEvents.filter((e) => e.eventType === 'tier_changed');
    assertEqual(tierEvents.length, 1);
    assertEqual(tierEvents[0].data.from, 'normal');
    assertEqual(tierEvents[0].data.to, 'conservative');
    assertEqual(tierEvents[0].metadata.severity, 'warning');
  });

  // ── Test 22: state persists across module reload ──────────────────────
  test('state persists across module reload', () => {
    survival._resetState();
    survival.setBudget(75, 750);
    survival.setTier('conservative');

    // Simulate reload: clear require cache and re-require
    delete require.cache[require.resolve('../scripts/survival.js')];
    const fresh = require('../scripts/survival.js');
    fresh._setEventSystem({
      emit: () => {}, // no-op
    });

    assertEqual(fresh.getTier(), 'conservative');
    assertEqual(fresh._loadState().budget.dailyUsd, 75);
    assertEqual(fresh._loadState().budget.monthlyUsd, 750);
  });

  // ── Test 23: alert reset when cost drops below threshold ──────────────
  test('alert resets when cost drops below threshold', () => {
    survival._resetState();
    survival._clearAlerts();
    survival.setBudget(100, 1000);
    clearCostLog();

    let callCount = 0;
    survival.alertOnThreshold(10, () => { callCount++; }, 'daily');

    // Exceed threshold
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 15, sessionId: 's1' }]);
    survival.evaluateAlerts();
    assertEqual(callCount, 1);

    // Drop below threshold
    clearCostLog();
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 5, sessionId: 's1' }]);
    survival.evaluateAlerts();
    // Should not trigger again since triggered flag was reset
    assertEqual(callCount, 1); // Still 1, no new trigger

    // Exceed again
    clearCostLog();
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 15, sessionId: 's1' }]);
    survival.evaluateAlerts();
    assertEqual(callCount, 2); // Triggered again after reset
  });

  // ── Test 24: check() generates actions in result ──────────────────────
  test('check() generates actions in result', () => {
    survival._resetState();
    survival.setBudget(100, 1000);
    clearCostLog();

    // Normal state
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 10, sessionId: 's1' }]);
    const normalResult = survival.check();
    assertTrue(normalResult.actions.some((a) => a.includes('Normal')));

    // Warning state
    clearCostLog();
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 80, sessionId: 's1' }]);
    const warnResult = survival.check();
    assertTrue(warnResult.actions.some((a) => a.includes('CONSERVATIVE')));

    // Critical state
    clearCostLog();
    writeCostLog([{ timestamp: `${todayStr()}T10:00:00Z`, totalCost: 95, sessionId: 's1' }]);
    const critResult = survival.check();
    assertTrue(critResult.actions.some((a) => a.includes('EMERGENCY')));
  });

  // Restore CWD and cleanup
  teardown(originalCwd);

  // ============================================================================
  // Results
  // ============================================================================

  console.log('\n------------------------------');
  console.log(`Tests run:    ${testsRun}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('------------------------------\n');

  if (testsFailed > 0) {
    console.log('Failed tests:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
    console.log('');
    process.exit(1);
  } else {
    console.log('All tests passed ✓\n');
    process.exit(0);
  }
}

runTests();
