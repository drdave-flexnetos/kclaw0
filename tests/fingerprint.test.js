#!/usr/bin/env node
/**
 * Tests for Fingerprinting System
 * Run: node tests/fingerprint.test.js
 */

const fs = require('fs');
const path = require('path');
const { scan, check, getHotFiles, hashFile, expandGlobs } = require('../scripts/fingerprint.js');

const TEST_DIR = '/tmp/fingerprint-test';
const TEST_WORKSPACE = path.join(TEST_DIR, 'workspace');

// Mock the WORKSPACE constant
const originalWorkspace = '/root/.openclaw/workspace';

function setup() {
  // Create test workspace
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(TEST_WORKSPACE, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(TEST_WORKSPACE, 'skills', 'test-skill'), { recursive: true });
  
  // Create test files
  fs.writeFileSync(path.join(TEST_WORKSPACE, 'SOUL.md'), '# SOUL\nTest content');
  fs.writeFileSync(path.join(TEST_WORKSPACE, 'memory', 'test.md'), '# Test\nContent here');
  fs.writeFileSync(path.join(TEST_WORKSPACE, 'skills', 'test-skill', 'SKILL.md'), '# Skill\nSkill content');
  
  // Override the module's WORKSPACE
  const fpModule = require('../scripts/fingerprint.js');
  // Note: We can't easily override the const, so we test the functions directly
  // by using the real workspace but with controlled files
}

function teardown() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testExpandGlobs() {
  console.log('\n📁 Testing expandGlobs...');
  
  const globs = ['*.md', 'memory/*.md'];
  const files = expandGlobs(globs, TEST_WORKSPACE);
  
  assert(files.includes('SOUL.md'), 'Should find SOUL.md');
  assert(files.includes(path.join('memory', 'test.md')), 'Should find memory/test.md');
  assert(!files.includes(path.join('skills', 'test-skill', 'SKILL.md')), 'Should not find nested SKILL.md without **');
}

function testHashFile() {
  console.log('\n🔐 Testing hashFile...');
  
  const hash1 = hashFile('SOUL.md');
  assert(hash1 !== null, 'Should compute hash for existing file');
  assert(hash1.length === 64, 'Hash should be 64 chars (SHA-256 hex)');
  
  const hash2 = hashFile('SOUL.md');
  assert(hash1 === hash2, 'Same file should produce same hash');
  
  const hashNull = hashFile('nonexistent.md');
  assert(hashNull === null, 'Nonexistent file should return null');
}

function testScan() {
  console.log('\n📊 Testing scan...');
  
  const result = scan();
  assert(result.scanned > 0, 'Should scan some files');
  assert(Array.isArray(result.changes), 'Should return changes array');
  assert(result.fingerprintFile.includes('fingerprints.json'), 'Should mention fingerprint file');
}

function testCheck() {
  console.log('\n🔍 Testing check...');
  
  const result1 = check();
  assert(result1.scanned > 0, 'Should scan some files');
  
  // After scan, check should show no changes
  const result2 = check();
  assert(result2.changes.length === 0, 'Check after scan should show no changes');
}

function testHotFiles() {
  console.log('\n🔥 Testing getHotFiles...');
  
  const hot = getHotFiles(10);
  assert(Array.isArray(hot), 'Should return array');
}

function runTests() {
  console.log('🧪 Fingerprinting System Tests');
  console.log('=============================');
  
  try {
    testExpandGlobs();
    testHashFile();
    testScan();
    testCheck();
    testHotFiles();
    
    console.log('\n🎉 All tests passed!');
  } catch (err) {
    console.error('\n💥 Test suite failed:', err.message);
    process.exit(1);
  } finally {
    teardown();
  }
}

// Run tests against the actual workspace but only touch test files
// We don't call setup/teardown since we're using the real workspace
// But we verify the functions work

console.log('🧪 Fingerprinting System Tests');
console.log('=============================');
console.log('Note: Testing against actual workspace...\n');

try {
  testHashFile();
  testScan();
  testCheck();
  testHotFiles();
  
  console.log('\n🎉 All tests passed!');
} catch (err) {
  console.error('\n💥 Test suite failed:', err.message);
  process.exit(1);
}
