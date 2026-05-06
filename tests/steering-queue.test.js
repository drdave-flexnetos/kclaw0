#!/usr/bin/env node
/**
 * Tests for Steering Queue System
 * Run: node tests/steering-queue.test.js
 */

const { add, list, flush, process, clear, expireOld, getInjectionMessages, PRIORITY_CONFIG } = require('../scripts/steering-queue.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testAdd() {
  console.log('\n➕ Testing add...');
  
  clear();
  const entry = add('Test message', 'high');
  
  assert(entry.id.startsWith('str-'), 'Should have str- prefix');
  assert(entry.message === 'Test message', 'Should have message');
  assert(entry.priority === 'high', 'Should have priority');
  assert(entry.status === 'pending', 'Should be pending');
  assert(entry.expiresAt, 'Should have expiresAt');
}

function testList() {
  console.log('\n📋 Testing list...');
  
  clear();
  add('Message 1', 'urgent');
  add('Message 2', 'normal');
  
  const messages = list();
  assert(messages.length === 2, 'Should list 2 messages');
  assert(messages[0].message === 'Message 1', 'First should be Message 1');
  assert(messages[1].message === 'Message 2', 'Second should be Message 2');
}

function testFlush() {
  console.log('\n🚿 Testing flush...');
  
  clear();
  add('Flush test', 'normal');
  
  const before = list();
  assert(before.length === 1, 'Should have 1 before flush');
  
  const flushed = flush();
  assert(flushed.length === 1, 'Should flush 1 message');
  assert(flushed[0].status === 'consumed', 'Should be consumed');
  
  const after = list();
  assert(after.length === 0, 'Should have 0 after flush');
}

function testProcess() {
  console.log('\n🔄 Testing process...');
  
  clear();
  add('Process test', 'low');
  
  const processed = process();
  assert(processed.length === 1, 'Should process 1 message');
  assert(processed[0].status === 'consumed', 'Should be consumed');
}

function testExpireOld() {
  console.log('\n🧹 Testing expireOld...');
  
  clear();
  const entry = add('Old message', 'urgent', { ttlMinutes: -1 }); // Already expired
  
  // Manually set expiresAt to past
  const queue = require('fs').readFileSync('/root/.openclaw/workspace/memory/steering-queue.json', 'utf-8');
  const data = JSON.parse(queue);
  data.messages[0].expiresAt = new Date(Date.now() - 1000).toISOString();
  require('fs').writeFileSync('/root/.openclaw/workspace/memory/steering-queue.json', JSON.stringify(data, null, 2));
  
  const expired = expireOld();
  assert(expired >= 1, 'Should expire at least 1 message');
  
  const remaining = list();
  assert(remaining.length === 0, 'Should have 0 after expire');
}

function testGetInjectionMessages() {
  console.log('\n💉 Testing getInjectionMessages...');
  
  clear();
  add('Inject this', 'high');
  
  const injection = getInjectionMessages();
  assert(injection !== null, 'Should return injection text');
  assert(injection.includes('STEERING MESSAGES'), 'Should contain header');
  assert(injection.includes('Inject this'), 'Should contain message');
}

function testPriorityConfig() {
  console.log('\n⚙️ Testing PRIORITY_CONFIG...');
  
  assert(PRIORITY_CONFIG.urgent.ttlMinutes === 15, 'Urgent TTL should be 15');
  assert(PRIORITY_CONFIG.high.ttlMinutes === 60, 'High TTL should be 60');
  assert(PRIORITY_CONFIG.normal.ttlMinutes === 240, 'Normal TTL should be 240');
  assert(PRIORITY_CONFIG.low.ttlMinutes === 1440, 'Low TTL should be 1440');
}

console.log('🧪 Steering Queue Tests');
console.log('======================');

try {
  testAdd();
  testList();
  testFlush();
  testProcess();
  testExpireOld();
  testGetInjectionMessages();
  testPriorityConfig();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
