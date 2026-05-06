#!/usr/bin/env node
/**
 * Tests for Loop Detection System
 * Run: node tests/loop-detection.test.js
 */

const { 
  check, 
  detectIdentical, 
  detectCycles, 
  detectNoProgress, 
  detectResearchSpiral, 
  detectRetry,
  generateRecommendations,
  saveHistory,
  loadHistory,
} = require('../scripts/loop-detection.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function createMockToolCall(tool, args = {}, id = null) {
  return {
    id: id || `evt-${Math.random().toString(36).substring(2)}`,
    eventType: 'tool_call',
    data: { tool, args },
  };
}

function testDetectIdentical() {
  console.log('\n🔄 Testing detectIdentical...');
  
  const calls = [
    createMockToolCall('read', { path: 'test.md' }, '1'),
    createMockToolCall('read', { path: 'test.md' }, '2'),
    createMockToolCall('read', { path: 'test.md' }, '3'),
    createMockToolCall('read', { path: 'test.md' }, '4'),
  ];
  
  const loops = detectIdentical(calls);
  assert(loops.length > 0, 'Should detect identical loop');
  assert(loops[0].type === 'identical', 'Should be identical type');
  assert(loops[0].tool === 'read', 'Should identify read tool');
  assert(loops[0].count === 4, 'Should count 4 calls');
}

function testDetectCycles() {
  console.log('\n🔄 Testing detectCycles...');
  
  const calls = [
    createMockToolCall('read', {}, '1'),
    createMockToolCall('write', {}, '2'),
    createMockToolCall('read', {}, '3'),
    createMockToolCall('write', {}, '4'),
    createMockToolCall('read', {}, '5'),
    createMockToolCall('write', {}, '6'),
  ];
  
  const loops = detectCycles(calls);
  assert(loops.length > 0, 'Should detect cycle');
  assert(loops[0].type === 'cycle', 'Should be cycle type');
  assert(loops[0].cycleLength === 2, 'Should have cycle length 2');
}

function testDetectNoProgress() {
  console.log('\n📖 Testing detectNoProgress...');
  
  const calls = [
    createMockToolCall('read', {}, '1'),
    createMockToolCall('read', {}, '2'),
    createMockToolCall('read', {}, '3'),
    createMockToolCall('web_fetch', {}, '4'),
    createMockToolCall('read', {}, '5'),
    createMockToolCall('read', {}, '6'),
    createMockToolCall('read', {}, '7'),
    createMockToolCall('read', {}, '8'),
  ];
  
  const loops = detectNoProgress(calls);
  assert(loops.length > 0, 'Should detect no-progress loop');
  assert(loops[0].type === 'no-progress', 'Should be no-progress type');
}

function testDetectResearchSpiral() {
  console.log('\n🔍 Testing detectResearchSpiral...');
  
  const calls = [];
  for (let i = 0; i < 5; i++) {
    calls.push(createMockToolCall('kimi_search', { query: `topic ${i}` }));
  }
  
  const loops = detectResearchSpiral(calls);
  assert(loops.length > 0, 'Should detect research spiral');
  assert(loops[0].type === 'research-spiral', 'Should be research-spiral type');
}

function testDetectRetry() {
  console.log('\n❌ Testing detectRetry...');
  
  const calls = [
    createMockToolCall('read', { path: 'test.md' }, '1'),
    createMockToolCall('tool_error', { error: 'fail' }, '2'),
    createMockToolCall('read', { path: 'test.md' }, '3'),
    createMockToolCall('tool_error', { error: 'fail' }, '4'),
    createMockToolCall('read', { path: 'test.md' }, '5'),
    createMockToolCall('tool_error', { error: 'fail' }, '6'),
  ];
  
  const loops = detectRetry(calls);
  assert(loops.length > 0, 'Should detect retry loop');
  assert(loops[0].type === 'retry', 'Should be retry type');
}

function testGenerateRecommendations() {
  console.log('\n💡 Testing generateRecommendations...');
  
  const result = {
    loops: [
      { type: 'identical', tool: 'read', count: 4 },
      { type: 'no-progress', tool: 'read', count: 8, details: { reads: 8, writes: 0 } },
    ],
  };
  
  const recs = generateRecommendations(result);
  assert(recs.length === 2, 'Should generate 2 recommendations');
  assert(recs[0].severity === 'critical', 'Identical should be critical');
  assert(recs[1].severity === 'warning', 'No-progress should be warning');
}

function testHistory() {
  console.log('\n📜 Testing saveHistory/loadHistory...');
  
  const result = {
    checkedAt: new Date().toISOString(),
    loops: [{ type: 'identical' }],
    hasLoop: true,
  };
  
  saveHistory(result);
  const history = loadHistory();
  assert(history.length > 0, 'Should have history entries');
  assert(history[history.length - 1].hasLoop, 'Last entry should have loop');
}

function testCheck() {
  console.log('\n🔍 Testing check...');
  
  const result = check();
  assert(result.checkedAt, 'Should have checkedAt');
  assert(typeof result.toolCalls === 'number', 'Should have toolCalls count');
  assert(Array.isArray(result.loops), 'Should have loops array');
  assert(typeof result.hasLoop === 'boolean', 'Should have hasLoop boolean');
}

console.log('🧪 Loop Detection Tests');
console.log('======================');

try {
  testDetectIdentical();
  testDetectCycles();
  testDetectNoProgress();
  testDetectResearchSpiral();
  testDetectRetry();
  testGenerateRecommendations();
  testHistory();
  testCheck();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
