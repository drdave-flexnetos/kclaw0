/**
 * KClaw0 Checkpoint/Resume System — Test Suite
 * Type C (Agent Loop) Upgrade — P3
 * 
 * Run: node tests/checkpoint.test.js
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
    throw new Error(`${msg} Expected true, got ${value}`);
  }
}

function assertFalse(value, msg = '') {
  if (value) {
    throw new Error(`${msg} Expected false, got ${value}`);
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

const TEST_DIR = path.join(os.tmpdir(), `kclaw0-checkpoint-test-${Date.now()}`);
const CHECKPOINT_DIR = path.join(TEST_DIR, 'memory', 'checkpoints');
const MEMORY_DIR = path.join(TEST_DIR, 'memory');

function setup() {
  // Create test workspace
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  
  // Create dummy memory files
  fs.writeFileSync(path.join(MEMORY_DIR, 'MEMORY.md'), '# Memory\n');
  fs.writeFileSync(path.join(MEMORY_DIR, '2026-05-07.md'), '# Today\n');
  
  // Set env to use test directory
  process.env.KCLAW0_CHECKPOINT_DIR = CHECKPOINT_DIR;
  process.env.KCLAW0_SESSION_ID = 'test-session-001';
  process.env.KCLAW0_TURN_INDEX = '5';
  process.env.KCLAW0_CURRENT_TASK = 'test-task';
}

function teardown() {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  // Clear env
  delete process.env.KCLAW0_CHECKPOINT_DIR;
  delete process.env.KCLAW0_SESSION_ID;
  delete process.env.KCLAW0_TURN_INDEX;
  delete process.env.KCLAW0_CURRENT_TASK;
}

// ============================================================================
// Load Module (after setup sets env)
// ============================================================================

let checkpoint;

// ============================================================================
// Tests
// ============================================================================

function runTests() {
  console.log('\nKClaw0 Checkpoint System Tests\n==============================\n');
  
  setup();
  
  // Change CWD so module resolves paths correctly
  const originalCwd = process.cwd();
  process.chdir(TEST_DIR);
  
  // Clear require cache and load fresh
  delete require.cache[require.resolve('../scripts/checkpoint.js')];
  checkpoint = require('../scripts/checkpoint.js');
  
  // ── Test 1: save() creates checkpoint file ──────────────────────────────
  test('save() creates a checkpoint file', () => {
    const cp = checkpoint.save('test-checkpoint', { branch: 'main' });
    
    assertTrue(cp.id.startsWith('cp-'), 'ID should start with cp-');
    assertEqual(cp.name, 'test-checkpoint');
    assertTrue(fs.existsSync(path.join(CHECKPOINT_DIR, `${cp.id}.json`)), 'File should exist');
  });
  
  // ── Test 2: save() generates sequential IDs ─────────────────────────────
  test('save() generates sequential IDs', () => {
    const cp1 = checkpoint.save('first');
    const cp2 = checkpoint.save('second');
    const cp3 = checkpoint.save('third');
    
    assertTrue(cp1.id === 'cp-001' || cp1.id === 'cp-002', `First ID was ${cp1.id}`);
    // IDs should be unique and sequential
    const num1 = parseInt(cp1.id.split('-')[1]);
    const num2 = parseInt(cp2.id.split('-')[1]);
    const num3 = parseInt(cp3.id.split('-')[1]);
    assertTrue(num2 > num1, 'Second ID should be greater');
    assertTrue(num3 > num2, 'Third ID should be greater');
  });
  
  // ── Test 3: save() stores correct checkpoint structure ──────────────────
  test('save() stores correct checkpoint structure', () => {
    const cp = checkpoint.save('structured-test', { custom: true });
    const filePath = path.join(CHECKPOINT_DIR, `${cp.id}.json`);
    const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    assertTrue(loaded.id, 'Should have id');
    assertEqual(loaded.name, 'structured-test');
    assertTrue(loaded.timestamp, 'Should have timestamp');
    assertTrue(loaded.sessionId, 'Should have sessionId');
    assertTrue(typeof loaded.turnIndex === 'number', 'Should have turnIndex');
    assertTrue(Array.isArray(loaded.memoryRefs), 'Should have memoryRefs array');
    assertTrue(loaded.context, 'Should have context');
    assertTrue(loaded.snapshot, 'Should have snapshot');
    assertTrue(loaded.metadata, 'Should have metadata');
  });
  
  // ── Test 4: save() validates name parameter ──────────────────────────────
  test('save() throws on invalid name', () => {
    assertThrows(() => checkpoint.save(), 'name is required');
    assertThrows(() => checkpoint.save(''), 'name is required');
    assertThrows(() => checkpoint.save(null), 'name is required');
  });
  
  // ── Test 5: autoSave() creates timestamped checkpoint ───────────────────
  test('autoSave() creates timestamped checkpoint', () => {
    const cp = checkpoint.autoSave();
    
    assertTrue(cp.name.startsWith('autosave-'), 'Name should start with autosave-');
    assertTrue(cp.metadata && cp.metadata.auto === true, 'Should have auto metadata');
    assertTrue(fs.existsSync(path.join(CHECKPOINT_DIR, `${cp.id}.json`)), 'File should exist');
  });
  
  // ── Test 6: list() returns all checkpoints ────────────────────────────────
  test('list() returns all checkpoints sorted', () => {
    // Clear existing
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    checkpoint.save('alpha');
    checkpoint.save('beta');
    checkpoint.save('gamma');
    
    const list = checkpoint.list();
    
    assertEqual(list.length, 3, 'Should have 3 checkpoints');
    
    // Should be sorted by ID
    for (let i = 1; i < list.length; i++) {
      const prev = parseInt(list[i-1].id.split('-')[1]);
      const curr = parseInt(list[i].id.split('-')[1]);
      assertTrue(curr > prev, 'Should be sorted');
    }
  });
  
  // ── Test 7: list() returns checkpoint summaries ─────────────────────────
  test('list() returns summary fields', () => {
    const list = checkpoint.list();
    const first = list[0];
    
    assertTrue(first.id, 'Should have id');
    assertTrue(first.name, 'Should have name');
    assertTrue(first.timestamp, 'Should have timestamp');
    assertTrue(typeof first.memoryRefsCount === 'number', 'Should have memoryRefsCount');
  });
  
  // ── Test 8: load() retrieves full checkpoint data ───────────────────────
  test('load() retrieves full checkpoint', () => {
    // Clear and create fresh
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const saved = checkpoint.save('load-test', { testData: 42 });
    const loaded = checkpoint.load(saved.id);
    
    assertEqual(loaded.id, saved.id);
    assertEqual(loaded.name, 'load-test');
    assertEqual(loaded.metadata.testData, 42);
    assertTrue(Array.isArray(loaded.memoryRefs), 'Should have memoryRefs');
    assertTrue(loaded.context, 'Should have context');
    assertTrue(loaded.snapshot, 'Should have snapshot');
  });
  
  // ── Test 9: load() supports partial ID matching ─────────────────────────
  test('load() supports partial ID matching', () => {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const cp = checkpoint.save('partial-test');
    const loaded = checkpoint.load(cp.id.replace('cp-', '')); // Search by number only
    
    assertEqual(loaded.id, cp.id);
    assertEqual(loaded.name, 'partial-test');
  });
  
  // ── Test 10: load() throws on missing checkpoint ────────────────────────
  test('load() throws on missing checkpoint', () => {
    assertThrows(() => checkpoint.load('nonexistent'), 'not found');
  });
  
  // ── Test 11: delete() removes checkpoint ──────────────────────────────
  test('delete() removes checkpoint', () => {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const cp = checkpoint.save('to-delete');
    const filePath = path.join(CHECKPOINT_DIR, `${cp.id}.json`);
    
    assertTrue(fs.existsSync(filePath), 'Should exist before delete');
    checkpoint.delete(cp.id);
    assertFalse(fs.existsSync(filePath), 'Should not exist after delete');
  });
  
  // ── Test 12: delete() throws on missing checkpoint ──────────────────────
  test('delete() throws on missing checkpoint', () => {
    assertThrows(() => checkpoint.delete('nonexistent'), 'not found');
  });
  
  // ── Test 13: prune() keeps only N most recent ──────────────────────────
  test('prune() keeps only N most recent', () => {
    // Clear all
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    // Create 5 checkpoints
    for (let i = 0; i < 5; i++) {
      checkpoint.save(`checkpoint-${i}`);
    }
    
    const deleted = checkpoint.prune(3);
    assertEqual(deleted.length, 2, 'Should delete 2');
    
    const remaining = checkpoint.list();
    assertEqual(remaining.length, 3, 'Should keep 3');
    
    // Remaining should be the most recent (highest IDs)
    const ids = remaining.map(r => parseInt(r.id.split('-')[1]));
    assertTrue(ids[0] < ids[1] && ids[1] < ids[2], 'Should keep most recent');
  });
  
  // ── Test 14: prune() with nothing to prune ──────────────────────────────
  test('prune() does nothing when count ≤ keep', () => {
    // Clear all
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    checkpoint.save('single');
    const deleted = checkpoint.prune(5);
    
    assertEqual(deleted.length, 0, 'Should not delete anything');
    assertEqual(checkpoint.list().length, 1, 'Should still have 1');
  });
  
  // ── Test 15: prune() validates keep parameter ───────────────────────────
  test('prune() validates keep parameter', () => {
    assertThrows(() => checkpoint.prune(0), 'at least 1');
    assertThrows(() => checkpoint.prune(-1), 'at least 1');
  });
  
  // ── Test 16: checkpoint includes memory refs ────────────────────────────
  test('checkpoint includes memory file references', () => {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const cp = checkpoint.save('memory-refs-test');
    const loaded = checkpoint.load(cp.id);
    
    assertTrue(loaded.memoryRefs.includes('MEMORY.md') || loaded.memoryRefs.some(r => r.includes('MEMORY.md')), 
      'Should reference MEMORY.md');
    assertTrue(loaded.memoryRefs.some(r => r.includes('.md')), 
      'Should reference at least one .md file');
  });
  
  // ── Test 17: checkpoint includes context ──────────────────────────────
  test('checkpoint includes runtime context', () => {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const cp = checkpoint.save('context-test');
    const loaded = checkpoint.load(cp.id);
    
    assertEqual(loaded.context.currentTask, 'test-task');
    assertTrue(loaded.context.nodeVersion, 'Should have nodeVersion');
    assertTrue(loaded.context.cwd, 'Should have cwd');
    assertTrue(typeof loaded.context.uptime === 'number', 'Should have uptime');
  });
  
  // ── Test 18: checkpoint file is valid JSON ──────────────────────────────
  test('checkpoint file is valid JSON', () => {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    for (const f of files) fs.unlinkSync(path.join(CHECKPOINT_DIR, f));
    
    const cp = checkpoint.save('json-validity');
    const filePath = path.join(CHECKPOINT_DIR, `${cp.id}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    
    // Should parse without error
    const parsed = JSON.parse(raw);
    assertEqual(parsed.name, 'json-validity');
    
    // Should be pretty-printed (contains newlines)
    assertTrue(raw.includes('\n'), 'Should be pretty-printed');
  });
  
  // Restore CWD
  process.chdir(originalCwd);
  teardown();
  
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
