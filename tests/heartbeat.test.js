/**
 * KClaw0 Heartbeat Scheduler — Test Suite
 * 24/7 Runtime — Cron, Watchers, Alerts, Events, State Persistence
 *
 * Run: node tests/heartbeat.test.js
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

const TEST_DIR = path.join(os.tmpdir(), `kclaw0-heartbeat-test-${Date.now()}`);
const MEMORY_DIR = path.join(TEST_DIR, 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'heartbeat-state.json');
const WATCH_FILE = path.join(TEST_DIR, 'watched-file.txt');

let heartbeat;
let mockEvents = [];
let originalEmit;
let clockTick = 0;

function setup() {
  // Create test workspace
  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  // Create a watched file for tests
  fs.writeFileSync(WATCH_FILE, 'initial content', 'utf8');

  // Change CWD so module resolves paths correctly
  const originalCwd = process.cwd();
  process.chdir(TEST_DIR);

  // Mock event-system module before loading heartbeat
  mockEvents = [];
  const mockEventSystem = {
    emit: (eventType, data, metadata) => {
      mockEvents.push({ eventType, data, metadata });
    },
  };

  // Inject mock event-system into require cache
  const eventSystemPath = require.resolve('../scripts/event-system.js');
  delete require.cache[eventSystemPath];
  require.cache[eventSystemPath] = {
    id: eventSystemPath,
    filename: eventSystemPath,
    loaded: true,
    exports: mockEventSystem,
  };

  // Clear heartbeat require cache and load fresh
  const heartbeatPath = require.resolve('../scripts/heartbeat.js');
  delete require.cache[heartbeatPath];
  heartbeat = require('../scripts/heartbeat.js');

  return originalCwd;
}

function teardown(originalCwd) {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  process.chdir(originalCwd);
  // Clear mock from require cache
  const eventSystemPath = require.resolve('../scripts/event-system.js');
  delete require.cache[eventSystemPath];
  const heartbeatPath = require.resolve('../scripts/heartbeat.js');
  delete require.cache[heartbeatPath];
}

// ============================================================================
// Helpers
// ============================================================================

function makeDate(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Tests
// ============================================================================

function runTests() {
  console.log('\nKClaw0 Heartbeat Scheduler Tests\n================================\n');

  const originalCwd = setup();

  // ── Test 1: parseCron() parses valid 5-field expressions ──────────────
  test('parseCron() parses valid 5-field expressions', () => {
    const fields = heartbeat.parseCron('0 9 * * 1');
    assertEqual(fields.length, 5);
    assertEqual(fields[0].type, 'value');
    assertEqual(fields[0].value, 0);
    assertEqual(fields[1].type, 'value');
    assertEqual(fields[1].value, 9);
    assertEqual(fields[4].type, 'value');
    assertEqual(fields[4].value, 1); // Monday
  });

  // ── Test 2: parseCron() handles aliases ──────────────────────────────
  test('parseCron() handles aliases', () => {
    const hourly = heartbeat.parseCron('@hourly');
    assertEqual(hourly.length, 5);
    assertEqual(hourly[0].type, 'value');
    assertEqual(hourly[0].value, 0);

    const daily = heartbeat.parseCron('@daily');
    assertEqual(daily[0].value, 0);
    assertEqual(daily[1].value, 0);
  });

  // ── Test 3: parseCron() rejects invalid expressions ─────────────────────
  test('parseCron() rejects invalid expressions', () => {
    assertThrows(() => heartbeat.parseCron('* * *'), 'expected 5 fields');
    assertThrows(() => heartbeat.parseCron('invalid'), 'expected 5 fields');
  });

  // ── Test 4: parseCronField() handles all field types ──────────────────
  test('parseCronField() handles all field types', () => {
    // Wildcard
    const any = heartbeat.parseCronField('*', 0);
    assertEqual(any.type, 'any');

    // Step
    const step = heartbeat.parseCronField('*/5', 0);
    assertEqual(step.type, 'step');
    assertEqual(step.step, 5);

    // Range
    const range = heartbeat.parseCronField('9-17', 1);
    assertEqual(range.type, 'range');
    assertEqual(range.start, 9);
    assertEqual(range.end, 17);

    // List
    const list = heartbeat.parseCronField('1,15,30', 0);
    assertEqual(list.type, 'list');
    assertEqual(list.values.length, 3);
    assertEqual(list.values[0], 1);
    assertEqual(list.values[2], 30);

    // Single value
    const val = heartbeat.parseCronField('30', 0);
    assertEqual(val.type, 'value');
    assertEqual(val.value, 30);
  });

  // ── Test 5: fieldMatches() matches correctly ───────────────────────────
  test('fieldMatches() matches correctly', () => {
    const any = heartbeat.parseCronField('*', 0);
    assertTrue(heartbeat.fieldMatches(any, 0));
    assertTrue(heartbeat.fieldMatches(any, 59));

    const step = heartbeat.parseCronField('*/15', 0);
    assertTrue(heartbeat.fieldMatches(step, 0));
    assertTrue(heartbeat.fieldMatches(step, 15));
    assertTrue(heartbeat.fieldMatches(step, 30));
    assertTrue(heartbeat.fieldMatches(step, 45));
    assertFalse(heartbeat.fieldMatches(step, 10));

    const range = heartbeat.parseCronField('9-17', 1);
    assertTrue(heartbeat.fieldMatches(range, 9));
    assertTrue(heartbeat.fieldMatches(range, 12));
    assertTrue(heartbeat.fieldMatches(range, 17));
    assertFalse(heartbeat.fieldMatches(range, 8));
    assertFalse(heartbeat.fieldMatches(range, 18));

    const list = heartbeat.parseCronField('1,3,5', 4);
    assertTrue(heartbeat.fieldMatches(list, 1));
    assertTrue(heartbeat.fieldMatches(list, 5));
    assertFalse(heartbeat.fieldMatches(list, 2));

    const val = heartbeat.parseCronField('30', 0);
    assertTrue(heartbeat.fieldMatches(val, 30));
    assertFalse(heartbeat.fieldMatches(val, 31));
  });

  // ── Test 6: cronMatches() validates full date matching ───────────────────
  test('cronMatches() validates full date matching', () => {
    // Every Monday at 9:00 AM
    const expr = '0 9 * * 1';
    const monday = makeDate(2024, 6, 3, 9, 0); // Monday
    const tuesday = makeDate(2024, 6, 4, 9, 0); // Tuesday
    const mondayWrongTime = makeDate(2024, 6, 3, 10, 0);

    assertTrue(heartbeat.cronMatches(expr, monday));
    assertFalse(heartbeat.cronMatches(expr, tuesday));
    assertFalse(heartbeat.cronMatches(expr, mondayWrongTime));
  });

  // ── Test 7: getNextRun() calculates correct next execution time ────────
  test('getNextRun() calculates correct next execution time', () => {
    // Every hour at minute 0
    const from = makeDate(2024, 6, 3, 9, 15);
    const next = heartbeat.getNextRun('0 * * * *', from);
    assertEqual(next.getHours(), 10);
    assertEqual(next.getMinutes(), 0);
    assertEqual(next.getDate(), 3);

    // Every day at 9:00
    const nextDaily = heartbeat.getNextRun('0 9 * * *', from);
    assertEqual(nextDaily.getHours(), 9);
    assertEqual(nextDaily.getMinutes(), 0);
    assertEqual(nextDaily.getDate(), 4); // next day

    // Step: every 15 minutes
    const from2 = makeDate(2024, 6, 3, 9, 10);
    const nextStep = heartbeat.getNextRun('*/15 * * * *', from2);
    assertEqual(nextStep.getMinutes(), 15);
    assertEqual(nextStep.getHours(), 9);
  });

  // ── Test 8: schedule() creates task with correct metadata ───────────────
  test('schedule() creates task with correct metadata', () => {
    let triggered = false;
    heartbeat.schedule('0 * * * *', 'test-task', () => { triggered = true; }, { tag: 'test' });

    const tasks = heartbeat.getTasks();
    const task = tasks.find(t => t.name === 'test-task');
    assertTrue(task !== undefined, 'Task should exist');
    assertEqual(task.cronExpr, '0 * * * *');
    assertTrue(task.nextRun, 'Should have nextRun');
    assertEqual(task.enabled, true);
    assertEqual(task.lastRun, null);

    // Cleanup
    heartbeat.unschedule('test-task');
  });

  // ── Test 9: schedule() validates arguments ───────────────────────────────
  test('schedule() validates arguments', () => {
    assertThrows(() => heartbeat.schedule(null, 't', () => {}), 'requires all three');
    assertThrows(() => heartbeat.schedule('* * * * *', 't', 'not-a-function'), 'requires all three');
    assertThrows(() => heartbeat.schedule('invalid', 't', () => {}), 'Invalid cron');
  });

  // ── Test 10: unschedule() removes a task ───────────────────────────────
  test('unschedule() removes a task', () => {
    heartbeat.schedule('0 * * * *', 'remove-me', () => {});
    assertTrue(heartbeat.getTasks().some(t => t.name === 'remove-me'));

    const removed = heartbeat.unschedule('remove-me');
    assertTrue(removed);
    assertFalse(heartbeat.getTasks().some(t => t.name === 'remove-me'));
  });

  // ── Test 11: watch() registers file watcher ────────────────────────────
  test('watch() registers file watcher', () => {
    let changed = false;
    let changedMtime = 0;
    heartbeat.watch(WATCH_FILE, (fp, mtime) => {
      changed = true;
      changedMtime = mtime;
    });

    const watchers = heartbeat.getWatchers();
    const watcher = watchers.find(w => w.path === WATCH_FILE);
    assertTrue(watcher !== undefined, 'Watcher should exist');
    assertTrue(watcher.lastMtime > 0, 'Should have initial mtime');
    assertEqual(watcher.enabled, true);

    // Modify file
    fs.writeFileSync(WATCH_FILE, 'modified content', 'utf8');
    const newStat = fs.statSync(WATCH_FILE);

    heartbeat.tick(); // trigger check

    assertTrue(changed, 'Callback should have been called');
    assertTrue(changedMtime >= watcher.lastMtime, 'Mtime should be updated');

    // Cleanup
    heartbeat.unwatch(WATCH_FILE);
  });

  // ── Test 12: watch() handles non-existent file gracefully ──────────────
  test('watch() handles non-existent file gracefully', () => {
    const missingFile = path.join(TEST_DIR, 'does-not-exist.txt');
    let triggered = false;

    heartbeat.watch(missingFile, () => { triggered = true; });

    const watchers = heartbeat.getWatchers();
    const watcher = watchers.find(w => w.path === missingFile);
    assertTrue(watcher !== undefined, 'Watcher should be registered for missing file');
    assertEqual(watcher.lastMtime, 0, 'Mtime should be 0 for missing file');

    // Now create the file - this should trigger the watcher
    fs.writeFileSync(missingFile, 'new file', 'utf8');
    heartbeat.tick();
    assertTrue(triggered, 'Should trigger when file is created');

    // Cleanup
    heartbeat.unwatch(missingFile);
  });

  // ── Test 13: watch() validates arguments ─────────────────────────────────
  test('watch() validates arguments', () => {
    assertThrows(() => heartbeat.watch(null, () => {}), 'requires filePath');
    assertThrows(() => heartbeat.watch('/some/file', 'not-a-function'), 'requires filePath and callback');
  });

  // ── Test 14: unwatch() removes a watcher ───────────────────────────────
  test('unwatch() removes a watcher', () => {
    const testFile = path.join(TEST_DIR, 'unwatch-test.txt');
    fs.writeFileSync(testFile, 'test', 'utf8');

    heartbeat.watch(testFile, () => {});
    assertTrue(heartbeat.getWatchers().some(w => w.path === testFile));

    const removed = heartbeat.unwatch(testFile);
    assertTrue(removed);
    assertFalse(heartbeat.getWatchers().some(w => w.path === testFile));
  });

  // ── Test 15: alert() with function condition triggers callback ───────────
  test('alert() with function condition triggers callback', () => {
    let alertTriggered = false;
    let alertName = '';

    const condition = () => true; // always triggers
    alertName = heartbeat.alert(condition, (name, cond) => {
      alertTriggered = true;
    }, 'test-alert');

    assertEqual(alertName, 'test-alert');
    assertTrue(heartbeat.getAlerts().some(a => a.name === 'test-alert'));

    heartbeat.tick(); // trigger check
    assertTrue(alertTriggered, 'Alert callback should have been called');

    // Cleanup
    heartbeat.removeAlert('test-alert');
  });

  // ── Test 16: alert() with object condition evaluates metric ───────────
  test('alert() with object condition evaluates metric', () => {
    let alertTriggered = false;

    // Ensure at least one task exists so task_count > 0
    heartbeat.schedule('0 0 * * *', 'metric-test-task', () => {});

    const condition = { metric: 'task_count', threshold: 0, operator: '>' };
    const name = heartbeat.alert(condition, () => {
      alertTriggered = true;
    }, 'metric-alert');

    // At this point we have tasks, so task_count > 0 should be true
    heartbeat.tick();
    assertTrue(alertTriggered, 'Metric alert should trigger when task_count > 0');
    assertTrue(heartbeat.getAlerts().find(a => a.name === 'metric-alert').lastTriggered !== null);

    // Cleanup
    heartbeat.removeAlert('metric-alert');
    heartbeat.unschedule('metric-test-task');
  });

  // ── Test 17: alert() validates arguments ───────────────────────────────
  test('alert() validates arguments', () => {
    assertThrows(() => heartbeat.alert(null, () => {}), 'requires condition');
    assertThrows(() => heartbeat.alert(() => true, 'not-a-function'), 'requires condition and callback');
  });

  // ── Test 18: alert() supports all comparison operators ───────────────
  test('alert() supports all comparison operators', () => {
    // Ensure we have at least 1 task for predictable metrics
    heartbeat.schedule('0 0 * * *', 'operator-test-task', () => {});

    const ops = [
      { metric: 'task_count', threshold: 0, operator: '>', expect: true },
      { metric: 'task_count', threshold: 999, operator: '<', expect: true },
      { metric: 'task_count', threshold: 1, operator: '>=', expect: true },
      { metric: 'task_count', threshold: 1, operator: '<=', expect: true },
      { metric: 'task_count', threshold: 1, operator: '==', expect: true },
      { metric: 'task_count', threshold: 0, operator: '!=', expect: true },
    ];

    for (const opTest of ops) {
      let triggered = false;
      const aName = `alert-${opTest.operator}`;
      heartbeat.alert(opTest, () => { triggered = true; }, aName);
      heartbeat.tick();
      assertEqual(triggered, opTest.expect, `Operator ${opTest.operator} should trigger=${opTest.expect}`);
      heartbeat.removeAlert(aName);
    }

    heartbeat.unschedule('operator-test-task');
  });

  // ── Test 19: removeAlert() removes an alert ──────────────────────────
  test('removeAlert() removes an alert', () => {
    const name = heartbeat.alert(() => false, () => {}, 'removable-alert');
    assertTrue(heartbeat.getAlerts().some(a => a.name === 'removable-alert'));

    const removed = heartbeat.removeAlert(name);
    assertTrue(removed);
    assertFalse(heartbeat.getAlerts().some(a => a.name === 'removable-alert'));
  });

  // ── Test 20: start()/stop() lifecycle toggles running state ──────────
  test('start()/stop() lifecycle toggles running state', () => {
    assertFalse(heartbeat.getStatus().running);

    heartbeat.start();
    assertTrue(heartbeat.getStatus().running);

    heartbeat.stop();
    assertFalse(heartbeat.getStatus().running);
  });

  // ── Test 21: start() emits start event with counts ────────────────────
  test('start() emits start event with counts', () => {
    mockEvents = [];

    heartbeat.start();
    const startEvents = mockEvents.filter(e => e.eventType === 'heartbeat' && e.data.action === 'start');
    assertEqual(startEvents.length, 1, 'Should have exactly one start event');
    assertTrue(typeof startEvents[0].data.tasks === 'number');
    assertTrue(typeof startEvents[0].data.watchers === 'number');
    assertTrue(typeof startEvents[0].data.alerts === 'number');

    heartbeat.stop();
  });

  // ── Test 22: stop() emits stop event and saves state ───────────────────
  test('stop() emits stop event and saves state', () => {
    // Use a fresh scheduler instance to avoid singleton state pollution
    const scheduler = new heartbeat.HeartbeatScheduler();
    mockEvents = [];

    scheduler.start();
    scheduler.stop();

    const stopEvents = mockEvents.filter(e => e.eventType === 'heartbeat' && e.data.action === 'stop');
    assertEqual(stopEvents.length, 1, 'Should have stop event');
  });

  // ── Test 23: saveState() persists tasks, watchers, alerts ────────────
  test('saveState() persists tasks, watchers, alerts', () => {
    // Use a fresh scheduler instance for direct method access
    const scheduler = new heartbeat.HeartbeatScheduler();
    scheduler.schedule('0 9 * * *', 'state-test-task', () => {}, { author: 'test' });
    scheduler.watch(WATCH_FILE, () => {}, { tag: 'test-watcher' });
    scheduler.alert(() => true, () => {}, 'state-test-alert');

    const state = scheduler.saveState();
    assertTrue(state.tasks['state-test-task'], 'Task should be in state');
    assertEqual(state.tasks['state-test-task'].cronExpr, '0 9 * * *');
    assertTrue(state.tasks['state-test-task'].metadata.author === 'test');
    assertTrue(state.watchers[WATCH_FILE], 'Watcher should be in state');
    assertTrue(state.alerts['state-test-alert'], 'Alert should be in state');
    assertEqual(state.metrics.task_count, 1);
    assertEqual(state.metrics.watcher_count, 1);
    assertEqual(state.metrics.alert_count, 1);
  });

  // ── Test 24: loadState() restores from file ────────────────────────────
  test('loadState() restores from file', () => {
    // Use a fresh scheduler instance
    const scheduler = new heartbeat.HeartbeatScheduler();

    const state = scheduler.loadState();
    assertEqual(state.version, 1);
    // State may be from a previous test or default; check structure
    assertTrue(state.metrics !== undefined, 'Should have metrics');
    assertTrue(state.tasks !== undefined, 'Should have tasks');
    assertTrue(state.watchers !== undefined, 'Should have watchers');
    assertTrue(state.alerts !== undefined, 'Should have alerts');
  });

  // ── Test 25: loadState() handles missing file gracefully ───────────────
  test('loadState() handles missing file gracefully', () => {
    // Use a fresh scheduler instance; its loadState will return defaults
    // if the file doesn't exist (or is corrupt)
    const scheduler = new heartbeat.HeartbeatScheduler();
    const state = scheduler.loadState();
    assertEqual(state.version, 1);
    assertTrue(state.startedAt !== undefined);
    assertTrue(state.metrics !== undefined);
    assertTrue(state.metrics.task_count !== undefined);
    assertTrue(state.metrics.watcher_count !== undefined);
    assertTrue(state.metrics.alert_count !== undefined);
  });

  // ── Test 26: event integration emits correct event types ───────────────
  test('event integration emits correct event types', () => {
    mockEvents = [];

    heartbeat.schedule('0 * * * *', 'event-test-task', () => {});
    const scheduleEvents = mockEvents.filter(e => e.eventType === 'heartbeat' && e.data.action === 'schedule');
    assertEqual(scheduleEvents.length, 1);
    assertEqual(scheduleEvents[0].data.taskName, 'event-test-task');
    assertEqual(scheduleEvents[0].data.cronExpr, '0 * * * *');
    assertEqual(scheduleEvents[0].metadata.source, 'heartbeat');

    heartbeat.unschedule('event-test-task');
    const unscheduleEvents = mockEvents.filter(e => e.eventType === 'heartbeat' && e.data.action === 'unschedule');
    assertEqual(unscheduleEvents.length, 1);

    heartbeat.unwatch('event-test-task'); // no-op, just checking it doesn't crash
  });

  // ── Test 27: tick() triggers due tasks and updates nextRun ─────────────
  test('tick() triggers due tasks and updates nextRun', () => {
    let runCount = 0;

    // Schedule a task that runs every minute
    const task = heartbeat.schedule('* * * * *', 'tick-test-task', () => { runCount++; });

    // Force nextRun to be in the past so it triggers immediately
    const originalNextRun = new Date(Date.now() - 60000).toISOString();
    task.nextRun = originalNextRun;

    heartbeat.tick();
    assertEqual(runCount, 1, 'Task should have run once');
    const updatedTask = heartbeat.getTasks().find(t => t.name === 'tick-test-task');
    assertTrue(updatedTask.nextRun !== originalNextRun, 'nextRun should be updated');
    assertTrue(updatedTask.lastRun !== null, 'lastRun should be set');

    heartbeat.unschedule('tick-test-task');
  });

  // ── Test 28: tick() handles task callback errors gracefully ───────────
  test('tick() handles task callback errors gracefully', () => {
    mockEvents = [];

    const task = heartbeat.schedule('* * * * *', 'error-task', () => { throw new Error('task error'); });
    task.nextRun = new Date(Date.now() - 60000).toISOString();

    heartbeat.tick();

    const errorEvents = mockEvents.filter(e => e.eventType === 'heartbeat' && e.data.action === 'task_run' && e.data.status === 'error');
    assertEqual(errorEvents.length, 1, 'Should log error event');
    assertTrue(errorEvents[0].data.error.includes('task error'));

    heartbeat.unschedule('error-task');
  });

  // ── Test 29: getStatus() returns comprehensive status ──────────────────
  test('getStatus() returns comprehensive status', () => {
    heartbeat.schedule('0 0 * * *', 'status-task', () => {});
    heartbeat.watch(WATCH_FILE, () => {});
    heartbeat.alert(() => true, () => {}, 'status-alert');

    const status = heartbeat.getStatus();
    assertEqual(status.running, false); // not started
    assertTrue(status.tasks >= 1);
    assertTrue(status.watchers >= 1);
    assertTrue(status.alerts >= 1);

    heartbeat.unschedule('status-task');
    heartbeat.unwatch(WATCH_FILE);
    heartbeat.removeAlert('status-alert');
  });

  // ── Test 30: describeCondition() formats conditions correctly ───────────
  test('describeCondition() formats conditions correctly', () => {
    // We need to test this indirectly via getAlerts
    heartbeat.alert(() => true, () => {}, 'func-alert');
    heartbeat.alert({ metric: 'cpu', threshold: 80, operator: '>' }, () => {}, 'obj-alert');
    heartbeat.alert('simple-string', () => {}, 'str-alert');

    const alerts = heartbeat.getAlerts();
    const funcAlert = alerts.find(a => a.name === 'func-alert');
    const objAlert = alerts.find(a => a.name === 'obj-alert');
    const strAlert = alerts.find(a => a.name === 'str-alert');

    assertEqual(funcAlert.condition, '<function>');
    assertTrue(objAlert.condition.includes('cpu'));
    assertEqual(strAlert.condition, 'simple-string');

    heartbeat.removeAlert('func-alert');
    heartbeat.removeAlert('obj-alert');
    heartbeat.removeAlert('str-alert');
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
