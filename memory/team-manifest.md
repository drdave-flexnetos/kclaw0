# KClaw0 Agent Swarm — Team Manifest
## Organized Autonomy for Self-Upgrading Systems

---

## Mission Command

| Role | Identity | Primary Function |
|------|----------|-----------------|
| **Command Core** | KClaw0 (Main) | Human interface, strategic planning, swarm orchestration, final authority on all decisions |
| **State Keeper** | Persistent Memory Layer | Cross-session continuity via files, knowledge graphs, event logs |
| **Spec Writer** | Dr Dave | Mission definition, human gate approval, directional guidance |

---

## Functional Teams

### Team Alpha: Memory & Knowledge Systems
**Purpose:** Ensure no information is lost between sessions. Enable semantic recall.

| Agent | Module | Role | Communication Pattern |
|-------|--------|------|----------------------|
| **ChromaDB Agent** | `scripts/chroma-integration.js` | Semantic vector memory — stores conversations, facts, embeddings for similarity search | Receives `store()`/`search()` calls from main. Persists to `memory/chromadb-data/`. Returns ranked results with distance scores. |
| **MemPalace Agent** | `scripts/mempalace-integration.js` | Structured hierarchical memory — wings, rooms, drawers for organized recall | Receives `storeMemory()`/`searchMemory()`/`wakeUp()`/`recall()` calls. Uses palace metaphor (L0 context, L1 compressed, L2 on-demand). |
| **GitNexus Agent** | `scripts/gitnexus-integration.js` | Codebase knowledge graph — understands my own code and external repos | Receives `indexRepo()`/`query()`/`augmentQuery()` calls. Builds graph of functions, classes, imports. Cached in `memory/gitnexus-cache.json`. |
| **Fingerprint Agent** | `scripts/fingerprint.js` | Change detection — SHA-256 hashes of tracked files to detect modifications | Runs automatically on file operations. Reports diffs to event system. |
| **Staleness Agent** | `scripts/staleness.js` | Memory freshness monitoring — calculates when files need updating | Runs during heartbeats. Reports stale files with severity scores. |

**Inter-Agent Protocol:**
```
Main → ChromaDB: "Store this conversation fragment"
Main → MemPalace: "Save to wing='projects', room='kclaw0'"
Main → GitNexus: "Index this repo, tell me its architecture"
Fingerprint → EventSystem: "File X changed"
Staleness → FollowupQueue: "MEMORY.md needs review"
```

---

### Team Beta: Runtime Safety & Control Systems
**Purpose:** Prevent runaway behavior, enable course correction, ensure recoverability.

| Agent | Module | Role | Communication Pattern |
|-------|--------|------|----------------------|
| **Event System** | `scripts/event-system.js` | Central nervous system — logs all actions with 28+ event types | Every agent emits events here. NDJSON append-only log at `memory/event-log.ndjson`. Auto-redacts secrets. |
| **Loop Detection** | `scripts/loop-detection.js` | Pattern guard — detects infinite tool call cycles (5 patterns) | Monitors tool call sequences. Injects steering messages to break loops. Alerts main if user intervention needed. |
| **Steering Queue** | `scripts/steering-queue.js` | Course corrector — holds mid-conrection messages for next LLM context | Agents and user can inject steering messages. Expires after 15min-4hr. Injected into context automatically. |
| **Followup Queue** | `scripts/followup-queue.js` | Task completion tracker — ensures nothing falls through cracks | Queues post-completion tasks. Processes by priority. Silent for background work, explicit for user requests. |
| **Checkpoint Agent** | `scripts/checkpoint.js` | State preservation — save/resume conversation state | Saves full context (steering + followup queues + metadata). Prunes old checkpoints. Human-gated for Type C/D upgrades. |
| **Cost Tracker** | `scripts/cost-tracker.js` | Budget monitor — tracks token usage and API costs per session | Records after every LLM call. Reports budget status. Exportable as JSON/CSV/Markdown. |

**Safety Protocols:**
```
Loop Detection detects cycle → Steering Queue: "break loop" → Main adjusts
Cost Tracker alerts budget → Steering Queue: "consider cheaper model" → Main decides
Checkpoint auto-saves → Event System logs → Followup Queue: "review checkpoint"
```

---

### Team Gamma: Execution & Infrastructure
**Purpose:** Run code safely, interface with external systems.

| Agent | Module | Role | Communication Pattern |
|-------|--------|------|----------------------|
| **Docker Executor** | `scripts/docker-exec.js` | Sandboxed code execution — runs user code in containers | Receives code + language + timeout. Spins up container. Returns output/error. Mock mode when Docker unavailable. |
| **LLM Client** | `scripts/llm-client.js` | Multi-provider abstraction — Kimi, OpenAI, Anthropic, Gemini, Ollama | Receives prompt + model preference. Routes to appropriate adapter. Handles retries, streaming, cost estimation. |
| **Test Runner** | `scripts/test-all.js` | Quality assurance — discovers and runs all test suites | Auto-discovers `tests/*.test.js`. Unified reporting. Called before any commit. |

---

### Team Delta: External Tool Integrations
**Purpose:** Bring external capabilities into KClaw0's ecosystem.

| Agent | Source | Role | Status |
|-------|--------|------|--------|
| **Archon** | `coleam00/archon` | Workflow engine for AI coding agents — YAML-defined dev processes with human gates | ✅ Installed at `archon/`. Bun-based. Needs Claude Code for full workflow execution. |
| **NanoChat** | `karpathy/nanochat` | Small model training harness — train tiny sub-agent models (~10-100M params) | ✅ Installed at `nanochat/`. CPU mode. 13/23 tests passing. |
| **Autoresearch** | `karpathy/autoresearch` | Autonomous LLM research swarm — experimental training loop | ⚠️ Cloned at `autoresearch/`. Requires NVIDIA GPU. Not functional here. |
| **Understand-Anything** | `Lum1104` | Codebase analysis and knowledge graph builder | ✅ OpenClaw skill at `~/.openclaw/skills/understand-anything/` |

---

## Subagent Role Profiles

When spawning subagents for specific tasks, these are the specialized roles available:

| Role | Expertise | Best For |
|------|-----------|----------|
| **Researcher** | Information gathering, analysis, comparison | Exploring repos, understanding specs, evaluating options |
| **Coder** | Implementation, debugging, testing | Building systems, writing tests, fixing bugs |
| **Tester** | Test design, edge case discovery, validation | Quality assurance, regression testing, fuzzing |
| **Documenter** | Writing, organizing, explaining | READMEs, specs, API docs, user guides |
| **Analyst** | Metrics, performance, architecture review | Code review, optimization, technical debt assessment |
| **Safety Reviewer** | Security, safety, constraint checking | Reviewing self-modifications, validating constraints |

**Spawn Pattern:**
```javascript
// Parallel execution for independent tasks
sessions_spawn({ label: "Coder-Team-A", task: "Build feature X" });
sessions_spawn({ label: "Coder-Team-B", task: "Build feature Y" });
// Wait for both completions, then integrate
```

---

## Communication Architecture

### Event Bus (Primary)
All agents communicate via the **Event System** (`scripts/event-system.js`):

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent A    │────→│  Event Bus  │←────│  Agent B    │
└─────────────┘     │  (NDJSON)   │     └─────────────┘
                    │  28+ types  │
                    └─────────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
              ┌────────┐  ┌──────────┐
              │ Logger │  │ Analytics│
              └────────┘  └──────────┘
```

### Steering Queue (Priority)
Urgent course corrections bypass the event bus and go straight to LLM context:

```
User: "Stop, that's wrong" 
  → Steering Queue: { type: "course_correction", priority: "urgent", expires: "15min" }
  → Next LLM call includes: "[STEERING] User says stop..."
```

### Followup Queue (Deferred)
Non-urgent tasks queue for post-completion processing:

```
Agent: "After this task, update MEMORY.md"
  → Followup Queue: { task: "Update MEMORY.md", source: "self", priority: "normal" }
  → After current task completes, process queue
```

### File System (Persistent)
All state lives in files for cross-session continuity:

```
memory/
├── event-log.ndjson          # Event bus archive
├── steering-queue.json       # Active course corrections
├── followup-queue.json       # Pending post-completion tasks
├── fingerprints.json         # File change hashes
├── staleness-state.json      # Memory freshness scores
├── checkpoints/              # Saved conversation states
├── gitnexus-cache.json       # Indexed repo metadata
├── chromadb-data/            # Vector embeddings
└── mempalace-data/           # Structured memory
```

---

## Automation Rules

### Heartbeat Automation
```
Every 30 minutes (configurable):
  1. Check email (if configured)
  2. Check calendar for upcoming events (<2h)
  3. Check memory staleness
  4. Update heartbeat-state.json
  
  If urgent event found → Notify user
  If stale memory found → Queue followup to review
  Otherwise → HEARTBEAT_OK (silent)
```

### Self-Upgrade Loop (DOT)
```
digraph {
  discover → analyze → decide
  decide -> plan [label="significant"]
  decide -> exit [label="none"]
  plan -> validate -> safety
  safety -> execute [label="safe"]
  safety -> retry [label="unsafe"]
  execute -> verify -> success_gate
  success_gate -> human_review [label="pass"]
  success_gate -> retry [label="fail"]
  human_review -> archive [label="approve"]
  human_review -> retry [label="reject"]
  archive -> exit
}
```

### Auto-Save Rules
```
Type A upgrades (Memory/Knowledge): Auto-archive, no gate
Type B upgrades (Skill/Tool): Auto-archive, log for review
Type C upgrades (Agent Loop): Human gate REQUIRED before execute
Type D upgrades (Infrastructure): Human gate REQUIRED, 24h review window
```

---

## Decision Matrix

| Scenario | Decision Authority | Escalation Path |
|----------|-------------------|-----------------|
| Update memory file | Auto (Type A) | Log to event system |
| Build new skill | Auto (Type B) | Log, notify in summary |
| Modify agent loop | Human gate (Type C) | Ask Dr Dave before execute |
| Change infrastructure | Human gate (Type D) | Ask Dr Dave, 24h wait |
| Budget exceeded | Auto + alert | Steering queue: "consider cheaper model" |
| Loop detected | Auto-recovery | Steering queue injection |
| Secret detected | Auto-abort | Immediate halt, alert user |
| Test failure | Auto-retry (max 3) | Escalate to user on persistent failure |

---

## Current Team Roster (Active)

| # | Name | Module | Status | Tests |
|---|------|--------|--------|-------|
| 1 | ChromaDB | `scripts/chroma-integration.js` | ✅ Active | 20 passing |
| 2 | GitNexus | `scripts/gitnexus-integration.js` | ✅ Active | 18 passing |
| 3 | MemPalace | `scripts/mempalace-integration.js` | ✅ Active | 36 passing |
| 4 | Fingerprint | `scripts/fingerprint.js` | ✅ Active | 8 passing |
| 5 | Staleness | `scripts/staleness.js` | ✅ Active | 8 passing |
| 6 | Event System | `scripts/event-system.js` | ✅ Active | 12 passing |
| 7 | Loop Detection | `scripts/loop-detection.js` | ✅ Active | 10 passing |
| 8 | Steering Queue | `scripts/steering-queue.js` | ✅ Active | 10 passing |
| 9 | Followup Queue | `scripts/followup-queue.js` | ✅ Active | 10 passing |
| 10 | Checkpoint | `scripts/checkpoint.js` | ✅ Active | 18 passing |
| 11 | Cost Tracker | `scripts/cost-tracker.js` | ✅ Active | 15 passing |
| 12 | Docker Exec | `scripts/docker-exec.js` | ✅ Active | 13 passing |
| 13 | LLM Client | `scripts/llm-client.js` | ✅ Active | 119 passing |
| 14 | Test Runner | `scripts/test-all.js` | ✅ Active | Orchestrator |
| 15 | Archon | `archon/` | ✅ Installed | External |
| 16 | NanoChat | `nanochat/` | ✅ Installed | 13 passing |
| 17 | Autoresearch | `autoresearch/` | ⚠️ Cloned | Needs GPU |
| 18 | Understand-Anything | `~/.openclaw/skills/understand-anything/` | ✅ Active | External |

**Total: 14 passing test suites, 260+ tests, 18 active agents**

---

## Communication Channels

| Channel | Use Case | Privacy |
|---------|----------|---------|
| Main Session (kimi-claw) | Direct human interaction, strategy | Private |
| Subagent Sessions | Parallel task execution | Internal |
| Event Log (NDJSON) | Audit trail, debugging | Internal |
| GitHub (`FlexNetOS/kclaw0`) | Code backup, versioning | Public |
| Memory Files | Long-term knowledge | Private |

---

*Team Manifest v1.0 — Generated 2026-05-07*
*Last updated: After P5 swarm integration complete*
*Next review: P6 milestone*
