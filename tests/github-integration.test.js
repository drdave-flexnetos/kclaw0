#!/usr/bin/env node
/**
 * Tests for GitHub Integration — PR Workflow System
 * Run: node tests/github-integration.test.js
 */

const {
  createBranch,
  commitAll,
  push,
  createPR,
  getRepoStatus,
  workflow,
  loadConfig,
  setExec,
  resetExec,
} = require('../scripts/github-integration.js');

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join('/root/.openclaw/workspace', 'memory', 'github-config.json');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  passCount++;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeMockExec(commands) {
  return (cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    const base = cmd.replace(/git /, '');
    for (const [pattern, result] of Object.entries(commands)) {
      if (base.includes(pattern) || cmd.includes(pattern)) {
        if (result instanceof Error) {
          return cb(result, '', result.message);
        }
        return cb(null, typeof result === 'string' ? result : JSON.stringify(result), '');
      }
    }
    cb(new Error(`Unexpected command: ${cmd}`), '', `Unexpected: ${cmd}`);
  };
}

function ensureConfigFile(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function removeConfigFile() {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
}

// ── Tests ──────────────────────────────────────────────────────────

async function testBranchCreation() {
  console.log('\n🌿 Testing createBranch...');
  setExec(makeMockExec({
    'checkout -b': 'Switched to new branch\n',
  }));

  const result = await createBranch('feat/new-thing', 'master');
  assert(result.branch === 'feat/new-thing', 'Should return created branch name');
  assert(result.base === 'master', 'Should return base branch');
  assert(result.created === true, 'Should indicate success');

  resetExec();
}

async function testCommitAll() {
  console.log('\n💾 Testing commitAll...');
  setExec(makeMockExec({
    'add -A': '',
    'commit -m': '[master abc1234] Test commit\n',
  }));

  const result = await commitAll('Test commit message');
  assert(result.committed === true, 'Should indicate committed');
  assert(result.message === 'Test commit message', 'Should return message');

  resetExec();
}

async function testPush() {
  console.log('\n📤 Testing push...');
  setExec(makeMockExec({
    'push origin': 'To github.com:owner/repo.git\n * [new branch]      feat/x -> feat/x\n',
  }));

  const result = await push('feat/x');
  assert(result.pushed === true, 'Should indicate pushed');
  assert(result.branch === 'feat/x', 'Should return branch name');

  resetExec();
}

async function testPRCreationWithGhCLI() {
  console.log('\n🔀 Testing createPR with gh CLI...');
  setExec((cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    if (cmd.includes('git --version')) return cb(null, 'git version 2.40.0\n', '');
    if (cmd.includes('which gh')) return cb(null, '/usr/local/bin/gh\n', '');
    if (cmd.includes('gh pr create')) {
      return cb(null, 'https://github.com/owner/repo/pull/42\n', '');
    }
    cb(new Error(`Unexpected: ${cmd}`), '', '');
  });

  const result = await createPR('Add feature', 'This adds a feature', 'feat/x', 'master');
  assert(result.created === true, 'Should indicate PR created');
  assert(result.method === 'gh-cli', 'Should use gh-cli method');
  assert(result.url === 'https://github.com/owner/repo/pull/42', 'Should return PR URL');

  resetExec();
}

async function testPRCreationWithAPI() {
  console.log('\n🔀 Testing createPR with GitHub API fallback...');
  // No gh CLI available
  setExec((cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    if (cmd.includes('which gh')) return cb(new Error('not found'), '', '');
    if (cmd.includes('git ')) return cb(null, 'ok', '');
    cb(new Error(`Unexpected: ${cmd}`), '', '');
  });

  // Mock global.fetch for the API call
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/99', number: 99 }),
      text: async () => '',
    };
  };

  ensureConfigFile({ token: 'ghp_test123', owner: 'testorg', repo: 'testrepo' });

  const result = await createPR('API PR', 'Body via API', 'feat/api', 'main');
  assert(result.created === true, 'Should indicate PR created via API');
  assert(result.method === 'api', 'Should use api method');
  assert(result.url === 'https://github.com/owner/repo/pull/99', 'Should return API PR URL');
  assert(result.number === 99, 'Should return PR number');

  global.fetch = originalFetch;
  resetExec();
}

async function testLoadConfig() {
  console.log('\n⚙️ Testing loadConfig...');
  ensureConfigFile({ token: 'abc', owner: 'me', repo: 'myrepo' });

  const config = loadConfig();
  assert(config.token === 'abc', 'Should load token');
  assert(config.owner === 'me', 'Should load owner');
  assert(config.repo === 'myrepo', 'Should load repo');
}

async function testLoadConfigMissing() {
  console.log('\n⚙️ Testing loadConfig missing file...');
  removeConfigFile();

  let errorCaught = false;
  try {
    loadConfig();
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('GitHub config not found'), 'Should throw config not found error');
  }
  assert(errorCaught === true, 'Should throw when config missing');
}

async function testFailedGitCommand() {
  console.log('\n💥 Testing failed git command...');
  setExec(makeMockExec({
    'checkout -b': new Error('fatal: A branch named \'feat/x\' already exists.'),
  }));

  let errorCaught = false;
  try {
    await createBranch('feat/x', 'master');
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('already exists'), 'Should propagate git error message');
  }
  assert(errorCaught === true, 'Should throw on failed git command');

  resetExec();
}

async function testFullWorkflow() {
  console.log('\n🚀 Testing full workflow...');
  setExec((cmd, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    if (cmd.includes('git --version')) return cb(null, 'git version 2.40.0\n', '');
    if (cmd.includes('checkout -b')) return cb(null, 'Switched to new branch\n', '');
    if (cmd.includes('add -A')) return cb(null, '', '');
    if (cmd.includes('commit -m')) return cb(null, '[feat/wf 1234567] workflow commit\n', '');
    if (cmd.includes('push origin')) return cb(null, 'To github.com:owner/repo.git\n', '');
    if (cmd.includes('which gh')) return cb(null, '/usr/bin/gh\n', '');
    if (cmd.includes('gh pr create')) return cb(null, 'https://github.com/owner/repo/pull/77\n', '');
    cb(new Error(`Unexpected: ${cmd}`), '', '');
  });

  const result = await workflow('feat/wf', 'workflow commit', 'Workflow PR', 'PR body');

  assert(result.branch.branch === 'feat/wf', 'Workflow: should create branch');
  assert(result.branch.created === true, 'Workflow: branch success');
  assert(result.commit.committed === true, 'Workflow: should commit');
  assert(result.commit.message === 'workflow commit', 'Workflow: commit message');
  assert(result.push.pushed === true, 'Workflow: should push');
  assert(result.pr.created === true, 'Workflow: should create PR');
  assert(result.pr.url === 'https://github.com/owner/repo/pull/77', 'Workflow: PR URL');

  resetExec();
}

async function testRepoStatus() {
  console.log('\n📊 Testing getRepoStatus...');
  setExec(makeMockExec({
    'branch --show-current': 'main',
    'status --short': ' M scripts/file.js\n?? tests/new.test.js',
    'log -1 --format=%H': 'abc123def456',
    'log -1 --format=%s': 'Last commit message',
  }));

  const status = await getRepoStatus();
  assert(status.branch === 'main', 'Should show current branch');
  assert(status.dirty === true, 'Should detect dirty state');
  assert(status.changedFiles.length === 2, 'Should list changed files');
  assert(status.lastCommit === 'abc123def456', 'Should show last commit hash');
  assert(status.lastCommitMsg === 'Last commit message', 'Should show last commit message');

  resetExec();
}

async function testRepoStatusClean() {
  console.log('\n📊 Testing getRepoStatus (clean repo)...');
  setExec(makeMockExec({
    'branch --show-current': 'master',
    'status --short': '',
    'log -1 --format=%H': '000000000000',
    'log -1 --format=%s': 'Initial commit',
  }));

  const status = await getRepoStatus();
  assert(status.branch === 'master', 'Clean: should show branch');
  assert(status.dirty === false, 'Clean: should not be dirty');
  assert(status.changedFiles.length === 0, 'Clean: no changed files');

  resetExec();
}

// ── Runner ─────────────────────────────────────────────────────────

async function testAll() {
  console.log('═══════════════════════════════════════════');
  console.log('  GitHub Integration Tests');
  console.log('═══════════════════════════════════════════');

  const tests = [
    testBranchCreation,
    testCommitAll,
    testPush,
    testPRCreationWithGhCLI,
    testPRCreationWithAPI,
    testLoadConfig,
    testLoadConfigMissing,
    testFailedGitCommand,
    testFullWorkflow,
    testRepoStatus,
    testRepoStatusClean,
  ];

  for (const t of tests) {
    try {
      await t();
    } catch (err) {
      console.error(`❌ FAIL (crash): ${t.name} — ${err.message}`);
      failCount++;
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passCount} passed, ${failCount} failed`);
  console.log('═══════════════════════════════════════════');

  process.exitCode = failCount > 0 ? 1 : 0;
}

testAll();
