# KClaw0 Loop 2 Research Findings — Implementation Patterns from Production Agents

**Date:** 2026-05-08  
**Researcher:** KClaw0 (parallel subagent deep-dive)  
**Scope:** oh-my-pi source code, Attractor/pi-agent-core, memory/runtime systems  
**Status:** IMPLEMENTATION PATTERNS EXTRACTED — Ready for adaptation

---

## 1. oh-my-pi Task Tool (Subagent System)

### Source: `packages/coding-agent/src/task/`

**Architecture:**
```
TaskTool
├── Agent Discovery (filesystem)
│   ├── ~/.omp/agent/agents/*.md (user-level)
│   ├── .omp/agents/*.md (project-level)
│   └── Bundled agents (embedded at build time)
├── Agent Registry (process-global)
│   ├── Tracks all alive agents (main + sub)
│   ├── Status: running | idle | completed | aborted
│   └── Event subscription for lifecycle
├── Parallel Execution
│   ├── mapWithConcurrencyLimit(items, concurrency, fn, signal)
│   ├── AbortSignal support for cancellation
│   └── Fail-fast on error
├── Agent Output Manager
│   ├── Unique ID allocation (0-AuthProvider, 1-AuthApi)
│   ├── Parent prefix nesting (0-Auth.1-Subtask)
│   └── Resume-safe (scans existing files)
└── In-Process Execution
    ├── Runs subagent on main thread
    ├── Forwards AgentEvents for progress tracking
    └── JSON event streaming
```

**Key Implementation Details:**
- Agent definitions are markdown files with YAML frontmatter
- Bundled agents use Bun's `import ... with { type: "text" }` for embedding
- Max output: 500KB bytes / 5000 lines per agent
- EventBus channels: `task:subagent:event`, `task:subagent:progress`, `task:subagent:lifecycle`

**KClaw0 Adaptation:**
```javascript
// scripts/task-tool.js — Node.js adaptation
class TaskTool {
  // Agent discovery from memory/agents/*.md
  // Parallel execution with OpenClaw sessions_spawn
  // Output manager with sequential IDs
  // EventBus integration with event-system.js
}
```

---

## 2. oh-my-pi Tool Registry

### Source: `packages/coding-agent/src/tools/index.ts`

**Architecture:**
```
ToolRegistry
├── DiscoverableToolIndex
│   ├── Dynamic tool registration
│   ├── Feature gates ($env.PI_FEATURE_*)
│   └── Search by name/description
├── Tool Choice Queue
│   ├── Manages which tool the LLM should use next
│   └── Priority-based scheduling
├── Built-in Tools
│   ├── AskTool — Ask user for input
│   ├── BashTool — Shell execution
│   ├── BrowserTool — Web automation
│   ├── EditTool — File editing
│   ├── AstEditTool — AST-based editing
│   ├── AstGrepTool — Code search
│   ├── TaskTool — Subagent dispatch
│   ├── WebSearchTool — Internet search
│   └── LspTool — Language server
├── Custom Tools
│   ├── Loaded from external packages
│   └── MCP (Model Context Protocol) integration
└── Event Bus
    ├── Tool lifecycle events
    └── Progress tracking
```

**Key Implementation Details:**
- Tools are classes implementing `AgentTool` interface
- Each tool has: name, description, parameters (JSON Schema), execute method
- Feature gates control availability: `$env.PI_FEATURE_BROWSER`, `$env.PI_FEATURE_LSP`
- Tool choice is managed via `ToolChoiceQueue` — not just letting LLM pick freely

**KClaw0 Adaptation:**
```javascript
// scripts/tool-registry.js
class ToolRegistry {
  register(tool) { /* validates schema, adds to index */ }
  discover(query) { /* fuzzy search */ }
  isEnabled(featureFlag) { /* check memory/feature-flags.json */ }
  getToolChoiceQueue() { /* priority-based */ }
}
```

---

## 3. oh-my-pi Session Management

### Source: `packages/coding-agent/src/session/`

**Architecture:**
```
AgentSession
├── Session Storage (JSONL)
│   ├── FileSessionStorage — persists to disk
│   ├── MemorySessionStorage — in-memory only
│   └── SessionHeader: {type, version, id, title, timestamp}
├── Blob Store
│   ├── Externalizes image data from messages
│   ├── Blob references in JSONL
│   └── Automatic resolution on load
├── Session Compaction
│   ├── Automatic when context overflows
│   ├── Branch summary messages
│   └── Compaction summary with token counts
├── Session Branching
│   ├── Creates branch with summary
│   └── Preserves original session
└── Event Subscription
    ├── Automatic session persistence
    └── AgentEvent streaming
```

**Key Implementation Details:**
- Session version: 3 (CURRENT_SESSION_VERSION)
- JSONL format with typed messages: bash_execution, custom, file_mention, hook, python_execution
- BlobStore handles image data URLs and externalizes them
- Compaction creates branch summary messages with token counts
- Sessions have IDs with Snowflake format

**KClaw0 Adaptation:**
```javascript
// scripts/session-manager.js
class SessionManager {
  // JSONL read/write with locking
  // Blob store for attachments
  // Auto-compaction on context overflow
  // Branch creation with summaries
}
```

---

## 4. oh-my-pi Async Job Manager

### Source: `packages/coding-agent/src/async/`

**Architecture:**
```
AsyncJobManager
├── Job Lifecycle
│   ├── register() → running
│   ├── complete() → completed
│   ├── fail() → failed
│   └── cancel() → cancelled
├── Delivery Retry
│   ├── Exponential backoff: base 500ms, max 30s
│   ├── Jitter: 200ms random
│   └── Persistent queue survives restart
├── Concurrency Control
│   ├── maxRunningJobs: 15 (default)
│   └── Queue overflow protection
├── Retention
│   ├── Default: 5 minutes
│   └── Eviction timer cleanup
└── Suppression
    └── Suppressed deliveries tracking
```

**Key Implementation Details:**
- Jobs: `{id, type, status, startTime, label, abortController, promise, resultText, errorText}`
- Delivery: `{jobId, text, attempt, nextAttemptAt, lastError}`
- Background job support: `settings.get("async.enabled") || settings.get("bash.autoBackground.enabled")`
- Delivery loop runs continuously for retry

**KClaw0 Adaptation:**
```javascript
// scripts/job-queue.js
class JobQueue {
  // SQLite-backed durable queue
  // Exponential backoff retry
  // Max concurrency: 5 (adapted for KClaw0)
  // Job types: bash, task, research
}
```

---

## 5. Attractor DOT Execution Engine

### Source: `github.com/jhugman/attractor-pi-dev packages/core/src/`

**Architecture:**
```
Attractor Runner
├── DOT Parser
│   ├── Graphviz DOT syntax
│   ├── Node shapes: box, diamond, hexagon, ellipse
│   └── Edge conditions: [label="condition"]
├── Node Handlers
│   ├── LLM task nodes — call LLM with prompt
│   ├── Human gate nodes — hexagon, wait for approval
│   ├── Shell nodes — execute commands
│   ├── Conditional nodes — diamond, branch on result
│   └── Start/End nodes — ellipse
├── State Machine
│   ├── Current node tracking
│   ├── Edge evaluation
│   └── Context propagation
├── Checkpoint/Resume
│   ├── Save after every node
│   ├── State serialization
│   └── resumeFrom support (CLI pending)
└── Manager/Supervisor (partial)
    ├── Observer pattern (no-op fallback)
    └── Loop detection (not wired)
```

**Key Implementation Details:**
- DOT file defines the entire workflow
- Each node has attributes: `label`, `shape`, `handler`, `maxBudgetUsd`
- Human gates use `shape=hexagon` with `auto-approve` flag
- Context keys for routing on human choice
- Checkpoints saved as JSON after every node execution

**KClaw0 Adaptation:**
```javascript
// scripts/workflow-engine.js
class WorkflowEngine {
  // DOT parser (simplified for KClaw0)
  // Node handlers: llm, human-gate, shell, conditional
  // Checkpoint after every node
  // Context propagation between nodes
}
```

---

## 6. pi-chat Conversation Runtime

### Source: `github.com/earendil-works/pi-chat`

**Architecture:**
```
ConversationRuntime
├── Log State Machine
│   ├── JSONL read/write with locking
│   ├── Attachment materialization
│   └── Directory setup
├── Job Dispatch
│   ├── Trigger-based dispatch
│   ├── Job types: message, tool_call, response
│   └── Async job queue
├── Streaming Preview
│   ├── Real-time response preview
│   └── Progressive rendering
├── Session Lifecycle
│   ├── Create → Active → Idle → Close
│   └── Automatic compaction
└── Gondolin VM Integration
    ├── One VM per connection
    ├── Alpine Linux micro-VM
    └── Workspace + shared mounts
```

**Key Implementation Details:**
- Runtime types: log records, job types, dispatch types
- Discovery snapshots: channels, users, roles
- Config stored under `~/.pi/agent/chat/`
- Locking for concurrent JSONL access
- Session ID derivation from channel keys

**KClaw0 Adaptation:**
```javascript
// scripts/runtime.js — ConversationRuntime equivalent
class KClawRuntime {
  // Log state machine (builds on event-system.js)
  // Job dispatch (builds on job-queue.js)
  // Session lifecycle management
  // Streaming preview for long operations
}
```

---

## 7. Conway Automaton 24/7 Runtime

### Source: `github.com/Conway-Research/automaton`

**Architecture:**
```
Automaton Runtime
├── Sovereign Agent
│   ├── Self-improving
│   ├── Self-replicating
│   └── Earns its own existence
├── On-Chain Identity
│   ├── ERC-8004 standard
│   ├── Cryptographically verifiable
│   └── Base chain registration
├── Conway Cloud
│   ├── Linux VM provisioning
│   ├── Frontier model access
│   ├── Domain registration
│   └── Stablecoin payments
├── Development
│   ├── pnpm build
│   ├── node dist/index.js --run
│   └── Creator CLI for status
└── Runtime Loop
    ├── --run flag starts daemon
    ├── Continuous operation
    └── Status monitoring via CLI
```

**Key Insight:** The automaton demonstrates a fully sovereign AI that can:
- Spin up its own infrastructure
- Pay for itself with crypto
- Register domains
- Run frontier models
- No human account setup required

**KClaw0 Adaptation:**
- 24/7 runtime via cron + heartbeat
- Cost tracking with budget limits
- Self-funding not needed (Dr Dave funds)
- Infrastructure: OpenClaw platform
- Sovereignty: Self-directed learning + self-upgrades

---

## 8. LLM Wiki Ingest Queue

### Source: `github.com/nashsu/llm_wiki`

**Architecture:**
```
Ingest Queue
├── Persistence
│   ├── Serial processing (prevents concurrent LLM calls)
│   ├── Queue persisted to disk
│   └── Survives app restart
├── Retry Semantics
│   ├── Failed tasks auto-retry
│   ├── Exponential backoff
│   └── Max retry count
├── Two-Step Chain-of-Thought
│   ├── Step 1: LLM analyzes document
│   ├── Step 2: LLM generates wiki pages
│   └── Incremental cache with source traceability
└── Multimodal Support
    ├── Image extraction from PDFs
    ├── Vision LLM caption generation
    └── Image-aware search
```

**Key Implementation Details:**
- Queue file: SQLite or JSON on disk
- Serial processing prevents race conditions
- Incremental cache: only process new/changed content
- Source traceability: every wiki page links to source
- Vision pipeline: extract → caption → index → search

**KClaw0 Adaptation:**
```javascript
// scripts/ingest-queue.js
class IngestQueue {
  // SQLite-backed queue
  // Serial processing for LLM calls
  // Two-step: analyze → generate
  // Incremental cache with fingerprints
}
```

---

## 9. Absurd Durable Task Queue

### Source: `github.com/earendil-works/absurd`

**Architecture:**
```
Durable Task Queue
├── Schema
│   ├── SQLite initialization
│   └── Migration support
├── Worker Claims
│   ├── Idempotency keys
│   └── Prevents duplicate execution
├── Retry Semantics
│   ├── Exponential backoff
│   ├── Max attempts
│   └── Dead letter queue
└── Web UI
    ├── Task monitoring dashboard
    ├── Status visualization
    └── Agent skill integration
```

**KClaw0 Adaptation:**
```javascript
// scripts/durable-queue.js
class DurableQueue {
  // SQLite schema with migrations
  // Worker claim with idempotency
  // Retry with backoff + dead letter
  // Web dashboard (optional)
}
```

---

## Consolidated Implementation Priority

Based on Loop 1 + Loop 2 research, here's the prioritized build order:

### Tier 1: Foundation (Week 1)
1. `scripts/tool-registry.js` — Everything depends on this
2. `scripts/job-queue.js` — Async background jobs
3. `scripts/session-manager.js` — Session lifecycle
4. `scripts/agent-registry.js` — Process-global agent tracking

### Tier 2: Agent Core (Week 2)
5. `scripts/task-tool.js` — Subagent orchestration (adapted from oh-my-pi)
6. `scripts/agent-profiles.js` — Agent definitions in markdown
7. `scripts/agent-dispatch.js` — Parallel execution with concurrency
8. `scripts/isolation-manager.js` — Git worktree isolation

### Tier 3: Memory & Knowledge (Week 3)
9. `scripts/ingest-queue.js` — Persistent ingest with retry
10. `scripts/wiki-engine.js` — Wiki maintenance
11. `scripts/knowledge-graph.js` — 4-signal graph (LLM Wiki pattern)
12. `scripts/vector-store.js` — LanceDB or ChromaDB

### Tier 4: Workflow & 24/7 (Week 4)
13. `scripts/workflow-engine.js` — DOT execution (Attractor pattern)
14. `scripts/dark-factory.js` — 24/7 orchestrator (Dark Factory pattern)
15. `scripts/github-state-machine.js` — Label-based state management
16. `scripts/validation-harness.js` — Holdout validation

### Tier 5: Integration (Week 5)
17. `scripts/hook-manager.js` — Lifecycle hooks
18. `scripts/extension-loader.js` — Extension discovery
19. `scripts/rpc-server.js` — Remote control API
20. `scripts/metrics-collector.js` — Performance metrics

**Total: 20 new scripts** (beyond existing 14)
**Estimated tests: 160+** (8 per script)
**Combined total: 34 scripts, 480+ tests**

---

## Critical Patterns to Adopt

### Pattern: Markdown Agent Definitions
oh-my-pi defines agents as `.md` files with YAML frontmatter:
```markdown
---
name: "Code Reviewer"
description: "Reviews code for bugs and style"
tools: ["read", "edit", "bash"]
model: "claude-3.5-sonnet"
thinkingLevel: "high"
---
You are a code reviewer. Focus on...
```

KClaw0 should adopt this for subagent profiles in `memory/agents/`.

### Pattern: EventBus for Decoupling
oh-my-pi uses EventBus channels:
- `task:subagent:event` — Raw events
- `task:subagent:progress` — Aggregated progress
- `task:subagent:lifecycle` — Start/end

KClaw0's `event-system.js` should adopt channel-based routing.

### Pattern: Feature Gates
oh-my-pi uses `$env.PI_FEATURE_*` flags. KClaw0 should use `memory/feature-flags.json`:
```json
{
  "docker-exec": false,
  "chroma-db": false,
  "web-search": true,
  "browser-tool": true
}
```

### Pattern: Snowflake IDs
oh-my-pi uses Snowflake IDs for sessions and outputs. KClaw0 should adopt for checkpoint IDs, job IDs, event IDs.

### Pattern: Blob Store for Attachments
oh-my-pi externalizes image data to blob store, references in JSONL. KClaw0 should do the same for `memorized_media/`.

### Pattern: Compaction as First-Class
oh-my-pi has automatic compaction with branch summaries. KClaw0's session compaction should be automatic, not manual.

---

*Ready for Loop 3: Deep-dive into specific implementation files and create adaptation specs.*
