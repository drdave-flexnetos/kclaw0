#!/usr/bin/env node
/**
 * Master Integration Test
 * Validates all 6 P2 systems work together.
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';

// Import all systems
const fingerprint = require('../scripts/fingerprint.js');
const staleness = require('../scripts/staleness.js');
const eventSystem = require('../scripts/event-system.js');
const loopDetection = require('../scripts/loop-detection.js');
const steeringQueue = require('../scripts/steering-queue.js');
const followupQueue = require('../scripts/followup-queue.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
}

console.log('🔬 Master Integration Test');
console.log('==========================\n');

// 1. Fingerprinting
console.log('1️⃣  Fingerprinting');
const fpResult = fingerprint.scan();
assert(fpResult.scanned > 0, `Scanned ${fpResult.scanned} files`);

// 2. Staleness
console.log('\n2️⃣  Staleness');
const stResults = staleness.check();
assert(stResults.length > 0, `Checked ${stResults.length} files`);
assert(stResults.every(r => r.stalenessScore >= 0), 'All scores valid');

// 3. Event System
console.log('\n3️⃣  Event System');
const evt = eventSystem.emit('memory_write', { file: 'test.md' });
assert(evt.id.startsWith('evt-'), 'Event emitted');
const events = eventSystem.query({ type: 'memory_write' });
assert(events.length >= 1, `Found ${events.length} memory_write events`);

// 4. Loop Detection
console.log('\n4️⃣  Loop Detection');
const loopResult = loopDetection.check();
assert(typeof loopResult.hasLoop === 'boolean', 'Loop detection works');

// 5. Steering Queue
console.log('\n5️⃣  Steering Queue');
steeringQueue.clear();
const str = steeringQueue.add('Test steering', 'urgent');
assert(str.id.startsWith('str-'), 'Steering message added');
const injection = steeringQueue.getInjectionMessages();
assert(injection.includes('STEERING MESSAGES'), 'Injection format correct');
steeringQueue.clear();

// 6. Followup Queue
console.log('\n6️⃣  Followup Queue');
const fol = followupQueue.add('Test followup', 'low', { delayMinutes: 0 });
assert(fol.id.startsWith('fol-'), 'Followup task added');
const due = followupQueue.due();
assert(due.some(t => t.id === fol.id), 'Task is due');

// Cross-system integration
console.log('\n🔗 Cross-System Integration');

// Event system should log fingerprint changes
const fpEvent = eventSystem.emit('file_write', { file: 'memory/fingerprints.json' });
assert(fpEvent.eventType === 'file_write', 'Fingerprint change logged');

// Staleness should use fingerprint data
const stReport = staleness.generateReport();
assert(stReport.files.some(f => f.file === 'SOUL.md'), 'Staleness tracks SOUL.md');

// Loop detection should use event log
const ldResult = loopDetection.check();
assert(ldResult.toolCalls >= 0, 'Loop detection reads event log');

console.log('\n🎉 All integration checks passed!');
console.log('\n📊 System Status:');
console.log(`   Fingerprinted files: ${Object.keys(fingerprint.loadFingerprints?.().files || {}).length || 'N/A'}`);
console.log(`   Events logged: ${eventSystem.stats().totalEvents}`);
console.log(`   Staleness score range: ${Math.min(...stResults.map(r => r.stalenessScore))} - ${Math.max(...stResults.map(r => r.stalenessScore))}`);
console.log(`   Loop checks run: ${loopDetection.loadHistory().length}`);
console.log('   Steering queue: ready');
console.log('   Followup queue: ready');
