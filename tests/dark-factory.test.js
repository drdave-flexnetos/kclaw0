#!/usr/bin/env node
/**
 * Tests for Dark Factory Governance System
 * Run: node tests/dark-factory.test.js
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'factory-state.json');
const MISSION_FILE = path.join(MEMORY_DIR, 'MISSION.md');
const RULES_FILE = path.join(MEMORY_DIR, 'FACTORY_RULES.md');
const STYLE_FILE = path.join(MEMORY_DIR, 'CLAUDE.md');

const eventLog = [];

// Mock event-system before requiring dark-factory
const eventSystemPath = path.resolve(__dirname, '..', 'scripts', 'event-system.js');
require.cache[eventSystemPath] = {
  id: eventSystemPath,
  filename: eventSystemPath,
  loaded: true,
  exports: {
    emit: (eventType, data, metadata) => {
      eventLog.push({ eventType, data, metadata });
      return { id: 'mock-evt', timestamp: new Date().toISOString() };
    },
  },
};

const {
  loadGovernance,
  verifyImmutability,
  enforceBudget,
  validateHoldout,
  getStateMachine,
  transitionState,
  decisionGate,
  initializeState,
} = require('../scripts/dark-factory.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

const backups = {};

function backupFile(filepath) {
  if (fs.existsSync(filepath)) {
    backups[filepath] = fs.readFileSync(filepath, 'utf8');
  }
}

function restoreFile(filepath) {
  if (backups[filepath] !== undefined) {
    fs.writeFileSync(filepath, backups[filepath]);
  }
}

function setup() {
  backupFile(MISSION_FILE);
  backupFile(RULES_FILE);
  backupFile(STYLE_FILE);
  backupFile(STATE_FILE);
  eventLog.length = 0;
}

function teardown() {
  restoreFile(MISSION_FILE);
  restoreFile(RULES_FILE);
  restoreFile(STYLE_FILE);
  restoreFile(STATE_FILE);
}

function testLoadGovernance() {
  console.log('\n📖 Testing loadGovernance...');
  setup();

  const gov = loadGovernance();
  assert(gov.mission && gov.mission.content, 'Should load mission content');
  assert(gov.rules && gov.rules.content, 'Should load rules content');
  assert(gov.style && gov.style.content, 'Should load style content');
  assert(gov.mission.hash && gov.mission.hash.length === 64, 'Mission hash should be 64-char hex');
  assert(gov.rules.hash && gov.rules.hash.length === 64, 'Rules hash should be 64-char hex');
  assert(gov.style.hash && gov.style.hash.length === 64, 'Style hash should be 64-char hex');

  teardown();
}

function testVerifyImmutabilityPass() {
  console.log('\n🔒 Testing verifyImmutability (pass)...');
  setup();

  const gov = loadGovernance();
  const initialHashes = {
    mission: gov.mission.hash,
    rules: gov.rules.hash,
    style: gov.style.hash,
  };

  const result = verifyImmutability(initialHashes);
  assert(result.passed === true, 'Should pass when files unchanged');
  assert(result.changed.length === 0, 'Should have no changed files');

  teardown();
}

function testVerifyImmutabilityFail() {
  console.log('\n🔓 Testing verifyImmutability (fail)...');
  setup();

  const gov = loadGovernance();
  const initialHashes = {
    mission: gov.mission.hash,
    rules: gov.rules.hash,
    style: gov.style.hash,
  };

  fs.writeFileSync(MISSION_FILE, gov.mission.content + '\n\n# HACKED');

  const result = verifyImmutability(initialHashes);
  assert(result.passed === false, 'Should fail when file changed');
  assert(result.changed.includes('MISSION.md'), 'Should report MISSION.md as changed');

  teardown();
}

function testEnforceBudgetAllow() {
  console.log('\n💰 Testing enforceBudget (allow)...');

  const result = enforceBudget(100, 1000, 0.5, 10);
  assert(result.allowed === true, 'Should allow within budget');
  assert(result.reason.includes('within'), 'Should say within limits');
}

function testEnforceBudgetBlock() {
  console.log('\n🚫 Testing enforceBudget (block)...');

  const tokensResult = enforceBudget(1100, 1000, 0, 10);
  assert(tokensResult.allowed === false, 'Should block over token budget');
  assert(tokensResult.reason.includes('1100'), 'Should report token usage');

  const usdResult = enforceBudget(100, 1000, 15, 10);
  assert(usdResult.allowed === false, 'Should block over USD budget');
  assert(usdResult.reason.includes('15.0000'), 'Should report USD usage');
}

function testGetStateMachine() {
  console.log('\n🏷️ Testing getStateMachine...');

  const auto = getStateMachine(['auto', 'p1']);
  assert(auto.state === 'auto', 'Auto label should yield auto state');
  assert(auto.confidence === 0.7, 'Auto confidence should be 0.7');

  const holdout = getStateMachine(['auto', 'holdout']);
  assert(holdout.state === 'holdout', 'Holdout should win over auto');

  const blocked = getStateMachine(['auto', 'holdout', 'blocked']);
  assert(blocked.state === 'blocked', 'Blocked should win over everything');

  const needsReview = getStateMachine(['needs-review', 'p2']);
  assert(needsReview.state === 'needs-review', 'Needs-review should be detected');

  const verified = getStateMachine(['verified']);
  assert(verified.state === 'verified', 'Verified should be detected');

  const empty = getStateMachine([]);
  assert(empty.state === 'auto', 'Empty labels default to auto');
}

function testTransitionState() {
  console.log('\n🔄 Testing transitionState...');

  const autoStart = transitionState([], 'start', 'auto');
  assert(autoStart.includes('auto'), 'Start auto should add auto label');

  const holdoutStart = transitionState([], 'start', 'holdout');
  assert(holdoutStart.includes('holdout'), 'Start holdout should add holdout label');

  const complete = transitionState(['auto', 'p1'], 'complete', 'done');
  assert(!complete.includes('auto'), 'Complete should remove auto');
  assert(complete.includes('needs-review'), 'Complete should add needs-review');

  const passHoldout = transitionState(['holdout', 'p1'], 'pass_holdout', 'done');
  assert(!passHoldout.includes('holdout'), 'Pass holdout should remove holdout');
  assert(passHoldout.includes('verified'), 'Pass holdout should add verified');

  const failHoldout = transitionState(['auto'], 'fail_holdout', 'done');
  assert(failHoldout.includes('blocked'), 'Fail holdout should add blocked');
}

function testDecisionGateAllow() {
  console.log('\n✅ Testing decisionGate (allow)...');
  setup();

  initializeState();
  const result = decisionGate('test_operation', {
    usedTokens: 100,
    maxTokens: 1000,
    usedUsd: 0.5,
    maxUsd: 10,
    labels: ['auto'],
  });

  assert(result.action === 'allow', 'Should allow safe operation');
  assert(result.reason.includes('passed'), 'Should say all checks passed');

  teardown();
}

function testDecisionGateBlockImmutability() {
  console.log('\n🛑 Testing decisionGate (block immutability)...');
  setup();

  initializeState();
  const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  s.governanceHashes.mission = '0000000000000000000000000000000000000000000000000000000000000000';
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

  const result = decisionGate('test_operation', {
    usedTokens: 100,
    maxTokens: 1000,
    labels: ['auto'],
  });

  assert(result.action === 'block', 'Should block when immutability violated');
  assert(result.reason.includes('immutability'), 'Should mention immutability');

  teardown();
}

function testEventLogging() {
  console.log('\n📡 Testing event logging integration...');
  setup();
  eventLog.length = 0;

  initializeState();
  decisionGate('allowed_op', {
    usedTokens: 50,
    maxTokens: 1000,
    labels: ['auto'],
  });

  const allowedEvents = eventLog.filter(e => e.eventType === 'governance.allowed');
  assert(allowedEvents.length >= 1, 'Should log governance.allowed event');

  eventLog.length = 0;
  const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  s.governanceHashes.mission = '0000000000000000000000000000000000000000000000000000000000000000';
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

  decisionGate('blocked_op', {
    usedTokens: 50,
    maxTokens: 1000,
    labels: ['auto'],
  });

  const blockedEvents = eventLog.filter(e => e.eventType === 'governance.blocked');
  assert(blockedEvents.length >= 1, 'Should log governance.blocked event');

  teardown();
}

console.log('🧪 Dark Factory Governance Tests');
console.log('================================');

try {
  testLoadGovernance();
  testVerifyImmutabilityPass();
  testVerifyImmutabilityFail();
  testEnforceBudgetAllow();
  testEnforceBudgetBlock();
  testGetStateMachine();
  testTransitionState();
  testDecisionGateAllow();
  testDecisionGateBlockImmutability();
  testEventLogging();

  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
