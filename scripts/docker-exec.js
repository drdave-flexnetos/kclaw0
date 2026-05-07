#!/usr/bin/env node
// scripts/docker-exec.js — Docker Execution Environment for KClaw0
// Type D (Infrastructure) Upgrade
// Works with and without Docker installed.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const CONFIG_PATH = path.join(MEMORY_DIR, 'docker-config.json');
const EXEC_LOG_PATH = path.join(MEMORY_DIR, 'docker-executions.ndjson');
const TEMPLATES_DIR = path.join(MEMORY_DIR, 'docker-templates');

// --- Config ---
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      defaultTimeout: 300,
      maxContainers: 5,
      autoCleanup: true,
      volumeMounts: [{ host: '/root/.openclaw/workspace', container: '/workspace' }],
      envVars: { NODE_ENV: 'production' },
      network: 'bridge'
    };
  }
}

let CONFIG = loadConfig();

// --- Docker availability ---
function isAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['version'], { stdio: 'pipe' });
    let ok = false;
    proc.on('error', () => resolve(false));
    proc.stdout.on('data', () => { ok = true; });
    proc.on('close', (code) => resolve(code === 0 && ok));
  });
}

// --- Execution record ---
function recordExecution(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(EXEC_LOG_PATH, line);
}

function readExecutions(limit = 100) {
  if (!fs.existsSync(EXEC_LOG_PATH)) return [];
  const lines = fs.readFileSync(EXEC_LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => JSON.parse(l));
}

// --- Mock mode helpers ---
function mockRun(image, command, options = {}) {
  const containerId = 'mock-' + Math.random().toString(36).slice(2, 10);
  const entry = {
    timestamp: new Date().toISOString(),
    containerId,
    image,
    command: Array.isArray(command) ? command.join(' ') : command,
    status: 'mock_success',
    exitCode: 0,
    durationMs: 1,
    output: `Docker not available — running in mock mode\n[MOCK] Would run: ${image} ${Array.isArray(command) ? command.join(' ') : command}\n[MOCK] Options: ${JSON.stringify(options)}`,
    mock: true
  };
  recordExecution(entry);
  console.log(entry.output);
  return entry;
}

function mockExec(containerId, command) {
  const entry = {
    timestamp: new Date().toISOString(),
    containerId,
    image: 'n/a',
    command: Array.isArray(command) ? command.join(' ') : command,
    status: 'mock_success',
    exitCode: 0,
    durationMs: 1,
    output: `Docker not available — running in mock mode\n[MOCK] Would exec in ${containerId}: ${Array.isArray(command) ? command.join(' ') : command}`,
    mock: true
  };
  recordExecution(entry);
  console.log(entry.output);
  return entry;
}

function mockBuild(dockerfilePath, tag) {
  const entry = {
    timestamp: new Date().toISOString(),
    containerId: 'build-mock',
    image: tag,
    command: `build -f ${dockerfilePath} -t ${tag} .`,
    status: 'mock_success',
    exitCode: 0,
    durationMs: 1,
    output: `Docker not available — running in mock mode\n[MOCK] Would build image '${tag}' from ${dockerfilePath}`,
    mock: true
  };
  recordExecution(entry);
  console.log(entry.output);
  return entry;
}

// --- Real Docker commands ---
function dockerRun(image, command, options = {}) {
  const args = ['run', '--rm', '-d'];
  const containerId = 'kclaw-' + Math.random().toString(36).slice(2, 10);

  // Name
  args.push('--name', options.name || containerId);

  // Network
  args.push('--network', options.network || CONFIG.network || 'bridge');

  // Timeout (docker run doesn't have a native timeout, we handle it externally)
  const timeoutSec = options.timeout || CONFIG.defaultTimeout || 300;

  // Volume mounts
  const mounts = options.volumeMounts || CONFIG.volumeMounts || [];
  for (const m of mounts) {
    args.push('-v', `${m.host}:${m.container}`);
  }

  // Environment variables
  const env = { ...CONFIG.envVars, ...(options.envVars || {}) };
  for (const [k, v] of Object.entries(env)) {
    args.push('-e', `${k}=${v}`);
  }

  // Working directory
  if (options.workdir) {
    args.push('-w', options.workdir);
  }

  args.push(image);
  if (Array.isArray(command)) {
    args.push(...command);
  } else if (command) {
    args.push('sh', '-c', command);
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      // For detached runs, timeout applies to the container lifecycle
      // We'll note it but detached containers run independently
    }, timeoutSec * 1000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const entry = {
        timestamp: new Date().toISOString(),
        containerId: options.name || containerId,
        image,
        command: Array.isArray(command) ? command.join(' ') : command,
        status: code === 0 ? 'success' : 'error',
        exitCode: code,
        durationMs: Date.now() - start,
        output: stdout || stderr,
        detached: true
      };
      recordExecution(entry);
      if (code !== 0 && stderr) {
        entry.output = stderr;
      }
      resolve(entry);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      const entry = {
        timestamp: new Date().toISOString(),
        containerId: options.name || containerId,
        image,
        command: Array.isArray(command) ? command.join(' ') : command,
        status: 'error',
        exitCode: -1,
        durationMs: Date.now() - start,
        output: err.message,
        detached: true
      };
      recordExecution(entry);
      reject(entry);
    });
  });
}

function dockerExec(containerId, command) {
  const cmdArray = Array.isArray(command) ? command : ['sh', '-c', command];
  const args = ['exec', containerId, ...cmdArray];

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId,
        image: 'n/a',
        command: Array.isArray(command) ? command.join(' ') : command,
        status: code === 0 ? 'success' : 'error',
        exitCode: code,
        durationMs: Date.now() - start,
        output: stdout || stderr
      };
      recordExecution(entry);
      resolve(entry);
    });

    proc.on('error', (err) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId,
        image: 'n/a',
        command: Array.isArray(command) ? command.join(' ') : command,
        status: 'error',
        exitCode: -1,
        durationMs: Date.now() - start,
        output: err.message
      };
      recordExecution(entry);
      reject(entry);
    });
  });
}

function dockerBuild(dockerfilePath, tag) {
  const args = ['build', '-f', dockerfilePath, '-t', tag, '.'];
  const cwd = path.dirname(dockerfilePath);

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId: 'build-' + Math.random().toString(36).slice(2, 8),
        image: tag,
        command: `build -f ${dockerfilePath} -t ${tag} .`,
        status: code === 0 ? 'success' : 'error',
        exitCode: code,
        durationMs: Date.now() - start,
        output: stdout || stderr
      };
      recordExecution(entry);
      resolve(entry);
    });

    proc.on('error', (err) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId: 'build-' + Math.random().toString(36).slice(2, 8),
        image: tag,
        command: `build -f ${dockerfilePath} -t ${tag} .`,
        status: 'error',
        exitCode: -1,
        durationMs: Date.now() - start,
        output: err.message
      };
      recordExecution(entry);
      reject(entry);
    });
  });
}

function dockerStop(containerId) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc = spawn('docker', ['stop', containerId], { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId,
        image: 'n/a',
        command: `stop ${containerId}`,
        status: code === 0 ? 'success' : 'error',
        exitCode: code,
        durationMs: Date.now() - start,
        output: stdout || stderr
      };
      recordExecution(entry);
      resolve(entry);
    });

    proc.on('error', (err) => {
      const entry = {
        timestamp: new Date().toISOString(),
        containerId,
        image: 'n/a',
        command: `stop ${containerId}`,
        status: 'error',
        exitCode: -1,
        durationMs: Date.now() - start,
        output: err.message
      };
      recordExecution(entry);
      reject(entry);
    });
  });
}

function dockerList() {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['ps', '-a', '--format', '{{json .}}'], { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'docker ps failed'));
        return;
      }
      const containers = stdout.trim().split('\n').filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      resolve(containers);
    });

    proc.on('error', reject);
  });
}

function dockerLogs(containerId) {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['logs', containerId], { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', reject);
  });
}

// --- Unified API ---
async function run(image, command, options = {}) {
  const available = await isAvailable();
  if (!available) {
    return mockRun(image, command, options);
  }
  return dockerRun(image, command, options);
}

async function build(dockerfilePath, tag) {
  const available = await isAvailable();
  if (!available) {
    return mockBuild(dockerfilePath, tag);
  }
  return dockerBuild(dockerfilePath, tag);
}

async function exec(containerId, command) {
  const available = await isAvailable();
  if (!available) {
    return mockExec(containerId, command);
  }
  return dockerExec(containerId, command);
}

async function stop(containerId) {
  const available = await isAvailable();
  if (!available) {
    const entry = {
      timestamp: new Date().toISOString(),
      containerId,
      image: 'n/a',
      command: `stop ${containerId}`,
      status: 'mock_success',
      exitCode: 0,
      durationMs: 1,
      output: `Docker not available — running in mock mode\n[MOCK] Would stop container ${containerId}`,
      mock: true
    };
    recordExecution(entry);
    console.log(entry.output);
    return entry;
  }
  return dockerStop(containerId);
}

async function list() {
  const available = await isAvailable();
  if (!available) {
    console.log('Docker not available — running in mock mode');
    return [];
  }
  return dockerList();
}

async function logs(containerId) {
  const available = await isAvailable();
  if (!available) {
    const output = `Docker not available — running in mock mode\n[MOCK] Would fetch logs for ${containerId}`;
    console.log(output);
    return { stdout: output, stderr: '', exitCode: 0 };
  }
  return dockerLogs(containerId);
}

function template(name) {
  const templatePath = path.join(TEMPLATES_DIR, `${name}.Dockerfile`);
  if (!fs.existsSync(templatePath)) {
    console.log(`Template not found: ${name}`);
    return null;
  }
  return fs.readFileSync(templatePath, 'utf8');
}

// --- CLI ---
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status': {
      const available = await isAvailable();
      console.log(`Docker available: ${available}`);
      if (available) {
        const containers = await list();
        console.log(`Active containers: ${containers.length}`);
        for (const c of containers) {
          console.log(`  ${c.Names} (${c.Image}) — ${c.Status}`);
        }
      } else {
        console.log('Docker not available — running in mock mode');
      }
      break;
    }

    case 'run': {
      const image = args[1];
      const cmd = args[2] || '';
      if (!image) {
        console.log('Usage: docker-exec run <image> <command>');
        process.exit(1);
      }
      const result = await run(image, cmd, { name: args[3] });
      console.log(result.output);
      break;
    }

    case 'build': {
      const dockerfile = args[1];
      const tag = args[2];
      if (!dockerfile || !tag) {
        console.log('Usage: docker-exec build <dockerfile> <tag>');
        process.exit(1);
      }
      const result = await build(dockerfile, tag);
      console.log(result.output);
      break;
    }

    case 'list': {
      const containers = await list();
      if (containers.length === 0) {
        console.log('No active containers');
      } else {
        for (const c of containers) {
          console.log(`${c.ID}  ${c.Image}  ${c.Status}  ${c.Names}`);
        }
      }
      break;
    }

    case 'stop': {
      const containerId = args[1];
      if (!containerId) {
        console.log('Usage: docker-exec stop <containerId>');
        process.exit(1);
      }
      const result = await stop(containerId);
      console.log(result.output);
      break;
    }

    case 'logs': {
      const containerId = args[1];
      if (!containerId) {
        console.log('Usage: docker-exec logs <containerId>');
        process.exit(1);
      }
      const result = await logs(containerId);
      console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      break;
    }

    case 'template': {
      const name = args[1];
      if (!name) {
        console.log('Usage: docker-exec template <name>');
        console.log('Available: node-runner, python-runner, rust-runner');
        process.exit(1);
      }
      const content = template(name);
      if (content) console.log(content);
      break;
    }

    default: {
      console.log(`
KClaw0 Docker Execution Environment
Usage: node scripts/docker-exec.js <command> [args]

Commands:
  status                  Show Docker availability and active containers
  run <image> <cmd>       Run a container
  build <dockerfile> <tag> Build an image
  list                    List active containers
  stop <containerId>      Stop a container
  logs <containerId>      Show container logs
  template <name>         Show Dockerfile template (node-runner, python-runner, rust-runner)
`);
    }
  }
}

// --- Module exports ---
module.exports = {
  isAvailable,
  run,
  build,
  exec,
  stop,
  list,
  logs,
  template,
  loadConfig,
  recordExecution,
  readExecutions,
  CONFIG
};

// Run CLI if executed directly
if (require.main === module) {
  cli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
