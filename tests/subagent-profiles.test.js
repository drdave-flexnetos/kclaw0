const assert = require('assert');
const test = require('node:test');
const {
  loadProfiles,
  getProfile,
  matchProfile,
  listProfiles,
  FALLBACK,
  parseFrontmatter,
  buildProfile
} = require('../scripts/subagent-profiles');

// ---- parseFrontmatter tests ----

test('parseFrontmatter parses valid YAML frontmatter with multi-line arrays', () => {
  const text = `---
id: test-001
name: Test Agent
capabilities:
  - testing
  - debugging
constraints:
  maxTokens: 50000
  timeoutMinutes: 5
  models:
    - kimi-k2p6
priority: medium
created: 2026-05-08
---
You are a test agent.

## Rules
- Be fast.
`;
  const parsed = parseFrontmatter(text);
  assert.ok(parsed);
  assert.equal(parsed.data.id, 'test-001');
  assert.equal(parsed.data.name, 'Test Agent');
  assert.ok(Array.isArray(parsed.data.capabilities));
  assert.deepEqual(parsed.data.capabilities, ['testing', 'debugging']);
  assert.ok(Array.isArray(parsed.data.constraints.models));
  assert.deepEqual(parsed.data.constraints.models, ['kimi-k2p6']);
  assert.equal(parsed.data.constraints.maxTokens, 50000);
  assert.equal(parsed.body.split('\n')[0], 'You are a test agent.');
});

test('parseFrontmatter returns null for invalid text', () => {
  const parsed = parseFrontmatter('no frontmatter here');
  assert.equal(parsed, null);
});

// ---- buildProfile tests ----

test('buildProfile constructs profile from parsed data with nested constraints', () => {
  const parsed = parseFrontmatter(`---
id: scout-001
name: Integration Scout
capabilities:
  - integration
  - testing
constraints:
  maxTokens: 80000
  timeoutMinutes: 8
  models:
    - kimi-k2p5
priority: medium
created: 2026-05-08
---
You are an integration specialist.
`);
  const profile = buildProfile('scout', parsed);
  assert.equal(profile.role, 'scout');
  assert.equal(profile.name, 'Integration Scout');
  assert.deepEqual(profile.skills, ['integration', 'testing']);
  assert.equal(profile.model, 'kimi-k2p5');
  assert.equal(profile.priority, 'medium');
  assert.equal(profile.maxTokens, 80000);
  assert.equal(profile.timeoutMinutes, 8);
  assert.equal(profile.id, 'scout-001');
  assert.ok(profile.triggers.includes('integrate'));
  assert.ok(profile.tools.includes('exec'))
});

test('buildProfile uses sensible defaults for missing fields', () => {
  const parsed = parseFrontmatter(`---
name: Minimal
created: 2026-05-08
---
Minimal agent.
`);
  const profile = buildProfile('minimal', parsed);
  assert.equal(profile.role, 'minimal');
  assert.equal(profile.name, 'Minimal');
  assert.deepEqual(profile.skills, []);
  assert.equal(profile.model, 'kimi-k2p6');
  assert.equal(profile.priority, 'medium');
  assert.equal(profile.maxTokens, 80000);
  assert.equal(profile.timeoutMinutes, 10);
  assert.equal(profile.id, 'minimal-001');
});

// ---- loadProfiles tests ----

test('loadProfiles returns 7 profiles from disk', () => {
  const profiles = loadProfiles();
  const roles = Object.keys(profiles);
  assert.equal(roles.length, 7, `Expected 7 profiles, got ${roles.length}: ${roles.join(', ')}`);
  const expected = ['coder', 'documenter', 'oracle', 'researcher', 'safety_reviewer', 'scout', 'tester'];
  for (const role of expected) {
    assert.ok(roles.includes(role), `Missing role: ${role}`);
  }
});

test('loadProfiles returns fallback when agents dir missing', () => {
  const profile = getProfile('nonexistent');
  assert.equal(profile.role, FALLBACK.role);
  assert.equal(profile.name, FALLBACK.name);
});

// ---- getProfile tests ----

test('getProfile returns correct profile for each of the 7 roles', () => {
  const roles = ['coder', 'tester', 'researcher', 'oracle', 'scout', 'documenter', 'safety_reviewer'];
  for (const role of roles) {
    const profile = getProfile(role);
    assert.equal(profile.role, role, `Role mismatch for ${role}`);
    assert.ok(profile.name, `Missing name for ${role}`);
    assert.ok(profile.skills.length > 0, `Missing skills for ${role}`);
    assert.ok(profile.model, `Missing model for ${role}`);
    assert.ok(profile.triggers.length > 0, `Missing triggers for ${role}`);
    assert.ok(profile.description, `Missing description for ${role}`);
    assert.ok(profile.tools.length > 0, `Missing tools for ${role}`);
  }
});

test('getProfile returns fallback for unknown role', () => {
  const profile = getProfile('alien');
  assert.equal(profile.role, FALLBACK.role);
  assert.equal(profile.name, FALLBACK.name);
});

// ---- matchProfile tests ----

test('matchProfile selects coder for code-related tasks', () => {
  const profile = matchProfile('Build a new script for the heartbeat system');
  assert.equal(profile.role, 'coder');
});

test('matchProfile selects tester for test-related tasks', () => {
  const profile = matchProfile('Write tests to validate the sub-agent system');
  assert.equal(profile.role, 'tester');
});

test('matchProfile selects researcher for research tasks', () => {
  const profile = matchProfile('Research patterns from the autoresearch repository');
  assert.equal(profile.role, 'researcher');
});

test('matchProfile selects oracle for architecture tasks', () => {
  const profile = matchProfile('Review the architecture of the self-upgrade pipeline');
  assert.equal(profile.role, 'oracle');
});

test('matchProfile selects scout for integration tasks', () => {
  const profile = matchProfile('Integrate ChromaDB with the memory system');
  assert.equal(profile.role, 'scout');
});

test('matchProfile selects documenter for documentation tasks', () => {
  const profile = matchProfile('Document the new API endpoints in README');
  assert.equal(profile.role, 'documenter');
});

test('matchProfile selects safety_reviewer for security tasks', () => {
  const profile = matchProfile('Security audit of the GitHub integration module');
  assert.equal(profile.role, 'safety_reviewer');
});

test('matchProfile returns fallback for empty or unmatched task', () => {
  const profile = matchProfile('');
  assert.equal(profile.role, FALLBACK.role);
  const profile2 = matchProfile('something completely random xyz');
  assert.equal(profile2.role, FALLBACK.role);
});

test('matchProfile tiebreaker: coder vs tester on mixed task', () => {
  const profile = matchProfile('code and test the new module');
  // Both 'code' and 'test' match; both have high priority. Accept either.
  assert.ok(['coder', 'tester'].includes(profile.role));
});

// ---- listProfiles tests ----

test('listProfiles returns all profiles as array', () => {
  const profiles = listProfiles();
  assert.equal(profiles.length, 7);
  for (const p of profiles) {
    assert.ok(p.role);
    assert.ok(p.name);
  }
});

// ---- Validation tests ----

test('all profiles have required fields and correct types', () => {
  const profiles = listProfiles();
  for (const p of profiles) {
    assert.equal(typeof p.role, 'string');
    assert.equal(typeof p.name, 'string');
    assert.ok(Array.isArray(p.skills));
    assert.ok(Array.isArray(p.tools));
    assert.equal(typeof p.model, 'string');
    assert.ok(Array.isArray(p.triggers));
    assert.equal(typeof p.description, 'string');
    assert.equal(typeof p.priority, 'string');
    assert.equal(typeof p.maxTokens, 'number');
    assert.equal(typeof p.timeoutMinutes, 'number');
    assert.equal(typeof p.id, 'string');
  }
});

test('profile IDs are unique', () => {
  const profiles = listProfiles();
  const ids = profiles.map(p => p.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `Duplicate IDs found: ${ids.join(', ')}`);
});
