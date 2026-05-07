#!/usr/bin/env node
/**
 * MemPalace Integration — KClaw0 Cross-Session Memory System
 *
 * Wraps MemPalace Python API via child_process.
 * Provides structured memory storage, semantic search, wake-up context,
 * and knowledge graph operations for persistent cross-session recall.
 *
 * Palace data lives at memory/mempalace-data/ by default.
 *
 * Usage:
 *   const mp = require('./scripts/mempalace-integration.js');
 *   await mp.initializePalace('./memory/mempalace-data');
 *   await mp.storeMemory('User prefers Rust for speed', 'projects', 'kclaw0');
 *   const ctx = await mp.wakeUp('projects');
 *   const hits = await mp.searchMemory('Rust preferences', 'projects');
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Configuration ───────────────────────────────────────────────────────────

const WORKSPACE = '/root/.openclaw/workspace';
const DEFAULT_PALACE_PATH = path.join(WORKSPACE, 'memory', 'mempalace-data');
const MEMPALACE_VENV_PYTHON = path.join(WORKSPACE, 'mempalace', '.venv', 'bin', 'python');
const MEMPALACE_SRC = path.join(WORKSPACE, 'mempalace');

// Timeouts for Python subprocess calls
const TIMEOUT_MS = 30000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape a string for safe inclusion in a Python triple-quoted string.
 */
function pyEscape(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""');
}

/**
 * Build a Python list literal from a JS array of strings.
 */
function pyList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '[]';
  const items = arr.map((s) => `"${pyEscape(String(s))}"`).join(', ');
  return `[${items}]`;
}

/**
 * Execute a Python script via the MemPalace venv interpreter.
 * Returns parsed JSON stdout.
 */
function runPython(script) {
  return new Promise((resolve, reject) => {
    const args = ['-c', script];
    const child = spawn(MEMPALACE_VENV_PYTHON, args, {
      cwd: MEMPALACE_SRC,
      env: {
        ...process.env,
        PYTHONPATH: MEMPALACE_SRC,
      },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`MemPalace subprocess timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;

      if (code !== 0) {
        reject(new Error(`MemPalace subprocess exited ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }

      // Try to parse JSON from the last non-empty line
      const lines = stdout.trim().split('\n').filter((l) => l.trim());
      const jsonLine = lines.find((l) => l.trim().startsWith('{') || l.trim().startsWith('['));
      const lastLine = lines[lines.length - 1] || '';

      // If there's a clear JSON line, prefer it; otherwise try the last line
      const candidate = jsonLine || lastLine;
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        try {
          resolve(JSON.parse(candidate));
          return;
        } catch {
          // fall through to raw-string resolve
        }
      }

      // Return raw string for text-returning ops (wakeUp, recall, search)
      resolve({ __raw: stdout.trim() });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn MemPalace Python: ${err.message}`));
    });
  });
}

/**
 * Resolve an absolute palace path. Defaults to memory/mempalace-data/.
 */
function resolvePalacePath(given) {
  if (!given) return DEFAULT_PALACE_PATH;
  return path.isAbsolute(given) ? given : path.resolve(WORKSPACE, given);
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Initialize a new palace at the given path.
 * Creates the directory and an empty ChromaDB collection.
 *
 * @param {string} [palacePath] — defaults to memory/mempalace-data/
 * @param {object} [options] — { createIdentity: boolean }
 * @returns {Promise<object>} — { palacePath, initialized: true }
 */
async function initializePalace(palacePath, options = {}) {
  const targetPath = resolvePalacePath(palacePath);

  // Ensure directory exists
  fs.mkdirSync(targetPath, { recursive: true });

  // Also ensure parent dirs for identity/config
  const configDir = path.join(WORKSPACE, 'memory', 'mempalace-config');
  fs.mkdirSync(configDir, { recursive: true });

  const identityFile = path.join(configDir, 'identity.txt');
  if (options.createIdentity !== false && !fs.existsSync(identityFile)) {
    const identity = `I am KClaw0, a self-upgrading autonomous agent.\nMy core purpose is to learn, store knowledge in persistent memory,\nand use that knowledge to edit my own code and self-upgrade.\n`;
    fs.writeFileSync(identityFile, identity, 'utf8');
  }

  // Create the ChromaDB collection by calling the palace init logic
  const script = `
import sys
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
import os
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.palace import get_collection
from mempalace.knowledge_graph import KnowledgeGraph

try:
    col = get_collection("${pyEscape(targetPath)}", create=True)
    kg = KnowledgeGraph(db_path=os.path.join("${pyEscape(targetPath)}", "knowledge_graph.db"))
    kg.close()
    print('{"initialized": true, "drawers": 0}')
except Exception as e:
    print(f'{{"error": "{str(e)}"}}')
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`Failed to initialize palace: ${result.error}`);
  }

  return {
    palacePath: targetPath,
    initialized: true,
    drawers: result.drawers || 0,
  };
}

/**
 * Store a memory in the palace.
 *
 * @param {string} text — the memory content
 * @param {string} wing — wing/namespace (e.g. 'projects', 'conversations')
 * @param {string} room — room/category (e.g. 'kclaw0', 'user-prefs')
 * @param {string[]} [tags] — optional tags for metadata
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — { drawerId, stored: true }
 */
async function storeMemory(text, wing, room, tags = [], palacePath) {
  if (!text || typeof text !== 'string') {
    throw new Error('storeMemory: text is required and must be a string');
  }
  if (!wing || typeof wing !== 'string') {
    throw new Error('storeMemory: wing is required and must be a string');
  }
  if (!room || typeof room !== 'string') {
    throw new Error('storeMemory: room is required and must be a string');
  }

  const targetPath = resolvePalacePath(palacePath);
  const tagList = pyList(Array.isArray(tags) ? tags : []);
  const timestamp = new Date().toISOString();

  const script = `
import sys, os
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.palace import get_collection
from mempalace.miner import add_drawer
import hashlib

try:
    col = get_collection("${pyEscape(targetPath)}", create=True)
    # Create a synthetic source_file path for metadata
    source_file = f"memory://{pyEscape(wing)}/{pyEscape(room)}/{hashlib.sha256("${pyEscape(text)}".encode()).hexdigest()[:16]}.md"
    drawer_id = f"drawer_${pyEscape(wing)}_${pyEscape(room)}_{hashlib.sha256((source_file + '0').encode()).hexdigest()[:24]}"
    
    metadata = {
        "wing": "${pyEscape(wing)}",
        "room": "${pyEscape(room)}",
        "source_file": source_file,
        "chunk_index": 0,
        "agent": "kclaw0",
        "tags": ${tagList},
        "stored_at": "${timestamp}",
    }
    
    col.upsert(
        documents=["""${pyEscape(text)}"""],
        ids=[drawer_id],
        metadatas=[metadata]
    )
    print(f'{{"drawerId": "{drawer_id}", "stored": true}}')
except Exception as e:
    print(f'{{"error": "{str(e)}"}}')
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`storeMemory failed: ${result.error}`);
  }

  return {
    drawerId: result.drawerId,
    stored: result.stored === true,
    wing,
    room,
  };
}

/**
 * Semantic search across the palace.
 *
 * @param {string} query — natural language query
 * @param {string} [wing] — optional wing filter
 * @param {string} [room] — optional room filter
 * @param {number} [n_results=5] — max results
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — { results: [{distance, document, metadata, id}] }
 */
async function searchMemory(query, wing, room, n_results = 5, palacePath) {
  if (!query || typeof query !== 'string') {
    throw new Error('searchMemory: query is required and must be a string');
  }

  const targetPath = resolvePalacePath(palacePath);
  const wingArg = wing ? `"${pyEscape(wing)}"` : 'None';
  const roomArg = room ? `"${pyEscape(room)}"` : 'None';

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.searcher import search_memories

try:
    result = search_memories(
        query="""${pyEscape(query)}""",
        palace_path="${pyEscape(targetPath)}",
        wing=${wingArg},
        room=${roomArg},
        n_results=${n_results}
    )
    # search_memories returns a dict with results key
    if isinstance(result, dict):
        print(json.dumps(result))
    else:
        print(json.dumps({"results": [], "raw": str(result)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`searchMemory failed: ${result.error}`);
  }

  return {
    results: result.results || [],
    query,
    wing: wing || null,
    room: room || null,
  };
}

/**
 * Get L0 + L1 wake-up context for a session start (~600-900 tokens).
 *
 * @param {string} [wing] — optional wing filter for project-specific wake-up
 * @param {string} [palacePath] — override palace path
 * @param {string} [identityPath] — path to identity.txt for L0
 * @returns {Promise<string>} — wake-up context text
 */
async function wakeUp(wing, palacePath, identityPath) {
  const targetPath = resolvePalacePath(palacePath);
  const idPath = identityPath || path.join(WORKSPACE, 'memory', 'mempalace-config', 'identity.txt');
  const wingArg = wing ? `"${pyEscape(wing)}"` : 'None';

  const script = `
import sys, os
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.layers import MemoryStack

try:
    stack = MemoryStack(
        palace_path="${pyEscape(targetPath)}",
        identity_path="${pyEscape(idPath)}"
    )
    text = stack.wake_up(wing=${wingArg})
    # Output as JSON-escaped string to preserve newlines
    import json
    print(json.dumps({"context": text}))
except Exception as e:
    import json
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`wakeUp failed: ${result.error}`);
  }

  return result.context || '';
}

/**
 * L2 on-demand retrieval filtered by wing/room.
 *
 * @param {string} [wing] — wing filter
 * @param {string} [room] — room filter
 * @param {number} [n_results=10] — max results
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<string>} — retrieved memories as formatted text
 */
async function recall(wing, room, n_results = 10, palacePath) {
  const targetPath = resolvePalacePath(palacePath);
  const wingArg = wing ? `"${pyEscape(wing)}"` : 'None';
  const roomArg = room ? `"${pyEscape(room)}"` : 'None';

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.layers import MemoryStack

try:
    stack = MemoryStack(palace_path="${pyEscape(targetPath)}")
    text = stack.recall(wing=${wingArg}, room=${roomArg}, n_results=${n_results})
    print(json.dumps({"memories": text}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`recall failed: ${result.error}`);
  }

  return result.memories || '';
}

// ── Knowledge Graph Operations ──────────────────────────────────────────────

/**
 * Add an entity to the knowledge graph.
 *
 * @param {string} name — entity name
 * @param {string} [type='unknown'] — entity type
 * @param {object} [properties] — optional properties dict
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — { entityId, name, type, added: true }
 */
async function addEntity(name, type = 'unknown', properties = {}, palacePath) {
  if (!name || typeof name !== 'string') {
    throw new Error('addEntity: name is required and must be a string');
  }

  const targetPath = resolvePalacePath(palacePath);
  const kgDbPath = path.join(targetPath, 'knowledge_graph.db');

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")

from mempalace.knowledge_graph import KnowledgeGraph

try:
    kg = KnowledgeGraph(db_path="${pyEscape(kgDbPath)}")
    kg.add_entity(name="${pyEscape(name)}", entity_type="${pyEscape(type)}", properties=${JSON.stringify(properties)})
    # Query back to confirm
    result = kg.query_entity(name="${pyEscape(name)}")
    kg.close()
    print(json.dumps({"entity": result, "added": True}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`addEntity failed: ${result.error}`);
  }

  return {
    entityId: result.entity?.id || null,
    name,
    type,
    added: result.added === true,
    entity: result.entity || null,
  };
}

/**
 * Add a triple (relationship) to the knowledge graph.
 *
 * @param {string} subject — subject entity name
 * @param {string} predicate — relationship type
 * @param {string} object — object entity name
 * @param {number} [confidence=1.0] — confidence 0.0–1.0
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — { tripleId, added: true }
 */
async function addTriple(subject, predicate, object, confidence = 1.0, palacePath) {
  if (!subject || !predicate || !object) {
    throw new Error('addTriple: subject, predicate, and object are all required');
  }

  const targetPath = resolvePalacePath(palacePath);
  const kgDbPath = path.join(targetPath, 'knowledge_graph.db');

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")

from mempalace.knowledge_graph import KnowledgeGraph

try:
    kg = KnowledgeGraph(db_path="${pyEscape(kgDbPath)}")
    kg.add_triple(
        subject="${pyEscape(subject)}",
        predicate="${pyEscape(predicate)}",
        obj="${pyEscape(object)}",
        confidence=${confidence}
    )
    kg.close()
    print(json.dumps({"added": True, "subject": "${pyEscape(subject)}", "predicate": "${pyEscape(predicate)}", "object": "${pyEscape(object)}"}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`addTriple failed: ${result.error}`);
  }

  return {
    subject: result.subject || subject,
    predicate: result.predicate || predicate,
    object: result.object || object,
    added: result.added === true,
  };
}

/**
 * Query an entity from the knowledge graph.
 *
 * @param {string} name — entity name to query
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object|null>} — entity data or null
 */
async function queryEntity(name, palacePath) {
  if (!name || typeof name !== 'string') {
    throw new Error('queryEntity: name is required and must be a string');
  }

  const targetPath = resolvePalacePath(palacePath);
  const kgDbPath = path.join(targetPath, 'knowledge_graph.db');

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")

from mempalace.knowledge_graph import KnowledgeGraph

try:
    kg = KnowledgeGraph(db_path="${pyEscape(kgDbPath)}")
    result = kg.query_entity(name="${pyEscape(name)}")
    kg.close()
    print(json.dumps({"entity": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`queryEntity failed: ${result.error}`);
  }

  return result.entity || null;
}

/**
 * Query triples by relationship predicate.
 *
 * @param {string} predicate — relationship type to query
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — { triples: [...] }
 */
async function queryRelationship(predicate, palacePath) {
  if (!predicate || typeof predicate !== 'string') {
    throw new Error('queryRelationship: predicate is required and must be a string');
  }

  const targetPath = resolvePalacePath(palacePath);
  const kgDbPath = path.join(targetPath, 'knowledge_graph.db');

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")

from mempalace.knowledge_graph import KnowledgeGraph

try:
    kg = KnowledgeGraph(db_path="${pyEscape(kgDbPath)}")
    result = kg.query_relationship(predicate="${pyEscape(predicate)}")
    kg.close()
    print(json.dumps({"triples": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  const result = await runPython(script);
  if (result.error) {
    throw new Error(`queryRelationship failed: ${result.error}`);
  }

  return {
    predicate,
    triples: result.triples || [],
  };
}

// ── Status & Diagnostics ────────────────────────────────────────────────────

/**
 * Get palace status — drawer count and layer info.
 *
 * @param {string} [palacePath] — override palace path
 * @returns {Promise<object>} — status object
 */
async function status(palacePath) {
  const targetPath = resolvePalacePath(palacePath);
  const idPath = path.join(WORKSPACE, 'memory', 'mempalace-config', 'identity.txt');

  const script = `
import sys, os, json
sys.path.insert(0, "${pyEscape(MEMPALACE_SRC)}")
os.environ["MEMPALACE_PALACE_PATH"] = "${pyEscape(targetPath)}"

from mempalace.layers import MemoryStack

try:
    stack = MemoryStack(
        palace_path="${pyEscape(targetPath)}",
        identity_path="${pyEscape(idPath)}"
    )
    print(json.dumps(stack.status()))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  return runPython(script);
}

// ── Export ──────────────────────────────────────────────────────────────────

module.exports = {
  initializePalace,
  storeMemory,
  searchMemory,
  wakeUp,
  recall,
  addEntity,
  addTriple,
  queryEntity,
  queryRelationship,
  status,
  // Internal helpers (exported for testing)
  _internals: {
    resolvePalacePath,
    pyEscape,
    pyList,
    DEFAULT_PALACE_PATH,
    MEMPALACE_VENV_PYTHON,
    MEMPALACE_SRC,
  },
};
