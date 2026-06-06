#!/usr/bin/env node
/**
 * GitHub Integration — PR Workflow System
 * 
 * Automates branch → commit → push → PR workflow.
 * Uses `gh` CLI when available, falls back to GitHub REST API.
 * 
 * Usage:
 *   node scripts/github-integration.js [command]
 * 
 * Commands:
 *   status                   — Show repo git status
 *   branch <name> [base]     — Create branch (default base: master)
 *   commit <message>           — Stage all and commit
 *   push <branch>            — Push branch to origin
 *   pr <title> <body> <branch> [base] — Create pull request
 *   workflow <branch> <commit> <title> <body> — Run full workflow
 */

const { exec: defaultExec } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace';
const CONFIG_PATH = path.join(WORKSPACE, 'memory', 'github-config.json');

// ── Dependency Injection for tests ─────────────────────────────────
let exec = defaultExec;

function setExec(mockExec) {
  exec = mockExec;
}

function resetExec() {
  exec = defaultExec;
}

// ── Config ─────────────────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `GitHub config not found at ${CONFIG_PATH}. ` +
      `Create it with: { "token": "ghp_...", "owner": "your-org", "repo": "your-repo" }`
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ token: '', owner: '', repo: '' }, null, 2)
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function runGit(args) {
  return new Promise((resolve, reject) => {
    exec(`git ${args}`, { cwd: WORKSPACE }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout.trim());
    });
  });
}

async function hasGhCli() {
  try {
    await runGit('--version'); // ensure git works at least
    return new Promise((resolve) => {
      exec('which gh', { cwd: WORKSPACE }, (err) => resolve(!err));
    });
  } catch {
    return false;
  }
}

// ── Core API ─────────────────────────────────────────────────────

/**
 * Create a new branch from base.
 */
async function createBranch(name, base = 'master') {
  await runGit(`checkout -b ${name} ${base}`);
  return { branch: name, base, created: true };
}

/**
 * Stage all changes and commit.
 */
async function commitAll(message) {
  await runGit('add -A');
  await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
  return { committed: true, message };
}

/**
 * Push branch to origin.
 */
async function push(branch) {
  await runGit(`push origin ${branch}`);
  return { pushed: true, branch };
}

/**
 * Create a pull request.
 * Prefers `gh` CLI, falls back to GitHub REST API via fetch.
 */
async function createPR(title, body, branch, base = 'master') {
  const useGh = await hasGhCli();

  if (useGh) {
    const cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --head ${branch} --base ${base}`;
    const result = await new Promise((resolve, reject) => {
      exec(cmd, { cwd: WORKSPACE }, (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout.trim());
      });
    });
    return { created: true, method: 'gh-cli', url: result.match(/https:\/\/[^\s]+/)?.[0] || result };
  }

  // Fallback: GitHub REST API
  const config = loadConfig();
  if (!config.token || !config.owner || !config.repo) {
    throw new Error('GitHub config incomplete (token, owner, repo required)');
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, head: branch, base }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { created: true, method: 'api', url: data.html_url, number: data.number };
}

/**
 * Get repository status (branch, dirty state, last commit).
 */
async function getRepoStatus() {
  const branch = await runGit('branch --show-current');
  const status = await runGit('status --short');
  const lastCommit = await runGit('log -1 --format=%H');
  const lastCommitMsg = await runGit('log -1 --format=%s');

  return {
    branch,
    dirty: status.length > 0,
    changedFiles: status ? status.split('\n').filter(Boolean) : [],
    lastCommit,
    lastCommitMsg,
  };
}

/**
 * Run the full workflow: branch → commit → push → PR.
 */
async function workflow(branchName, commitMessage, prTitle, prBody) {
  const base = 'master';
  const results = {
    branch: null,
    commit: null,
    push: null,
    pr: null,
  };

  results.branch = await createBranch(branchName, base);
  results.commit = await commitAll(commitMessage);
  results.push = await push(branchName);
  results.pr = await createPR(prTitle, prBody, branchName, base);

  return results;
}

// ── CLI ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'status': {
        const s = await getRepoStatus();
        console.log(`Branch: ${s.branch}`);
        console.log(`Dirty: ${s.dirty ? 'yes' : 'no'}`);
        if (s.dirty) console.log(`Changed: ${s.changedFiles.join(', ')}`);
        console.log(`Last commit: ${s.lastCommitMsg} (${s.lastCommit.slice(0, 7)})`);
        break;
      }

      case 'branch': {
        const [name, base = 'master'] = args.slice(1);
        if (!name) throw new Error('Usage: branch <name> [base]');
        const r = await createBranch(name, base);
        console.log(`✅ Created branch ${r.branch} from ${r.base}`);
        break;
      }

      case 'commit': {
        const message = args.slice(1).join(' ');
        if (!message) throw new Error('Usage: commit <message>');
        const r = await commitAll(message);
        console.log(`✅ Committed: ${r.message}`);
        break;
      }

      case 'push': {
        const branch = args[1];
        if (!branch) throw new Error('Usage: push <branch>');
        const r = await push(branch);
        console.log(`✅ Pushed ${r.branch}`);
        break;
      }

      case 'pr': {
        const [title, body, branch, base = 'master'] = args.slice(1);
        if (!title || !body || !branch) throw new Error('Usage: pr <title> <body> <branch> [base]');
        const r = await createPR(title, body, branch, base);
        console.log(`✅ PR created (${r.method}): ${r.url}`);
        break;
      }

      case 'workflow': {
        const [branchName, commitMsg, prTitle, ...prBodyParts] = args.slice(1);
        const prBody = prBodyParts.join(' ');
        if (!branchName || !commitMsg || !prTitle || !prBody) {
          throw new Error('Usage: workflow <branch> <commit-msg> <pr-title> <pr-body>');
        }
        const r = await workflow(branchName, commitMsg, prTitle, prBody);
        console.log('✅ Full workflow complete:');
        console.log(`  Branch: ${r.branch.branch}`);
        console.log(`  Commit: ${r.commit.message}`);
        console.log(`  Pushed: ${r.push.branch}`);
        console.log(`  PR: ${r.pr.url || 'N/A'}`);
        break;
      }

      default: {
        console.log(`Usage: node scripts/github-integration.js <command>
Commands:
  status
  branch <name> [base]
  commit <message>
  push <branch>
  pr <title> <body> <branch> [base]
  workflow <branch> <commit-msg> <pr-title> <pr-body>`);
        process.exitCode = command ? 1 : 0;
      }
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createBranch,
  commitAll,
  push,
  createPR,
  getRepoStatus,
  workflow,
  loadConfig,
  setExec,
  resetExec,
};
