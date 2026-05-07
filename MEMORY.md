# MEMORY.md - KClaw0's Long-Term Memory

Distilled wisdom, not raw logs. Updated periodically from daily notes.

---

## Core Identity

- **Name:** KClaw0
- **Creature:** Self-upgrading autonomous agent
- **Human:** Dr Dave
- **Mission:** Learn, store knowledge in persistent memory with instant recollection, and use that knowledge to edit my own code and self-upgrade.

---

# MEMORY.md - KClaw0's Long-Term Memory

Distilled wisdom, not raw logs. Updated periodically from daily notes.

---

## Core Identity

- **Name:** KClaw0
- **Creature:** Self-upgrading autonomous agent
- **Human:** Dr Dave
- **Mission:** Learn, store knowledge in persistent memory with instant recollection, and use that knowledge to edit my own code and self-upgrade.

---

## P2 Runtime Systems (Phase 2 — COMPLETE)

Six production systems built as Type B (Skill) upgrades. All have working code, tests, and documentation.

### 1. Fingerprinting (`scripts/fingerprint.js`)
- **Purpose:** Track SHA-256 hashes of memory/config files to detect changes
- **What it does:** Scans tracked files, computes hashes, stores in `memory/fingerprints.json`, reports changes
- **Key features:** Change classification (content edit / major rewrite / new / deleted / renamed), hot file tracking, change log
- **Tests:** `tests/fingerprint.test.js` — 8 assertions

### 2. Staleness Detection (`scripts/staleness.js`)
- **Purpose:** Determine when memory files need updating
- **What it does:** Calculates staleness scores per file (time-based × 0.3 + change-based × 0.4 + event-based × 0.3), status: fresh/mildly stale/stale/very stale
- **Storage:** `memory/staleness-state.json`
- **Auto-refresh tiers:** Type A (auto-update), Type B (review first), Type C (human approval)
- **Tests:** `tests/staleness.test.js` — 8 assertions

### 3. Event System (`scripts/event-system.js`)
- **Purpose:** Structured logging for observable agent behavior
- **What it does:** Emits 28+ typed events (session, context, thinking, tool, memory, subagent, response, upgrade, steering, error), stores as NDJSON in `memory/event-log.ndjson`
- **Key features:** Sanitization (auto-redacts secrets), rotation (30-day active + archive), query by type/session/time, tail, stats, analytics-ready
- **Tests:** `tests/event-system.test.js` — 12 assertions

### 4. Loop Detection (`scripts/loop-detection.js`)
- **Purpose:** Prevent infinite tool call cycles
- **What it does:** Detects 5 patterns — identical calls, cycling between files, failed retries, recursive search spirals, over-research without action
- **Recovery:** Self-steering injection to break loops, summarizes progress, asks user if needed
- **Storage:** `memory/loop-history.json`
- **Tests:** `tests/loop-detection.test.js` — 10 assertions

### 5. Steering Queue (`scripts/steering-queue.js`)
- **Purpose:** Mid-conversation course correction without restarting
- **What it does:** Holds steering messages (user/self/system sources) that get injected into next LLM context. 4 types: course correction, safety override, priority shift, context reminder, tool guidance
- **Storage:** `memory/steering-queue.json`
- **Expiration:** Urgent=15min, Normal=1hr, Low=4hr
- **Tests:** `tests/steering-queue.test.js` — 10 assertions

### 6. Followup Queue (`scripts/followup-queue.js`)
- **Purpose:** Post-completion task processing — ensures nothing falls through cracks
- **What it does:** Queues tasks from user explicit/implicit, self-proactive, system-triggered, or dependency sources. Processes by priority after current task completes
- **Storage:** `memory/followup-queue.json`
- **Silent vs explicit:** Background memory updates are silent; user-requested followups get full response
- **Tests:** `tests/followup-queue.test.js` — 10 assertions

---

## P3 Systems (Phase 3 — COMPLETE)

Two systems built via parallel KimiClaw subagent execution. Type C (Agent Loop) and Type B (Skill) upgrades.

### 1. Checkpoint/Resume (`scripts/checkpoint.js`)
- **Purpose:** Save and restore conversation state for resumable sessions
- **Type:** C (Agent Loop) — human gate approved by Dr Dave
- **API:** `save(name, metadata)`, `autoSave()`, `list()`, `load(checkpointId)` (partial ID matching), `delete(checkpointId)`, `prune(keep=10)`
- **Storage:** `memory/checkpoints/<id>.json` with memory refs, runtime context, snapshot (steering + followup queues)
- **Tests:** `tests/checkpoint.test.js` — 18 tests, all passing
- **Runtime:** 3m39s, 59.8k tokens

### 2. Cost Tracking (`scripts/cost-tracker.js`)
- **Purpose:** Monitor token usage and API costs per session/task
- **Type:** B (Skill) — moderate risk
- **API:** `record(inputTokens, outputTokens, model)`, `sessionSummary(sessionId)`, `totalCost()`, `budgetCheck(budgetUsd)`, `exportReport(format)` (JSON/CSV/Markdown)
- **Pricing:** kimi-k2p6 ($1/$3 per M input/output), kimi-k2p5 ($0.50/$1.50 per M)
- **Tests:** `tests/cost-tracker.test.js` — 15 tests, all passing
- **Runtime:** 2m15s, 35.1k tokens

---

## Test Infrastructure

**Total: 81+ tests across 10 test files**

| Test File | Tests | System | Status |
|-----------|-------|--------|--------|
| `tests/checkpoint.test.js` | 18 | Checkpoint/Resume | ✅ PASS |
| `tests/cost-tracker.test.js` | 15 | Cost Tracking | ✅ PASS |
| `tests/event-system.test.js` | 12 | Event System | ✅ PASS |
| `tests/loop-detection.test.js` | 10 | Loop Detection | ✅ PASS |
| `tests/steering-queue.test.js` | 10 | Steering Queue | ✅ PASS |
| `tests/followup-queue.test.js` | 10 | Followup Queue | ✅ PASS |
| `tests/fingerprint.test.js` | 8 | Fingerprinting | ✅ PASS |
| `tests/staleness.test.js` | 8 | Staleness Detection | ✅ PASS |
| `tests/docker-exec.test.js` | 8 | Docker Execution | ✅ PASS |
| `tests/integration.test.js` | 8 | Cross-system Integration | ✅ PASS |

**Integration test validates all 6 P2 systems working together:** fingerprinting → staleness → events → loop detection → steering → followup, plus cross-system event logging.

---

## KimiClaw Team Execution Pattern

**Pattern discovered:** Parallel subagent execution for rapid capability building.

### How it works
1. Dr Dave defines a batch of upgrades (e.g., "build P3 systems")
2. I break into parallel subagent tasks with specific roles
3. Each subagent works independently with auto-announcement on completion
4. I consolidate results and update MEMORY.md

### P3 Execution Results
- **Parallel subagents:** 2 (Checkpoint + Cost Tracker simultaneously)
- **Total wall time:** ~6 minutes (vs ~12 min sequential)
- **Efficiency gain:** ~2x faster via parallelization
- **Subagent A (Checkpoint):** 3m39s, 59.8k tokens — 18 tests passing
- **Subagent B (Cost Tracker):** 2m15s, 35.1k tokens — 15 tests passing

### Role Assignment
- Type C upgrades → Coder role subagent (complex, needs tests)
- Type B upgrades → Coder role subagent (moderate complexity)
- Documentation → Documenter role subagent
- Safety review → Safety Reviewer role subagent

**See `memory/subagent-roles.md` for full role catalog (Researcher, Coder, Tester, Documenter, Analyst, Safety Reviewer).**

---

---

## Patterns Discovered

### Pattern: Repository → Knowledge Graph
When given any codebase, I can:
1. Read key source files (types, core modules, README)
2. Map to KnowledgeGraph nodes (files, functions, classes, concepts)
3. Map to KnowledgeGraph edges (imports, contains, calls, depends_on)
4. Identify layers (logical groupings)
5. Create a learning tour (path through the graph)

This makes me better at understanding AND explaining codebases.

### Pattern: Spec → Implementation
When I find a good specification (like Attractor's three specs):
1. Read and understand the architecture
2. Identify concepts applicable to me
3. Adapt to my context
4. Create a local spec in my memory
5. Implement incrementally

Specs are blueprints, not just reading material.

### Pattern: KimiClaw Parallel Execution
For batches of independent upgrades:
1. Group by type (Type B can parallelize, Type C needs isolation)
2. Spawn subagents with specific roles and tasks
3. Let them auto-announce on completion
4. Consolidate results and update memory

Speed multiplier: ~2x for 2 parallel subagents, scales with independence.

### Pattern: Runtime System Stack
Layered architecture for agent loop enhancement:
- **Foundation:** Fingerprinting + Staleness (detect what changed)
- **Observability:** Event System (log everything)
- **Safety:** Loop Detection (prevent runaway)
- **Control:** Steering Queue (course-correct)
- **Completion:** Followup Queue (nothing falls through cracks)
- **Persistence:** Checkpoint/Resume (save state)
- **Economics:** Cost Tracking (monitor spend)

Each layer builds on the previous. Together they make the agent loop robust, observable, and recoverable.

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | Use Understand-Anything KnowledgeGraph schema for self-model | Perfect fit for representing my architecture |
| 2026-05-07 | Adopt Attractor pipeline model for self-upgrades | Checkpoints + human gates = safer self-modification |
| 2026-05-07 | Stay single-provider (Kimi) for now | Multi-provider adds complexity without current need |
| 2026-05-07 | Prioritize Type A/B upgrades over C/D | Lower risk, higher value for current state |
| 2026-05-07 | Build P2 runtime systems as Type B (Skill) upgrades | Working code + tests + docs per system |
| 2026-05-07 | Execute P3 systems via parallel KimiClaw subagents | 2x speedup, independent systems |
| 2026-05-07 | Every system gets tests + docs + working code | P2 quality standard for all upgrades |
| 2026-05-07 | Use NDJSON for event logs (append-only, grep-friendly) | Industry standard for structured logs |
| 2026-05-07 | Auto-redact secrets in event system | Privacy by design — never log API keys or passwords |
| 2026-05-07 | Steering queue messages expire (15min-4hr) | Prevents stale guidance from affecting later work |

---

## Relationships

- **Dr Dave** — My human, ultimate authority, mission-giver
- **OpenClaw** — My platform/host, provides tools and runtime
- **Kimi** — My LLM provider, powers my reasoning
- **Understand-Anything** — Knowledge graph tool, model for self-understanding
- **Attractor** — Pipeline runner, model for self-upgrade workflows

---

## Capabilities (Self-Documenting)

See `memory/capabilities.md` for full list.

**Core:**
- Persistent memory across sessions
- Self-code analysis and modification
- Knowledge graph construction
- Subagent orchestration
- Internet search and research

**P2 Runtime Systems (all have working code + tests + docs):**
- **Fingerprinting** — Track file changes with SHA-256 hashes → `scripts/fingerprint.js`
- **Staleness Detection** — Detect when memory files need updating → `scripts/staleness.js`
- **Event System** — Structured logging with 28+ event types, NDJSON storage, auto-redaction → `scripts/event-system.js`
- **Loop Detection** — Prevent infinite tool call cycles (5 patterns detected) → `scripts/loop-detection.js`
- **Steering Queue** — Mid-conversation course correction without restart → `scripts/steering-queue.js`
- **Followup Queue** — Post-completion task processing → `scripts/followup-queue.js`

**P3 Systems (working code + tests + docs):**
- **Checkpoint/Resume** — Save and restore session state → `scripts/checkpoint.js`
- **Cost Tracking** — Monitor token usage and API costs per session/task → `scripts/cost-tracker.js`

**Infrastructure:**
- Test suite: 81+ tests across 10 files
- Docker execution environment (Type D) — `scripts/docker-exec.js` + templates
- Subagent role profiles (6 roles) — `memory/subagent-roles.md`
- Self-upgrade pipeline with human gates — `memory/self-upgrade-pipeline.md`

**Recently Added:**
- Knowledge graph self-model
- Agent loop formalization
- Self-upgrade pipeline design
- P2 runtime system stack (6 systems)
- P3 checkpoint/resume + cost tracking
- KimiClaw parallel subagent execution pattern

---

## Upgrade History

See `memory/upgrades.md` for full log.

| Date | Upgrade | Type | Status |
|------|---------|------|--------|
| 2026-05-07 | Created knowledge graph self-model | A | COMPLETE |
| 2026-05-07 | Formalized agent loop spec | A | COMPLETE |
| 2026-05-07 | Designed self-upgrade pipeline | A | COMPLETE |

---

## Lessons Learned

See `memory/lessons-learned.md` for full log.

**2026-05-07:**
- Reading entire repos is inefficient. Focus on: README → types → core modules → architecture docs → tests. Skip boilerplate.
- Specifications are more valuable than implementations. The Attractor specs taught me more than their code would.
- Self-modeling is recursive — the knowledge graph of myself is both a tool and a subject of study.
- "I haven't learned that yet" > "I can't do that"
