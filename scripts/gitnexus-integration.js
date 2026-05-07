#!/usr/bin/env node
/**
 * GitNexus Integration Module
 * Wraps the GitNexus CLI for code knowledge graph operations.
 *
 * Usage:
 *   node scripts/gitnexus-integration.js [command]
 *
 * Commands:
 *   index <path> [options]   — Index a repository
 *   query <pattern> [opts]   — Search the knowledge graph
 *   list                     — List all indexed repositories
 *   status <path>            — Show index status for a repo
 *   wiki <path> [opts]       — Generate repository wiki
 *   augment <pattern>        — Augment a search with KG context
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Promisified exec that always resolves the *current* child_process.exec.
 * This allows tests to monkey-patch exec and have the module use the mock.
 */
function execAsync(cmd, opts) {
  return new Promise((resolve, reject) => {
    const cp = require('child_process');
    cp.exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const WORKSPACE = '/root/.openclaw/workspace';
const CACHE_FILE = path.join(WORKSPACE, 'memory', 'gitnexus-cache.json');
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for analyze
const QUERY_TIMEOUT_MS = 30000;    // 30 seconds for queries

/**
 * Load cache from disk
 */
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    return { indexedRepos: {}, lastAccessed: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (e) {
    return { indexedRepos: {}, lastAccessed: {} };
  }
}

/**
 * Save cache to disk
 */
function saveCache(cache) {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Run a GitNexus CLI command
 */
async function runGitNexus(args, options = {}) {
  const cwd = options.cwd || WORKSPACE;
  const timeout = options.timeout || QUERY_TIMEOUT_MS;
  const cmd = `npx gitnexus ${args}`;

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (error) {
    return {
      stdout: (error.stdout || '').trim(),
      stderr: (error.stderr || '').trim(),
      ok: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Parse JSON from command output, falling back to raw text
 */
function parseJsonOutput(stdout) {
  // Try to extract JSON block from mixed output
  const jsonMatch = stdout.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // fall through
    }
  }
  // Try whole output
  try {
    return JSON.parse(stdout);
  } catch (e) {
    return null;
  }
}

/**
 * Extract the last JSON object from mixed stdout/stderr
 */
function extractLastJson(combined) {
  // Split by newlines and try each line from the end
  const lines = combined.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      return JSON.parse(line);
    } catch (e) {
      // continue to next line
    }
  }
  // Fallback: try to find JSON objects using regex
  const matches = combined.match(/\{[\s\S]*?\}/g);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(matches[i]);
      } catch (e) {
        // continue
      }
    }
  }
  return null;
}

/**
 * Parse list output into structured array
 */
function parseListOutput(stdout) {
  const repos = [];
  const lines = stdout.split('\n');
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match repo name (indented, no colon)
    const nameMatch = trimmed.match(/^(\S+)$/);
    if (nameMatch && !trimmed.includes(':') && !trimmed.startsWith('Indexed')) {
      current = { name: nameMatch[1], details: {} };
      repos.push(current);
      continue;
    }

    // Match key: value pairs
    const kvMatch = trimmed.match(/^([A-Za-z\s]+):\s*(.+)$/);
    if (kvMatch && current) {
      const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      current.details[key] = kvMatch[2].trim();
    }
  }

  return repos;
}

/**
 * Parse status output into structured object
 */
function parseStatusOutput(stdout) {
  const status = { raw: stdout };
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const kvMatch = trimmed.match(/^([A-Za-z\s/]+):\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '_').replace('/', '_');
      status[key] = kvMatch[2].trim();
    }
  }

  // Extract up-to-date flag
  status.up_to_date = stdout.includes('✅ up-to-date');
  status.outdated = stdout.includes('⚠️ outdated');

  return status;
}

// ── API Methods ─────────────────────────────────────────────────────────────

/**
 * Index a repository into the knowledge graph.
 * Caches the result to avoid re-indexing unchanged repos.
 *
 * @param {string} repoPath — absolute or relative path to the repo
 * @param {object} options — { force, embeddings, skills, skipGit, name, verbose }
 * @returns {Promise<object>} — { success, repoName, wasCached, stdout, stderr }
 */
async function indexRepo(repoPath, options = {}) {
  const absPath = path.resolve(repoPath);
  const cache = loadCache();

  // Check cache
  const cached = cache.indexedRepos[absPath];
  if (cached && !options.force) {
    // Quick status check to see if repo is still up to date
    const statusResult = await getStatus(absPath);
    if (statusResult.ok && statusResult.data && statusResult.data.up_to_date) {
      cache.lastAccessed[absPath] = new Date().toISOString();
      saveCache(cache);
      return {
        success: true,
        repoName: cached.name,
        wasCached: true,
        message: 'Repository already indexed and up-to-date. Use force=true to re-index.',
        stdout: statusResult.rawStdout || '',
        stderr: statusResult.rawStderr || '',
      };
    }
  }

  // Build command args
  const args = ['analyze', '--skip-agents-md', '--no-stats'];
  if (options.force) args.push('--force');
  if (options.embeddings) args.push('--embeddings');
  if (options.skills) args.push('--skills');
  if (options.skipGit) args.push('--skip-git');
  if (options.name) args.push('--name', options.name);
  if (options.verbose) args.push('--verbose');
  if (options.maxFileSize) args.push('--max-file-size', String(options.maxFileSize));
  args.push(absPath);

  const result = await runGitNexus(args.join(' '), {
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
  });

  if (result.ok) {
    // Extract repo name from output or use provided name
    const nameMatch = result.stdout.match(/Repository indexed successfully/);
    const repoName = options.name || path.basename(absPath);

    cache.indexedRepos[absPath] = {
      name: repoName,
      indexedAt: new Date().toISOString(),
      path: absPath,
    };
    cache.lastAccessed[absPath] = new Date().toISOString();
    saveCache(cache);

    return {
      success: true,
      repoName,
      wasCached: false,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    success: false,
    repoName: options.name || path.basename(absPath),
    wasCached: false,
    error: result.error,
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code,
  };
}

/**
 * Search the knowledge graph for execution flows related to a concept.
 *
 * @param {string} pattern — search query
 * @param {object} options — { repo, context, goal, limit, content }
 * @returns {Promise<object>} — { ok, data, rawStdout, rawStderr }
 */
async function query(pattern, options = {}) {
  const args = ['query'];
  if (options.repo) args.push('-r', options.repo);
  if (options.context) args.push('-c', `"${options.context}"`);
  if (options.goal) args.push('-g', `"${options.goal}"`);
  if (options.limit) args.push('-l', String(options.limit));
  if (options.content) args.push('--content');
  args.push(`"${pattern}"`);

  const result = await runGitNexus(args.join(' '), {
    cwd: options.cwd || WORKSPACE,
    timeout: options.timeout || QUERY_TIMEOUT_MS,
  });

  const json = extractLastJson(result.stdout + '\n' + result.stderr);

  return {
    ok: result.ok,
    data: json || { processes: [], process_symbols: [], definitions: [] },
    rawStdout: result.stdout,
    rawStderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * List all indexed repositories.
 *
 * @returns {Promise<object>} — { ok, repos, rawStdout, rawStderr }
 */
async function listRepos() {
  const result = await runGitNexus('list');

  // If no repos, gitnexus says "No indexed repositories found"
  const repos = parseListOutput(result.stdout);

  return {
    ok: result.ok,
    repos,
    count: repos.length,
    rawStdout: result.stdout,
    rawStderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * Show index status for a repository.
 *
 * @param {string} repoPath — path to the repository
 * @returns {Promise<object>} — { ok, data, rawStdout, rawStderr }
 */
async function getStatus(repoPath) {
  const result = await runGitNexus('status', { cwd: repoPath });
  const data = parseStatusOutput(result.stdout);

  return {
    ok: result.ok,
    data,
    rawStdout: result.stdout,
    rawStderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * Generate repository wiki from knowledge graph.
 *
 * @param {string} repoPath — path to the repository
 * @param {object} options — { force, provider, model, apiKey, concurrency, verbose }
 * @returns {Promise<object>} — { ok, stdout, stderr, error }
 */
async function generateWiki(repoPath, options = {}) {
  const args = ['wiki'];
  if (options.force) args.push('--force');
  if (options.provider) args.push('--provider', options.provider);
  if (options.model) args.push('--model', options.model);
  if (options.apiKey) args.push('--api-key', options.apiKey);
  if (options.concurrency) args.push('--concurrency', String(options.concurrency));
  if (options.verbose) args.push('--verbose');
  args.push(repoPath);

  const result = await runGitNexus(args.join(' '), {
    cwd: repoPath,
    timeout: options.timeout || 300000, // 5 min for wiki generation
  });

  return {
    ok: result.ok,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * Augment a search pattern with knowledge graph context.
 *
 * @param {string} pattern — search pattern
 * @param {object} options — { cwd }
 * @returns {Promise<object>} — { ok, data, rawStdout, rawStderr }
 */
async function augmentQuery(pattern, options = {}) {
  const result = await runGitNexus(`augment "${pattern}"`, {
    cwd: options.cwd || WORKSPACE,
    timeout: options.timeout || QUERY_TIMEOUT_MS,
  });

  const json = parseJsonOutput(result.stdout);

  return {
    ok: result.ok,
    data: json,
    rawStdout: result.stdout,
    rawStderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * Remove a repo from the index.
 *
 * @param {string} target — alias, name, or absolute path
 * @returns {Promise<object>}
 */
async function removeRepo(target) {
  const result = await runGitNexus(`remove "${target}"`);

  // Update cache
  if (result.ok) {
    const cache = loadCache();
    const toDelete = Object.keys(cache.indexedRepos).filter(
      p => p === target || cache.indexedRepos[p].name === target
    );
    for (const p of toDelete) {
      delete cache.indexedRepos[p];
      delete cache.lastAccessed[p];
    }
    saveCache(cache);
  }

  return {
    ok: result.ok,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.ok ? null : result.error,
  };
}

/**
 * Get cached repo info
 *
 * @param {string} repoPath
 * @returns {object|null}
 */
function getCachedInfo(repoPath) {
  const cache = loadCache();
  const absPath = path.resolve(repoPath);
  return cache.indexedRepos[absPath] || null;
}

/**
 * Clear the integration cache (does NOT remove GitNexus indexes)
 */
function clearCache() {
  saveCache({ indexedRepos: {}, lastAccessed: {} });
  return { cleared: true };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printRepos(result) {
  if (result.count === 0) {
    console.log('\n📦 No indexed repositories.');
    return;
  }
  console.log(`\n📦 Indexed Repositories (${result.count})\n`);
  for (const repo of result.repos) {
    console.log(`  📁 ${repo.name}`);
    for (const [k, v] of Object.entries(repo.details)) {
      console.log(`     ${k}: ${v}`);
    }
    console.log('');
  }
}

function printStatus(result) {
  if (!result.ok) {
    console.log(`❌ Status check failed: ${result.error}`);
    return;
  }
  const d = result.data;
  console.log('\n📊 Repository Status');
  console.log(`   Repository: ${d.repository || 'unknown'}`);
  console.log(`   Indexed: ${d.indexed || 'N/A'}`);
  console.log(`   Status: ${d.up_to_date ? '✅ up-to-date' : d.outdated ? '⚠️ outdated' : '❓ unknown'}`);
  if (d.indexed_commit) console.log(`   Commit (indexed): ${d.indexed_commit}`);
  if (d.current_commit) console.log(`   Commit (current): ${d.current_commit}`);
}

function printQuery(result) {
  if (!result.ok) {
    console.log(`❌ Query failed: ${result.error}`);
    if (result.rawStderr) console.log(`   Stderr: ${result.rawStderr}`);
    return;
  }
  const d = result.data;
  console.log('\n🔍 Query Results');
  console.log(`   Processes: ${(d.processes || []).length}`);
  console.log(`   Definitions: ${(d.definitions || []).length}`);
  if (d.timing) {
    console.log(`   Timing: ${d.timing.wall?.toFixed(1) || 'N/A'}ms`);
  }
  if ((d.processes || []).length > 0) {
    console.log('\n   Processes:');
    for (const p of d.processes.slice(0, 5)) {
      console.log(`      • ${p.name || p.title || JSON.stringify(p).slice(0, 80)}`);
    }
  }
}

async function main() {
  let args = [];
  try {
    args = process.argv ? process.argv.slice(2) : [];
  } catch (e) {
    args = [];
  }

  const command = args[0] || 'list';

  switch (command) {
    case 'index': {
      const repoPath = args[1];
      if (!repoPath) {
        console.log('Usage: node scripts/gitnexus-integration.js index <path> [--force]');
        process.exit(1);
      }
      const opts = { force: args.includes('--force') };
      const result = await indexRepo(repoPath, opts);
      if (result.success) {
        console.log(`\n✅ Indexed: ${result.repoName}`);
        if (result.wasCached) console.log('   (from cache — up-to-date)');
        if (result.stdout) console.log(`   ${result.stdout.split('\n').pop() || result.stdout}`);
      } else {
        console.log(`\n❌ Index failed: ${result.error}`);
      }
      break;
    }
    case 'query': {
      const pattern = args[1];
      if (!pattern) {
        console.log('Usage: node scripts/gitnexus-integration.js query <pattern> [-r <repo>]');
        process.exit(1);
      }
      const rIdx = args.indexOf('-r');
      const repo = rIdx >= 0 ? args[rIdx + 1] : undefined;
      const result = await query(pattern, { repo });
      printQuery(result);
      break;
    }
    case 'list': {
      const result = await listRepos();
      printRepos(result);
      break;
    }
    case 'status': {
      const repoPath = args[1] || WORKSPACE;
      const result = await getStatus(repoPath);
      printStatus(result);
      break;
    }
    case 'wiki': {
      const repoPath = args[1];
      if (!repoPath) {
        console.log('Usage: node scripts/gitnexus-integration.js wiki <path>');
        process.exit(1);
      }
      console.log('\n📝 Generating wiki (this may take a while)...');
      const result = await generateWiki(repoPath);
      if (result.ok) {
        console.log('✅ Wiki generated');
      } else {
        console.log(`❌ Wiki failed: ${result.error}`);
      }
      break;
    }
    case 'augment': {
      const pattern = args[1];
      if (!pattern) {
        console.log('Usage: node scripts/gitnexus-integration.js augment <pattern>');
        process.exit(1);
      }
      const result = await augmentQuery(pattern);
      console.log(result.ok ? '\n✅ Augment completed' : `\n❌ Augment failed: ${result.error}`);
      if (result.data) console.log(JSON.stringify(result.data, null, 2));
      break;
    }
    case 'remove': {
      const target = args[1];
      if (!target) {
        console.log('Usage: node scripts/gitnexus-integration.js remove <target>');
        process.exit(1);
      }
      const result = await removeRepo(target);
      console.log(result.ok ? `\n🗑️ Removed: ${target}` : `\n❌ Remove failed: ${result.error}`);
      break;
    }
    case 'cache-clear': {
      clearCache();
      console.log('\n🧹 Integration cache cleared');
      break;
    }
    default: {
      console.log(`Unknown command: ${command}`);
      console.log('Usage: node scripts/gitnexus-integration.js [index|query|list|status|wiki|augment|remove|cache-clear]');
      process.exit(1);
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  indexRepo,
  query,
  listRepos,
  getStatus,
  generateWiki,
  augmentQuery,
  removeRepo,
  getCachedInfo,
  clearCache,
  // Internal helpers exposed for testing
  _internals: {
    loadCache,
    saveCache,
    runGitNexus,
    parseListOutput,
    parseStatusOutput,
    parseJsonOutput,
    extractLastJson,
  },
};

// Only run main if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
  });
}
