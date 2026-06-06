# KClaw0 Loop 1 Research Findings — MASSIVE Structure & Automation Gaps Identified

**Date:** 2026-05-08  
**Researcher:** KClaw0 (self-research via parallel subagents + direct search)  
**Scope:** 15 repositories analyzed  
**Status:** CRITICAL GAPS FOUND — KClaw0 is missing ~80% of production agent infrastructure

---

## Executive Summary

The research reveals KClaw0 has built a solid **foundation** (14 scripts, 317 tests) but is missing an **enormous** amount of structure and automation that production agent systems have. The gap is not incremental — it's architectural. Production systems like oh-my-pi, pi-agent-core, and Attractor have 10-20x more infrastructure.

**Key Realization:** KClaw0 is at "Phase 0.5" of a 5-phase maturity model. The swarm plan must be **radically expanded**.

---

## Maturity Model (Discovered from Repos)

| Phase | Name | What KClaw0 Has | What's Missing |
|-------|------|----------------|----------------|
| P0 | Bootstrap | ✓ Basic memory, simple scripts | — |
| P1 | Runtime | ✓ Event system, fingerprinting, staleness | — |
| P2 | Safety | ✓ Loop detection, steering, followup | — |
| P3 | Persistence | ✓ Checkpoint, cost tracking | — |
| **P4** | **Agent Core** | **✗ NOTHING** | Task tool, subagent orchestration, session management, compaction |
| **P5** | **Tool Harness** | **✗ NOTHING** | 25+ tools, custom tool registry, LSP, browser, python execution |
| **P6** | **Memory System** | **✗ PARTIAL** | MemPalace only; missing wiki layer, ingest queue, vector search, knowledge graph |
| **P7** | **Workflow Engine** | **✗ NOTHING** | DOT pipelines, conditional routing, parallel fan-out/fan-in, human gates |
| **P8** | **Integration** | **✗ NOTHING** | GitHub PR workflow, skills system, hooks, extensions, MCP |
| **P9** | **Observability** | **✓ Partial** | Event system exists; missing metrics, dashboards, alerting |
| **P10** | **24/7 Runtime** | **✗ NOTHING** | Heartbeat, survival, sandboxing, VM isolation |

---

## Critical Missing Systems (Priority Order)

### 1. TASK / SUBAGENT ORCHESTRATION SYSTEM (P4) — HIGHEST PRIORITY

**What oh-my-pi has:**
- `task` tool: Launch subagents for parallel execution
- 6 bundled agents: explore, plan, designer, reviewer, task, quick_task
- Parallel exploration: Reviewer spawns explore agents for large codebases
- Real-time artifact streaming: Outputs stream as created
- Isolation backends: git worktrees, fuse-overlay filesystems, Windows ProjFS
- Async background jobs: Up to 100 concurrent jobs
- `poll` tool: Block on async jobs
- Agent Control Center: `/agents` dashboard
- Per-agent model overrides
- User-level + project-level custom agents

**What KClaw0 needs:**
- `scripts/task-tool.js` — Subagent orchestration with isolation
- `scripts/agent-profiles.js` — Agent type definitions + model assignment
- `scripts/agent-dispatch.js` — Spawn, monitor, consolidate
- `scripts/isolation-manager.js` — Git worktree / filesystem isolation
- `scripts/job-queue.js` — Async background job management

### 2. TOOL HARNESS SYSTEM (P5) — HIGHEST PRIORITY

**What oh-my-pi has (25+ tools):**
| Tool | Purpose |
|------|---------|
| `bash` | Shell execution |
| `python` | Python in IPython kernel |
| `calc` | Deterministic calculator |
| `ssh` | Remote execution |
| `edit` | Hash-anchored in-place editing |
| `find` | File glob search |
| `grep` | Content search |
| `ast_grep` | Structural code search |
| `ast_edit` | Structural code rewrite |
| `lsp` | Language server (11 ops) |
| `notebook` | Jupyter notebook editing |
| `read` | File/directory reading |
| `browser` | Puppeteer automation |
| `task` | Subagent launch |
| `poll` | Block on async jobs |
| `todo_write` | Phased task tracking |
| `fetch` | URL retrieval |
| `web_search` | Multi-provider search |
| `write` | File creation |
| `generate_image` | Image generation |
| `ask` | Structured user questions |

**What KClaw0 needs:**
- `scripts/tool-registry.js` — Dynamic tool registration/discovery
- `scripts/custom-tool-loader.js` — Load tools from `~/.kclaw/tools/`
- `scripts/python-exec.js` — Python execution via IPython or child_process
- `scripts/browser-tool.js` — Puppeteer integration (already have browser tool via OpenClaw but not exposed as agent tool)
- `scripts/hash-edit.js` — Hash-anchored file editing (more reliable than string replacement)

### 3. AGENT SESSION MANAGEMENT (P4)

**What pi-agent-core has:**
- `AgentSession` with persistence, storage, compaction, artifacts
- Session file format: JSONL with structured records
- Compaction: Summarize old messages to reduce context
- Branching: Create session branches for parallel work
- Session resume: `--resume` flag with partial ID matching
- Session directory: `~/.omp/agent/sessions/`
- Artifacts: Named outputs from agent turns
- `SessionManager` for multi-session orchestration

**What KClaw0 needs:**
- `scripts/session-manager.js` — Multi-session lifecycle
- `scripts/session-compaction.js` — Context window management
- `scripts/artifact-tracker.js` — Named output tracking
- Session JSONL format compatible with pi-agent-core

### 4. WORKFLOW ENGINE (P7)

**What Attractor has:**
- DOT-based workflow definition
- 9 node types: start, exit, LLM task, human gate, conditional, parallel fan-out, parallel fan-in, external tool, manager loop
- Edge conditions: outcome-based, tool output-based, LLM response-based, retry count-based
- Subgraph defaults with inheritance
- Checkpoint after every node
- Retry with `max_retries`, `allow_partial`, `retry_target`
- Goal gates: Must succeed before exit
- Loop restart capability
- CLI: validate, run, serve (HTTP server)
- Simulation mode (no LLM calls)

**What KClaw0 needs:**
- `scripts/workflow-engine.js` — DOT parser + execution engine
- `scripts/node-handlers.js` — Handler implementations for each node type
- `scripts/condition-evaluator.js` — Edge condition evaluation
- `pipelines/` directory for `.dot` workflow files

### 5. MEMORY / KNOWLEDGE SYSTEM (P6)

**What LLM Wiki has:**
- 3-layer architecture: Raw Sources → Wiki → Schema
- Operations: Ingest, Query, Lint
- 4-Signal Knowledge Graph: direct links, source overlap, Adamic-Adar, type affinity
- Louvain Community Detection for automatic clustering
- Persistent Ingest Queue with crash recovery
- Async Review System: LLM flags items for human judgment
- LanceDB for vector semantic search
- Deep Research: Multi-query web search, auto-ingest results
- [[wikilink]] syntax for cross-references
- YAML frontmatter on every page
- Obsidian vault compatibility

**What KClaw0 needs:**
- `scripts/wiki-engine.js` — Wiki maintenance system
- `scripts/ingest-queue.js` — Persistent ingest with crash recovery
- `scripts/knowledge-graph.js` — 4-signal graph with Louvain clustering
- `scripts/vector-store.js` — LanceDB integration (lighter than ChromaDB)
- `scripts/deep-research.js` — Multi-query research pipeline
- Wiki directory structure under `memory/wiki/`

### 6. HOOKS & EXTENSIONS SYSTEM (P8)

**What oh-my-pi has:**
- Hooks: TypeScript modules subscribing to lifecycle events
- Global hooks: `~/.omp/agent/hooks/pre/*.ts`, `post/*.ts`
- Project hooks: `.omp/hooks/pre/*.ts`, `post/*.ts`
- CLI hooks: `--hook <path>`
- Events: `tool_call`, `session_start`, `session_end`, etc.
- Can block tool execution from hooks
- Can inject messages from hooks
- Custom tools: Auto-discovered from `~/.omp/agent/tools/*/`
- Extensions: `pi install /path/to/extension`
- Skills: Auto-discovered from `~/.omp/agent/skills/`

**What KClaw0 needs:**
- `scripts/hook-manager.js` — Event subscription + hook execution
- `scripts/extension-loader.js` — Extension discovery + loading
- `scripts/skill-registry.js` — Skill discovery + injection
- `~/.kclaw/hooks/`, `~/.kclaw/extensions/`, `~/.kclaw/skills/` directories

### 7. CODE REVIEW SYSTEM (P8)

**What oh-my-pi has:**
- `/review` command with 3 modes: branch comparison, uncommitted changes, commit review
- `report_finding` tool with priority levels: P0 (critical) → P3 (nit)
- Verdict rendering: approve / request-changes / comment
- Structured findings with result tree

**What KClaw0 needs:**
- `scripts/code-review.js` — Automated review pipeline
- Priority-based finding tracking
- Integration with GitHub PRs

### 8. SANDBOXING / VM ISOLATION (P10)

**What Gondolin has:**
- Local Linux micro-VMs with QEMU
- Programmable HTTP/TLS egress policy (allowlists + hooks)
- Secret injection without guest exposure
- Programmable VFS mounts (custom filesystem behavior in JS)
- Disk checkpoints with resume
- Custom image builds (Alpine-based)
- SSH support

**What KClaw0 needs:**
- `scripts/sandbox-manager.js` — VM lifecycle management
- `scripts/egress-policy.js` — Network policy enforcement
- `scripts/secret-injector.js` — Secure credential injection
- Gondolin integration or Docker-based alternative

### 9. RPC & REMOTE CONTROL (P8)

**What pi-chat has:**
- RPC protocol for remote control
- Commands: `stop`, `status`, `compact`, `new`
- JSONL logs per channel
- Trigger-based dispatch
- Streaming preview responses
- Reply-to-trigger

**What KClaw0 needs:**
- `scripts/rpc-server.js` — HTTP server for remote control
- `scripts/remote-commands.js` — Stop, status, compact, new session
- REST API for external integration

### 10. DURABLE TASK QUEUE (P10)

**What Absurd has:**
- SQLite-based durable task queue
- Schema initialization and migration
- Worker claims and idempotency keys
- Retry semantics with backoff
- Web UI for task monitoring
- Agent skill for database interaction

**What KClaw0 needs:**
- `scripts/task-queue.js` — Durable task queue with SQLite
- `scripts/worker-pool.js` — Worker claim system
- Retry with exponential backoff

### 11. DARK FACTORY PATTERN (P10) — GOVERNANCE & AUTONOMY

**What coleam00/dark-factory-experiment has:**
- **24/7 Orchestrator:** Cron every 4-6 hours, reads GitHub state, dispatches one Archon workflow at a time
- **GitHub as State Machine:**
  - Issues: `factory:triaging` → `factory:accepted` → `factory:in-progress` → PR or `factory:rejected`
  - PRs: `factory:implementing` → `factory:needs-review` → `factory:approved` (auto-merge) or `factory:needs-fix` → max 2 retries → `factory:needs-human`
- **3 Workflows:** triage → fix-github-issue → validate-pr
- **Governance Layer (IMMUTABLE):**
  - `MISSION.md` — constitutional document, defines scope and goals
  - `FACTORY_RULES.md` — operational rules, what the factory can/cannot do
  - `CLAUDE.md` — code style guide
  - **NEVER modified by the factory** (security hard-fail)
- **Validation Strategy:**
  - Validator NEVER reads implementation plan (holdout pattern from StrongDM)
  - Only checks outcome against issue
  - Regression tests against entire feature suite
  - Fix workflow feeds test failures back to AI
- **Economic Optimization:** MiniMax M2.7 instead of Anthropic (cheaper for continuous operation)
- **Flood Protection:** 3 issues/day non-owner cap
- **Per-Node Budget Caps:** Every workflow node has `maxBudgetUsd`

**What KClaw0 needs:**
- `scripts/dark-factory.js` — Orchestrator loop
- `memory/MISSION.md` — Constitutional document
- `memory/FACTORY_RULES.md` — Operational rules
- `memory/CLAUDE.md` — Code style guide
- `scripts/github-state-machine.js` — Label-based state management
- `scripts/validation-harness.js` — Holdout validation pattern
- `scripts/flood-protection.js` — Rate limiting
- `scripts/budget-caps.js` — Per-node budget enforcement

---

## KClaw0's Current Position vs Target

### Current (P0-P3): ~6,200 lines, 14 scripts
```
scripts/
├── fingerprint.js          (401 lines)
├── staleness.js            (364 lines)
├── event-system.js         (346 lines)
├── loop-detection.js       (457 lines)
├── steering-queue.js       (287 lines)
├── followup-queue.js       (383 lines)
├── checkpoint.js           (510 lines)
├── cost-tracker.js         (392 lines)
├── docker-exec.js          (574 lines) [mock]
├── chroma-integration.js     (658 lines) [mock]
├── gitnexus-integration.js (641 lines) [mock]
├── llm-client.js           (1021 lines)
├── mempalace-integration.js (628 lines)
└── test-all.js             (136 lines)
```

### Target (P4-P10): Estimated ~25,000-35,000 lines, 40-50 scripts
```
scripts/
# P4 — Agent Core
├── task-tool.js            # Subagent orchestration
├── agent-profiles.js        # Agent type definitions
├── agent-dispatch.js        # Spawn/monitor/consolidate
├── isolation-manager.js     # Git worktree isolation
├── job-queue.js             # Async background jobs
├── session-manager.js       # Multi-session lifecycle
├── session-compaction.js    # Context management
├── artifact-tracker.js      # Named outputs

# P5 — Tool Harness
├── tool-registry.js         # Dynamic tool registration
├── custom-tool-loader.js    # Load custom tools
├── python-exec.js           # Python execution
├── hash-edit.js             # Hash-anchored editing

# P6 — Memory/Knowledge
├── wiki-engine.js           # Wiki maintenance
├── ingest-queue.js          # Persistent ingest
├── knowledge-graph.js       # 4-signal graph
├── vector-store.js          # LanceDB integration
├── deep-research.js         # Multi-query research

# P7 — Workflow Engine
├── workflow-engine.js        # DOT parser + executor
├── node-handlers.js         # Node implementations
├── condition-evaluator.js   # Edge evaluation

# P8 — Integration
├── hook-manager.js          # Lifecycle hooks
├── extension-loader.js      # Extension discovery
├── skill-registry.js        # Skill injection
├── code-review.js          # Automated review
├── github-integration.js   # PR workflow

# P9 — Observability
├── metrics-collector.js     # Performance metrics
├── dashboard-server.js      # Web dashboard
├── alerting-system.js       # Alert rules

# P10 — 24/7 Runtime
├── heartbeat.js             # Scheduled execution
├── survival.js              # Budget/lifecycle
├── sandbox-manager.js       # VM isolation
├── rpc-server.js            # Remote control API
├── task-queue.js            # Durable queue
├── worker-pool.js           # Worker management
```

---

## Swarm Plan Update: New Phase Structure

The original 4-phase plan is insufficient. Here's the **expanded 10-phase plan**:

```
PHASE 1: Foundation Hardening (Agents 1-9)
├── ChromaDB install + real integration (3)
├── GitNexus install + real integration (3)
└── LanceDB alternative setup (3)

PHASE 2: Agent Core (Agents 10-25)
├── Task/Subagent tool (5)
├── Agent profiles + dispatch (5)
├── Session manager + compaction (5)
└── Job queue + isolation (5)

PHASE 3: Tool Harness (Agents 26-40)
├── Tool registry + custom loader (5)
├── Python exec + hash edit (5)
├── Browser tool enhancement (5)
└── LSP integration (5)

PHASE 4: Memory System (Agents 41-55)
├── Wiki engine + ingest queue (5)
├── Knowledge graph (5)
├── Vector store (LanceDB) (5)
└── Deep research pipeline (5)

PHASE 5: Workflow Engine (Agents 56-65)
├── DOT parser (5)
├── Node handlers (5)
└── Condition evaluator + CLI (5)

PHASE 6: Hooks & Extensions (Agents 66-75)
├── Hook manager (5)
├── Extension loader (5)
├── Skill registry (5)
└── Code review system (5)

PHASE 7: Integration (Agents 76-85)
├── GitHub PR workflow (5)
├── RPC server (5)
├── Remote commands (5)
└── Metrics + dashboard (5)

PHASE 8: 24/7 Runtime (Agents 86-95)
├── Heartbeat scheduler (5)
├── Survival system (5)
├── Sandbox manager (5)
└── Worker pool (5)

PHASE 9: End-to-End Testing (Agents 96-110)
├── Integration tests (10)
├── Stress tests (5)
└── Documentation (10)

PHASE 10: Verification & Handoff (Agents 111-120)
├── Final verification (5)
├── Performance benchmarks (5)
└── PR creation + merge (5)
```

**Total: 120 swarm agents** (was 40)

---

## Test Target Update

| Metric | Original | Updated |
|--------|----------|---------|
| Test suites | 18 | 50+ |
| Test assertions | 350+ | 1000+ |
| Pass rate | 100% | 100% |
| Scripts | 18 | 50+ |
| Lines of code | ~10,000 | ~35,000 |

---

## Immediate Actions for KClaw0

1. **Update swarm-plan.md** with expanded 10-phase plan
2. **Create `memory/phase-roadmap.md`** with detailed per-phase deliverables
3. **Build `scripts/tool-registry.js` first** — Foundation for all other systems
4. **Research LanceDB** as lighter ChromaDB alternative
5. **Study oh-my-pi source** for implementation patterns

---

## Key Patterns Discovered

### Pattern: Agent as Operating System
oh-my-pi treats the agent like an OS:
- Tools = System calls
- Sessions = Processes
- Subagents = Threads
- Hooks = Interrupt handlers
- Extensions = Kernel modules
- Skills = Userspace libraries

### Pattern: Everything is a Tool
Every capability is exposed as a tool the LLM can call:
- `task` → spawn subagent
- `poll` → block on async
- `todo_write` → track progress
- `report_finding` → structured output

### Pattern: Structured Output Everywhere
All outputs are structured:
- Findings: `{priority: "P0", file, line, message}`
- Reviews: `{verdict: "approve", findings: [...]}`
- Task results: `{status, artifacts, logs}`

### Pattern: Persistent Everything
Nothing is ephemeral:
- Sessions persist as JSONL
- Tasks persist in queue
- Memory persists in wiki
- Artifacts persist in directory

### Pattern: Human-in-the-Loop as First-Class
Human gates are pipeline nodes, not exceptions:
- `shape=hexagon` for human approval
- `auto-approve` flag for CI/CD
- Context keys for routing on human choice

### Pattern: Dark Factory Governance
Autonomous systems need constitutional boundaries:
- `MISSION.md` — immutable scope and goals
- `FACTORY_RULES.md` — immutable operational rules
- `CLAUDE.md` — immutable code style
- Factory CANNOT modify governance files (security hard-fail)
- Validator uses holdout pattern (never sees implementation plan)

---

*This changes everything. The swarm request must be 3x larger than originally planned.*
