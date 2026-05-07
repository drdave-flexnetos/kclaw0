#!/usr/bin/env node
/**
 * Tests for GitNexus Integration Module
 * Run: node tests/gitnexus-integration.test.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  indexRepo,
  query,
  listRepos,
  getStatus,
  generateWiki,
  augmentQuery,
  removeRepo,
  getCachedInfo,
  clearCache,
  _internals,
} = require('../scripts/gitnexus-integration.js');

const {
  runGitNexus,
  parseListOutput,
  parseStatusOutput,
  parseJsonOutput,
  extractLastJson,
  loadCache,
  saveCache,
} = _internals;

let execCallCount = 0;
const execOriginal = exec;

// ── Mock helpers ────────────────────────────────────────────────────────────

function mockExec(stdout, stderr = '', error = null, code = 0) {
  return (cmd, opts, callback) => {
    execCallCount++;
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    process.nextTick(() => {
      if (error) {
        const err = new Error(error);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        callback(err, '', stderr);
      } else {
        callback(null, stdout, stderr);
      }
    });
  };
}

// Patch child_process.exec for the module
let execRestore = null;

function installMockExec(mock) {
  const cp = require('child_process');
  execRestore = cp.exec;
  cp.exec = mock;
}

function restoreExec() {
  const cp = require('child_process');
  if (execRestore) cp.exec = execRestore;
  execRestore = null;
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

// ── Internal helpers tests ──────────────────────────────────────────────────

function testParseListOutput() {
  console.log('\n📋 Testing parseListOutput...');

  const raw = `Indexed Repositories (2)

  kclaw0
    Path:    /root/.openclaw/workspace
    Indexed: 5/7/2026, 9:55:24 AM
    Commit:  e2ec433
    Stats:   276 files, 9707 symbols, 14691 edges

  my-app
    Path:    /home/user/my-app
    Indexed: 5/6/2026, 3:00:00 PM
    Commit:  abc1234`;

  const repos = parseListOutput(raw);
  assert(repos.length === 2, 'Should parse 2 repos');
  assert(repos[0].name === 'kclaw0', 'First repo name should be kclaw0');
  assert(repos[0].details.path === '/root/.openclaw/workspace', 'First repo path');
  assert(repos[1].name === 'my-app', 'Second repo name should be my-app');
}

function testParseStatusOutput() {
  console.log('\n📊 Testing parseStatusOutput...');

  const raw = `Repository: /root/.openclaw/workspace
Indexed: 5/7/2026, 9:55:24 AM
Indexed commit: e2ec433
Current commit: e2ec433
Status: ✅ up-to-date`;

  const status = parseStatusOutput(raw);
  assert(status.repository === '/root/.openclaw/workspace', 'Repository parsed');
  assert(status.up_to_date === true, 'Should be up-to-date');
  assert(status.outdated === false, 'Should not be outdated');
}

function testParseJsonOutput() {
  console.log('\n🧪 Testing parseJsonOutput...');

  const valid = '{"processes": [{"name": "test"}], "timing": {"wall": 100}}';
  const obj = parseJsonOutput(valid);
  assert(obj !== null, 'Should parse valid JSON');
  assert(obj.processes.length === 1, 'Should have 1 process');

  const mixed = 'some log\n{"result": true}';
  const obj2 = parseJsonOutput(mixed);
  assert(obj2 !== null, 'Should extract JSON from mixed output');

  const invalid = 'not json at all';
  const obj3 = parseJsonOutput(invalid);
  assert(obj3 === null, 'Should return null for invalid JSON');
}

function testExtractLastJson() {
  console.log('\n🔍 Testing extractLastJson...');

  const mixed = '[gitnexus] log\n{"a": 1}\n{"b": 2, "c": true}';
  const obj = extractLastJson(mixed);
  assert(obj !== null, 'Should extract last JSON');
  assert(obj.b === 2, 'Should have b=2');
  assert(obj.c === true, 'Should have c=true');

  const noJson = 'just plain text\nmore text';
  const obj2 = extractLastJson(noJson);
  assert(obj2 === null, 'Should return null when no JSON');
}

// ── Cache tests ─────────────────────────────────────────────────────────────

function testLoadAndSaveCache() {
  console.log('\n💾 Testing load/save cache...');

  // Ensure clean state
  const cachePath = path.join('/root/.openclaw/workspace', 'memory', 'gitnexus-cache.json');
  if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

  const cache1 = loadCache();
  assert(typeof cache1 === 'object', 'Should return object');
  assert(typeof cache1.indexedRepos === 'object', 'Should have indexedRepos');
  assert(Object.keys(cache1.indexedRepos).length === 0, 'Should start empty');

  cache1.indexedRepos['/test/repo'] = { name: 'test-repo', indexedAt: new Date().toISOString() };
  saveCache(cache1);

  const cache2 = loadCache();
  assert(cache2.indexedRepos['/test/repo'].name === 'test-repo', 'Should persist repo name');

  // Cleanup
  fs.unlinkSync(cachePath);
}

function testClearCache() {
  console.log('\n🧹 Testing clearCache...');

  const cache = loadCache();
  cache.indexedRepos['/foo'] = { name: 'foo' };
  saveCache(cache);

  clearCache();
  const cleared = loadCache();
  assert(Object.keys(cleared.indexedRepos).length === 0, 'Should clear indexedRepos');
  assert(Object.keys(cleared.lastAccessed).length === 0, 'Should clear lastAccessed');
}

// ── API method tests (with mocked exec) ─────────────────────────────────────

async function testIndexRepo() {
  console.log('\n📦 Testing indexRepo...');
  execCallCount = 0;

  const mock = mockExec(
    'Repository indexed successfully (5.0s)\n  100 nodes | 200 edges',
    '',
    null,
    0
  );
  installMockExec(mock);

  clearCache();
  const result = await indexRepo('/tmp/test-repo', { name: 'test-repo' });

  assert(result.success === true, 'Should succeed');
  assert(result.repoName === 'test-repo', 'Should have correct repo name');
  assert(result.wasCached === false, 'Should not be cached on first index');
  assert(execCallCount >= 1, 'Should have called exec');

  // Second call should hit cache and check status
  installMockExec(mockExec(
    'Repository: /tmp/test-repo\nIndexed: 5/7/2026\nStatus: ✅ up-to-date',
    '',
    null,
    0
  ));

  const result2 = await indexRepo('/tmp/test-repo');
  assert(result2.wasCached === true, 'Should be cached on second call');
  assert(result2.success === true, 'Cached result should be success');

  restoreExec();
}

async function testIndexRepoForce() {
  console.log('\n🔥 Testing indexRepo force=true...');
  execCallCount = 0;

  const mock = mockExec(
    'Repository indexed successfully (3.0s)',
    '',
    null,
    0
  );
  installMockExec(mock);

  // Pre-populate cache
  const cache = loadCache();
  cache.indexedRepos['/tmp/force-repo'] = { name: 'force-repo', indexedAt: new Date().toISOString() };
  saveCache(cache);

  const result = await indexRepo('/tmp/force-repo', { force: true });
  assert(result.wasCached === false, 'Force should bypass cache');
  assert(result.success === true, 'Should succeed');

  restoreExec();
}

async function testIndexRepoError() {
  console.log('\n❌ Testing indexRepo error handling...');
  execCallCount = 0;

  const mock = mockExec('', 'Not a git repo', 'Command failed', 1);
  installMockExec(mock);
  clearCache();

  const result = await indexRepo('/tmp/not-a-repo');
  assert(result.success === false, 'Should fail');
  assert(result.error !== undefined, 'Should have error message');
  assert(result.stderr === 'Not a git repo', 'Should capture stderr');

  restoreExec();
}

async function testQuery() {
  console.log('\n🔍 Testing query...');
  execCallCount = 0;

  const jsonOut = JSON.stringify({
    processes: [{ name: 'auth-flow', id: 1 }],
    definitions: [{ name: 'authenticate', file: 'auth.js' }],
    timing: { wall: 45.2 },
  });

  const mock = mockExec(jsonOut, '', null, 0);
  installMockExec(mock);

  const result = await query('authentication', { repo: 'kclaw0', limit: 5 });
  assert(result.ok === true, 'Query should succeed');
  assert(result.data.processes.length === 1, 'Should have 1 process');
  assert(result.data.processes[0].name === 'auth-flow', 'Process name should match');
  assert(result.data.definitions.length === 1, 'Should have 1 definition');
  assert(result.rawStdout === jsonOut, 'Should preserve raw stdout');

  restoreExec();
}

async function testQueryError() {
  console.log('\n🔍 Testing query error...');
  execCallCount = 0;

  const mock = mockExec('', 'No indexed repos', 'Command failed', 1);
  installMockExec(mock);

  const result = await query('foo');
  assert(result.ok === false, 'Should fail');
  assert(result.error !== undefined, 'Should have error');
  assert(Array.isArray(result.data.processes), 'Should still have safe data shape');

  restoreExec();
}

async function testListRepos() {
  console.log('\n📦 Testing listRepos...');
  execCallCount = 0;

  const mock = mockExec(
    'Indexed Repositories (1)\n\n  kclaw0\n    Path:    /root/.openclaw/workspace\n    Indexed: 5/7/2026, 9:55:24 AM\n    Commit:  e2ec433',
    '',
    null,
    0
  );
  installMockExec(mock);

  const result = await listRepos();
  assert(result.ok === true, 'Should succeed');
  assert(result.count === 1, 'Should have 1 repo');
  assert(result.repos[0].name === 'kclaw0', 'Repo name should be kclaw0');
  assert(result.repos[0].details.path === '/root/.openclaw/workspace', 'Path should match');

  restoreExec();
}

async function testGetStatus() {
  console.log('\n📊 Testing getStatus...');
  execCallCount = 0;

  const mock = mockExec(
    'Repository: /root/.openclaw/workspace\nIndexed: 5/7/2026\nIndexed commit: e2ec433\nCurrent commit: abc1234\nStatus: ⚠️ outdated',
    '',
    null,
    0
  );
  installMockExec(mock);

  const result = await getStatus('/root/.openclaw/workspace');
  assert(result.ok === true, 'Should succeed');
  assert(result.data.up_to_date === false, 'Should not be up-to-date');
  assert(result.data.outdated === true, 'Should be outdated');
  assert(result.data.repository === '/root/.openclaw/workspace', 'Repository path');

  restoreExec();
}

async function testAugmentQuery() {
  console.log('\n🔮 Testing augmentQuery...');
  execCallCount = 0;

  const jsonOut = JSON.stringify({ context: ['related symbol A', 'related symbol B'], confidence: 0.95 });
  const mock = mockExec(jsonOut, '', null, 0);
  installMockExec(mock);

  const result = await augmentQuery('steering queue');
  assert(result.ok === true, 'Should succeed');
  assert(result.data !== null, 'Should have data');
  assert(result.data.confidence === 0.95, 'Should parse confidence');

  restoreExec();
}

async function testRemoveRepo() {
  console.log('\n🗑️ Testing removeRepo...');
  execCallCount = 0;

  // Pre-populate cache
  const cache = loadCache();
  cache.indexedRepos['/tmp/old-repo'] = { name: 'old-repo', indexedAt: new Date().toISOString() };
  cache.lastAccessed['/tmp/old-repo'] = new Date().toISOString();
  saveCache(cache);

  const mock = mockExec('Removed: old-repo', '', null, 0);
  installMockExec(mock);

  const result = await removeRepo('old-repo');
  assert(result.ok === true, 'Should succeed');

  const afterCache = loadCache();
  assert(afterCache.indexedRepos['/tmp/old-repo'] === undefined, 'Should remove from cache');

  restoreExec();
}

async function testGenerateWiki() {
  console.log('\n📝 Testing generateWiki...');
  execCallCount = 0;

  const mock = mockExec('Wiki generated successfully\nOutput: /tmp/test/.gitnexus/wiki.md', '', null, 0);
  installMockExec(mock);

  const result = await generateWiki('/tmp/test', { force: true });
  assert(result.ok === true, 'Should succeed');
  assert(result.stdout.includes('Wiki generated'), 'Should have wiki output');

  restoreExec();
}

async function testGetCachedInfo() {
  console.log('\n💾 Testing getCachedInfo...');

  clearCache();
  const info1 = getCachedInfo('/tmp/unknown');
  assert(info1 === null, 'Should return null for unknown repo');

  const cache = loadCache();
  cache.indexedRepos['/tmp/known'] = { name: 'known-repo', indexedAt: '2026-05-07T00:00:00Z' };
  saveCache(cache);

  const info2 = getCachedInfo('/tmp/known');
  assert(info2 !== null, 'Should return info for known repo');
  assert(info2.name === 'known-repo', 'Should have correct name');

  clearCache();
}

// ── Test runner ─────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('🧪 GitNexus Integration Tests');
  console.log('============================');

  try {
    // Internal helpers
    testParseListOutput();
    testParseStatusOutput();
    testParseJsonOutput();
    testExtractLastJson();

    // Cache
    testLoadAndSaveCache();
    testClearCache();

    // API with mocked exec
    await testIndexRepo();
    await testIndexRepoForce();
    await testIndexRepoError();
    await testQuery();
    await testQueryError();
    await testListRepos();
    await testGetStatus();
    await testAugmentQuery();
    await testRemoveRepo();
    await testGenerateWiki();
    await testGetCachedInfo();

    console.log('\n🎉 All tests passed!');
  } catch (err) {
    console.error('\n💥 Test suite failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    // Always clean up
    clearCache();
    restoreExec();
  }
}

runAllTests();
