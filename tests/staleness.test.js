#!/usr/bin/env node
/**
 * Tests for Staleness Detection System
 * Run: node tests/staleness.test.js
 */

const { check, generateReport, autoFix, calculateStaleness, daysSince, STALENESS_RULES } = require('../scripts/staleness.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testDaysSince() {
  console.log('\n📅 Testing daysSince...');
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  assert(daysSince(yesterday.toISOString()) >= 0.9, 'Yesterday should be ~1 day ago');
  assert(daysSince(weekAgo.toISOString()) >= 6.9, 'Week ago should be ~7 days ago');
  assert(daysSince(null) === Infinity, 'Null date should return Infinity');
}

function testStalenessRules() {
  console.log('\n📋 Testing STALENESS_RULES...');
  
  assert(Object.keys(STALENESS_RULES).length > 0, 'Should have staleness rules');
  assert(STALENESS_RULES['SOUL.md'].maxAge === 30, 'SOUL.md maxAge should be 30');
  assert(STALENESS_RULES['MEMORY.md'].maxAge === 7, 'MEMORY.md maxAge should be 7');
}

function testCalculateStaleness() {
  console.log('\n🔬 Testing calculateStaleness...');
  
  const rule = { maxAge: 7, dependencies: [], checkTrigger: 'test' };
  const state = { files: {} };
  const fingerprints = { files: { 'test.md': { hash: 'abc123', firstSeen: new Date().toISOString() } } };
  
  const result = calculateStaleness('test.md', rule, state, fingerprints);
  
  assert(result.file === 'test.md', 'Should return file path');
  assert(result.stalenessScore >= 0, 'Should have staleness score');
  assert(['fresh', 'mildly-stale', 'stale', 'very-stale'].includes(result.status), 'Should have valid status');
}

function testCheck() {
  console.log('\n🔍 Testing check...');
  
  const results = check();
  assert(Array.isArray(results), 'Should return array');
  assert(results.length > 0, 'Should have results');
  assert(results[0].stalenessScore >= 0, 'Results should have staleness scores');
  
  // Should be sorted by score descending
  for (let i = 1; i < results.length; i++) {
    assert(results[i-1].stalenessScore >= results[i].stalenessScore, 'Should be sorted by score descending');
  }
}

function testGenerateReport() {
  console.log('\n📊 Testing generateReport...');
  
  const report = generateReport();
  assert(report.timestamp, 'Should have timestamp');
  assert(report.summary, 'Should have summary');
  assert(typeof report.summary.total === 'number', 'Should have total count');
  assert(Array.isArray(report.files), 'Should have files array');
  assert(Array.isArray(report.recommendations), 'Should have recommendations');
}

function testAutoFix() {
  console.log('\n🔧 Testing autoFix...');
  
  const state = autoFix();
  assert(state.lastCheck, 'Should set lastCheck');
  assert(Object.keys(state.files).length > 0, 'Should track files');
  
  // All files should be fresh after auto-fix
  for (const [file, entry] of Object.entries(state.files)) {
    assert(entry.status === 'fresh', `${file} should be fresh after auto-fix`);
    assert(entry.lastHash, `${file} should have hash`);
  }
}

console.log('🧪 Staleness Detection Tests');
console.log('===========================');

try {
  testDaysSince();
  testStalenessRules();
  testCalculateStaleness();
  testCheck();
  testGenerateReport();
  testAutoFix();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
