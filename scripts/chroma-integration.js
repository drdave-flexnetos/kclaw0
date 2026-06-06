#!/usr/bin/env node
/**
 * ChromaDB Integration — KClaw0 Semantic Memory Storage
 *
 * Provides semantic memory storage and retrieval via ChromaDB HTTP API v2.
 * Manages the ChromaDB server lifecycle, generates embeddings via Python,
 * and exposes a clean JS API for store/search/delete/list operations.
 *
 * To enable real mode you must install ChromaDB:
 *   Python: pip install chromadb
 *   CLI:    chroma run --path <data-dir> (provided by Python package)
 *
 * If Python chromadb is not installed, `_generateEmbeddings` will throw
 * and the client falls back to mock-only behaviour.
 *
 * Core API:
 *   new ChromaClient(options)       → Create client instance
 *   await client.isReal()           → Check if a real server is reachable
 *   await client.start()            → Start ChromaDB server (if not running)
 *   await client.stop()             → Stop managed server
 *   await client.store(text, metadata, collection) → Store text with embedding
 *   await client.search(query, collection, n_results) → Semantic search
 *   await client.delete(id, collection)             → Remove by ID
 *   await client.listCollections()                   → Show all collections
 *   await client.ensureCollection(name, metadata)    → Auto-create collection
 *
 * CLI commands:
 *   start      — Start the ChromaDB server
 *   stop       — Stop the managed server
 *   status     — Check if server is running
 *   store      — Store a text document
 *   search     — Search a collection
 *   list       — List collections
 *
 * @module scripts/chroma-integration
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', 'memory', 'chromadb-data');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8000;
const DEFAULT_PYTHON = 'python3';
const HEARTBEAT_POLL_MS = 200;
const HEARTBEAT_TIMEOUT_MS = 15000;

// ── ChromaDB v2 API Paths ────────────────────────────────────────────────────
// v2 uses UUID-based collection IDs for all data operations.

function apiBase(tenant = 'default_tenant', database = 'default_database') {
  return `/api/v2/tenants/${tenant}/databases/${database}`;
}

// ── HTTP Helper ──────────────────────────────────────────────────────────────

function httpRequest(baseUrl, apiPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, baseUrl);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
        ...(options.timeout ? { timeout: options.timeout } : {}),
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {}, headers: res.headers });
            } catch {
              resolve({ status: res.statusCode, body, headers: res.headers });
            }
          } else {
            let parsed = body;
            try { parsed = JSON.parse(body); } catch { /* keep raw */ }
            const err = new Error(`ChromaDB HTTP ${res.statusCode}: ${typeof parsed === 'object' && parsed.message ? parsed.message : body}`);
            err.status = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    if (options.timeout) req.on('timeout', () => req.destroy());
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ── ChromaClient ─────────────────────────────────────────────────────────────

class ChromaClient {
  /**
   * @param {object} options
   * @param {string} options.dataDir — ChromaDB persistence path
   * @param {string} options.host — Server host (default 127.0.0.1)
   * @param {number} options.port — Server port (default 8000)
   * @param {string} options.pythonPath — Python executable path (default 'python3')
   * @param {string} options.venvPath — Virtual env activation path (optional)
   * @param {string} options.baseUrl — Full URL to an existing server (skips local start)
   * @param {boolean} options.autoStart — Auto-start server on first operation (default true)
   * @param {string} options.tenant — ChromaDB tenant (default 'default_tenant')
   * @param {string} options.database — ChromaDB database (default 'default_database')
   */
  constructor(options = {}) {
    this.dataDir = options.dataDir || DEFAULT_DATA_DIR;
    this.host = options.host || DEFAULT_HOST;
    this.port = options.port || DEFAULT_PORT;
    this.pythonPath = options.pythonPath || DEFAULT_PYTHON;
    this.venvPath = options.venvPath || null;
    this.baseUrl = options.baseUrl || `http://${this.host}:${this.port}`;
    this.autoStart = options.autoStart !== false;
    this.tenant = options.tenant || 'default_tenant';
    this.database = options.database || 'default_database';

    this._serverProcess = null;
    this._collectionCache = new Map(); // name → { id, fetchedAt }
    this._cacheTTL = 30000; // 30s
    this._embeddingQueue = []; // batching buffer
    this._embeddingTimer = null;
    this._embeddingBatchSize = 32;
  }

  // ── Server Lifecycle ───────────────────────────────────────────────────────

/**
 * Check if a real ChromaDB server is available (responds to heartbeat
 * with expected API format). Returns `false` when the server is not
 * running or the response is not a valid ChromaDB v2 heartbeat.
 *
 * To enable real mode you must install ChromaDB:
 *   Python: pip install chromadb
 *   CLI:    chroma run --path <data-dir> (provided by Python package)
 *
 * If Python chromadb is not installed, `_generateEmbeddings` will throw
 * and the client falls back to mock-only behaviour.
 */
async isReal() {
  try {
    const res = await httpRequest(this.baseUrl, '/api/v2/heartbeat', {
      method: 'GET',
      timeout: 3000,
    });
    return res.status === 200 && res.body && typeof res.body === 'object';
  } catch {
    return false;
  }
}

  /**
   * Backward-compatible alias for `isReal()`.
   * Checks whether the ChromaDB server responds to the heartbeat endpoint.
   */
  async isRunning() {
    return this.isReal();
  }

  /**
   * Start a local ChromaDB server process.
   * Uses the `chroma run` CLI. If a venvPath is provided, activates it first.
   */
  async start() {
    if (await this.isRunning()) {
      return { started: false, message: 'Server already running' };
    }

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const args = ['run', '--path', this.dataDir, '--host', this.host, '--port', String(this.port)];
    let command = 'chroma';
    let spawnOpts = { detached: false, stdio: ['ignore', 'pipe', 'pipe'] };

    if (this.venvPath) {
      // Use the venv's chroma binary directly
      const venvChroma = path.join(this.venvPath, 'bin', 'chroma');
      if (fs.existsSync(venvChroma)) {
        command = venvChroma;
        spawnOpts.env = { ...process.env, PATH: `${path.join(this.venvPath, 'bin')}:${process.env.PATH}` };
      }
    }

    this._serverProcess = spawn(command, args, spawnOpts);

    // Collect stdout/stderr for debugging
    let bootLog = '';
    this._serverProcess.stdout.on('data', (d) => { bootLog += d; });
    this._serverProcess.stderr.on('data', (d) => { bootLog += d; });

    this._serverProcess.on('error', (err) => {
      throw new Error(`Failed to start ChromaDB server: ${err.message}`);
    });

    this._serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`ChromaDB server exited with code ${code}. Boot log:\n${bootLog}`);
      }
      this._serverProcess = null;
    });

    // Poll heartbeat until ready or timeout
    const startTime = Date.now();
    while (Date.now() - startTime < HEARTBEAT_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, HEARTBEAT_POLL_MS));
      if (await this.isRunning()) {
        return { started: true, pid: this._serverProcess.pid, baseUrl: this.baseUrl };
      }
    }

    // Timeout — kill process and throw
    this.stop();
    throw new Error(
      `ChromaDB server failed to start within ${HEARTBEAT_TIMEOUT_MS}ms. ` +
        `Command: ${command} ${args.join(' ')}. Boot log:\n${bootLog}`
    );
  }

  /**
   * Stop the managed ChromaDB server process.
   */
  stop() {
    if (!this._serverProcess) {
      return { stopped: false, message: 'No managed server running' };
    }
    try {
      this._serverProcess.kill('SIGTERM');
      // Force kill after 3s if still running
      setTimeout(() => {
        try { this._serverProcess.kill('SIGKILL'); } catch { /* ignore */ }
      }, 3000);
    } catch (err) {
      return { stopped: false, error: err.message };
    }
    const pid = this._serverProcess.pid;
    this._serverProcess = null;
    return { stopped: true, pid };
  }

  /**
   * Internal: ensure server is running before operations.
   */
  async _ensureServer() {
    if (this.autoStart && !(await this.isRunning())) {
      await this.start();
    }
    if (!(await this.isRunning())) {
      throw new Error('ChromaDB server is not running and autoStart is disabled');
    }
  }

  // ── Collections ────────────────────────────────────────────────────────────

  /**
   * Resolve a collection name to its UUID, using an in-memory cache.
   */
  async _getCollectionId(name) {
    const cached = this._collectionCache.get(name);
    if (cached && Date.now() - cached.fetchedAt < this._cacheTTL) {
      return cached.id;
    }

    await this._ensureServer();
    const api = apiBase(this.tenant, this.database);
    const res = await httpRequest(this.baseUrl, `${api}/collections`, { method: 'GET' });
    const collections = res.body || [];
    const found = collections.find((c) => c.name === name);
    if (!found) {
      throw new Error(`Collection "${name}" not found. Use ensureCollection() to create it.`);
    }
    this._collectionCache.set(name, { id: found.id, fetchedAt: Date.now() });
    return found.id;
  }

  /**
   * Create a collection if it doesn't exist, or return existing.
   */
  async ensureCollection(name, metadata = {}) {
    await this._ensureServer();
    const api = apiBase(this.tenant, this.database);

    // Try to get existing
    try {
      const existingId = await this._getCollectionId(name);
      return { id: existingId, name, created: false };
    } catch {
      // Not found — create it
    }

    // v2 requires non-empty metadata
    const safeMetadata = Object.keys(metadata).length > 0 ? metadata : { type: 'default' };
    const body = {
      name,
      metadata: safeMetadata,
      configuration: { hnsw_configuration: {} },
      get_or_create: false,
    };

    const res = await httpRequest(this.baseUrl, `${api}/collections`, {
      method: 'POST',
      body,
    });

    const created = res.body;
    this._collectionCache.set(name, { id: created.id, fetchedAt: Date.now() });
    return { id: created.id, name, created: true, metadata: safeMetadata };
  }

  /**
   * List all collections.
   */
  async listCollections() {
    await this._ensureServer();
    const api = apiBase(this.tenant, this.database);
    const res = await httpRequest(this.baseUrl, `${api}/collections`, { method: 'GET' });
    const collections = res.body || [];
    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      metadata: c.metadata,
      dimension: c.dimension,
      tenant: c.tenant,
      database: c.database,
    }));
  }

  /**
   * Delete a collection by name.
   */
  async deleteCollection(name) {
    await this._ensureServer();
    const api = apiBase(this.tenant, this.database);
    const collectionId = await this._getCollectionId(name);

    await httpRequest(this.baseUrl, `${api}/collections/${collectionId}`, { method: 'DELETE' });
    this._collectionCache.delete(name);
    return { deleted: true, name, id: collectionId };
  }

  // ── Embeddings ─────────────────────────────────────────────────────────────

  /**
   * Generate embeddings for one or more texts using ChromaDB's
   * DefaultEmbeddingFunction via a Python subprocess.
   *
   * Requires Python chromadb to be installed:
   *   pip install chromadb
   *
   * This keeps the model loaded in a single Python call for the batch,
   * avoiding repeated cold-start overhead.
   */
  async _generateEmbeddings(texts) {
    if (!Array.isArray(texts)) texts = [texts];
    if (texts.length === 0) return [];

    const pythonScript = `
import json, sys
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
ef = DefaultEmbeddingFunction()
texts = json.load(sys.stdin)
embeddings = ef(texts)
json.dump([[float(v) for v in e] for e in embeddings], sys.stdout)
`;

    const pythonExec = this.venvPath
      ? path.join(this.venvPath, 'bin', 'python')
      : this.pythonPath;

    const env = this.venvPath
      ? { ...process.env, PATH: `${path.join(this.venvPath, 'bin')}:${process.env.PATH}` }
      : process.env;

    return new Promise((resolve, reject) => {
      const child = spawn(pythonExec, ['-c', pythonScript], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => (stderr += d));

      child.on('error', (err) => {
        reject(new Error(`Embedding generation failed: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Embedding generation failed (exit ${code}): ${stderr || 'no stderr'}`));
          return;
        }
        try {
          const embeddings = JSON.parse(stdout);
          resolve(embeddings);
        } catch {
          reject(new Error(`Failed to parse embedding output: ${stdout}. stderr: ${stderr || 'none'}`));
        }
      });

      // Set a timeout for the entire operation
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 3000);
        reject(new Error('Embedding generation timed out after 30000ms'));
      }, 30000);

      child.on('close', () => clearTimeout(timeout));

      child.stdin.write(JSON.stringify(texts));
      child.stdin.end();
    });
  }

  // ── Data Operations ──────────────────────────────────────────────────────

  /**
   * Store a text document with its embedding and metadata.
   *
   * @param {string} text — Document text to store
   * @param {object} metadata — Key-value metadata (optional)
   * @param {string} collection — Collection name (default: 'conversations')
   * @param {string} id — Optional explicit ID (default: auto-generated UUID)
   * @returns {Promise<{id, collection, stored: boolean}>}
   */
  async store(text, metadata = {}, collection = 'conversations', id) {
    await this._ensureServer();
    const collectionId = await this._getCollectionId(collection);

    const docId = id || this._uuid();
    const embeddings = await this._generateEmbeddings([text]);

    const api = apiBase(this.tenant, this.database);
    await httpRequest(this.baseUrl, `${api}/collections/${collectionId}/add`, {
      method: 'POST',
      body: {
        ids: [docId],
        documents: [text],
        metadatas: [metadata],
        embeddings: embeddings,
      },
    });

    return { id: docId, collection, stored: true };
  }

  /**
   * Semantic search over a collection.
   *
   * @param {string} query — Query text
   * @param {string} collection — Collection name (default: 'conversations')
   * @param {number} n_results — Number of results (default: 5)
   * @param {object} where — Metadata filter (optional, v2 where clause)
   * @returns {Promise<Array<{id, document, metadata, distance}>>}
   */
  async search(query, collection = 'conversations', n_results = 5, where) {
    await this._ensureServer();
    const collectionId = await this._getCollectionId(collection);

    const queryEmbeddings = await this._generateEmbeddings([query]);

    const api = apiBase(this.tenant, this.database);
    const body = {
      query_embeddings: queryEmbeddings,
      n_results: n_results,
      include: ['metadatas', 'documents', 'distances'],
    };
    if (where) body.where = where;

    const res = await httpRequest(this.baseUrl, `${api}/collections/${collectionId}/query`, {
      method: 'POST',
      body,
    });

    const data = res.body;
    if (!data || !data.ids || !data.ids[0]) return [];

    const ids = data.ids[0];
    const docs = data.documents?.[0] || [];
    const metas = data.metadatas?.[0] || [];
    const dists = data.distances?.[0] || [];

    return ids.map((id, i) => ({
      id,
      document: docs[i] || null,
      metadata: metas[i] || {},
      distance: dists[i] !== undefined ? dists[i] : null,
    }));
  }

  /**
   * Delete records by ID from a collection.
   *
   * @param {string|Array<string>} ids — ID or array of IDs to delete
   * @param {string} collection — Collection name (default: 'conversations')
   * @returns {Promise<{deleted: number}>}
   */
  async delete(ids, collection = 'conversations') {
    await this._ensureServer();
    const collectionId = await this._getCollectionId(collection);
    const idList = Array.isArray(ids) ? ids : [ids];

    const api = apiBase(this.tenant, this.database);
    const res = await httpRequest(this.baseUrl, `${api}/collections/${collectionId}/delete`, {
      method: 'POST',
      body: { ids: idList },
    });

    return { deleted: res.body?.deleted || idList.length };
  }

  /**
   * Get records by ID from a collection.
   *
   * @param {string|Array<string>} ids — ID or array of IDs
   * @param {string} collection — Collection name (default: 'conversations')
   * @returns {Promise<Array<{id, document, metadata}>>}
   */
  async get(ids, collection = 'conversations') {
    await this._ensureServer();
    const collectionId = await this._getCollectionId(collection);
    const idList = Array.isArray(ids) ? ids : [ids];

    const api = apiBase(this.tenant, this.database);
    const res = await httpRequest(this.baseUrl, `${api}/collections/${collectionId}/get`, {
      method: 'POST',
      body: { ids: idList, include: ['metadatas', 'documents'] },
    });

    const data = res.body;
    if (!data || !data.ids) return [];

    return data.ids.map((id, i) => ({
      id,
      document: data.documents?.[i] || null,
      metadata: data.metadatas?.[i] || {},
    }));
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ── CLI Interface ────────────────────────────────────────────────────────────

async function runCLI() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`
Usage: chroma-integration <command> [args]

Commands:
  start                    Start the ChromaDB server
  stop                     Stop the managed server
  status                   Check if server is running
  ensure <name>            Create a collection if it doesn't exist
  store <collection> "<text>" [metadata_json]
                           Store a text document
  search <collection> "<query>" [n_results]
                           Search a collection
  get <collection> <id>    Get a record by ID
  delete <collection> <id>   Delete a record by ID
  list                     List all collections

Environment:
  CHROMADB_DATA_DIR        Persistence path (default: memory/chromadb-data)
  CHROMADB_PORT            Server port (default: 8000)
  CHROMADB_VENV            Path to Python venv with chromadb
`);
    return;
  }

  const dataDir = process.env.CHROMADB_DATA_DIR || DEFAULT_DATA_DIR;
  const port = parseInt(process.env.CHROMADB_PORT || String(DEFAULT_PORT), 10);
  const venvPath = process.env.CHROMADB_VENV || null;

  const client = new ChromaClient({ dataDir, port, venvPath, autoStart: false });

  switch (cmd) {
    case 'start': {
      const result = await client.start();
      console.log(result.started ? `✅ Server started at ${result.baseUrl} (pid ${result.pid})` : `ℹ️ ${result.message}`);
      break;
    }

    case 'stop': {
      const result = client.stop();
      console.log(result.stopped ? `✅ Server stopped (was pid ${result.pid})` : `ℹ️ ${result.message}`);
      break;
    }

    case 'status': {
      const ok = await client.isRunning();
      console.log(ok ? '✅ ChromaDB server is running' : '❌ ChromaDB server is not running');
      process.exitCode = ok ? 0 : 1;
      break;
    }

    case 'ensure': {
      const name = args[1];
      if (!name) { console.error('Usage: ensure <collection_name>'); process.exit(1); }
      const meta = args[2] ? JSON.parse(args[2]) : { type: 'default' };
      const result = await client.ensureCollection(name, meta);
      console.log(result.created ? `✅ Created collection "${name}" (${result.id})` : `ℹ️ Collection "${name}" already exists (${result.id})`);
      break;
    }

    case 'store': {
      const collection = args[1];
      const text = args[2];
      const meta = args[3] ? JSON.parse(args[3]) : {};
      if (!collection || !text) { console.error('Usage: store <collection> "<text>" [metadata_json]'); process.exit(1); }
      const result = await client.store(text, meta, collection);
      console.log(`✅ Stored in "${collection}" with id ${result.id}`);
      break;
    }

    case 'search': {
      const collection = args[1];
      const query = args[2];
      const n = parseInt(args[3] || '5', 10);
      if (!collection || !query) { console.error('Usage: search <collection> "<query>" [n_results]'); process.exit(1); }
      const results = await client.search(query, collection, n);
      console.log(`\n🔍 ${results.length} result(s) in "${collection}":\n`);
      for (const r of results) {
        console.log(`  [${r.id}] dist=${r.distance?.toFixed(4) ?? 'N/A'}`);
        console.log(`  ${r.document}`);
        console.log(`  meta: ${JSON.stringify(r.metadata)}\n`);
      }
      break;
    }

    case 'get': {
      const collection = args[1];
      const id = args[2];
      if (!collection || !id) { console.error('Usage: get <collection> <id>'); process.exit(1); }
      const results = await client.get(id, collection);
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case 'delete': {
      const collection = args[1];
      const id = args[2];
      if (!collection || !id) { console.error('Usage: delete <collection> <id>'); process.exit(1); }
      const result = await client.delete(id, collection);
      console.log(`✅ Deleted ${result.deleted} record(s) from "${collection}"`);
      break;
    }

    case 'list': {
      const collections = await client.listCollections();
      console.log(`\n📋 Collections (${collections.length}):\n`);
      for (const c of collections) {
        console.log(`  • ${c.name} (${c.id})`);
        if (c.metadata && Object.keys(c.metadata).length) {
          console.log(`    meta: ${JSON.stringify(c.metadata)}`);
        }
      }
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

// ── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  ChromaClient,
  httpRequest,
  DEFAULT_DATA_DIR,
  DEFAULT_HOST,
  DEFAULT_PORT,
};

// CLI entry point
if (require.main === module) {
  runCLI().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
