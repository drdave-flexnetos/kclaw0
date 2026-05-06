#!/usr/bin/env node
/**
 * Tests for Event System
 * Run: node tests/event-system.test.js
 */

const { emit, query, tail, stats, VALID_EVENT_TYPES, sanitizeData, parseTimeToMs } = require('../scripts/event-system.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testValidEventTypes() {
  console.log('\n📋 Testing VALID_EVENT_TYPES...');
  
  assert(VALID_EVENT_TYPES.includes('session_start'), 'Should have session_start');
  assert(VALID_EVENT_TYPES.includes('tool_call'), 'Should have tool_call');
  assert(VALID_EVENT_TYPES.includes('memory_write'), 'Should have memory_write');
  assert(VALID_EVENT_TYPES.includes('loop_detected'), 'Should have loop_detected');
  assert(VALID_EVENT_TYPES.length >= 28, 'Should have at least 28 event types');
}

function testSanitizeData() {
  console.log('\n🔒 Testing sanitizeData...');
  
  const data = {
    file: 'test.md',
    api_key: 'secret123',
    password: 'mypass',
    token: 'bearer-token',
    content: 'normal content',
  };
  
  const sanitized = sanitizeData(data);
  assert(sanitized.api_key === '[REDACTED]', 'Should redact api_key');
  assert(sanitized.password === '[REDACTED]', 'Should redact password');
  assert(sanitized.token === '[REDACTED]', 'Should redact token');
  assert(sanitized.file === 'test.md', 'Should keep normal fields');
  assert(sanitized.content === 'normal content', 'Should keep content');
}

function testParseTimeToMs() {
  console.log('\n⏱️ Testing parseTimeToMs...');
  
  assert(parseTimeToMs('5s') === 5000, '5s should be 5000ms');
  assert(parseTimeToMs('2m') === 120000, '2m should be 120000ms');
  assert(parseTimeToMs('1h') === 3600000, '1h should be 3600000ms');
  assert(parseTimeToMs('1d') === 86400000, '1d should be 86400000ms');
}

function testEmit() {
  console.log('\n📡 Testing emit...');
  
  const event = emit('tool_call', { tool: 'test_tool' }, { severity: 'info' });
  
  assert(event.id.startsWith('evt-'), 'Should have evt- prefix');
  assert(event.eventType === 'tool_call', 'Should have correct type');
  assert(event.timestamp, 'Should have timestamp');
  assert(event.sessionId, 'Should have sessionId');
  assert(event.sequence > 0, 'Should have positive sequence');
  assert(event.data.tool === 'test_tool', 'Should have data');
  assert(event.severity === 'info', 'Should have severity');
}

function testEmitInvalidType() {
  console.log('\n❌ Testing emit invalid type...');
  
  let caught = false;
  try {
    emit('invalid_type', {});
  } catch (err) {
    caught = true;
    assert(err.message.includes('Invalid event type'), 'Should throw for invalid type');
  }
  assert(caught, 'Should have thrown');
}

function testQuery() {
  console.log('\n🔍 Testing query...');
  
  // Emit some test events
  emit('tool_call', { tool: 'read' });
  emit('tool_call', { tool: 'write' });
  emit('memory_write', { file: 'test.md' });
  
  const toolEvents = query({ type: 'tool_call' });
  assert(toolEvents.length >= 2, 'Should find tool_call events');
  assert(toolEvents.every(e => e.eventType === 'tool_call'), 'All should be tool_call');
  
  const memEvents = query({ type: 'memory_write' });
  assert(memEvents.length >= 1, 'Should find memory_write events');
}

function testTail() {
  console.log('\n📎 Testing tail...');
  
  const events = tail(5);
  assert(Array.isArray(events), 'Should return array');
  assert(events.length <= 5, 'Should return at most 5 events');
}

function testStats() {
  console.log('\n📊 Testing stats...');
  
  const s = stats();
  assert(typeof s.totalEvents === 'number', 'Should have totalEvents');
  assert(typeof s.uniqueSessions === 'number', 'Should have uniqueSessions');
  assert(s.typeCounts, 'Should have typeCounts');
  assert(s.severityCounts, 'Should have severityCounts');
  assert(Array.isArray(s.topTypes), 'Should have topTypes');
}

console.log('🧪 Event System Tests');
console.log('====================');

try {
  testValidEventTypes();
  testSanitizeData();
  testParseTimeToMs();
  testEmit();
  testEmitInvalidType();
  testQuery();
  testTail();
  testStats();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
