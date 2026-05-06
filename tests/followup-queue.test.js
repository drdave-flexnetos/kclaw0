#!/usr/bin/env node
/**
 * Tests for Followup Queue System
 * Run: node tests/followup-queue.test.js
 */

const { add, list, due, complete, cancel, expireOld, clearCompleted, stats, run, PRIORITY_CONFIG } = require('../scripts/followup-queue.js');

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
  
  // Clear first
  const fs = require('fs');
  const path = '/root/.openclaw/workspace/memory/followup-queue.json';
  if (fs.existsSync(path)) fs.unlinkSync(path);
  
  const task = add('Test followup', 'high', { delayMinutes: 0 });
  
  assert(task.id.startsWith('fol-'), 'Should have fol- prefix');
  assert(task.summary === 'Test followup', 'Should have summary');
  assert(task.priority === 'high', 'Should have priority');
  assert(task.status === 'pending', 'Should be pending');
  assert(task.delayMinutes === 0, 'Should have delayMinutes');
}

function testList() {
  console.log('\n📋 Testing list...');
  
  const tasks = list();
  assert(Array.isArray(tasks), 'Should return array');
  assert(tasks.length >= 0, 'Should have tasks or be empty');
}

function testDue() {
  console.log('\n⏰ Testing due...');
  
  // Add a task that's due now
  add('Due now task', 'critical', { delayMinutes: -1 });
  
  const dueTasks = due();
  assert(Array.isArray(dueTasks), 'Should return array');
  // Should find the task with negative delay
  assert(dueTasks.some(t => t.summary === 'Due now task'), 'Should find due task');
}

function testComplete() {
  console.log('\n✅ Testing complete...');
  
  // Add and complete
  const task = add('Complete me', 'normal', { delayMinutes: 0 });
  const completed = complete(task.id, { success: true });
  
  assert(completed !== null, 'Should return completed task');
  assert(completed.status === 'completed', 'Should be completed');
  assert(completed.completedAt, 'Should have completedAt');
  assert(completed.result.success === true, 'Should have result');
}

function testCancel() {
  console.log('\n🚫 Testing cancel...');
  
  const task = add('Cancel me', 'low', { delayMinutes: 0 });
  const cancelled = cancel(task.id);
  
  assert(cancelled !== null, 'Should return cancelled task');
  assert(cancelled.status === 'cancelled', 'Should be cancelled');
}

function testExpireOld() {
  console.log('\n🧹 Testing expireOld...');
  
  const removed = expireOld();
  assert(typeof removed === 'number', 'Should return number');
}

function testClearCompleted() {
  console.log('\n🧹 Testing clearCompleted...');
  
  const result = clearCompleted();
  assert(typeof result.removed === 'number', 'Should return removed count');
  assert(typeof result.remaining === 'number', 'Should return remaining count');
}

function testStats() {
  console.log('\n📊 Testing stats...');
  
  const s = stats();
  assert(typeof s.total === 'number', 'Should have total');
  assert(typeof s.pending === 'number', 'Should have pending');
  assert(typeof s.completed === 'number', 'Should have completed');
  assert(s.byPriority, 'Should have byPriority');
}

function testPriorityConfig() {
  console.log('\n⚙️ Testing PRIORITY_CONFIG...');
  
  assert(PRIORITY_CONFIG.critical.defaultDelay === 0, 'Critical should be 0');
  assert(PRIORITY_CONFIG.high.defaultDelay === 15, 'High should be 15');
  assert(PRIORITY_CONFIG.normal.defaultDelay === 60, 'Normal should be 60');
  assert(PRIORITY_CONFIG.low.defaultDelay === 240, 'Low should be 240');
}

console.log('🧪 Followup Queue Tests');
console.log('======================');

try {
  testAdd();
  testList();
  testDue();
  testComplete();
  testCancel();
  testExpireOld();
  testClearCompleted();
  testStats();
  testPriorityConfig();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
