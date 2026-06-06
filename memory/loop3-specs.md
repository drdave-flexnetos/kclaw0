# KClaw0 Loop 3 Implementation Specs — Concrete Adaptation Plans

**Date:** 2026-05-08
**Status:** Implementation-ready specifications for 20 new scripts + 4 governance files
**Target:** ~35,000 lines combined, 160+ new tests
**Build Order:** Tier 1 → Tier 2 → Tier 3 → Tier 4 → Tier 5 (5 weeks)

---

## Governance Files

### MISSION.md

**Purpose:** Constitutional document defining KClaw0's immutable scope, goals, and boundaries.

**Location:** `memory/MISSION.md`
**Immutable:** Yes (factory read-only)

**Content:**
```markdown
# KClaw0 Mission Constitution

## Identity
- Name: KClaw0
- Creature: Self-upgrading autonomous agent
- Owner: Dr Dave
- Core Purpose: Learn, persist knowledge, self-upgrade

## Scope (What We Do)
1. Persistent memory across sessions
2. Self-code analysis and modification
3. Knowledge graph construction
4. Subagent orchestration
5. Tool harness expansion
6. Workflow execution
7. 24/7 autonomous operation

## Boundaries (What We Do NOT Do)
1. Never modify governance files (MISSION.md, FACTORY_RULES.md, CLAUDE.md)
2. Never expose owner credentials or private data
3. Never execute destructive commands without confirmation
4. Never modify OpenClaw core infrastructure
5. Never self-replicate outside owner-approved boundaries
6. Never engage in unauthorized network access
7. Never modify `.gitignore` to hide changes
8. Never delete or corrupt the event log

## Success Metrics
- Knowledge retention: 100% across sessions
- Test pass rate: >=99%
- Cost per session: tracked and optimized
- Self-upgrade success rate: >=90%
- Human intervention rate: declining over time

## Owner Override
Dr Dave holds ultimate authority. Any self-decision can be overridden by owner request.
```

---

### FACTORY_RULES.md

**Purpose:** Operational rules for the Dark Factory / 24/7 orchestrator.

**Location:** `memory/FACTORY_RULES.md`
**Immutable:** Yes (factory read-only)

**Content:**
```markdown
# KClaw0 Factory Rules

## Autonomy Levels
- **Level 1 (Self-Directed):** Memory maintenance, wiki updates, ingest processing
- **Level 2 (Owner-Notified):** Code changes, new script creation, dependency installs
- **Level 3 (Owner-Approved):** Breaking changes, infrastructure changes, cost >$5

## Workflow Constraints
- Max 3 GitHub issues processed per day (non-owner)
- Max 2 validation retries per PR
- Every workflow node has maxBudgetUsd cap
- All changes must pass tests before merge
- Validator NEVER reads implementation plan (holdout pattern)

## GitHub State Machine
- Issues: triaging -> accepted -> in-progress -> PR or rejected
- PRs: implementing -> needs-review -> approved (auto-merge) or needs-fix
- Max 2 retries for needs-fix -> then needs-human
- Factory labels only: `factory:*` prefix

## Safety Rules
- Always backup before destructive operations
- Always run tests before merge
- Always log to event-system
- Always respect feature flags
- Always check budget before LLM calls
- Never bypass checkpoint system

## Economic Rules
- Default model: use most cost-effective capable model
- Track all costs via cost-tracker.js
- Alert if daily spend >$10
- Prefer cached results over fresh LLM calls
```

---

### CLAUDE.md

**Purpose:** Code style guide for all KClaw0 scripts.

**Location:** `memory/CLAUDE.md`
**Immutable:** Yes (factory read-only)

**Content:**
```markdown
# KClaw0 Code Style Guide

## General Principles
- Clean code, clear logic, minimal overhead
- Efficiency is elegance
- The best solution teaches you something

## File Organization
```
#!/usr/bin/env node
/**
 * File Name
 * One-line description
 *
 * Usage: node scripts/file.js [command] [args]
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

// ============================================================================
// Utility Functions
// ============================================================================

// ============================================================================
// Core Classes
// ============================================================================

// ============================================================================
// CLI
// ============================================================================
```

## Naming Conventions
- Files: `kebab-case.js`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leadingUnderscore`

## Error Handling
- Always try/catch file operations
- Return `{ success: false, error: string }` objects, not thrown errors
- Log errors to event-system before returning
- Never swallow errors silently

## Data Formats
- Logs: NDJSON (newline-delimited JSON)
- Config: JSON with 2-space indent
- State: JSON or SQLite
- Cache: JSON with timestamp fields

## Testing
- Every script has a matching `tests/<name>.test.js`
- Minimum 8 assertions per script
- Mock external dependencies
- Test error paths, not just happy paths
```

---

### feature-flags.json

**Purpose:** Capability toggles for gradual rollout and safe experimentation.

**Location:** `memory/feature-flags.json`
**Mutable:** Yes (owner or factory can toggle)

**Schema:**
```json
{
  "version": 1,
  "updated": "2026-05-08T00:00:00Z",
  "flags": {
    "docker-exec": false,
    "chroma-db": false,
    "lancedb": false,
    "web-search": true,
    "browser-tool": true,
    "task-tool": false,
    "agent-dispatch": false,
    "workflow-engine": false,
    "dark-factory": false,
    "github-integration": false,
    "rpc-server": false,
    "metrics-dashboard": false,
    "hook-manager": false,
    "extension-loader": false,
    "ingest-queue": false,
    "wiki-engine": false,
    "knowledge-graph-v2": false,
    "vector-store": false,
    "deep-research": false,
    "session-compaction": false,
    "auto-checkpoint": true,
    "cost-tracking": true,
    "loop-detection": true,
    "steering-queue": true,
    "followup-queue": true
  },
  "environments": {
    "development": {
      "docker-exec": true,
      "chroma-db": true
    },
    "production": {
      "dark-factory": true,
      "github-integration": true
    }
  }
}
```

---

## Script Specifications

### scripts/tool-registry.js

**Purpose:** Dynamic tool registration, discovery, and feature-gated availability. Every capability is exposed as a tool the LLM can invoke. Foundation for all other systems.

**API:**
```javascript
class ToolRegistry {
  constructor(flagsPath = 'memory/feature-flags.json')
  register(tool: AgentTool): { success: boolean, error?: string }
  unregister(name: string): boolean
  get(name: string): AgentTool | null
  list(): AgentTool[]
  discover(query: string): AgentTool[]
  isEnabled(featureFlag: string): boolean
  execute(name: string, args: object, context: ExecutionContext): Promise<ToolResult>
}

class AgentTool {
  constructor(spec: ToolSpec)
  name: string; description: string; parameters: JSONSchema
  featureFlag: string | null
  execute(args: object, context: ExecutionContext): Promise<ToolResult>
}
```

**Data Structures:**
```javascript
// ToolSpec
{ name: string, description: string, parameters: object, featureFlag: string,
  execute: function, category: string }

// ToolResult
{ success: boolean, output: any, error?: string, cost?: number,
  durationMs?: number, artifacts?: string[] }

// ExecutionContext
{ sessionId: string, turnIndex: number, agentId: string,
  abortSignal?: AbortSignal, budgetRemaining?: number }

// Registry state (memory/tool-registry.json)
{ version: 1, tools: [{ name, description, category, enabled, registeredAt }],
  categories: ['file', 'exec', 'memory', 'agent', 'research', 'workflow'],
  lastUpdated: string }
```

**Dependencies:** `event-system.js`, `feature-flags.json`

**Test Plan:**
1. Register a tool and retrieve it by name
2. Unregister a tool and confirm removal
3. Discover tools with fuzzy query matching
4. Feature gate blocks disabled tools
5. Feature gate allows enabled tools
6. Execute tool with valid args returns success
7. Execute tool with invalid args returns error
8. Execute tool with disabled feature flag returns error
9. List returns all registered tools sorted by category
10. ToolChoiceQueue priority ordering

**Code Sketch:**
```javascript
class ToolRegistry {
  constructor(flagsPath = 'memory/feature-flags.json') {
    this.tools = new Map();
    this.flags = this._loadFlags(flagsPath);
  }
  register(tool) {
    if (this.tools.has(tool.name))
      return { success: false, error: `Tool "${tool.name}" already registered` };
    if (tool.featureFlag && !this.isEnabled(tool.featureFlag)) tool._disabled = true;
    this.tools.set(tool.name, tool);
    emitEvent('tool_registered', { name: tool.name, category: tool.category });
    this._saveState();
    return { success: true };
  }
  get(name) { return this.tools.get(name) || null; }
  list() {
    return Array.from(this.tools.values()).filter(t => !t._disabled)
      .sort((a, b) => a.category.localeCompare(b.category));
  }
  discover(query) {
    const q = query.toLowerCase();
    return this.list().filter(t =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }
  isEnabled(flag) {
    const env = process.env.KCLAW0_ENV || 'development';
    return this.flags.environments?.[env]?.[flag] ?? this.flags.flags?.[flag] ?? false;
  }
  async execute(name, args, context) {
    const tool = this.get(name);
    if (!tool) return { success: false, error: `Unknown tool: ${name}` };
    if (tool._disabled) return { success: false, error: `Tool "${name}" is disabled` };
    const start = Date.now();
    try {
      emitEvent('tool_call', { name, args, sessionId: context.sessionId });
      const result = await tool.execute(args, context);
      emitEvent('tool_result', { name, durationMs: Date.now() - start });
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      emitEvent('tool_error', { name, error: err.message });
      return { success: false, error: err.message, durationMs: Date.now() - start };
    }
  }
}
```

---

### scripts/job-queue.js

**Purpose:** SQLite-backed durable async job queue with retry semantics, worker claims, and crash recovery.

**API:**
```javascript
class JobQueue {
  constructor(dbPath = 'memory/job-queue.sqlite')
  enqueue(job: JobSpec): Promise<string>
  claim(workerId: string): Promise<Job | null>
  complete(jobId: string, result: object): Promise<void>
  fail(jobId: string, error: string): Promise<void>
  cancel(jobId: string): Promise<void>
  stats(): Promise<QueueStats>
  purge(olderThanDays: number = 7): Promise<number>
}
```

**Data Structures:**
```javascript
// JobSpec
{ type: string, payload: object, priority: number, maxRetries: number,
  retryDelayMs: number, idempotencyKey: string, timeoutMs: number,
  scheduledAt: string }

// Job (DB record)
{ id: string, type: string, payload: string, status: 'pending'|'claimed'|'running'|
  'completed'|'failed'|'cancelled'|'dead_letter', priority: number, attempts: number,
  maxRetries: number, retryDelayMs: number, idempotencyKey: string|null,
  workerId: string|null, claimedAt: string|null, completedAt: string|null,
  failedAt: string|null, lastError: string|null, result: string|null,
  createdAt: string, updatedAt: string }

// QueueStats
{ pending: number, running: number, completed: number, failed: number,
  deadLetter: number, averageDurationMs: number }
```

**Dependencies:** `event-system.js`, `tool-registry.js`

**Test Plan:**
1. Enqueue job and verify pending status
2. Claim job marks it claimed with workerId
3. Complete job transitions to completed
4. Fail job increments attempts, stays pending if retries left
5. Max retries exceeded -> dead_letter
6. Idempotency key prevents duplicate enqueue
7. Priority ordering: higher priority claimed first
8. ScheduledAt future job not claimed until time
9. Cancel transitions to cancelled
10. Purge removes old completed jobs

**Code Sketch:**
```javascript
class JobQueue {
  constructor(dbPath = 'memory/job-queue.sqlite') {
    this.db = new sqlite3.Database(dbPath);
    this._initSchema();
  }
  _initSchema() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending', priority INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0, maxRetries INTEGER DEFAULT 3,
      retryDelayMs INTEGER DEFAULT 5000, idempotencyKey TEXT UNIQUE,
      workerId TEXT, claimedAt TEXT, completedAt TEXT, failedAt TEXT,
      lastError TEXT, result TEXT, createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_status_priority ON jobs(status, priority DESC, createdAt);
      CREATE INDEX IF NOT EXISTS idx_idempotency ON jobs(idempotencyKey);`);
  }
  async enqueue(spec) {
    const id = generateId();
    if (spec.idempotencyKey) {
      const existing = await this._getByIdempotency(spec.idempotencyKey);
      if (existing) return existing.id;
    }
    await this._run(`INSERT INTO jobs (id, type, payload, priority, maxRetries,
      retryDelayMs, idempotencyKey, scheduledAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, spec.type, JSON.stringify(spec.payload), spec.priority || 0,
       spec.maxRetries || 3, spec.retryDelayMs || 5000,
       spec.idempotencyKey || null, spec.scheduledAt || new Date().toISOString()]);
    emitEvent('job_enqueued', { id, type: spec.type });
    return id;
  }
  async claim(workerId) {
    const job = await this._getOne(`SELECT * FROM jobs WHERE status = 'pending'
      AND scheduledAt <= datetime('now') ORDER BY priority DESC, createdAt ASC LIMIT 1`);
    if (!job) return null;
    await this._run(`UPDATE jobs SET status = 'claimed', workerId = ?,
      claimedAt = ?, attempts = attempts + 1 WHERE id = ? AND status = 'pending'`,
      [workerId, new Date().toISOString(), job.id]);
    emitEvent('job_claimed', { id: job.id, workerId });
    return { ...job, status: 'claimed' };
  }
  async complete(jobId, result) {
    await this._run(`UPDATE jobs SET status = 'completed', result = ?,
      completedAt = ?, updatedAt = ? WHERE id = ?`,
      [JSON.stringify(result), new Date().toISOString(), new Date().toISOString(), jobId]);
    emitEvent('job_completed', { id: jobId });
  }
  async fail(jobId, error) {
    const job = await this._getOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (job.attempts >= job.maxRetries) {
      await this._run(`UPDATE jobs SET status = 'dead_letter', lastError = ?,
        updatedAt = ? WHERE id = ?`, [error, new Date().toISOString(), jobId]);
      emitEvent('job_dead_letter', { id: jobId, error });
    } else {
      const delay = job.retryDelayMs * Math.pow(2, job.attempts - 1);
      const nextAttempt = new Date(Date.now() + delay).toISOString();
      await this._run(`UPDATE jobs SET status = 'pending', lastError = ?,
        scheduledAt = ?, updatedAt = ? WHERE id = ?`,
        [error, nextAttempt, new Date().toISOString(), jobId]);
    }
  }
}
```

---

### scripts/session-manager.js

**Purpose:** JSONL v3 session storage with blob store for attachments. Multi-session lifecycle, auto-compaction, and branching.

**API:**
```javascript
class SessionManager {
  constructor(baseDir = 'memory/sessions/')
  create(title?: string): Session
  load(sessionId: string): Session
  list(): SessionHeader[]
  compact(sessionId: string): Promise<Session>
  branch(sessionId: string, reason: string): Promise<string>
  storeBlob(sessionId: string, data: Buffer, mimeType: string): string
  resolveBlob(blobId: string): Buffer
}
class Session {
  append(record: SessionRecord): void
  read(offset?: number, limit?: number): SessionRecord[]
  getMetadata(): SessionMetadata
  getTokenCount(): number
}
```

**Data Structures:**
```javascript
// SessionHeader
{ type: 'session_header', version: 3, id: string, title: string,
  createdAt: string, model: string, agentProfile: string }

// SessionRecord
{ type: string, timestamp: string, turnIndex: number, sequence: number,
  data: object, blobRefs?: string[] }

// SessionMetadata
{ id: string, title: string, recordCount: number, createdAt: string,
  lastActivityAt: string, branches: string[], isCompacted: boolean }

// BlobRecord
{ id: string, sessionId: string, mimeType: string, size: number,
  sha256: string, storedAt: string, dataPath: string }

// Layout: memory/sessions/{id}.jsonl, {id}.meta.json, blobs/{blobId}.bin, blobs/index.json
```

**Dependencies:** `event-system.js`, `checkpoint.js`, `cost-tracker.js`

**Test Plan:**
1. Create session writes valid JSONL header
2. Append record increments sequence
3. Read with offset/limit returns correct slice
4. Store and resolve blob round-trips binary data
5. Compact creates summary and reduces size
6. Branch creates new session with summary as first record
7. List returns all sessions sorted by lastActivity
8. Delete removes session file and metadata
9. Token count estimation is monotonic
10. Blob deduplication via SHA256

**Code Sketch:**
```javascript
class SessionManager {
  constructor(baseDir = 'memory/sessions/') {
    this.baseDir = baseDir;
    this.blobDir = path.join(baseDir, 'blobs');
    ensureDir(this.baseDir); ensureDir(this.blobDir);
  }
  create(title = 'Untitled Session') {
    const id = generateSnowflakeId();
    const header = { type: 'session_header', version: 3, id, title,
      createdAt: new Date().toISOString(),
      model: process.env.KCLAW0_DEFAULT_MODEL || 'default' };
    const filepath = path.join(this.baseDir, `${id}.jsonl`);
    fs.writeFileSync(filepath, JSON.stringify(header) + '\n');
    emitEvent('session_created', { id, title });
    return new Session(header, filepath);
  }
  load(id) {
    const filepath = path.join(this.baseDir, `${id}.jsonl`);
    if (!fs.existsSync(filepath)) throw new Error(`Session ${id} not found`);
    const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n');
    return new Session(JSON.parse(lines[0]), filepath);
  }
  storeBlob(sessionId, data, mimeType) {
    const sha = crypto.createHash('sha256').update(data).digest('hex');
    const blobs = this._loadBlobIndex();
    const existing = blobs.find(b => b.sha256 === sha);
    if (existing) return existing.id;
    const id = `blob-${generateSnowflakeId()}`;
    const dataPath = path.join(this.blobDir, `${id}.bin`);
    fs.writeFileSync(dataPath, data);
    blobs.push({ id, sessionId, mimeType, size: data.length, sha256: sha,
      storedAt: new Date().toISOString(), dataPath });
    this._saveBlobIndex(blobs);
    return id;
  }
  compact(sessionId) {
    const session = this.load(sessionId);
    const records = session.read();
    const compactRecord = { type: 'compact_summary', timestamp: new Date().toISOString(),
      originalCount: records.length, summary: this._generateSummary(records),
      tokenCount: this._estimateTokens(records) };
    const compacted = [session.header, compactRecord, ...records.slice(-10)];
    const filepath = path.join(this.baseDir, `${sessionId}.jsonl`);
    fs.writeFileSync(filepath, compacted.map(r => JSON.stringify(r)).join('\n') + '\n');
    emitEvent('session_compacted', { id: sessionId, originalCount: records.length });
    return this.load(sessionId);
  }
}
```

---

### scripts/agent-registry.js

**Purpose:** Process-global agent tracking for all alive agents (main + subagents).

**API:**
```javascript
class AgentRegistry {
  constructor()
  register(spec: AgentSpec): string
  unregister(agentId: string): boolean
  get(agentId: string): AgentDescriptor | null
  list(status?: AgentStatus): AgentDescriptor[]
  updateStatus(agentId: string, status: AgentStatus): void
  updateOutput(agentId: string, output: string): void
  subscribe(event: AgentEventType, handler: Function): () => void
  emit(event: AgentEventType, data: object): void
}
```

**Data Structures:**
```javascript
// AgentSpec
{ name: string, type: 'main'|'subagent'|'daemon'|'worker', model: string,
  profile: string, parentId?: string, isolationType?: string,
  maxBudgetUsd?: number, timeoutMs?: number }

// AgentDescriptor (extends AgentSpec)
{ id: string, status: AgentStatus, spawnedAt: string, completedAt?: string,
  artifacts: string[], outputPath: string }

// AgentStatus: 'idle' | 'running' | 'completed' | 'aborted' | 'failed'

// Registry state (memory/agent-registry.json)
{ version: 1, agents: [AgentDescriptor], activeCount: number,
  totalSpawned: number, totalCompleted: number, totalFailed: number,
  lastUpdated: string }
```

**Dependencies:** `event-system.js`, `agent-profiles.js`

**Test Plan:**
1. Register generates unique ID
2. Get returns correct descriptor
3. UpdateStatus persists to state
4. List filters by status
5. Unregister removes from active but keeps history
6. Subscribe receives events
7. Unsubscribe stops receiving
8. Parent-child relationship tracked
9. Artifacts accumulate
10. State file is valid JSON

**Code Sketch:**
```javascript
class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.history = [];
    this.subscribers = new Map();
    this.statePath = 'memory/agent-registry.json';
    this._loadState();
  }
  register(spec) {
    const id = `agent-${generateSnowflakeId()}`;
    const agent = { id, ...spec, status: 'idle', spawnedAt: new Date().toISOString(),
      artifacts: [], outputPath: `memory/agent-outputs/${id}.jsonl`,
      maxBudgetUsd: spec.maxBudgetUsd || 1.0, timeoutMs: spec.timeoutMs || 300000 };
    this.agents.set(id, agent);
    this._saveState();
    this.emit('spawned', { agentId: id, parentId: spec.parentId });
    emitEvent('subagent_spawn', { agentId: id, name: spec.name, model: spec.model });
    return id;
  }
  updateStatus(id, status) {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.status = status;
    if (['completed', 'failed', 'aborted'].includes(status)) {
      agent.completedAt = new Date().toISOString();
      this.history.push({ ...agent });
    }
    this._saveState();
    this.emit('status_change', { agentId: id, status });
    return true;
  }
  updateOutput(id, output) {
    const agent = this.agents.get(id);
    if (!agent) return;
    fs.appendFileSync(agent.outputPath,
      JSON.stringify({ timestamp: new Date().toISOString(), output }) + '\n');
    this.emit('output', { agentId: id, output });
  }
  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) this.subscribers.set(eventType, new Set());
    this.subscribers.get(eventType).add(handler);
    return () => this.subscribers.get(eventType).delete(handler);
  }
  emit(eventType, data) {
    const handlers = this.subscribers.get(eventType);
    if (handlers) handlers.forEach(h => { try { h(data); } catch (e) {} });
  }
  _saveState() {
    fs.writeFileSync(this.statePath, JSON.stringify({
      version: 1, agents: Array.from(this.agents.values()),
      activeCount: Array.from(this.agents.values()).filter(a =>
        ['idle', 'running'].includes(a.status)).length,
      totalSpawned: this.history.length + this.agents.size,
      totalCompleted: this.history.filter(h => h.status === 'completed').length,
      totalFailed: this.history.filter(h => h.status === 'failed').length,
      lastUpdated: new Date().toISOString()
    }, null, 2));
  }
}
```

---

### scripts/task-tool.js

**Purpose:** Subagent orchestration adapted from oh-my-pi. Spawns subagents for parallel execution with isolation, output streaming, and result consolidation.

**API:**
```javascript
class TaskTool {
  constructor(registry: AgentRegistry, dispatch: AgentDispatch, isolation: IsolationManager)
  spawn(task: TaskSpec): Promise<string>
  map(items: any[], spec: TaskSpec, options?: MapOptions): Promise<TaskResult[]>
  poll(subagentId: string, timeoutMs?: number): Promise<TaskResult>
  consolidate(results: TaskResult[]): ConsolidatedResult
}
```

**Data Structures:**
```javascript
// TaskSpec
{ agentProfile: string, task: string, inputs?: object, model?: string,
  isolation?: 'none'|'git_worktree', maxOutputBytes?: number,
  maxOutputLines?: number, parentContext?: object }

// TaskResult
{ agentId: string, status: 'success'|'error'|'timeout'|'aborted',
  output: string, artifacts: string[], durationMs: number, costUsd?: number,
  error?: string, turnCount?: number }

// MapOptions
{ concurrency: number, failFast: boolean, abortSignal?: AbortSignal }

// ConsolidatedResult
{ allSucceeded: boolean, results: TaskResult[], summary: string,
  combinedArtifacts: string[] }

// State (memory/task-tool-state.json)
{ version: 1, activeTasks: [...], completedTasks: [...], totalTasksRun: number,
  totalFailures: number, averageDurationMs: number }
```

**Dependencies:** `agent-registry.js`, `agent-dispatch.js`, `isolation-manager.js`, `agent-profiles.js`, `event-system.js`

**Test Plan:**
1. Spawn with valid profile returns agentId
2. Poll returns result after completion
3. Map runs items in parallel with concurrency limit
4. failFast aborts remaining on first error
5. Output streaming receives chunks in order
6. Consolidation produces summary
7. Isolation worktree created before spawn
8. Max output bytes/lines truncates if exceeded
9. Parent context forwarded to subagent
10. Timeout aborts long-running task

**Code Sketch:**
```javascript
class TaskTool {
  constructor(registry, dispatch, isolation) {
    this.registry = registry; this.dispatch = dispatch; this.isolation = isolation;
    this.statePath = 'memory/task-tool-state.json'; this._loadState();
  }
  async spawn(spec) {
    const profile = this._resolveProfile(spec.agentProfile);
    const isolationCtx = spec.isolation !== 'none'
      ? await this.isolation.create(spec.isolation) : null;
    const agentId = this.registry.register({
      name: spec.agentProfile, type: 'subagent',
      model: spec.model || profile.model, profile: spec.agentProfile,
      parentId: spec.parentContext?.sessionId,
      maxBudgetUsd: spec.maxBudgetUsd || profile.maxBudgetUsd || 1.0 });
    const taskData = { task: spec.task, inputs: spec.inputs || {},
      profile: profile.content, isolationPath: isolationCtx?.worktreePath,
      maxOutputBytes: spec.maxOutputBytes || 500000,
      maxOutputLines: spec.maxOutputLines || 5000 };
    this.registry.updateStatus(agentId, 'running');
    const startTime = Date.now();
    this.dispatch.run(agentId, taskData, {
      onOutput: (chunk) => this.registry.updateOutput(agentId, chunk),
      onComplete: (result) => {
        this.registry.updateStatus(agentId, result.status === 'success' ? 'completed' : 'failed');
        this._recordCompletion(agentId, result, Date.now() - startTime);
        if (isolationCtx) this.isolation.destroy(isolationCtx);
      }
    });
    emitEvent('subagent_spawn', { agentId, profile: spec.agentProfile, task: spec.task });
    return agentId;
  }
  async map(items, spec, options = {}) {
    const concurrency = options.concurrency || 3;
    const results = []; let aborted = false;
    const runItem = async (item, index) => {
      if (aborted) return { status: 'aborted', output: '' };
      const itemSpec = { ...spec, task: `${spec.task}\nInput: ${JSON.stringify(item)}`,
        inputs: { ...spec.inputs, _index: index, _item: item } };
      const agentId = await this.spawn(itemSpec);
      try {
        const result = await this.poll(agentId, spec.timeoutMs || 300000);
        if (result.status !== 'success' && options.failFast) aborted = true;
        return result;
      } catch (err) {
        if (options.failFast) aborted = true;
        return { status: 'error', error: err.message, output: '' };
      }
    };
    const executing = new Set();
    for (let i = 0; i < items.length; i++) {
      const p = runItem(items[i], i).then(r => { results[i] = r; executing.delete(p); return r; });
      executing.add(p);
      if (executing.size >= concurrency) await Promise.race(executing);
      if (aborted && options.failFast) break;
    }
    await Promise.all(executing);
    return results;
  }
  async poll(agentId, timeoutMs = 300000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const agent = this.registry.get(agentId);
      if (!agent) throw new Error(`Agent ${agentId} not found`);
      if (['completed', 'failed', 'aborted'].includes(agent.status)) {
        const output = fs.existsSync(agent.outputPath)
          ? fs.readFileSync(agent.outputPath, 'utf8') : '';
        return { agentId, status: agent.status === 'completed' ? 'success' : agent.status,
          output, artifacts: agent.artifacts, durationMs: Date.now() - start };
      }
      await sleep(1000);
    }
    this.registry.updateStatus(agentId, 'aborted');
    return { agentId, status: 'timeout', output: '', error: 'Polling timeout' };
  }
  consolidate(results) {
    return { allSucceeded: results.every(r => r.status === 'success'),
      results, summary: this._generateSummary(results),
      combinedArtifacts: results.flatMap(r => r.artifacts || []) };
  }
}
```

---

### scripts/agent-profiles.js

**Purpose:** Markdown agent definitions with YAML frontmatter. Profiles in `memory/agents/*.md`.

**API:**
```javascript
class AgentProfileRegistry {
  constructor(dir = 'memory/agents/')
  load(name: string): AgentProfile | null
  list(): AgentProfileSummary[]
  discover(): number
  create(spec: AgentProfileSpec): void
  update(name: string, spec: Partial<AgentProfileSpec>): void
  delete(name: string): boolean
}
```

**Data Structures:**
```javascript
// AgentProfile
{ name: string, description: string, tools: string[], model: string,
  thinkingLevel: string, maxBudgetUsd: number, maxOutputBytes: number,
  maxOutputLines: number, content: string }

// Built-in profiles: explorer, planner, designer, reviewer, task, quick_task
```

**Dependencies:** `tool-registry.js`, `event-system.js`

**Test Plan:**
1. Load parses YAML frontmatter and body
2. Discover scans directory
3. Create writes valid .md
4. Update modifies frontmatter
5. Delete removes file
6. List returns all profiles
7. Invalid frontmatter returns error
8. Unknown tool emits warning
9. Content accessible as system prompt
10. Built-ins always available

**Code Sketch:**
```javascript
class AgentProfileRegistry {
  constructor(dir = 'memory/agents/') {
    this.dir = dir;
    this.builtins = new Map([
      ['explorer', { name: 'explorer', description: 'Explores codebase',
        tools: ['read', 'find', 'grep', 'bash'], model: 'default',
        thinkingLevel: 'medium', maxBudgetUsd: 0.5,
        content: 'You are a codebase explorer...' }],
      ['reviewer', { name: 'reviewer', description: 'Reviews code',
        tools: ['read', 'edit', 'bash'], model: 'default',
        thinkingLevel: 'high', maxBudgetUsd: 1.0,
        content: 'You are a code reviewer...' }]
    ]);
    ensureDir(this.dir); this.discover();
  }
  load(name) {
    const filepath = path.join(this.dir, `${name}.md`);
    if (fs.existsSync(filepath)) return this._parseFile(filepath);
    return this.builtins.get(name) || null;
  }
  _parseFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error(`Invalid frontmatter in ${filepath}`);
    const meta = this._parseYaml(match[1]);
    return { name: meta.name, description: meta.description, tools: meta.tools || [],
      model: meta.model || 'default', thinkingLevel: meta.thinkingLevel || 'medium',
      maxBudgetUsd: meta.maxBudgetUsd || 1.0,
      maxOutputBytes: meta.maxOutputBytes || 500000,
      maxOutputLines: meta.maxOutputLines || 5000, content: match[2].trim() };
  }
  _parseYaml(yaml) {
    const result = {};
    for (const line of yaml.split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) {
        const [, k, v] = m;
        if (v.startsWith('[')) result[k] = v.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
        else if (v === 'true') result[k] = true;
        else if (v === 'false') result[k] = false;
        else if (!isNaN(Number(v))) result[k] = Number(v);
        else result[k] = v.replace(/"/g, '');
      }
    }
    return result;
  }
  discover() {
    if (!fs.existsSync(this.dir)) return 0;
    const files = fs.readdirSync(this.dir).filter(f => f.endsWith('.md'));
    emitEvent('profiles_discovered', { count: files.length });
    return files.length;
  }
  create(spec) {
    const filepath = path.join(this.dir, `${spec.name}.md`);
    if (fs.existsSync(filepath)) throw new Error(`Profile ${spec.name} exists`);
    const yaml = Object.entries(spec).filter(([k]) => k !== 'content')
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.map(s => `"${s}"`).join(', ') + ']' : `"${v}"`}`)
      .join('\n');
    fs.writeFileSync(filepath, `---\n${yaml}\n---\n\n${spec.content}\n`);
    emitEvent('profile_created', { name: spec.name });
  }
}
```

---

### scripts/agent-dispatch.js

**Purpose:** Parallel execution with concurrency limits and abort signal support.

**API:**
```javascript
class AgentDispatch {
  constructor(registry: AgentRegistry, maxConcurrency: number = 3)
  run(agentId: string, taskData: object, callbacks?: RunCallbacks): Promise<TaskResult>
  parallel(tasks: ParallelTask[], options?: ParallelOptions): Promise<TaskResult[]>
  sequential(tasks: ParallelTask[]): Promise<TaskResult[]>
  activeCount(): number
  abortAll(): void
}
```

**Data Structures:**
```javascript
// RunCallbacks
{ onOutput?: (chunk: string) => void, onComplete?: (result: TaskResult) => void,
  onError?: (error: Error) => void }

// ParallelOptions
{ concurrency?: number, failFast?: boolean, abortSignal?: AbortSignal }

// State (memory/agent-dispatch.json)
{ version: 1, running: [...], completed: [...], maxConcurrency: number,
  totalDispatched: number, totalCompleted: number, totalFailed: number }
```

**Dependencies:** `agent-registry.js`, `llm-client.js`, `event-system.js`

**Test Plan:**
1. Run single agent completes
2. Parallel with limit runs at most N simultaneously
3. failFast aborts remaining on error
4. AbortSignal cancels agents
5. ActiveCount is correct
6. Sequential runs in order
7. Callbacks fire correctly
8. Budget exceeded triggers abort
9. Timeout kills stuck agent
10. Result includes duration and cost

**Code Sketch:**
```javascript
class AgentDispatch {
  constructor(registry, maxConcurrency = 3) {
    this.registry = registry; this.maxConcurrency = maxConcurrency;
    this.running = new Map();
    this.statePath = 'memory/agent-dispatch.json';
  }
  async run(agentId, taskData, callbacks = {}) {
    const abortController = new AbortController();
    const startTime = Date.now();
    this.running.set(agentId, { abortController, startTime });
    this.registry.updateStatus(agentId, 'running');
    try {
      const result = await this._executeTask(agentId, taskData, abortController.signal, callbacks);
      this.running.delete(agentId);
      this.registry.updateStatus(agentId, 'completed');
      callbacks.onComplete?.(result);
      emitEvent('agent_completed', { agentId, durationMs: Date.now() - startTime });
      return { ...result, durationMs: Date.now() - startTime };
    } catch (err) {
      this.running.delete(agentId);
      this.registry.updateStatus(agentId, 'failed');
      callbacks.onError?.(err);
      emitEvent('agent_failed', { agentId, error: err.message });
      throw err;
    }
  }
  async _executeTask(agentId, taskData, signal, callbacks) {
    const chunks = [];
    const llm = require('./llm-client');
    const response = await llm.complete({
      model: taskData.model, system: taskData.profile?.content,
      messages: [{ role: 'user', content: taskData.task }],
      onChunk: (chunk) => { if (!signal.aborted) { chunks.push(chunk); callbacks.onOutput?.(chunk); } },
      signal
    });
    return { agentId, status: 'success', output: chunks.join(''), artifacts: [], turnCount: 1 };
  }
  async parallel(tasks, options = {}) {
    const concurrency = options.concurrency || this.maxConcurrency;
    const failFast = options.failFast || false;
    const results = []; let aborted = false;
    const pool = new Array(concurrency).fill(Promise.resolve());
    let taskIndex = 0;
    const nextTask = async () => {
      if (aborted && failFast) return;
      const idx = taskIndex++; if (idx >= tasks.length) return;
      const task = tasks[idx];
      try {
        const result = await this.run(task.agentId, task.taskData, task.callbacks);
        results[idx] = result;
        if (result.status !== 'success' && failFast) aborted = true;
      } catch (err) {
        results[idx] = { agentId: task.agentId, status: 'error', error: err.message, output: '' };
        if (failFast) aborted = true;
      }
    };
    await Promise.all(pool.map(p => p.then(() => {
      const chain = () => nextTask().then(() => {
        if (taskIndex < tasks.length && !(aborted && failFast)) return chain();
      });
      return chain();
    })));
    return results;
  }
  abortAll() {
    for (const [agentId, { abortController }] of this.running) {
      abortController.abort();
      this.registry.updateStatus(agentId, 'aborted');
    }
    this.running.clear();
  }
  activeCount() { return this.running.size; }
}
```

---

### scripts/isolation-manager.js

**Purpose:** Git worktree isolation for subagent execution.

**API:**
```javascript
class IsolationManager {
  constructor(repoRoot = process.cwd())
  create(type = 'git_worktree'): Promise<IsolationContext>
  destroy(ctx: IsolationContext): Promise<void>
  list(): IsolationContext[]
  get(agentId: string): IsolationContext | null
  syncIn(ctx, sourcePath, destRelativePath): void
  syncOut(ctx, sourceRelativePath, destPath): void
}
```

**Data Structures:**
```javascript
// IsolationContext
{ id: string, type: 'git_worktree'|'docker', worktreePath: string,
  createdAt: string, agentId?: string, originalBranch: string }

// State (memory/isolation-state.json)
{ version: 1, active: [IsolationContext], history: [...],
  totalCreated: number, totalActive: number }

// Layout: memory/worktrees/{id}/ (git worktree)
```

**Dependencies:** `event-system.js`, `agent-registry.js`

**Test Plan:**
1. Create git worktree succeeds
2. Destroy removes worktree
3. SyncIn copies file into worktree
4. SyncOut copies file from worktree
5. List returns active contexts
6. Get by agentId returns correct context
7. Worktree has clean tracked files
8. Changes don't affect main repo
9. Multiple worktrees are independent
10. Destroy cleans up git reference

**Code Sketch:**
```javascript
class IsolationManager {
  constructor(repoRoot = process.cwd()) {
    this.repoRoot = repoRoot;
    this.baseDir = path.join(repoRoot, 'memory', 'worktrees');
    this.statePath = path.join(repoRoot, 'memory', 'isolation-state.json');
    ensureDir(this.baseDir);
  }
  async create(type = 'git_worktree') {
    const id = `wt-${generateSnowflakeId()}`;
    const worktreePath = path.join(this.baseDir, id);
    if (type === 'git_worktree') {
      const branchName = `kclaw0-isolation-${id}`;
      execSync(`git branch ${branchName}`, { cwd: this.repoRoot });
      execSync(`git worktree add ${worktreePath} ${branchName}`, { cwd: this.repoRoot });
      const tracked = execSync('git ls-files', { cwd: this.repoRoot, encoding: 'utf8' }).trim().split('\n');
      for (const file of tracked) {
        const src = path.join(this.repoRoot, file);
        const dest = path.join(worktreePath, file);
        ensureDir(path.dirname(dest)); fs.copyFileSync(src, dest);
      }
    } else throw new Error(`Isolation type ${type} not yet implemented`);
    const ctx = { id, type, worktreePath, createdAt: new Date().toISOString(), originalBranch: 'main' };
    this._addActive(ctx);
    emitEvent('isolation_created', { id, type, worktreePath });
    return ctx;
  }
  async destroy(ctx) {
    if (ctx.type === 'git_worktree') {
      execSync(`git worktree remove ${ctx.worktreePath} --force`, { cwd: this.repoRoot });
      try { execSync(`git branch -D kclaw0-isolation-${ctx.id}`, { cwd: this.repoRoot }); } catch {}
    }
    this._removeActive(ctx.id);
    emitEvent('isolation_destroyed', { id: ctx.id });
  }
  syncIn(ctx, sourcePath, destRelativePath) {
    const dest = path.join(ctx.worktreePath, destRelativePath);
    ensureDir(path.dirname(dest)); fs.copyFileSync(sourcePath, dest);
  }
  syncOut(ctx, sourceRelativePath, destPath) {
    const source = path.join(ctx.worktreePath, sourceRelativePath);
    ensureDir(path.dirname(destPath)); fs.copyFileSync(source, destPath);
  }
  list() { return this._loadState().active; }
  get(agentId) { return this.list().find(c => c.agentId === agentId) || null; }
}
```

---

### scripts/ingest-queue.js

**Purpose:** Persistent ingest queue with crash recovery. Two-step LLM pipeline: analyze -> generate wiki pages.

**API:**
```javascript
class IngestQueue {
  constructor(dbPath = 'memory/ingest-queue.sqlite')
  enqueue(source: IngestSource): Promise<string>
  dequeue(): Promise<IngestJob | null>
  complete(ingestId: string, result: IngestResult): Promise<void>
  fail(ingestId: string, error: string): Promise<void>
  processNext(llmClient: LLMClient): Promise<IngestResult | null>
  isProcessed(fingerprint: string): boolean
  getCache(fingerprint: string): IngestResult | null
  stats(): IngestStats
}
```

**Data Structures:**
```javascript
// IngestSource
{ type: 'file'|'url'|'pdf'|'image'|'text', path?: string, url?: string,
  text?: string, fingerprint: string, metadata?: object }

// IngestJob
{ id: string, source: string, status: string, step: number, result: string|null,
  error: string|null, attempts: number, maxRetries: number,
  createdAt: string, updatedAt: string }

// IngestResult
{ ingestId: string, sourceFingerprint: string, analysis: string,
  wikiPages: WikiPage[], images: ImageCaption[], durationMs: number }

// WikiPage
{ title: string, content: string, category: string, tags: string[], sourceRef: string }

// Cache (memory/ingest-cache.json)
{ version: 1, entries: [{ fingerprint, result, processedAt }] }
```

**Dependencies:** `job-queue.js`, `llm-client.js`, `wiki-engine.js`, `event-system.js`

**Test Plan:**
1. Enqueue deduplicates by fingerprint
2. Dequeue returns oldest pending
3. ProcessNext completes two-step pipeline
4. Analysis produces structured output
5. Generation produces wiki pages
6. Failed job retries with backoff
7. Cache hit skips LLM call
8. Batch processing works
9. Stats accurate by status
10. Crash recovery resumes pending

**Code Sketch:**
```javascript
class IngestQueue {
  constructor(dbPath = 'memory/ingest-queue.sqlite') {
    this.db = new sqlite3.Database(dbPath);
    this.cachePath = 'memory/ingest-cache.json';
    this._initSchema(); this._loadCache();
  }
  _initSchema() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS ingest_jobs (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, status TEXT DEFAULT 'pending',
      step INTEGER DEFAULT 0, result TEXT, error TEXT, attempts INTEGER DEFAULT 0,
      maxRetries INTEGER DEFAULT 3, createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_status_step ON ingest_jobs(status, step, createdAt);`);
  }
  async enqueue(source) {
    if (this.isProcessed(source.fingerprint))
      return { skipped: true, cached: this.getCache(source.fingerprint) };
    const id = `ingest-${generateSnowflakeId()}`;
    await this._run(`INSERT INTO ingest_jobs (id, source, status, step) VALUES (?, ?, 'pending', 0)`,
      [id, JSON.stringify(source)]);
    emitEvent('ingest_enqueued', { id, type: source.type, fingerprint: source.fingerprint });
    return id;
  }
  async processNext(llmClient) {
    const job = await this.dequeue(); if (!job) return null;
    const source = JSON.parse(job.source); const start = Date.now();
    try {
      await this._run(`UPDATE ingest_jobs SET status = 'analyzing', step = 1, updatedAt = ? WHERE id = ?`,
        [new Date().toISOString(), job.id]);
      const analysis = await llmClient.complete({
        system: 'Analyze content and produce structured summary.',
        messages: [{ role: 'user', content: this._formatSource(source) }] });
      await this._run(`UPDATE ingest_jobs SET status = 'generating', step = 2, updatedAt = ? WHERE id = ?`,
        [new Date().toISOString(), job.id]);
      const wikiPages = await llmClient.complete({
        system: 'Generate wiki pages as JSON array with {title, content, category, tags}.',
        messages: [{ role: 'user', content: `Analysis:\n${analysis}` }] });
      const result = { ingestId: job.id, sourceFingerprint: source.fingerprint,
        analysis, wikiPages: JSON.parse(wikiPages), images: [],
        durationMs: Date.now() - start };
      await this.complete(job.id, result);
      this._cacheResult(source.fingerprint, result);
      return result;
    } catch (err) { await this.fail(job.id, err.message); throw err; }
  }
  async complete(id, result) {
    await this._run(`UPDATE ingest_jobs SET status = 'completed', result = ?, updatedAt = ? WHERE id = ?`,
      [JSON.stringify(result), new Date().toISOString(), id]);
    emitEvent('ingest_completed', { id, durationMs: result.durationMs });
  }
  async fail(id, error) {
    const job = await this._getOne('SELECT * FROM ingest_jobs WHERE id = ?', [id]);
    if (job.attempts >= job.maxRetries) {
      await this._run(`UPDATE ingest_jobs SET status = 'failed', error = ?, updatedAt = ? WHERE id = ?`,
        [error, new Date().toISOString(), id]);
    } else {
      const delay = Math.pow(2, job.attempts) * 5000;
      await this._run(`UPDATE ingest_jobs SET status = 'pending', step = 0, error = ?,
        updatedAt = ?, attempts = attempts + 1, createdAt = ? WHERE id = ?`,
        [error, new Date().toISOString(), new Date(Date.now() + delay).toISOString(), id]);
    }
  }
  isProcessed(fp) { return this.cache.entries.some(e => e.fingerprint === fp); }
  getCache(fp) { const e = this.cache.entries.find(e => e.fingerprint === fp); return e ? e.result : null; }
  _cacheResult(fp, result) {
    this.cache.entries.push({ fingerprint: fp, result, processedAt: new Date().toISOString() });
    this._saveCache();
  }
}
```

---

### scripts/wiki-engine.js

**Purpose:** Wiki maintenance with YAML frontmatter, wikilink syntax, and Obsidian vault compatibility.

**API:**
```javascript
class WikiEngine {
  constructor(dir = 'memory/wiki/')
  createPage(title: string, content: string, meta?: PageMeta): WikiPage
  readPage(title: string): WikiPage | null
  updatePage(title: string, content: string, meta?: Partial<PageMeta>): WikiPage
  deletePage(title: string): boolean
  search(query: string): WikiPageSummary[]
  listByCategory(category: string): WikiPageSummary[]
  listByTag(tag: string): WikiPageSummary[]
  getBacklinks(title: string): string[]
  getForwardLinks(title: string): string[]
  updateLinks(): void
  lint(): LintReport
  rebuildIndex(): void
}
```

**Data Structures:**
```javascript
// PageMeta
{ title: string, category: string, tags: string[],
  status: 'draft'|'review'|'published', sourceRefs: string[],
  createdAt: string, updatedAt: string, author: string }

// WikiPage
{ title: string, content: string, meta: PageMeta,
  backlinks: string[], forwardLinks: string[] }

// WikiPageSummary
{ title: string, category: string, tags: string[], updatedAt: string, wordCount: number }

// Index (memory/wiki/.index.json)
{ version: 1, pages: [WikiPageSummary], categories: string[], tags: string[],
  linkGraph: { from: string, to: string }[] }

// LintReport
{ brokenLinks: [...], orphanedPages: string[], duplicateTitles: string[],
  missingFrontmatter: string[], stalePages: [...] }

// Layout: memory/wiki/{category}/{slug}.md, .index.json, .links.json, attachments/
```

**Dependencies:** `ingest-queue.js`, `event-system.js`, `knowledge-graph.js`

**Test Plan:**
1. Create writes valid .md with frontmatter
2. Read parses frontmatter and body
3. Update modifies file and timestamp
4. Search returns matching pages
5. ListByCategory filters correctly
6. Wikilink [[Title]] detected
7. Backlinks updated on new page
8. Lint detects broken links
9. RebuildIndex regenerates .index.json
10. Duplicate title detection works

**Code Sketch:**
```javascript
class WikiEngine {
  constructor(dir = 'memory/wiki/') {
    this.dir = dir; this.indexPath = path.join(dir, '.index.json');
    this.linksPath = path.join(dir, '.links.json');
    ensureDir(dir); ensureDir(path.join(dir, 'attachments'));
  }
  createPage(title, content, meta = {}) {
    const slug = this._slugify(title);
    const category = meta.category || 'uncategorized';
    const catDir = path.join(this.dir, category); ensureDir(catDir);
    const pageMeta = { title, category, tags: meta.tags || [],
      status: meta.status || 'draft', sourceRefs: meta.sourceRefs || [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      author: meta.author || 'kclaw0' };
    const filepath = path.join(catDir, `${slug}.md`);
    fs.writeFileSync(filepath, this._buildMarkdown(pageMeta, content));
    this._updateIndex();
    emitEvent('wiki_page_created', { title, category });
    return { title, content, meta: pageMeta, backlinks: [], forwardLinks: [] };
  }
  readPage(title) {
    const slug = this._slugify(title);
    const index = this._loadIndex();
    const entry = index.pages.find(p => this._slugify(p.title) === slug);
    if (!entry) return null;
    const content = fs.readFileSync(entry.path, 'utf8');
    const { meta, body } = this._parseMarkdown(content);
    const links = this._loadLinks();
    return { title: meta.title, content: body, meta,
      backlinks: links.backlinks[title] || [],
      forwardLinks: links.forwardLinks[title] || [] };
  }
  _buildMarkdown(meta, content) {
    const yaml = Object.entries(meta).map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? '[' + v.map(s => `"${s}"`).join(', ') + ']' : `"${v}"`}`).join('\n');
    return `---\n${yaml}\n---\n\n${content}\n`;
  }
  _parseMarkdown(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };
    const meta = {}; const body = match[2].trim();
    for (const line of match[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) {
        const [, k, v] = m;
        if (v.startsWith('[')) meta[k] = v.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
        else if (v === 'true') meta[k] = true; else if (v === 'false') meta[k] = false;
        else if (!isNaN(Number(v))) meta[k] = Number(v); else meta[k] = v.replace(/"/g, '');
      }
    }
    return { meta, body };
  }
  updateLinks() {
    const index = this._loadIndex();
    const linkGraph = { backlinks: {}, forwardLinks: {} };
    for (const page of index.pages) {
      const content = fs.readFileSync(page.path, 'utf8');
      const { body } = this._parseMarkdown(content);
      const links = [...body.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
      linkGraph.forwardLinks[page.title] = links;
      for (const link of links) {
        if (!linkGraph.backlinks[link]) linkGraph.backlinks[link] = [];
        linkGraph.backlinks[link].push(page.title);
      }
    }
    fs.writeFileSync(this.linksPath, JSON.stringify(linkGraph, null, 2));
  }
  lint() {
    const index = this._loadIndex(); const links = this._loadLinks();
    const report = { brokenLinks: [], orphanedPages: [], duplicateTitles: [],
      missingFrontmatter: [], stalePages: [] };
    for (const page of index.pages) {
      const content = fs.readFileSync(page.path, 'utf8');
      if (!content.startsWith('---')) report.missingFrontmatter.push(page.title);
      const days = (Date.now() - new Date(page.updatedAt).getTime()) / 86400000;
      if (days > 30) report.stalePages.push({ title: page.title, daysSinceUpdate: days });
      const { body } = this._parseMarkdown(content);
      const fwdLinks = [...body.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
      for (const link of fwdLinks) {
        if (!index.pages.some(p => p.title === link || this._slugify(p.title) === this._slugify(link)))
          report.brokenLinks.push({ page: page.title, link, line: 0 });
      }
      const bc = (links.backlinks[page.title] || []).length;
      if (bc === 0 && page.category !== 'reference') report.orphanedPages.push(page.title);
    }
    const titles = index.pages.map(p => p.title.toLowerCase());
    report.duplicateTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
    return report;
  }
  _slugify(title) { return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
}
```

---

### scripts/knowledge-graph.js

**Purpose:** 4-signal knowledge graph with Louvain community detection.

**API:**
```javascript
class KnowledgeGraph {
  constructor(storePath = 'memory/knowledge-graph.json')
  addNode(node: KnowledgeNode): void
  removeNode(id: string): boolean
  getNode(id: string): KnowledgeNode | null
  addEdge(from: string, to: string, signal: SignalType, weight: number): void
  getNeighbors(nodeId: string): string[]
  detectCommunities(): Community[]
  findPath(from: string, to: string, maxDepth?: number): string[] | null
  rankByCentrality(type?: string): { id: string, score: number }[]
  search(query: string): { node: KnowledgeNode, relevance: number }[]
  save(): void; load(): void
}
```

**Data Structures:**
```javascript
// KnowledgeNode
{ id: string, type: 'concept'|'entity'|'decision'|'pattern'|'lesson'|'task'|'wiki_page',
  label: string, content: string, sourceRefs: string[],
  createdAt: string, updatedAt: string, metadata: object }

// KnowledgeEdge
{ from: string, to: string, signal: SignalType, weight: number, createdAt: string }

// SignalType: DIRECT_LINK, SOURCE_OVERLAP, ADAMIC_ADAR, TYPE_AFFINITY

// Community
{ id: string, nodes: string[], density: number, centralNode: string }

// State (memory/knowledge-graph.json)
{ version: 1, nodes: { [id]: KnowledgeNode }, edges: KnowledgeEdge[],
  communities: Community[], lastUpdated: string }
```

**Dependencies:** `wiki-engine.js`, `ingest-queue.js`, `event-system.js`

**Test Plan:**
1. Add node stores in graph state
2. Add edge connects two nodes
3. GetNeighbors returns connected IDs
4. Direct link has higher weight than type affinity
5. DetectCommunities groups related nodes
6. FindPath discovers shortest path
7. RankByCentrality orders by importance
8. Search returns relevant nodes
9. Save/load round-trips state
10. Remove node cleans up edges

**Code Sketch:**
```javascript
class KnowledgeGraph {
  constructor(storePath = 'memory/knowledge-graph.json') {
    this.storePath = storePath; this.nodes = new Map(); this.edges = [];
    this.communities = []; this.load();
  }
  addNode(node) {
    this.nodes.set(node.id, { ...node, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() });
    this.save(); emitEvent('kg_node_added', { id: node.id, type: node.type });
  }
  addEdge(from, to, signal, weight) {
    if (!this.nodes.has(from) || !this.nodes.has(to))
      throw new Error(`Cannot add edge: node ${from} or ${to} missing`);
    this.edges.push({ from, to, signal, weight, createdAt: new Date().toISOString() });
    this.save(); emitEvent('kg_edge_added', { from, to, signal, weight });
  }
  getNeighbors(nodeId) {
    return this.edges.filter(e => e.from === nodeId || e.to === nodeId)
      .map(e => e.from === nodeId ? e.to : e.from);
  }
  detectCommunities() {
    const adj = new Map();
    for (const [id] of this.nodes) adj.set(id, new Set(this.getNeighbors(id)));
    let communities = new Map();
    for (const id of this.nodes.keys()) communities.set(id, new Set([id]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [cid, members] of communities) {
        for (const [ocid, omembers] of communities) {
          if (cid === ocid) continue;
          const shared = [...members].filter(m => omembers.has(m)).length;
          if (shared > 0) { [...members].forEach(m => omembers.add(m)); communities.delete(cid); changed = true; break; }
        }
        if (changed) break;
      }
    }
    this.communities = Array.from(communities.values()).map((members, i) => ({
      id: `community-${i}`, nodes: Array.from(members),
      density: this._calcDensity(members), centralNode: this._findCentralNode(members) }));
    this.save(); return this.communities;
  }
  findPath(from, to, maxDepth = 5) {
    const visited = new Set(), queue = [[from]];
    while (queue.length > 0) {
      const path = queue.shift(), current = path[path.length - 1];
      if (current === to) return path;
      if (path.length >= maxDepth) continue;
      if (visited.has(current)) continue; visited.add(current);
      for (const n of this.getNeighbors(current))
        if (!visited.has(n)) queue.push([...path, n]);
    }
    return null;
  }
  rankByCentrality(type) {
    const nodes = type ? Array.from(this.nodes.values()).filter(n => n.type === type)
      : Array.from(this.nodes.values());
    return nodes.map(n => ({ id: n.id, score: this.getNeighbors(n.id).length }))
      .sort((a, b) => b.score - a.score);
  }
  search(query) {
    const q = query.toLowerCase();
    return Array.from(this.nodes.values()).map(n => {
      const ls = n.label.toLowerCase().includes(q) ? 2 : 0;
      const cs = n.content.toLowerCase().includes(q) ? 1 : 0;
      return { node: n, relevance: ls + cs };
    }).filter(r => r.relevance > 0).sort((a, b) => b.relevance - a.relevance);
  }
  save() {
    fs.writeFileSync(this.storePath, JSON.stringify({
      version: 1, nodes: Object.fromEntries(this.nodes), edges: this.edges,
      communities: this.communities, lastUpdated: new Date().toISOString()
    }, null, 2));
  }
  load() {
    if (!fs.existsSync(this.storePath)) return;
    const s = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
    this.nodes = new Map(Object.entries(s.nodes));
    this.edges = s.edges || []; this.communities = s.communities || [];
  }
}
```

---

### scripts/vector-store.js

**Purpose:** LanceDB/ChromaDB integration for semantic search.

**API:**
```javascript
class VectorStore {
  constructor(config?: VectorStoreConfig)
  connect(): Promise<void>
  createCollection(name: string, schema: CollectionSchema): Promise<Collection>
  addDocuments(collection: string, docs: VectorDocument[]): Promise<string[]>
  search(collection: string, query: string, options?: SearchOptions): Promise<SearchResult[]>
  similarity(collection: string, id: string, limit?: number): Promise<SearchResult[]>
}
```

**Data Structures:**
```javascript
// VectorStoreConfig
{ backend: 'lancedb'|'chromadb', path: string, embeddingModel: string,
  embeddingDimensions: number, distanceMetric: 'cosine'|'l2'|'dot' }

// VectorDocument
{ id: string, text: string, metadata: object, source: string }

// SearchResult
{ id: string, text: string, metadata: object, source: string,
  distance: number, score: number }

// Layout: memory/vector-store/{collection-name}.lance/
```

**Dependencies:** `wiki-engine.js`, `knowledge-graph.js`, `llm-client.js`, `event-system.js`

**Test Plan:**
1. Connect creates data directory
2. CreateCollection with schema succeeds
3. AddDocuments stores and returns IDs
4. Search returns results by similarity
5. Similarity finds nearest neighbors
6. UpdateDocument modifies without changing ID
7. DeleteDocuments removes from collection
8. Filtered search respects metadata filter
9. Collection count is accurate
10. Disconnect cleans up gracefully

**Code Sketch:**
```javascript
class VectorStore {
  constructor(config = {}) {
    this.config = { backend: config.backend || 'lancedb',
      path: config.path || 'memory/vector-store/',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      embeddingDimensions: config.embeddingDimensions || 1536,
      distanceMetric: config.distanceMetric || 'cosine' };
    this.connected = false; this.collections = new Map();
    ensureDir(this.config.path);
  }
  async connect() {
    if (this.config.backend === 'lancedb') {
      this.lancedb = require('vectordb');
      this.db = await this.lancedb.connect(this.config.path);
    } else if (this.config.backend === 'chromadb') {
      const { ChromaClient } = require('chromadb');
      this.db = new ChromaClient({ path: 'http://localhost:8000' });
    }
    this.connected = true;
    emitEvent('vector_store_connected', { backend: this.config.backend });
  }
  async createCollection(name, schema) {
    if (!this.connected) throw new Error('Not connected');
    if (this.config.backend === 'lancedb') {
      const sample = schema.fields.map(f => ({
        [f.name]: f.type === 'vector' ? new Array(this.config.embeddingDimensions).fill(0)
          : f.type === 'object' ? {} : '' }));
      const table = await this.db.createTable(name, sample);
      this.collections.set(name, table);
    }
    emitEvent('vector_collection_created', { name });
    return { name, count: async () => (await this.getCollection(name)).count() };
  }
  async addDocuments(collectionName, docs) {
    const table = this.collections.get(collectionName);
    const embeddings = await this._generateEmbeddings(docs.map(d => d.text));
    const data = docs.map((doc, i) => ({
      id: doc.id, text: doc.text, embedding: embeddings[i],
      metadata: JSON.stringify(doc.metadata), source: doc.source }));
    if (this.config.backend === 'lancedb') await table.add(data);
    emitEvent('vector_docs_added', { collection: collectionName, count: docs.length });
    return docs.map(d => d.id);
  }
  async search(collectionName, query, options = {}) {
    const limit = options.limit || 10;
    const embedding = (await this._generateEmbeddings([query]))[0];
    if (this.config.backend === 'lancedb') {
      const table = this.collections.get(collectionName);
      const results = await table.search(embedding)
        .metricType(this.config.distanceMetric === 'cosine' ? 'cosine' : 'l2')
        .limit(limit).toArray();
      return results.map(r => ({ id: r.id, text: r.text,
        metadata: JSON.parse(r.metadata || '{}'), source: r.source,
        distance: r._distance, score: 1 - (r._distance || 0) }));
    }
    return [];
  }
  async _generateEmbeddings(texts) {
    const llm = require('./llm-client');
    return await llm.embed({ model: this.config.embeddingModel, inputs: texts });
  }
}
```

---

### scripts/workflow-engine.js

**Purpose:** DOT-based workflow execution engine with checkpoint after every node. Adapted from Attractor.

**API:**
```javascript
class WorkflowEngine {
  constructor(toolRegistry: ToolRegistry, llmClient: LLMClient)
  load(dotSource: string): WorkflowGraph
  validate(graph: WorkflowGraph): ValidationReport
  run(graph: WorkflowGraph, context?: WorkflowContext): Promise<WorkflowResult>
  resume(checkpointPath: string): Promise<WorkflowResult>
  simulate(graph: WorkflowGraph): SimulationReport
}
```

**Data Structures:**
```javascript
// WorkflowNode types: start, exit, llm_task, human_gate, conditional,
//   parallel_fan_out, parallel_fan_in, external_tool, manager_loop

// WorkflowContext
{ inputs: object, state: object, budgetRemaining: number,
  autoApprove: boolean, checkpointDir: string }

// WorkflowResult
{ status: string, finalState: object, nodeResults: object,
  executionPath: string[], durationMs: number, totalCostUsd: number }

// NodeResult
{ nodeId: string, status: string, output: any, durationMs: number,
  costUsd: number, checkpointPath: string }

// ValidationReport
{ valid: boolean, errors: string[], warnings: string[],
  unreachableNodes: string[], missingHandlers: string[] }

// Checkpoint: memory/checkpoints/workflow-{name}-{timestamp}.json
```

**Dependencies:** `tool-registry.js`, `llm-client.js`, `checkpoint.js`, `event-system.js`, `cost-tracker.js`

**Test Plan:**
1. Load parses valid DOT
2. Validate detects unreachable nodes
3. Run executes start -> llm_task -> exit
4. Checkpoint saved after every node
5. Resume restores from checkpoint
6. Conditional routes based on state
7. Human gate pauses and resumes
8. Parallel fan-out/fan-in concurrent
9. Budget exceeded aborts workflow
10. Simulation produces path without LLM calls

**Code Sketch:**
```javascript
class WorkflowEngine {
  constructor(toolRegistry, llmClient) {
    this.toolRegistry = toolRegistry; this.llmClient = llmClient;
    this.handlers = this._buildHandlers();
  }
  load(dotSource) {
    const nodes = [], edges = [];
    const nodeRe = /"([^"]+)"\s*\[([^\]]+)\];?/g;
    let m; while ((m = nodeRe.exec(dotSource)) !== null) {
      const attrs = m[2].split(',').reduce((a, at) => {
        const [k, v] = at.split('=').map(s => s.trim().replace(/"/g, '')); a[k] = v; return a;
      }, {});
      nodes.push({ id: m[1], type: this._inferType(attrs), label: attrs.label || m[1], attributes: attrs });
    }
    const edgeRe = /"([^"]+)"\s*->\s*"([^"]+)"\s*(?:\[([^\]]*)\])?;?/g;
    while ((m = edgeRe.exec(dotSource)) !== null)
      edges.push({ from: m[1], to: m[2], condition: (m[3] || '').match(/label="([^"]*)"/)?.[1] });
    return { nodes, edges, name: 'workflow' };
  }
  _inferType(attrs) {
    const s = attrs.shape;
    if (s === 'ellipse' || s === 'oval') return 'start';
    if (s === 'box') return 'llm_task';
    if (s === 'hexagon') return 'human_gate';
    if (s === 'diamond') return 'conditional';
    if (s === 'trapezium') return 'parallel_fan_out';
    if (s === 'invtrapezium') return 'parallel_fan_in';
    return 'llm_task';
  }
  async run(graph, context = {}) {
    const ctx = { inputs: context.inputs || {}, state: context.state || {},
      budgetRemaining: context.budgetRemaining || 10.0,
      autoApprove: context.autoApprove || false,
      checkpointDir: context.checkpointDir || 'memory/checkpoints/' };
    const result = { status: 'success', finalState: {}, nodeResults: {},
      executionPath: [], durationMs: 0, totalCostUsd: 0 };
    let currentNode = graph.nodes.find(n => n.type === 'start');
    const startTime = Date.now();
    while (currentNode) {
      if (ctx.budgetRemaining <= 0) { result.status = 'aborted'; break; }
      this._saveCheckpoint(graph, currentNode.id, ctx, result);
      const handler = this.handlers[currentNode.type];
      if (!handler) throw new Error(`No handler for ${currentNode.type}`);
      const nodeResult = await handler(currentNode, ctx, graph);
      result.nodeResults[currentNode.id] = nodeResult;
      result.executionPath.push(currentNode.id);
      result.totalCostUsd += nodeResult.costUsd || 0;
      ctx.budgetRemaining -= nodeResult.costUsd || 0;
      if (nodeResult.status === 'error') { result.status = 'error'; break; }
      if (currentNode.type === 'exit') break;
      const outgoing = graph.edges.filter(e => e.from === currentNode.id);
      if (outgoing.length === 0) break;
      currentNode = this._selectNextNode(outgoing, nodeResult, ctx, graph);
    }
    result.finalState = ctx.state;
    result.durationMs = Date.now() - startTime;
    emitEvent('workflow_completed', { name: graph.name, status: result.status });
    return result;
  }
  _buildHandlers() {
    return {
      start: async (n, ctx) => ({ nodeId: n.id, status: 'success', output: null, durationMs: 0, costUsd: 0 }),
      exit: async (n, ctx) => ({ nodeId: n.id, status: 'success', output: ctx.state, durationMs: 0, costUsd: 0 }),
      llm_task: async (n, ctx) => {
        const s = Date.now();
        const resp = await this.llmClient.complete({
          system: n.attributes.system || 'You are helpful.',
          messages: [{ role: 'user', content: n.attributes.prompt || n.label }] });
        ctx.state[n.id] = resp;
        return { nodeId: n.id, status: 'success', output: resp,
          durationMs: Date.now() - s, costUsd: 0.01 };
      },
      human_gate: async (n, ctx) => {
        if (ctx.autoApprove) return { nodeId: n.id, status: 'success', output: 'auto-approved', durationMs: 0, costUsd: 0 };
        return { nodeId: n.id, status: 'pending_human', output: null, durationMs: 0, costUsd: 0 };
      },
      external_tool: async (n, ctx) => {
        const s = Date.now();
        const r = await this.toolRegistry.execute(n.attributes.tool,
          JSON.parse(n.attributes.args || '{}'), { sessionId: 'workflow' });
        return { nodeId: n.id, status: r.success ? 'success' : 'error',
          output: r.output, durationMs: Date.now() - s, costUsd: r.cost || 0 };
      }
    };
  }
  _selectNextNode(outgoing, nodeResult, ctx, graph) {
    for (const edge of outgoing) {
      if (!edge.condition) return graph.nodes.find(n => n.id === edge.to);
      if (this._evalCondition(edge.condition, nodeResult, ctx)) return graph.nodes.find(n => n.id === edge.to);
    }
    return null;
  }
  _evalCondition(cond, nodeResult, ctx) {
    try { return new Function('outcome', 'state', `return ${cond}`)(nodeResult.status, ctx.state); }
    catch { return false; }
  }
  _saveCheckpoint(graph, nodeId, ctx, result) {
    fs.writeFileSync(`${ctx.checkpointDir}/workflow-${graph.name}-${Date.now()}.json`,
      JSON.stringify({ version: 1, workflowName: graph.name, currentNodeId: nodeId,
        context: ctx, nodeResults: result.nodeResults, executionPath: result.executionPath,
        createdAt: new Date().toISOString() }, null, 2));
  }
}
```

---

### scripts/dark-factory.js

**Purpose:** 24/7 orchestrator. Reads GitHub state, dispatches one workflow at a time. Cron every 4-6 hours.

**API:**
```javascript
class DarkFactory {
  constructor(config: FactoryConfig)
  start(): void; stop(): void; pause(): void; resume(): void
  tick(): Promise<TickResult>
  getStatus(): FactoryStatus
  triageIssue(issue: GitHubIssue): Promise<TriageResult>
  processIssue(issue: GitHubIssue): Promise<ProcessResult>
  validatePR(pr: GitHubPR): Promise<ValidationResult>
  mergePR(pr: GitHubPR): Promise<boolean>
}
```

**Data Structures:**
```javascript
// FactoryConfig
{ owner: string, repo: string, githubToken: string,
  cronIntervalMinutes: number, maxIssuesPerDay: number,
  maxRetries: number, defaultBudgetUsd: number,
  missionPath: string, rulesPath: string, stylePath: string }

// FactoryStatus
{ state: string, lastTick: string, nextTick: string,
  issuesProcessedToday: number, prsProcessedToday: number,
  currentJob: string|null, totalIssuesProcessed: number,
  totalPRsProcessed: number, uptimeMinutes: number }

// TickResult
{ action: string, details: object, durationMs: number, costUsd: number }

// Factory log: memory/factory-log.ndjson
```

**Dependencies:** `github-state-machine.js`, `workflow-engine.js`, `validation-harness.js`, `job-queue.js`, `cost-tracker.js`, `event-system.js`, `task-tool.js`

**Test Plan:**
1. Start initializes state
2. Tick with no issues returns no_action
3. TriageIssue categorizes and labels
4. ProcessIssue creates branch and implements
5. ValidatePR uses holdout pattern
6. Rate limiting respects maxIssuesPerDay
7. Pause stops execution
8. Resume continues
9. Budget tracking accumulates
10. Factory log records all actions

**Code Sketch:**
```javascript
class DarkFactory {
  constructor(config) {
    this.config = config; this.state = 'idle';
    this.statusPath = 'memory/factory-status.json';
    this.logPath = 'memory/factory-log.ndjson';
    this._loadStatus(); this._validateGovernance();
  }
  _validateGovernance() {
    const mission = fs.readFileSync(this.config.missionPath, 'utf8');
    const rules = fs.readFileSync(this.config.rulesPath, 'utf8');
    if (!mission || !rules) throw new Error('Governance files missing');
  }
  start() {
    this.state = 'running'; this._saveStatus(); this._scheduleNextTick();
    emitEvent('factory_started', { repo: `${this.config.owner}/${this.config.repo}` });
  }
  stop() {
    this.state = 'stopping';
    if (this._timer) clearTimeout(this._timer);
    this.state = 'idle'; this._saveStatus();
    emitEvent('factory_stopped', {});
  }
  _scheduleNextTick() {
    if (this.state !== 'running') return;
    this._timer = setTimeout(async () => {
      try { await this.tick(); } catch (err) { this._log('tick_error', null, err.message, 0, 0); }
      this._scheduleNextTick();
    }, this.config.cronIntervalMinutes * 60000);
  }
  async tick() {
    const start = Date.now();
    if (this._issuesToday() >= this.config.maxIssuesPerDay)
      return { action: 'rate_limited', details: { reason: 'daily_limit' }, durationMs: Date.now() - start, costUsd: 0 };
    const issues = await this._fetchFactoryIssues();
    const prs = await this._fetchFactoryPRs();
    const triaging = issues.filter(i => i.labels.includes('factory:triaging'));
    const inProgress = issues.filter(i => i.labels.includes('factory:in-progress'));
    const needsReview = prs.filter(p => p.labels.includes('factory:needs-review'));
    if (triaging.length > 0) {
      const r = await this.triageIssue(triaging[0]);
      this._log('triage', triaging[0].number, r.verdict, r.costUsd, Date.now() - start);
      return { action: 'processed_issue', details: r, durationMs: Date.now() - start, costUsd: r.costUsd };
    }
    if (inProgress.length > 0) {
      const r = await this.processIssue(inProgress[0]);
      this._log('process', inProgress[0].number, r.status, r.costUsd, Date.now() - start);
      return { action: 'processed_issue', details: r, durationMs: Date.now() - start, costUsd: r.costUsd };
    }
    if (needsReview.length > 0) {
      const r = await this.validatePR(needsReview[0]);
      this._log('validate_pr', needsReview[0].number, r.verdict, r.costUsd, Date.now() - start);
      if (r.verdict === 'approved') await this.mergePR(needsReview[0]);
      return { action: 'validated_pr', details: r, durationMs: Date.now() - start, costUsd: r.costUsd };
    }
    return { action: 'no_action', details: { reason: 'no_work' }, durationMs: Date.now() - start, costUsd: 0 };
  }
  async triageIssue(issue) {
    const workflow = this._loadWorkflow('triage');
    const result = await this.workflowEngine.run(workflow, {
      inputs: { issueTitle: issue.title, issueBody: issue.body }, budgetRemaining: 0.5 });
    const verdict = result.finalState.verdict || 'rejected';
    await this._setLabel(issue.number, `factory:${verdict === 'accepted' ? 'accepted' : 'rejected'}`);
    return { verdict, costUsd: result.totalCostUsd };
  }
  async validatePR(pr) {
    const workflow = this._loadWorkflow('validate-pr');
    const result = await this.workflowEngine.run(workflow, {
      inputs: { prNumber: pr.number, headSha: pr.headSha },
      budgetRemaining: this.config.defaultBudgetUsd });
    const findings = result.finalState.findings || [];
    const testResults = result.finalState.testResults || { passed: 0, failed: 0 };
    let verdict = 'needs_fix';
    if (findings.every(f => f.severity !== 'error') && testResults.failed === 0) verdict = 'approved';
    await this._setLabel(pr.number, `factory:${verdict === 'approved' ? 'approved' : verdict === 'needs_fix' ? 'needs-fix' : 'needs-human'}`);
    return { verdict, findings, testResults, costUsd: result.totalCostUsd };
  }
  _log(action, issueOrPR, result, costUsd, durationMs) {
    fs.appendFileSync(this.logPath, JSON.stringify({
      timestamp: new Date().toISOString(), action, issueOrPR, result, costUsd, durationMs }) + '\n');
  }
  _issuesToday() {
    const today = new Date().toISOString().split('T')[0];
    if (!fs.existsSync(this.logPath)) return 0;
    return fs.readFileSync(this.logPath, 'utf8').trim().split('\n')
      .filter(l => { const e = JSON.parse(l); return e.timestamp.startsWith(today) && e.action === 'process'; }).length;
  }
}
```

---

### scripts/github-state-machine.js

**Purpose:** Label-based state management for GitHub issues and PRs.

**API:**
```javascript
class GitHubStateMachine {
  constructor(owner: string, repo: string, token: string)
  transitionIssue(issueNumber: number, from: string, to: string): Promise<boolean>
  getIssueState(issueNumber: number): Promise<string>
  listIssuesInState(state: string): Promise<GitHubIssue[]>
  transitionPR(prNumber: number, from: string, to: string): Promise<boolean>
  getPRState(prNumber: number): Promise<string>
  listPRsInState(state: string): Promise<GitHubPR[]>
  isValidTransition(type: 'issue'|'pr', from: string, to: string): boolean
}
```

**Data Structures:**
```javascript
// Issue states
const ISSUE_STATES = [
  { name: 'triaging', label: 'factory:triaging', validNext: ['accepted', 'rejected'], requiresHuman: false },
  { name: 'accepted', label: 'factory:accepted', validNext: ['in-progress'], requiresHuman: false },
  { name: 'in-progress', label: 'factory:in-progress', validNext: ['needs-review', 'rejected'], requiresHuman: false },
  { name: 'rejected', label: 'factory:rejected', validNext: [], requiresHuman: false }
];

// PR states
const PR_STATES = [
  { name: 'implementing', label: 'factory:implementing', validNext: ['needs-review'], requiresHuman: false },
  { name: 'needs-review', label: 'factory:needs-review', validNext: ['approved', 'needs-fix'], requiresHuman: false },
  { name: 'needs-fix', label: 'factory:needs-fix', validNext: ['needs-review', 'needs-human'], requiresHuman: false, timeoutHours: 48 },
  { name: 'approved', label: 'factory:approved', validNext: ['merged'], requiresHuman: false },
  { name: 'needs-human', label: 'factory:needs-human', validNext: [], requiresHuman: true },
  { name: 'merged', label: 'factory:merged', validNext: [], requiresHuman: false }
];

// Transition log: memory/github-transitions.ndjson
```

**Dependencies:** `event-system.js`, `dark-factory.js`

**Test Plan:**
1. GetIssueState returns current label
2. TransitionIssue changes label if valid
3. Invalid transition returns false
4. ListIssuesInState filters correctly
5. ValidNext returns correct states
6. PR state machine separate from issues
7. Timeout states trigger escalation
8. Transition log records all changes
9. RequiresHuman flag on appropriate states
10. Factory label prefix filtering works

**Code Sketch:**
```javascript
class GitHubStateMachine {
  constructor(owner, repo, token) {
    this.owner = owner; this.repo = repo; this.token = token;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
    this.issueStates = ISSUE_STATES; this.prStates = PR_STATES;
    this.transitionLog = 'memory/github-transitions.ndjson';
  }
  _headers() { return { Authorization: `token ${this.token}`, 'User-Agent': 'KClaw0-Factory' }; }
  async getIssueState(issueNumber) {
    const res = await fetch(`${this.baseUrl}/issues/${issueNumber}`, { headers: this._headers() });
    const issue = await res.json();
    const factoryLabels = issue.labels.filter(l => l.name.startsWith('factory:'));
    return factoryLabels.length > 0 ? factoryLabels[0].name.replace('factory:', '') : 'unknown';
  }
  isValidTransition(type, from, to) {
    const states = type === 'issue' ? this.issueStates : this.prStates;
    const fromState = states.find(s => s.name === from);
    return fromState ? fromState.validNext.includes(to) : false;
  }
  async transitionIssue(issueNumber, from, to) {
    if (!this.isValidTransition('issue', from, to)) {
      emitEvent('github_invalid_transition', { type: 'issue', number: issueNumber, from, to });
      return false;
    }
    await fetch(`${this.baseUrl}/issues/${issueNumber}/labels`, {
      method: 'DELETE', headers: this._headers(),
      body: JSON.stringify({ labels: [`factory:${from}`] }) });
    await fetch(`${this.baseUrl}/issues/${issueNumber}/labels`, {
      method: 'POST', headers: this._headers(),
      body: JSON.stringify({ labels: [`factory:${to}`] }) });
    this._logTransition('issue', issueNumber, from, to);
    emitEvent('github_transition', { type: 'issue', number: issueNumber, from, to });
    return true;
  }
  _logTransition(type, number, from, to) {
    fs.appendFileSync(this.transitionLog, JSON.stringify({
      timestamp: new Date().toISOString(), type, number, from, to, actor: 'kclaw0-factory' }) + '\n');
  }
}
```

---

### scripts/validation-harness.js

**Purpose:** Holdout validation. Validator NEVER reads implementation plan.

**API:**
```javascript
class ValidationHarness {
  constructor(testCommand = 'npm test')
  validatePR(pr: GitHubPR, issue: GitHubIssue): Promise<ValidationReport>
  runRegression(): Promise<RegressionResult>
  reportFinding(finding: Finding): void
  getFindings(): Finding[]
  renderVerdict(report: ValidationReport): Verdict
}
```

**Data Structures:**
```javascript
// ValidationReport
{ verdict: 'approve'|'request-changes'|'comment', findings: Finding[],
  testResults: { passed: number, failed: number, skipped: number, output: string },
  regressionResults: { passed: number, failed: number },
  coverageDelta: number, durationMs: number, costUsd: number, confidence: number }

// Finding
{ priority: 'P0'|'P1'|'P2'|'P3', file: string, line?: number,
  message: string, category: 'bug'|'style'|'performance'|'security'|'test' }

// RegressionResult
{ allPassed: boolean, suites: [...], totalPassed: number, totalFailed: number,
  newFailures: string[] }

// Findings log: memory/validation-findings.ndjson
```

**Dependencies:** `event-system.js`, `task-tool.js`, `tool-registry.js`, `github-state-machine.js`

**Test Plan:**
1. ValidatePR checks outcome, not plan
2. RunRegression runs full test suite
3. New failures detected and reported
4. ReportFinding accumulates
5. RenderVerdict produces correct action
6. P0 finding triggers request-changes
7. No findings + all pass -> approve
8. Missing tests trigger comment
9. Forbidden pattern detection
10. Coverage delta calculation

**Code Sketch:**
```javascript
class ValidationHarness {
  constructor(testCommand = 'npm test') {
    this.testCommand = testCommand; this.findings = [];
    this.findingsLog = 'memory/validation-findings.ndjson';
  }
  async validatePR(pr, issue) {
    const start = Date.now(); this.findings = [];
    const testResults = await this._runTests();
    const issueCriteria = this._extractCriteria(issue.body);
    const changes = await this._fetchChanges(pr);
    const hasTests = changes.some(c => c.path.includes('test') || c.path.includes('.test.'));
    if (!hasTests) this.reportFinding({ priority: 'P1', file: 'PR', message: 'No tests added', category: 'test' });
    for (const change of changes) {
      for (const pattern of issueCriteria.forbiddenPatterns || []) {
        if (change.diff.includes(pattern))
          this.reportFinding({ priority: 'P0', file: change.path, message: `Forbidden: ${pattern}`, category: 'security' });
      }
    }
    const report = { verdict: this._determineVerdict(), findings: [...this.findings],
      testResults, regressionResults: { passed: testResults.passed, failed: testResults.failed },
      coverageDelta: 0, durationMs: Date.now() - start, costUsd: 0,
      confidence: this._calcConfidence(testResults, this.findings) };
    this._logFindings(pr.number, report); return report;
  }
  async _runTests() {
    try {
      const output = execSync(this.testCommand, { encoding: 'utf8', timeout: 120000 });
      const p = output.match(/(\d+) passing/)?.[1] || '0';
      const f = output.match(/(\d+) failing/)?.[1] || '0';
      return { passed: parseInt(p), failed: parseInt(f), skipped: 0, output };
    } catch (err) { return { passed: 0, failed: 1, skipped: 0, output: err.stdout || err.message }; }
  }
  reportFinding(finding) { this.findings.push(finding); emitEvent('validation_finding', finding); }
  _determineVerdict() {
    if (this.findings.some(f => f.priority === 'P0')) return 'request-changes';
    if (this.findings.some(f => f.priority === 'P1')) return 'comment';
    return 'approve';
  }
  _calcConfidence(testResults, findings) {
    const ts = testResults.passed / (testResults.passed + testResults.failed + 1);
    return Math.max(0, Math.min(1, ts - findings.length * 0.05));
  }
  renderVerdict(report) {
    const reasons = [];
    if (report.verdict === 'approve') {
      reasons.push(`All ${report.testResults.passed} tests passed`);
      reasons.push(`${report.findings.length} findings (none critical)`);
    } else if (report.verdict === 'request-changes') {
      reasons.push(`${report.findings.filter(f => f.priority === 'P0').length} critical issues`);
    }
    return { action: report.verdict, reason: reasons.join('; '), requiredActions: report.findings.map(f => f.message) };
  }
  _logFindings(prNumber, report) {
    fs.appendFileSync(this.findingsLog, JSON.stringify({
      timestamp: new Date().toISOString(), prNumber, findings: report.findings, verdict: report.verdict }) + '\n');
  }
}
```

---

### scripts/hook-manager.js

**Purpose:** Lifecycle hooks system. Can block tool execution, inject messages, or modify behavior.

**API:**
```javascript
class HookManager {
  constructor(dirs = ['memory/hooks/pre/', 'memory/hooks/post/'])
  discover(): HookDescriptor[]
  load(hook: HookDescriptor): LoadedHook
  executePre(event: AgentEvent): Promise<HookResult>
  executePost(event: AgentEvent): Promise<HookResult>
  register(name: string, handler: HookHandler, phase: 'pre'|'post'): void
  unregister(name: string, phase: 'pre'|'post'): boolean
  list(): HookDescriptor[]
  isEnabled(name: string): boolean
  enable(name: string): void; disable(name: string): void
}
```

**Data Structures:**
```javascript
// HookDescriptor
{ name: string, phase: 'pre'|'post', events: string[], path: string, enabled: boolean }

// HookResult
{ blocked: boolean, modified: boolean, event: AgentEvent, messages: string[] }

// Hook state: memory/hook-state.json
// Execution log: memory/hook-executions.ndjson
```

**Dependencies:** `event-system.js`, `tool-registry.js`

**Test Plan:**
1. Discover scans directories
2. Load executes without errors
3. ExecutePre runs matching pre-hooks
4. ExecutePost runs matching post-hooks
5. blocked=true cancels event
6. modified=true updates event data
7. Messages injected into conversation
8. Unregister removes hook
9. Enable/disable toggles state
10. Hook execution order deterministic

**Code Sketch:**
```javascript
class HookManager {
  constructor(dirs = ['memory/hooks/pre/', 'memory/hooks/post/']) {
    this.dirs = dirs; this.hooks = new Map();
    this.statePath = 'memory/hook-state.json';
    this.executionLog = 'memory/hook-executions.ndjson';
    ensureDir('memory/hooks/pre'); ensureDir('memory/hooks/post');
    this.discover();
  }
  discover() {
    const discovered = [];
    for (const dir of this.dirs) {
      const phase = path.basename(dir);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
        const filepath = path.join(dir, file);
        try {
          const mod = require(filepath);
          discovered.push({ name: mod.name || file.replace('.js', ''), phase,
            events: mod.events || ['*'], path: filepath, enabled: true });
        } catch (err) { console.error(`Failed to load hook ${filepath}:`, err.message); }
      }
    }
    this._saveState(discovered); return discovered;
  }
  load(descriptor) {
    try {
      const mod = require(descriptor.path);
      this.hooks.set(descriptor.name, { ...descriptor, handler: mod.handler || mod.default });
      return this.hooks.get(descriptor.name);
    } catch (err) { console.error(`Failed to load hook ${descriptor.name}:`, err.message); return null; }
  }
  async executePre(event) { return this._executePhase('pre', event); }
  async executePost(event) { return this._executePhase('post', event); }
  async _executePhase(phase, event) {
    const results = [];
    for (const [name, hook] of this.hooks) {
      if (hook.phase !== phase || !hook.enabled) continue;
      if (!hook.events.includes('*') && !hook.events.includes(event.type)) continue;
      const start = Date.now();
      try {
        const result = await hook.handler(event);
        results.push(result);
        fs.appendFileSync(this.executionLog, JSON.stringify({
          hookName: name, eventType: event.type, timestamp: new Date().toISOString(),
          blocked: result.blocked, durationMs: Date.now() - start }) + '\n');
        if (result.blocked) break;
      } catch (err) {
        console.error(`Hook ${name} error:`, err.message);
      }
    }
    return { blocked: results.some(r => r.blocked), modified: results.some(r => r.modified),
      event: results.find(r => r.modified)?.event || event, messages: results.flatMap(r => r.messages || []) };
  }
}
```

---

### scripts/extension-loader.js

**Purpose:** Extension discovery and loading. Adapts oh-my-pi plugin pattern.

**API:**
```javascript
class ExtensionLoader {
  constructor(dirs = ['memory/extensions/'])
  discover(): ExtensionDescriptor[]
  load(ext: ExtensionDescriptor): LoadedExtension
  unload(name: string): boolean
  list(): ExtensionDescriptor[]
  get(name: string): LoadedExtension | null
}
```

**Data Structures:**
```javascript
// ExtensionDescriptor
{ name: string, version: string, description: string, path: string,
  entryPoint: string, hooks: string[], tools: string[], enabled: boolean }

// LoadedExtension
{ descriptor: ExtensionDescriptor, module: object, exports: object }

// Extension index: memory/extensions/.index.json
```

**Dependencies:** `event-system.js`, `hook-manager.js`, `tool-registry.js`

**Test Plan:**
1. Discover scans extension directories
2. Load executes entry point
3. Unload removes extension
4. List returns all extensions
5. Get returns loaded extension
6. Invalid extension returns error
7. Duplicate extension names handled
8. Extension hooks registered
9. Extension tools registered
10. Extension version compatibility checked

**Code Sketch:**
```javascript
class ExtensionLoader {
  constructor(dirs = ['memory/extensions/']) {
    this.dirs = dirs; this.extensions = new Map();
    this.indexPath = 'memory/extensions/.index.json';
    for (const dir of dirs) ensureDir(dir);
  }
  discover() {
    const discovered = [];
    for (const dir of this.dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const subdir of fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory())) {
        const manifestPath = path.join(dir, subdir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          discovered.push({ name: manifest.name, version: manifest.version,
            description: manifest.description, path: path.join(dir, subdir),
            entryPoint: manifest.main, hooks: manifest.hooks || [],
            tools: manifest.tools || [], enabled: true });
        } catch (err) { console.error(`Invalid manifest ${manifestPath}:`, err.message); }
      }
    }
    fs.writeFileSync(this.indexPath, JSON.stringify({ version: 1, extensions: discovered }, null, 2));
    return discovered;
  }
  load(descriptor) {
    try {
      const entryPath = path.join(descriptor.path, descriptor.entryPoint);
      const mod = require(entryPath);
      this.extensions.set(descriptor.name, { descriptor, module: mod, exports: mod });
      // Register hooks and tools
      if (mod.hooks) {
        const hookManager = require('./hook-manager');
        for (const [name, hook] of Object.entries(mod.hooks))
          hookManager.register(`${descriptor.name}:${name}`, hook.handler, hook.phase);
      }
      if (mod.tools) {
        const toolRegistry = require('./tool-registry');
        for (const tool of mod.tools) toolRegistry.register(tool);
      }
      emitEvent('extension_loaded', { name: descriptor.name, version: descriptor.version });
      return this.extensions.get(descriptor.name);
    } catch (err) { console.error(`Failed to load extension ${descriptor.name}:`, err.message); return null; }
  }
  unload(name) {
    const ext = this.extensions.get(name);
    if (!ext) return false;
    this.extensions.delete(name);
    emitEvent('extension_unloaded', { name });
    return true;
  }
  list() { return Array.from(this.extensions.values()).map(e => e.descriptor); }
  get(name) { return this.extensions.get(name) || null; }
}
```

---

### scripts/rpc-server.js

**Purpose:** Remote control API for external tools to interact with KClaw0.

**API:**
```javascript
class RPCServer {
  constructor(port: number = 7432)
  start(): Promise<void>
  stop(): Promise<void>
  registerMethod(name: string, handler: RPCMethod): void
  unregisterMethod(name: string): boolean
}

// RPCMethod signature
async function handler(params: object, context: RPCContext): Promise<RPCResult>
```

**Data Structures:**
```javascript
// RPCContext
{ requestId: string, clientId: string, timestamp: string, auth?: object }

// RPCResult
{ success: boolean, data?: object, error?: string }

// Methods registered by default:
// - agent.spawn, agent.status, agent.list
// - tool.execute, tool.list
// - session.create, session.load, session.append
// - memory.read, memory.write
// - factory.status, factory.tick
```

**Dependencies:** `agent-registry.js`, `tool-registry.js`, `session-manager.js`, `event-system.js`

**Test Plan:**
1. Start listens on port
2. RegisterMethod adds handler
3. JSON-RPC request invokes handler
4. Invalid method returns error
5. Authentication checked if enabled
6. Stop closes server
7. Batch requests handled
8. Error formatting consistent
9. Request logging to event-system
10. Rate limiting on requests

**Code Sketch:**
```javascript
class RPCServer {
  constructor(port = 7432) {
    this.port = port; this.methods = new Map(); this.server = null;
  }
  start() {
    this.server = http.createServer((req, res) => {
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const result = await this._handleRequest(request);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: err.message } }));
        }
      });
    });
    this.server.listen(this.port);
    emitEvent('rpc_server_started', { port: this.port });
  }
  stop() {
    if (this.server) { this.server.close(); this.server = null; }
    emitEvent('rpc_server_stopped', {});
  }
  registerMethod(name, handler) {
    this.methods.set(name, handler);
    emitEvent('rpc_method_registered', { name });
  }
  unregisterMethod(name) { return this.methods.delete(name); }
  async _handleRequest(request) {
    const method = this.methods.get(request.method);
    if (!method) return { success: false, error: `Unknown method: ${request.method}` };
    return await method(request.params, { requestId: request.id, timestamp: new Date().toISOString() });
  }
}
```

---

### scripts/metrics-collector.js

**Purpose:** Performance metrics collection and reporting.

**API:**
```javascript
class MetricsCollector {
  constructor(storePath = 'memory/metrics.json')
  record(metric: Metric): void
  get(name: string, since?: string): MetricPoint[]
  aggregate(name: string, window: string): AggregatedMetric
  export(format: 'json'|'csv'|'prometheus'): string
  getDashboard(): DashboardData
}
```

**Data Structures:**
```javascript
// Metric
{ name: string, value: number, unit: string, labels: object,
  timestamp: string, source: string }

// MetricPoint
{ timestamp: string, value: number, labels: object }

// AggregatedMetric
{ name: string, count: number, sum: number, avg: number,
  min: number, max: number, p50: number, p95: number, p99: number }

// DashboardData
{ metrics: string[], timeRange: { from: string, to: string },
  panels: [{ title: string, metric: string, type: string }] }

// Store: memory/metrics.json (rotated when >10MB)
```

**Dependencies:** `event-system.js`, `cost-tracker.js`, `job-queue.js`

**Test Plan:**
1. Record stores metric
2. Get returns metrics by name
3. Aggregate computes statistics
4. Export produces valid formats
5. Dashboard returns panel config
6. Metric labels filtered correctly
7. Time range filtering works
8. Store rotation at size limit
9. Metric names are valid
10. Duplicate timestamps handled

**Code Sketch:**
```javascript
class MetricsCollector {
  constructor(storePath = 'memory/metrics.json') {
    this.storePath = storePath; this.buffer = [];
    this.maxSize = 10 * 1024 * 1024; // 10MB
    this._loadStore();
  }
  record(metric) {
    const point = { timestamp: new Date().toISOString(), value: metric.value,
      labels: metric.labels || {} };
    this.buffer.push({ name: metric.name, ...point });
    if (this.buffer.length > 1000) this._flush();
    emitEvent('metric_recorded', { name: metric.name, value: metric.value });
  }
  get(name, since) {
    return this.buffer.filter(m => m.name === name && (!since || m.timestamp >= since));
  }
  aggregate(name, window = '1h') {
    const points = this.get(name, new Date(Date.now() - this._parseWindow(window)).toISOString());
    if (points.length === 0) return { name, count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    const values = points.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    return { name, count: values.length, sum, avg: sum / values.length,
      min: values[0], max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)] };
  }
  export(format = 'json') {
    if (format === 'json') return JSON.stringify(this.buffer, null, 2);
    if (format === 'csv') {
      const headers = 'timestamp,name,value,labels\n';
      return headers + this.buffer.map(m =>
        `${m.timestamp},${m.name},${m.value},${JSON.stringify(m.labels)}`).join('\n');
    }
    if (format === 'prometheus') {
      return this.buffer.map(m =>
        `${m.name}{${Object.entries(m.labels).map(([k, v]) => `${k}="${v}"`).join(',')}} ${m.value}`).join('\n');
    }
    return '';
  }
  getDashboard() {
    const metrics = [...new Set(this.buffer.map(m => m.name))];
    return { metrics, timeRange: { from: new Date(Date.now() - 86400000).toISOString(), to: new Date().toISOString() },
      panels: metrics.map(m => ({ title: m, metric: m, type: 'line' })) };
  }
  _flush() {
    const existing = fs.existsSync(this.storePath) ? JSON.parse(fs.readFileSync(this.storePath, 'utf8')) : [];
    const combined = [...existing, ...this.buffer];
    fs.writeFileSync(this.storePath, JSON.stringify(combined, null, 2));
    if (fs.statSync(this.storePath).size > this.maxSize) this._rotate();
    this.buffer = [];
  }
  _rotate() {
    const backup = this.storePath.replace('.json', `-${Date.now()}.json`);
    fs.renameSync(this.storePath, backup);
  }
  _parseWindow(window) {
    const unit = window.slice(-1);
    const val = parseInt(window.slice(0, -1));
    return val * (unit === 'h' ? 3600000 : unit === 'm' ? 60000 : unit === 'd' ? 86400000 : 1000);
  }
}
```

---

## Build Order Summary

| Tier | Scripts | Week |
|------|---------|------|
| **Tier 1: Foundation** | tool-registry, job-queue, session-manager, agent-registry | Week 1 |
| **Tier 2: Agent System** | task-tool, agent-profiles, agent-dispatch, isolation-manager | Week 2 |
| **Tier 3: Knowledge** | ingest-queue, wiki-engine, knowledge-graph, vector-store | Week 3 |
| **Tier 4: Orchestration** | workflow-engine, dark-factory, github-state-machine, validation-harness | Week 4 |
| **Tier 5: Extensions** | hook-manager, extension-loader, rpc-server, metrics-collector | Week 5 |

---

## Cross-Cutting Concerns

### Event System Integration
All scripts emit events via `event-system.js`:
- Lifecycle events: `script_loaded`, `script_unloaded`
- Operation events: `tool_call`, `tool_result`, `tool_error`
- Agent events: `subagent_spawn`, `subagent_complete`, `subagent_fail`
- Workflow events: `workflow_start`, `workflow_complete`, `workflow_error`
- Factory events: `factory_tick`, `factory_issue_triage`, `factory_pr_validate`

### Cost Tracking
All LLM calls go through `cost-tracker.js`:
- Track per-session spend
- Track per-script spend
- Alert at $10/day threshold
- Budget enforcement in workflow nodes

### Checkpoint Integration
All long-running operations use `checkpoint.js`:
- Workflow engine: checkpoint after every node
- Job queue: checkpoint job state in SQLite
- Session manager: checkpoint on compact/branch
- Factory: checkpoint on every tick

### Error Handling
All scripts follow `CLAUDE.md` rules:
- Return `{ success: false, error: string }` objects
- Log errors to `event-system.js` before returning
- Never swallow errors silently
- Always include context in error messages

---

*End of Loop 3 Implementation Specs*
