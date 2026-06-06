/**
 * Tests for scripts/chroma-integration.js
 *
 * Strategy: mock `child_process.spawn` and `http.request` to test
 * the ChromaClient without needing a real ChromaDB server.
 */

const assert = require('assert');

// ── Mocks ────────────────────────────────────────────────────────────────────

let httpRequests = [];
let spawnCalls = [];
let mockServerRunning = false;
let mockResponseQueue = [];

// Override http.request before requiring the module
const http = require('http');
const originalRequest = http.request;
http.request = function(url, options, callback) {
  if (typeof url === 'string' && typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof url === 'object' && url.href) {
    options = { ...options, ...url };
  }

  const req = {
    _url: typeof url === 'string' ? url : (url?.href || url?.pathname || ''),
    _options: options,
    _body: '',
    write(chunk) { this._body += chunk; },
    end() {
      httpRequests.push({ url: this._url, options: this._options, body: this._body });
      const response = mockResponseQueue.shift() || { status: 500, body: '{}' };
      const res = {
        statusCode: response.status,
        headers: response.headers || {},
        _data: response.body,
        on(event, handler) {
          if (event === 'data') handler(Buffer.from(this._data));
          if (event === 'end') handler();
        },
      };
      callback(res);
    },
    on() {},
    destroy() {},
  };
  return req;
};

// Override child_process.spawn
const cp = require('child_process');
const originalSpawn = cp.spawn;
cp.spawn = function(command, args, opts) {
  spawnCalls.push({ command, args, opts });
  const proc = {
    pid: 12345,
    stdout: { on() {} },
    stderr: { on() {} },
    on(event, handler) {
      if (event === 'error') this._errorHandler = handler;
      if (event === 'exit') this._exitHandler = handler;
    },
    kill(signal) {
      mockServerRunning = false;
      this._killed = signal;
      return true;
    },
    _triggerExit(code) {
      if (this._exitHandler) this._exitHandler(code);
    },
    _triggerError(err) {
      if (this._errorHandler) this._errorHandler(err);
    },
  };
  // Simulate heartbeat becoming ready after a short delay
  if (command.includes('chroma') || args.includes('run')) {
    setTimeout(() => { mockServerRunning = true; }, 50);
  }
  return proc;
};

// Override child_process.execFile (used by _generateEmbeddings)
const originalExecFile = cp.execFile;
cp.execFile = function(file, args, opts, callback) {
  if (typeof opts === 'function') { callback = opts; opts = {}; }
  // Check if this is the embedding call
  if (args && args.includes('-c') && args.some(a => a.includes('DefaultEmbeddingFunction'))) {
    // Return mock embeddings for 1 or 2 texts
    const inputMatch = opts?.input || '';
    const count = (inputMatch.match(/,/g) || []).length + 1;
    const embeddings = [];
    for (let i = 0; i < count; i++) {
      embeddings.push(Array(384).fill(0).map((_, j) => (i + 1) * 0.01 + j * 0.0001));
    }
    callback(null, { stdout: JSON.stringify(embeddings), stderr: '' });
    return;
  }
  // For the chroma version check in _generateEmbeddings
  if (args && args.includes('--version')) {
    callback(null, { stdout: '1.5.9\n', stderr: '' });
    return;
  }
  callback(new Error('Unknown execFile call'));
};

// Override promisify to handle our mock execFile
const util = require('util');
util.promisify = function(fn) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
};

// Now require the module
const { ChromaClient } = require('../scripts/chroma-integration.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
  httpRequests = [];
  spawnCalls = [];
  mockResponseQueue = [];
  mockServerRunning = false;
}

function queueResponse(status, body, headers = {}) {
  mockResponseQueue.push({ status, body: JSON.stringify(body), headers });
}

// ── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  resetMocks();
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
    console.log(`     ${err.stack?.split('\n')[1]?.trim() || ''}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'Deep equal failed'}:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || 'Expected function to throw');
}

console.log('\nChromaDB Integration Tests\n');

// 1. Constructor defaults
test('constructor uses default options', () => {
  const client = new ChromaClient();
  assertEqual(client.host, '127.0.0.1', 'default host');
  assertEqual(client.port, 8000, 'default port');
  assertEqual(client.autoStart, true, 'default autoStart');
  assertEqual(client.tenant, 'default_tenant', 'default tenant');
  assertEqual(client.database, 'default_database', 'default database');
});

// 2. Constructor custom options
test('constructor accepts custom options', () => {
  const client = new ChromaClient({
    host: '0.0.0.0',
    port: 9000,
    autoStart: false,
    tenant: 'my_tenant',
    database: 'my_db',
  });
  assertEqual(client.host, '0.0.0.0', 'custom host');
  assertEqual(client.port, 9000, 'custom port');
  assertEqual(client.autoStart, false, 'custom autoStart');
  assertEqual(client.tenant, 'my_tenant', 'custom tenant');
  assertEqual(client.database, 'my_db', 'custom database');
});

// 3. isRunning - server up
test('isRunning returns true when heartbeat responds', async () => {
  const client = new ChromaClient({ autoStart: false });
  queueResponse(200, { status: 'ok' });
  const running = await client.isRunning();
  assertEqual(running, true, 'should be running');
  assertEqual(httpRequests.length, 1, 'one HTTP request');
  assertEqual(httpRequests[0].url.includes('/api/v2/heartbeat'), true, 'heartbeat path');
});

// 3b. isReal - server up
test('isReal returns true when heartbeat responds with object', async () => {
  const client = new ChromaClient({ autoStart: false });
  queueResponse(200, { status: 'ok' });
  const real = await client.isReal();
  assertEqual(real, true, 'should be real');
  assertEqual(httpRequests.length, 1, 'one HTTP request');
});

// 3c. isReal - server down (no response)
test('isReal returns false when heartbeat fails', async () => {
  const client = new ChromaClient({ autoStart: false });
  // Don't queue response → request will error → isReal returns false
  const real = await client.isReal();
  assertEqual(real, false, 'should not be real');
});

// 4. isRunning - server down
test('isRunning returns false when heartbeat fails', async () => {
  const client = new ChromaClient({ autoStart: false });
  // Don't queue response → request will error → isRunning returns false
  const running = await client.isRunning();
  assertEqual(running, false, 'should not be running');
});

// 5. start server
test('start spawns chroma process and waits for heartbeat', async () => {
  const client = new ChromaClient({ autoStart: false });
  queueResponse(200, { status: 'ok' }); // heartbeat response

  const result = await client.start();

  assertEqual(result.started, true, 'started flag');
  assertEqual(result.pid, 12345, 'pid');
  assertEqual(spawnCalls.length, 1, 'spawn called once');
  assertEqual(spawnCalls[0].command.includes('chroma'), true, 'chroma command');
  assertEqual(spawnCalls[0].args.includes('run'), true, 'run arg');
});

// 6. start when already running
test('start returns already-running when server up', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  const result = await client.start();

  assertEqual(result.started, false, 'not started');
  assertEqual(result.message.includes('already running'), true, 'message');
  assertEqual(spawnCalls.length, 0, 'no spawn call');
});

// 7. stop server
test('stop kills managed server', () => {
  const client = new ChromaClient({ autoStart: false });
  // Manually set up a fake server process
  const fakeProc = {
    pid: 9999,
    kill(signal) { this._killed = signal; return true; },
    on() {},
    stdout: { on() {} },
    stderr: { on() {} },
  };
  client._serverProcess = fakeProc;

  const result = client.stop();

  assertEqual(result.stopped, true, 'stopped flag');
  assertEqual(result.pid, 9999, 'pid');
});

// 8. stop when no server
test('stop returns not-running when no server', () => {
  const client = new ChromaClient({ autoStart: false });
  const result = client.stop();
  assertEqual(result.stopped, false, 'not stopped');
  assertEqual(result.message.includes('No managed server'), true, 'message');
});

// 9. ensureCollection - create new
test('ensureCollection creates collection when not exists', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  // First request: list collections (empty)
  queueResponse(200, []);
  // Second request: create collection
  queueResponse(200, { id: 'col-uuid-123', name: 'test-col', metadata: { type: 'test' } });

  const result = await client.ensureCollection('test-col', { type: 'test' });

  assertEqual(result.created, true, 'created flag');
  assertEqual(result.name, 'test-col', 'name');
  assertEqual(result.id, 'col-uuid-123', 'id');
});

// 10. ensureCollection - existing
test('ensureCollection returns existing collection', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  // List collections with existing
  queueResponse(200, [{ id: 'existing-id', name: 'existing-col', metadata: {} }]);

  const result = await client.ensureCollection('existing-col');

  assertEqual(result.created, false, 'not created');
  assertEqual(result.id, 'existing-id', 'existing id');
});

// 11. listCollections
test('listCollections returns parsed collection list', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  queueResponse(200, [
    { id: 'c1', name: 'conversations', metadata: { type: 'chat' }, dimension: 384, tenant: 't1', database: 'd1' },
    { id: 'c2', name: 'facts', metadata: { type: 'knowledge' }, dimension: 384, tenant: 't1', database: 'd1' },
  ]);

  const result = await client.listCollections();

  assertEqual(result.length, 2, 'two collections');
  assertEqual(result[0].name, 'conversations', 'first name');
  assertEqual(result[1].name, 'facts', 'second name');
  assertEqual(result[0].dimension, 384, 'dimension');
});

// 12. store document
test('store sends add request with embedding', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  // get collection id
  queueResponse(200, [{ id: 'col-123', name: 'conversations' }]);
  // add document
  queueResponse(200, {});

  const result = await client.store('Hello world', { source: 'test' }, 'conversations');

  assertEqual(result.stored, true, 'stored flag');
  assertEqual(result.collection, 'conversations', 'collection');
  assertEqual(typeof result.id, 'string', 'id is string');
  assertEqual(result.id.length, 36, 'id is UUID');

  // Verify the add request body
  const addReq = httpRequests.find(r => r.url.includes('/add'));
  assertEqual(!!addReq, true, 'add request exists');
  const body = JSON.parse(addReq.body);
  assertEqual(body.documents[0], 'Hello world', 'document text');
  assertEqual(body.metadatas[0].source, 'test', 'metadata');
});

// 13. search
test('search returns ranked results', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  // get collection id
  queueResponse(200, [{ id: 'col-123', name: 'conversations' }]);
  // query response
  queueResponse(200, {
    ids: [['id1', 'id2']],
    documents: [['Hello', 'World']],
    metadatas: [[{ source: 'a' }, { source: 'b' }]],
    distances: [[0.1, 0.5]],
  });

  const result = await client.search('hello', 'conversations', 2);

  assertEqual(result.length, 2, 'two results');
  assertEqual(result[0].id, 'id1', 'first id');
  assertEqual(result[0].document, 'Hello', 'first doc');
  assertEqual(result[0].metadata.source, 'a', 'first meta');
  assertEqual(result[0].distance, 0.1, 'first distance');
  assertEqual(result[1].distance, 0.5, 'second distance');
});

// 14. search empty results
test('search returns empty array for no matches', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  queueResponse(200, [{ id: 'col-123', name: 'conversations' }]);
  queueResponse(200, { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] });

  const result = await client.search('nomatch', 'conversations', 5);

  assertEqual(result.length, 0, 'empty results');
});

// 15. delete by ID
test('delete sends delete request', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  queueResponse(200, [{ id: 'col-123', name: 'conversations' }]);
  queueResponse(200, { deleted: 2 });

  const result = await client.delete(['id1', 'id2'], 'conversations');

  assertEqual(result.deleted, 2, 'deleted count');

  const delReq = httpRequests.find(r => r.url.includes('/delete'));
  const body = JSON.parse(delReq.body);
  assertDeepEqual(body.ids, ['id1', 'id2'], 'ids in body');
});

// 16. get by ID
test('get retrieves records by ID', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  queueResponse(200, [{ id: 'col-123', name: 'conversations' }]);
  queueResponse(200, {
    ids: ['id1'],
    documents: ['Hello'],
    metadatas: [{ source: 'test' }],
  });

  const result = await client.get('id1', 'conversations');

  assertEqual(result.length, 1, 'one result');
  assertEqual(result[0].id, 'id1', 'id');
  assertEqual(result[0].document, 'Hello', 'document');
});

// 17. deleteCollection
test('deleteCollection removes collection', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  queueResponse(200, [{ id: 'col-123', name: 'old-col' }]);
  queueResponse(200, {});

  const result = await client.deleteCollection('old-col');

  assertEqual(result.deleted, true, 'deleted flag');
  assertEqual(result.name, 'old-col', 'name');
});

// 18. collection cache
test('collection cache avoids repeated list calls', async () => {
  const client = new ChromaClient({ autoStart: false });
  mockServerRunning = true;

  // First call: list collections
  queueResponse(200, [{ id: 'col-123', name: 'cached-col' }]);
  // store call: add
  queueResponse(200, {});

  await client.store('text1', {}, 'cached-col');
  assertEqual(httpRequests.filter(r => r.url.includes('/collections') && !r.url.includes('/add')).length, 1, 'one list call');

  // Second store should use cache
  queueResponse(200, {});
  await client.store('text2', {}, 'cached-col');
  assertEqual(httpRequests.filter(r => r.url.includes('/collections') && !r.url.includes('/add')).length, 1, 'still one list call');
});

// 19. _ensureServer with autoStart
test('_ensureServer auto-starts when autoStart enabled', async () => {
  const client = new ChromaClient({ autoStart: true });
  queueResponse(200, { status: 'ok' }); // heartbeat in isRunning

  // Manually trigger _ensureServer through listCollections
  queueResponse(200, []);
  await client.listCollections();

  assertEqual(spawnCalls.length, 1, 'server was started');
});

// 20. _ensureServer without autoStart throws
test('_ensureServer throws when autoStart disabled and server down', async () => {
  const client = new ChromaClient({ autoStart: false });
  let threw = false;
  try {
    await client.listCollections();
  } catch (err) {
    threw = true;
    assertEqual(err.message.includes('not running'), true, 'error message');
  }
  assertEqual(threw, true, 'should throw');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
