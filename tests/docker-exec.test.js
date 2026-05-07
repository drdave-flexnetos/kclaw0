const assert = require('assert');
const fs = require('fs');
const path = require('path');

// We'll test the docker-exec module by requiring it
const dockerExec = require('../scripts/docker-exec.js');

// Helpers
function cleanupLog() {
  const logPath = path.join(__dirname, '..', 'memory', 'docker-executions.ndjson');
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}

let testsRun = 0;
let testsPassed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

console.log('\n=== docker-exec.test.js ===\n');

// Clean slate
cleanupLog();

// Test 1: isAvailable should be a function that returns a Promise
test('isAvailable is exported and returns Promise', async () => {
  assert.strictEqual(typeof dockerExec.isAvailable, 'function');
  const result = dockerExec.isAvailable();
  assert.ok(result instanceof Promise, 'isAvailable should return a Promise');
  const available = await result;
  assert.strictEqual(typeof available, 'boolean');
});

// Test 2: Config loads with defaults
test('loadConfig returns valid config object', () => {
  const config = dockerExec.loadConfig();
  assert.ok(config, 'Config should exist');
  assert.strictEqual(typeof config.defaultTimeout, 'number');
  assert.strictEqual(typeof config.maxContainers, 'number');
  assert.strictEqual(typeof config.autoCleanup, 'boolean');
  assert.ok(Array.isArray(config.volumeMounts));
  assert.strictEqual(typeof config.envVars, 'object');
});

// Test 3: recordExecution writes to ndjson log
test('recordExecution creates log file and writes valid JSON', () => {
  cleanupLog();
  const entry = {
    timestamp: new Date().toISOString(),
    containerId: 'test-123',
    image: 'node:20',
    command: 'node test.js',
    status: 'success',
    exitCode: 0,
    durationMs: 100,
    output: 'hello'
  };
  dockerExec.recordExecution(entry);

  const logPath = path.join(__dirname, '..', 'memory', 'docker-executions.ndjson');
  assert.ok(fs.existsSync(logPath), 'Log file should exist');

  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1);

  const parsed = JSON.parse(lines[0]);
  assert.strictEqual(parsed.containerId, 'test-123');
  assert.strictEqual(parsed.status, 'success');
});

// Test 4: readExecutions returns parsed entries
test('readExecutions returns entries in order', () => {
  cleanupLog();
  dockerExec.recordExecution({ containerId: 'a', status: 'success' });
  dockerExec.recordExecution({ containerId: 'b', status: 'error' });
  dockerExec.recordExecution({ containerId: 'c', status: 'success' });

  const entries = dockerExec.readExecutions(2);
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].containerId, 'b');
  assert.strictEqual(entries[1].containerId, 'c');
});

// Test 5: Mock mode produces mock entries when Docker unavailable
test('run() returns mock entry when Docker unavailable', async () => {
  cleanupLog();
  // In this environment Docker is not installed, so isAvailable should be false
  const available = await dockerExec.isAvailable();

  // Force mock path by calling run directly (Docker won't be available)
  const result = await dockerExec.run('node:20', 'node test.js', { name: 'mock-test' });

  assert.ok(result.mock, 'Should have mock flag');
  assert.strictEqual(result.status, 'mock_success');
  assert.ok(result.containerId.startsWith('mock-'), 'Container ID should start with mock-');
  assert.ok(result.output.includes('mock mode'), 'Output should mention mock mode');
});

// Test 6: Mock exec works without Docker
test('exec() returns mock entry when Docker unavailable', async () => {
  cleanupLog();
  const result = await dockerExec.exec('mock-abc123', ['ls', '-la']);

  assert.ok(result.mock, 'Should have mock flag');
  assert.strictEqual(result.status, 'mock_success');
  assert.ok(result.output.includes('mock mode'), 'Output should mention mock mode');
});

// Test 7: Mock build works without Docker
test('build() returns mock entry when Docker unavailable', async () => {
  cleanupLog();
  const result = await dockerExec.build('./Dockerfile', 'my-app:latest');

  assert.ok(result.mock, 'Should have mock flag');
  assert.strictEqual(result.status, 'mock_success');
  assert.ok(result.output.includes('Would build'), 'Output should mention Would build');
});

// Test 8: Mock stop works without Docker
test('stop() returns mock entry when Docker unavailable', async () => {
  cleanupLog();
  const result = await dockerExec.stop('mock-abc123');

  assert.ok(result.mock, 'Should have mock flag');
  assert.strictEqual(result.status, 'mock_success');
  assert.ok(result.output.includes('Would stop'), 'Output should mention Would stop');
});

// Test 9: Template loader reads Dockerfile templates
test('template() returns Dockerfile content for known templates', () => {
  const nodeTemplate = dockerExec.template('node-runner');
  assert.ok(nodeTemplate, 'node-runner template should exist');
  assert.ok(nodeTemplate.includes('FROM node'), 'Should contain FROM node');

  const pythonTemplate = dockerExec.template('python-runner');
  assert.ok(pythonTemplate, 'python-runner template should exist');
  assert.ok(pythonTemplate.includes('FROM python'), 'Should contain FROM python');

  const rustTemplate = dockerExec.template('rust-runner');
  assert.ok(rustTemplate, 'rust-runner template should exist');
  assert.ok(rustTemplate.includes('FROM rust'), 'Should contain FROM rust');
});

// Test 10: Execution record format matches spec
test('Execution record format contains all required fields', async () => {
  cleanupLog();
  const result = await dockerExec.run('node:20', 'node test.js');

  // Read back from log
  const entries = dockerExec.readExecutions(1);
  assert.strictEqual(entries.length, 1);

  const entry = entries[0];
  assert.ok(entry.timestamp, 'Should have timestamp');
  assert.ok(entry.containerId, 'Should have containerId');
  assert.ok(entry.image, 'Should have image');
  assert.ok(entry.command !== undefined, 'Should have command');
  assert.ok(entry.status, 'Should have status');
  assert.ok(entry.exitCode !== undefined, 'Should have exitCode');
  assert.ok(entry.durationMs !== undefined, 'Should have durationMs');
  assert.ok(entry.output !== undefined, 'Should have output');
});

// Test 11: Simulated container lifecycle (mock)
test('Container lifecycle simulation: run -> exec -> stop', async () => {
  cleanupLog();

  // 1. Run
  const runResult = await dockerExec.run('python:3.12', 'python3 --version');
  assert.ok(runResult.mock);
  assert.strictEqual(runResult.status, 'mock_success');
  const cid = runResult.containerId;

  // 2. Exec in same container
  const execResult = await dockerExec.exec(cid, 'echo hello');
  assert.ok(execResult.mock);
  assert.strictEqual(execResult.status, 'mock_success');

  // 3. Stop
  const stopResult = await dockerExec.stop(cid);
  assert.ok(stopResult.mock);
  assert.strictEqual(stopResult.status, 'mock_success');

  // Verify all recorded - filter by this container's ID
  const entries = dockerExec.readExecutions(100).filter(e => e.containerId === cid);
  assert.ok(entries.length >= 3, `Expected at least 3 entries for container ${cid}, got ${entries.length}`);
  assert.ok(entries.some(e => e.command.includes('python3')));
  assert.ok(entries.some(e => e.command === 'echo hello'));
  assert.ok(entries.some(e => e.command.includes('stop')));
});

// Test 12: Logs in mock mode return mock output
test('logs() returns mock output when Docker unavailable', async () => {
  const result = await dockerExec.logs('mock-abc123');
  assert.ok(result.stdout.includes('mock mode'), 'Should mention mock mode');
});

// Test 13: list() returns empty array in mock mode
test('list() returns empty array when Docker unavailable', async () => {
  const result = await dockerExec.list();
  assert.ok(Array.isArray(result));
  assert.strictEqual(result.length, 0);
});

// Summary
console.log(`\n=== Results: ${testsPassed}/${testsRun} passed ===\n`);

if (testsPassed < testsRun) {
  process.exit(1);
}
