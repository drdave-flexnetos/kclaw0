#!/usr/bin/env node
/**
 * Master Test Runner
 * Discovers and runs all tests in tests/ directory.
 * 
 * Usage:
 *   node scripts/test-all.js [options]
 * 
 * Options:
 *   --verbose       Show detailed output
 *   --suite=<name>  Run only matching suite
 *   --fail-fast     Stop on first failure
 * 
 * Examples:
 *   node scripts/test-all.js
 *   node scripts/test-all.js --verbose
 *   node scripts/test-all.js --suite=fingerprint
 *   node scripts/test-all.js --fail-fast
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

function discoverTests() {
  if (!fs.existsSync(TESTS_DIR)) return [];
  return fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.test.js'))
    .map(f => ({
      name: f.replace('.test.js', ''),
      path: path.join(TESTS_DIR, f),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function runTest(test, options = {}) {
  const start = Date.now();
  try {
    const stdout = execSync(`node "${test.path}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: options.verbose ? 'pipe' : 'pipe',
    });
    return {
      name: test.name,
      status: 'pass',
      duration: Date.now() - start,
      output: options.verbose ? stdout : null,
    };
  } catch (err) {
    return {
      name: test.name,
      status: 'fail',
      duration: Date.now() - start,
      output: err.stdout || err.message,
    };
  }
}

function runAll(options = {}) {
  const tests = discoverTests();
  
  if (tests.length === 0) {
    console.log('No tests found in tests/');
    return { passed: 0, failed: 0, total: 0 };
  }
  
  // Filter by suite name if specified
  const filtered = options.suite 
    ? tests.filter(t => t.name.includes(options.suite))
    : tests;
  
  if (filtered.length === 0) {
    console.log(`No tests matching "${options.suite}"`);
    return { passed: 0, failed: 0, total: 0 };
  }
  
  console.log(`\n🧪 Running ${filtered.length} test suite(s)`);
  console.log('═'.repeat(50));
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of filtered) {
    process.stdout.write(`  ${test.name} ... `);
    const result = runTest(test, options);
    results.push(result);
    
    if (result.status === 'pass') {
      passed++;
      console.log(`✅ ${result.duration}ms`);
    } else {
      failed++;
      console.log(`❌ ${result.duration}ms`);
      if (options.verbose) {
        console.log(result.output);
      }
      if (options.failFast) break;
    }
  }
  
  // Summary
  console.log('═'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${filtered.length} total`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} suite(s) had failures`);
    if (!options.verbose) {
      console.log('   Run with --verbose for details');
    }
  }
  
  return { passed, failed, total: filtered.length, results };
}

function parseOptions(args) {
  const options = {};
  for (const arg of args) {
    if (arg === '--verbose') options.verbose = true;
    if (arg === '--fail-fast') options.failFast = true;
    if (arg.startsWith('--suite=')) options.suite = arg.split('=')[1];
  }
  return options;
}

// Main
const args = process.argv.slice(2);
const options = parseOptions(args);
const result = runAll(options);

process.exit(result.failed > 0 ? 1 : 0);
