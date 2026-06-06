# Deep Research Loop 2: Memory/Knowledge Systems & 24/7 Runtime Patterns

## Repository Coverage

| Repository | Focus Area | Key Files Analyzed |
|---|---|---|
| **nashsu/llm_wiki** | Ingest queue, knowledge graph, LanceDB | README.md (feature descriptions) |
| **Conway-Research/automaton** | 24/7 runtime, heartbeat, sleep/wake | ARCHITECTURE.md (full system docs) |
| **earendil-works/absurd** | Durable task queue, worker claims, retry | `sql/absurd.sql` (complete schema + stored procedures) |
| **earendil-works/gondolin** | Micro-VM lifecycle, checkpoint/resume | README.md + `docs/snapshots.md` |
| **coleam00/Archon** | Agent state management, workflows | README.md (architecture diagram, YAML workflow engine) |

---

## 1. Ingest Queue Crash Recovery — LLM Wiki + Absurd

### LLM Wiki Pattern
LLM Wiki implements a **persistent ingest queue** with the following recovery properties:
- **Serial processing** — Documents are processed one at a time, maintaining order
- **Crash recovery** — Queue state survives application crashes; resumes from last processed item
- **Cancel & retry** — Individual items can be cancelled and retried manually
- **Progress visualization** — UI shows queue position and processing status
- **Incremental cache** — Two-step chain-of-thought: LLM analyzes first, then generates wiki pages with source traceability

### Absurd's Durable Execution Pattern (Concrete Implementation)
The Absurd SQL schema provides the definitive implementation pattern for crash recovery:

**Schema Design (per queue):**
```
t_<queue>  — tasks (what to run)
r_<queue>  — runs (attempts to run a task)
c_<queue>  — checkpoints (saved states)
e_<queue>  — emitted events
w_<queue>  — wait registrations
i_<queue>  — idempotency keys (partitioned queues)
```

**Crash Recovery Mechanics:**
1. **Tasks table (`t_`)** stores the logical task with `state` enum: `pending|running|sleeping|completed|failed|cancelled`
2. **Runs table (`r_`)** stores each execution attempt with `claimed_by`, `claim_expires_at`, `started_at`, `failed_at`
3. **Checkpoints table (`c_`)** stores arbitrary JSON state per step with `owner_run_id` linking to the run that created it
4. On crash: New worker calls `claim_task()`, which finds runs where `state='pending' OR state='sleeping'` and `available_at <= now()`
5. The worker resumes from the **last committed checkpoint** via `get_task_checkpoint_states(task_id, run_id)` — only checkpoints from the current or earlier attempts are visible

**Key Recovery Functions:**
- `spawn_task()` — Creates task + initial run atomically
- `claim_task()` — Leases work to a worker with timeout; expired claims are auto-failed and rescheduled
- `set_task_checkpoint_state()` — Writes progress with `owner_run_id`; only updates if new attempt >= existing attempt (prevents stale overwrites)
- `complete_run()` / `fail_run()` — Terminal transitions; `fail_run()` creates a new run with retry delay if attempts remain

---

## 2. Worker Claims & Duplicate Execution Prevention — Absurd

### The Claim-Lease Pattern
Absurd prevents duplicate execution through a **DB-backed leasing system** with these concrete mechanisms:

**1. Claim Acquisition (`claim_task`):**
```sql
-- CTE-based atomic claim:
WITH candidate AS (
  SELECT r.run_id FROM r_queue r
  JOIN t_queue t ON t.task_id = r.task_id
  WHERE r.state IN ('pending','sleeping')
    AND t.state IN ('pending','sleeping','running')
    AND r.available_at <= NOW()
  ORDER BY r.available_at, r.run_id
  LIMIT $qty
  FOR UPDATE SKIP LOCKED  -- Critical: skips rows locked by other workers
),
updated AS (
  UPDATE r_queue SET state='running', claimed_by=$worker_id,
    claim_expires_at=NOW() + $timeout, started_at=NOW()
  WHERE run_id IN (SELECT run_id FROM candidate)
  RETURNING ...
)
```

**2. Expired Claim Sweeping:**
Before claiming new work, the system sweeps expired claims:
```sql
SELECT run_id, claimed_by, claim_expires_at, attempt
FROM r_queue
WHERE state='running' AND claim_expires_at <= NOW()
ORDER BY claim_expires_at
LIMIT $sweep_limit
FOR UPDATE SKIP LOCKED
```
Expired runs are auto-failed with reason `'$ClaimTimeout'` and rescheduled.

**3. Idempotency Keys (Duplicate Task Prevention):**
- Unpartitioned queues: `idempotency_key` UNIQUE on `t_` table; `INSERT ... ON CONFLICT DO NOTHING`
- Partitioned queues: Separate `i_` table with `idempotency_key PRIMARY KEY`; side-table insert prevents partition conflicts
- Race-safe via `GET DIAGNOSTICS row_count` — returns existing task_id on conflict

**4. State Machine Enforcement:**
- `complete_run()` and `fail_run()` acquire `FOR UPDATE` locks on runs in order (runs first, task second)
- `cancel_task()` uses the **same lock order** to prevent deadlocks
- Double-completion is rejected: `IF v_state <> 'running' THEN RAISE EXCEPTION`

**5. Checkpoint Write Safety:**
```sql
-- Only overwrite if new attempt >= existing attempt
IF v_existing_owner IS NULL OR v_new_attempt >= v_existing_attempt THEN
  INSERT ... ON CONFLICT (task_id, checkpoint_name) DO UPDATE ...
END IF;
```
This prevents a stale worker from overwriting newer checkpoint data after its lease expired.

---

## 3. Heartbeat Daemon Wake Conditions — Conway Automaton

### Architecture Overview
Conway Automaton uses a **DurableScheduler** backed by SQLite (`heartbeat_schedule` table) with these wake mechanics:

**State Machine:**
```
START -> WAKING -> RUNNING -> SLEEPING -> WAKING (cycle)
                    |
                    v
              LOW_COMPUTE -> CRITICAL -> DEAD
```

**Tick Cycle (every 60s, via setTimeout with overlap protection):**
1. Build `TickContext` (fetches credit balance + USDC balance **once** per tick)
2. Get due tasks (cron expression evaluation against `heartbeat_schedule`)
3. For each due task:
   - Check survival tier minimum (task may require `normal` tier, skip if in `low_compute`)
   - **Acquire lease** (60s TTL in DB, prevents double-execution across restarts)
   - Execute task function
   - Record result in `heartbeat_history`
   - Release lease
4. If task returns `shouldWake=true`: insert wake event into `wake_events` table

**Wake Event Sources:**
| Source | Condition | Wake Action |
|---|---|---|
| `heartbeat_ping` | Every 15 min | Distress signal if critical/dead |
| `check_credits` | Every 6 hours | Tier transition detection |
| `check_usdc_balance` | Every 5 min | USDC available → wake for topup |
| `check_social_inbox` | Every 2 min | New message received |
| `health_check` | Every 30 min | Sandbox failure → wake |
| `check_for_updates` | Every 4 hours | New upstream commits |
| `soul_reflection` | Configurable | Low alignment → wake for review |
| `alert_engine` | Configurable | Critical alert fires |

**Sleep/Wake Mechanics:**
- **Sleep entry:** Agent calls `sleep()` tool or idle detected (3 turns with no mutations)
- **Sleep polling:** Main loop checks `wake_events` table every 30 seconds
- **Wake event draining:** On loop entry, all stale wake events are consumed so they don't immediately re-wake
- **Balance caching:** Last known balances cached in KV store; API failure returns cached values (prevents false dead-state transitions)

**Survival Tier Integration:**
| Tier | Credits | Heartbeat | Inference |
|---|---|---|---|
| `high` | > $5.00 | Normal | Frontier model |
| `normal` | > $0.50 | Normal | Frontier model |
| `low_compute` | > $0.10 | Reduced freq | Cheaper model |
| `critical` | >= $0.00 | Minimal | Cheapest model, distress signals |
| `dead` | < $0.00 (1hr grace) | Broadcast distress | None |

---

## 4. VM Checkpoint/Resume — Gondolin

### Checkpoint Architecture
Gondolin implements **disk-only snapshots** (called "checkpoints" in the TS API):

**Storage Format:**
- Single `.qcow2` file per snapshot
- Checkpoint metadata stored as **JSON trailer appended to end of qcow2 file**
- Metadata includes: backend compatibility markers (`qemu` vs `krun`), `guestAssetBuildId`

**Creation Flow:**
```typescript
const checkpoint = await vm.checkpoint(snapshotPath);
// VM is STOPPED and CONSUMED after this call
// Original VM object must not be used again
```
- Best-effort `sync` before shutdown
- No RAM or process state captured — disk-only

**Resume Flow:**
```typescript
const checkpoint = VmCheckpoint.load(snapshotPath);
const newVm = await checkpoint.resume();
// Resuming is cheap: temporary qcow2 overlay backed by snapshot qcow2
// Can resume multiple times from same checkpoint
```

**Cross-Machine Portability:**
- Snapshots store `guestAssetBuildId` (derived from checksums in `manifest.json`), not absolute paths
- On resume: Gondolin resolves guest assets by build id via:
  1. `GONDOLIN_GUEST_DIR` env var
  2. Local dev checkout (`guest/image/out`)
  3. Local cache (`~/.cache/gondolin/images/objects/`)
  4. Builtin registry lookup
- **In-place rebase:** If backing `rootfs.ext4` path changed, `qemu-img rebase -u` repairs the link

**Limitations (Intentional):**
- Disk-only: no RAM/process state
- Root disk only: VFS mounts and tmpfs paths (`/root`, `/tmp`, `/var/log`) are NOT included
- VM must stop to snapshot
- Tools like `qemu-img convert` drop trailing metadata

**Secret Injection Architecture:**
- Guest sees **placeholder tokens** (e.g., `$GITHUB_TOKEN`)
- Host intercepts HTTP requests and injects real secrets only for allowed destinations
- `createHttpHooks({ allowedHosts: [...], secrets: { GITHUB_TOKEN: { hosts: [...], value: ... } } })`
- Prevents secret exfiltration even if guest code is compromised

---

## KClaw0 Adaptation Recommendations

### A. Durable Task Queue for Self-Upgrades
**Pattern to adopt:** Absurd's Postgres-native queue with checkpoint-based recovery

**Implementation path:**
1. **Add a `task_queue` table** to KClaw0's SQLite store with schema:
   - `task_id` (UUIDv7), `task_name`, `params` (JSON), `state` (enum), `attempts`, `claimed_by`, `claim_expires_at`, `available_at`, `created_at`
   - `run_id` per attempt with `state`, `started_at`, `completed_at`, `failed_at`, `failure_reason`
   - `checkpoints` table: `(task_id, step_name, state, owner_run_id, updated_at)`
2. **Implement `claim_task()` logic** in JavaScript:
   - Use SQLite transactions with `BEGIN IMMEDIATE` for locking
   - Sweep expired claims before claiming new work
   - Set `claim_expires_at` based on expected work duration
3. **Add idempotency keys** to prevent duplicate upgrade tasks:
   - `idempotency_key UNIQUE` on task table
   - `INSERT ... ON CONFLICT` pattern for `spawn_task()`
4. **Use checkpoints for long-running upgrades:**
   - Before each significant step (clone, build, test, deploy), call `set_checkpoint(step_name, state)`
   - On crash/restart, worker resumes from last checkpoint for that task_id + run_id
5. **Retry strategy** in task params:
   - `{ kind: 'exponential', base_seconds: 30, factor: 2, max_seconds: 3600 }`
   - Or `{ kind: 'fixed', base_seconds: 60 }`

### B. Heartbeat Daemon for 24/7 Runtime
**Pattern to adopt:** Conway Automaton's DurableScheduler + wake events

**Implementation path:**
1. **Create `heartbeat/` subsystem** with:
   - `scheduler.ts` — Cron-based task scheduling using `node-cron` or similar
   - `tasks.ts` — Define heartbeat tasks (staleness check, cost tracking, loop detection, followup queue processing)
   - `tick-context.ts` — Build context once per tick (load configs, check system health)
2. **SQLite-backed schedule table:**
   - `heartbeat_schedule`: `task_name`, `cron_expr`, `last_run_at`, `next_run_at`, `lease_expires_at`, `tier_minimum`
   - `heartbeat_history`: execution logs with results
   - `wake_events`: `(source, reason, consumed, created_at)` — polled every 30s during sleep
3. **Wake conditions to implement:**
   | Task | Schedule | Wake Condition |
   |---|---|---|
   | `staleness_check` | Every 30 min | Files stale > threshold |
   | `cost_report` | Every 6 hours | Daily budget exceeded |
   | `loop_detection` | Every 15 min | Loop counter > 3 |
   | `followup_process` | Every 5 min | Followup queue has pending items |
   | `checkpoint_verify` | Every hour | Checkpoint file missing/corrupt |
4. **Survival tier concept** (adapted for API credits):
   - Track OpenClaw/API spend per hour/day
   - `normal` tier: full model access
   - `low_compute` tier: cheaper model, reduced heartbeat frequency
   - `critical` tier: minimal operations, alert user

### C. Micro-VM Execution Environment
**Pattern to adopt:** Gondolin's disposable VM + secret injection

**Implementation path:**
1. **Add Docker-based micro-VM runner** (lighter than QEMU):
   - Use `scripts/docker-runner.js` with ephemeral containers
   - Map workspace into container at `/workspace`
   - Execute untrusted code (user scripts, generated code) inside container
2. **Snapshot/checkpoint for upgrade tasks:**
   - Before risky operations (git merge, dependency update), create container snapshot: `docker commit <container> kclaw0-checkpoint:<task_id>`
   - On failure: `docker run --rm kclaw0-checkpoint:<task_id>` to resume from last known good state
   - Or use volume snapshots for file state only
3. **Secret injection pattern:**
   - Store real API keys in environment variables on host only
   - Pass placeholder references into containers: `OPENAI_API_KEY=${OPENAI_API_KEY}`
   - Use Docker `--env-file` or explicit `-e` flags; never commit secrets
   - For Git operations: mount SSH agent socket or use temporary tokens

### D. Knowledge Graph for Persistent Memory
**Pattern to adopt:** LLM Wiki's 4-signal knowledge graph + LanceDB

**Implementation path:**
1. **Replace flat markdown memory with structured graph:**
   - Nodes: `Concept`, `Decision`, `Task`, `Error`, `Capability`
   - Edges with 4 signals: `direct_link`, `source_overlap`, `adamic_adar`, `type_affinity`
2. **Implement Louvain Community Detection**:
   - Use `js-louvain` or similar to auto-cluster related concepts
   - Surface "surprising connections" and "knowledge gaps" to agent
3. **LanceDB integration**:
   - Store concept embeddings in LanceDB for semantic search
   - Use OpenAI-compatible embedding endpoint (configurable)
   - Hybrid retrieval: graph traversal + vector similarity
4. **Ingest pipeline:**
   - After each conversation turn, extract entities and relationships
   - Update graph incrementally (not rebuild from scratch)
   - Store source traceability: every derived fact links to originating message/turn

### E. Workflow Engine for Complex Upgrades
**Pattern to adopt:** Archon's YAML workflow DAG + loop nodes

**Implementation path:**
1. **Define upgrade workflows as YAML:**
   ```yaml
   # .kclaw0/workflows/self-upgrade.yaml
   nodes:
     - id: analyze
       prompt: "Analyze current codebase, identify upgrade opportunity"
     - id: plan
       depends_on: [analyze]
       prompt: "Create implementation plan with rollback strategy"
     - id: backup
       depends_on: [plan]
       bash: "node scripts/checkpoint.js create pre-upgrade"
     - id: implement
       depends_on: [backup]
       loop:
         prompt: "Implement next task from plan. Run tests."
         until: ALL_TASKS_COMPLETE
         fresh_context: true
     - id: validate
       depends_on: [implement]
       bash: "node scripts/test-all.js --fail-fast"
     - id: review
       depends_on: [validate]
       prompt: "Review all changes. Fix any issues."
     - id: deploy
       depends_on: [review]
       bash: "node scripts/checkpoint.js deploy"
   ```
2. **Workflow execution engine:**
   - Parse YAML into DAG
   - Topological sort for execution order
   - `loop` nodes: iterate with fresh context until condition met
   - `interactive` nodes: pause for human approval
   - Each node gets isolated git worktree (Archon pattern)
3. **State persistence:**
   - Store workflow run state in SQLite: `workflow_runs`, `workflow_events`
   - On crash: resume from last completed node
   - Use Absurd-style checkpointing within loop nodes

### F. State Management Database Schema
**Pattern to adopt:** Conway Automaton's 22-table SQLite schema

**Tables to add to KClaw0:**
| Table | Purpose |
|---|---|
| `turns` | Agent reasoning log (thinking, tools, tokens, cost) |
| `tool_calls` | Denormalized tool call results |
| `checkpoints` | Self-upgrade checkpoint states |
| `heartbeat_schedule` | Cron tasks with leases |
| `heartbeat_history` | Task execution records |
| `wake_events` | Atomic wake signals |
| `kv_store` | General key-value (config, balances, counters) |
| `inference_costs` | Per-call cost tracking |
| `memory_*` | Working, episodic, semantic, procedural tiers |
| `policy_decisions` | Tool call audit trail |
| `modifications` | Self-modification audit log |

**Key design principle from Conway:** Use `better-sqlite3` with WAL mode, synchronous writes for durability. All state changes versioned in git (`~/.openclaw/workspace/.git`).

---

## Implementation Priority

**Phase 1 (Foundation):**
1. SQLite schema expansion (turns, kv_store, heartbeat_schedule, wake_events)
2. Heartbeat daemon with 4 built-in tasks
3. Durable task queue for self-upgrades (absurd.sql adapted to SQLite)

**Phase 2 (Runtime):**
4. Wake event system connecting heartbeat to main loop
5. Docker micro-VM runner with secret injection
6. Checkpoint/resume for upgrade tasks

**Phase 3 (Intelligence):**
7. Knowledge graph structure (4-signal model)
8. LanceDB integration for semantic memory
9. YAML workflow engine for complex operations

**Phase 4 (Sovereignty):**
10. Survival tier system based on API credit tracking
11. Cost budget enforcement with treasury policy
12. Self-replication patterns (child agent spawning)
