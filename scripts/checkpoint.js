#!/usr/bin/env node
/**
 * KClaw0 Checkpoint/Resume System
 * Type C (Agent Loop) Upgrade — P3
 * 
 * Provides session state capture and restoration for safe
 * self-upgrades and long-running task recovery.
 * 
 * Usage:
 *   node scripts/checkpoint.js save <name> [metadata.json]
 *   node scripts/checkpoint.js list
 *   node scripts/checkpoint.js load <id>
 *   node scripts/checkpoint.js delete <id>
 *   node scripts/checkpoint.js autosave
 *   node scripts/checkpoint.js prune [n]
 *   node scripts/checkpoint.js help
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const CHECKPOINT_DIR = process.env.KCLAW0_CHECKPOINT_DIR 
  || path.join(process.cwd(), 'memory', 'checkpoints');
const MEMORY_DIR = path.join(process.cwd(), 'memory');
const ID_PAD_LENGTH = 3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a zero-padded checkpoint ID.
 */
function generateCheckpointId() {
  const existing = listCheckpointFiles();
  const nextNum = existing.length + 1;
  return `cp-${String(nextNum).padStart(ID_PAD_LENGTH, '0')}`;
}

/**
 * Get ISO timestamp.
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Ensure checkpoint directory exists.
 */
function ensureCheckpointDir() {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

/**
 * Get all checkpoint files sorted by ID number.
 */
function listCheckpointFiles() {
  ensureCheckpointDir();
  if (!fs.existsSync(CHECKPOINT_DIR)) return [];
  return fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      filename: f,
      filepath: path.join(CHECKPOINT_DIR, f),
      id: f.replace('.json', '')
    }))
    .sort((a, b) => {
      const numA = parseInt(a.id.replace('cp-', '')) || 0;
      const numB = parseInt(b.id.replace('cp-', '')) || 0;
      return numA - numB;
    });
}

/**
 * Find a checkpoint file by ID (partial match supported).
 */
function findCheckpointFile(checkpointId) {
  const files = listCheckpointFiles();
  // Exact match
  let match = files.find(f => f.id === checkpointId);
  if (match) return match;
  // Partial match (e.g., "cp-001" matches "001")
  match = files.find(f => f.id.includes(checkpointId));
  if (match) return match;
  return null;
}

/**
 * Collect memory file references from the memory directory.
 */
function collectMemoryRefs() {
  const refs = [];
  if (!fs.existsSync(MEMORY_DIR)) return refs;
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Priority files
  const priorityFiles = [
    'MEMORY.md',
    `memory/${today}.md`,
    `memory/${yesterday}.md`
  ];
  
  for (const file of priorityFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      refs.push(file);
    }
  }
  
  // Add any other .md files in memory/
  if (fs.existsSync(MEMORY_DIR)) {
    const memFiles = fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.md') && !refs.includes(`memory/${f}`))
      .map(f => `memory/${f}`);
    refs.push(...memFiles);
  }
  
  return [...new Set(refs)];
}

/**
 * Build runtime context snapshot.
 */
function buildContext() {
  return {
    currentTask: process.env.KCLAW0_CURRENT_TASK || 'unknown',
    toolCallCount: parseInt(process.env.KCLAW0_TOOL_CALL_COUNT || '0', 10),
    nodeVersion: process.version,
    cwd: process.cwd(),
    uptime: process.uptime(),
    envVars: Object.keys(process.env).filter(k => k.startsWith('KCLAW0_'))
  };
}

/**
 * Build agent loop snapshot (steering/followup queues).
 */
function buildSnapshot() {
  // Attempt to load from environment or known files
  const steeringQueue = loadQueue('steering');
  const followupQueue = loadQueue('followup');
  
  return {
    steeringQueue,
    followupQueue,
    timestamp: nowISO()
  };
}

/**
 * Load a queue from file or environment.
 */
function loadQueue(name) {
  // Try environment first
  const envVar = process.env[`KCLAW0_${name.toUpperCase()}_QUEUE`];
  if (envVar) {
    try { return JSON.parse(envVar); } catch { /* fall through */ }
  }
  // Try file
  const queueFile = path.join(process.cwd(), 'memory', `${name}-queue.json`);
  if (fs.existsSync(queueFile)) {
    try {
      return JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    } catch { /* fall through */ }
  }
  return [];
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Save a checkpoint.
 * @param {string} name — Human-readable checkpoint name
 * @param {object} metadata — Optional additional metadata
 * @returns {object} The saved checkpoint record
 */
function save(name, metadata = {}) {
  ensureCheckpointDir();
  
  if (!name || typeof name !== 'string') {
    throw new Error('Checkpoint name is required and must be a string');
  }
  
  const id = generateCheckpointId();
  const checkpoint = {
    id,
    name: name.trim(),
    timestamp: nowISO(),
    sessionId: process.env.KCLAW0_SESSION_ID || `sess-${Date.now()}`,
    turnIndex: parseInt(process.env.KCLAW0_TURN_INDEX || '0', 10),
    memoryRefs: collectMemoryRefs(),
    context: buildContext(),
    snapshot: buildSnapshot(),
    metadata: {
      ...metadata,
      savedBy: process.env.USER || 'kclaw0',
      hostname: require('os').hostname()
    }
  };
  
  const filepath = path.join(CHECKPOINT_DIR, `${id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2), 'utf8');
  
  return checkpoint;
}

/**
 * Quick autosave with timestamp-based name.
 * @returns {object} The saved checkpoint record
 */
function autoSave() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `autosave-${timestamp}`;
  return save(name, { type: 'autosave', auto: true });
}

/**
 * List all available checkpoints.
 * @returns {Array<object>} Sorted array of checkpoint summaries
 */
function list() {
  const files = listCheckpointFiles();
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(f.filepath, 'utf8'));
      return {
        id: data.id,
        name: data.name,
        timestamp: data.timestamp,
        sessionId: data.sessionId,
        turnIndex: data.turnIndex,
        memoryRefsCount: data.memoryRefs?.length || 0,
        type: data.metadata?.type || 'manual'
      };
    } catch (err) {
      return {
        id: f.id,
        name: '<corrupt>',
        timestamp: null,
        error: err.message
      };
    }
  });
}

/**
 * Load a full checkpoint by ID.
 * @param {string} checkpointId — Checkpoint ID (or partial)
 * @returns {object|null} The checkpoint data, or null if not found
 */
function load(checkpointId) {
  if (!checkpointId) {
    throw new Error('Checkpoint ID is required');
  }
  
  const file = findCheckpointFile(checkpointId);
  if (!file) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(file.filepath, 'utf8'));
    return data;
  } catch (err) {
    throw new Error(`Failed to load checkpoint ${checkpointId}: ${err.message}`);
  }
}

/**
 * Delete a checkpoint by ID.
 * @param {string} checkpointId — Checkpoint ID (or partial)
 * @returns {boolean} True if deleted
 */
function deleteCheckpoint(checkpointId) {
  if (!checkpointId) {
    throw new Error('Checkpoint ID is required');
  }
  
  const file = findCheckpointFile(checkpointId);
  if (!file) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }
  
  fs.unlinkSync(file.filepath);
  return true;
}

/**
 * Prune old checkpoints, keeping only the N most recent.
 * @param {number} keep — Number of checkpoints to retain (default: 10)
 * @returns {Array<string>} IDs of deleted checkpoints
 */
function prune(keep = 10) {
  if (keep < 1) {
    throw new Error('Keep count must be at least 1');
  }
  
  const files = listCheckpointFiles();
  if (files.length <= keep) {
    return []; // Nothing to prune
  }
  
  const toDelete = files.slice(0, files.length - keep);
  const deleted = [];
  
  for (const file of toDelete) {
    try {
      fs.unlinkSync(file.filepath);
      deleted.push(file.id);
    } catch (err) {
      console.error(`Failed to delete ${file.id}: ${err.message}`);
    }
  }
  
  return deleted;
}

// ============================================================================
// CLI Interface
// ============================================================================

function printHelp() {
  console.log(`
KClaw0 Checkpoint/Resume System
================================

Commands:
  save <name> [metadata.json]   Save a new checkpoint
  list                          List all checkpoints
  load <id>                     Load and display checkpoint data
  delete <id>                   Delete a checkpoint
  autosave                      Quick save with timestamp name
  prune [n]                     Keep only N most recent (default: 10)
  help                          Show this help

Examples:
  node scripts/checkpoint.js save "before-upgrade"
  node scripts/checkpoint.js save "with-context" '{"branch":"feat-x"}'
  node scripts/checkpoint.js list
  node scripts/checkpoint.js load cp-001
  node scripts/checkpoint.js autosave
  node scripts/checkpoint.js prune 5

Environment:
  KCLAW0_CHECKPOINT_DIR    Override checkpoint storage directory
  KCLAW0_SESSION_ID        Set session identifier
  KCLAW0_TURN_INDEX        Set current turn index
  KCLAW0_CURRENT_TASK      Set current task description
`);
}

function formatCheckpointList(checkpoints) {
  if (checkpoints.length === 0) {
    return 'No checkpoints found.';
  }
  
  const lines = [
    `Found ${checkpoints.length} checkpoint(s):`,
    '',
    'ID      | Name                    | Timestamp              | Type      | MemRefs | Turn',
    '--------|-------------------------|------------------------|-----------|---------|------'
  ];
  
  for (const cp of checkpoints) {
    const id = cp.id.padEnd(7);
    const name = (cp.name || '').slice(0, 23).padEnd(23);
    const ts = (cp.timestamp || '').slice(0, 23).padEnd(23);
    const type = (cp.type || 'manual').padEnd(9);
    const memRefs = String(cp.memoryRefsCount || 0).padEnd(7);
    const turn = String(cp.turnIndex || 0).padEnd(4);
    lines.push(`${id}| ${name} | ${ts} | ${type} | ${memRefs} | ${turn}`);
  }
  
  return lines.join('\n');
}

function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'save': {
        const name = args[1];
        if (!name) {
          console.error('Error: Checkpoint name is required');
          console.error('Usage: save <name> [metadata.json]');
          process.exit(1);
        }
        let metadata = {};
        if (args[2]) {
          try {
            metadata = JSON.parse(args[2]);
          } catch {
            console.error('Error: metadata must be valid JSON');
            process.exit(1);
          }
        }
        const cp = save(name, metadata);
        console.log(`Checkpoint saved: ${cp.id} — "${cp.name}"`);
        console.log(`  Timestamp: ${cp.timestamp}`);
        console.log(`  Memory refs: ${cp.memoryRefs.length}`);
        console.log(`  Session: ${cp.sessionId} | Turn: ${cp.turnIndex}`);
        break;
      }
      
      case 'list': {
        const checkpoints = list();
        console.log(formatCheckpointList(checkpoints));
        break;
      }
      
      case 'load': {
        const id = args[1];
        if (!id) {
          console.error('Error: Checkpoint ID is required');
          process.exit(1);
        }
        const cp = load(id);
        console.log(JSON.stringify(cp, null, 2));
        break;
      }
      
      case 'delete': {
        const delId = args[1];
        if (!delId) {
          console.error('Error: Checkpoint ID is required');
          process.exit(1);
        }
        deleteCheckpoint(delId);
        console.log(`Checkpoint ${delId} deleted.`);
        break;
      }
      
      case 'autosave': {
        const cp = autoSave();
        console.log(`Autosaved: ${cp.id} — "${cp.name}"`);
        break;
      }
      
      case 'prune': {
        const keepCount = args[1] ? parseInt(args[1], 10) : 10;
        if (isNaN(keepCount) || keepCount < 1) {
          console.error('Error: Keep count must be a positive number');
          process.exit(1);
        }
        const deleted = prune(keepCount);
        if (deleted.length === 0) {
          console.log(`No checkpoints pruned. Total ≤ ${keepCount}.`);
        } else {
          console.log(`Pruned ${deleted.length} checkpoint(s): ${deleted.join(', ')}`);
          console.log(`Kept most recent ${keepCount}.`);
        }
        break;
      }
      
      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Module Exports (for testing and programmatic use)
// ============================================================================

module.exports = {
  save,
  autoSave,
  list,
  load,
  delete: deleteCheckpoint,
  prune,
  // Exposed for testing
  _internals: {
    generateCheckpointId,
    ensureCheckpointDir,
    listCheckpointFiles,
    findCheckpointFile,
    collectMemoryRefs,
    buildContext,
    buildSnapshot,
    CHECKPOINT_DIR
  }
};

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  runCLI();
}
