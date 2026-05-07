# KClaw0 Scripts Reference

Executable systems for self-management, monitoring, and improvement.

## Quick Start

```bash
# Run all tests
node scripts/test-all.js

# Check system status
node scripts/fingerprint.js check
node scripts/staleness.js check
node scripts/loop-detection.js check
```

---

## P2: Core Runtime Systems

### fingerprint.js — File Change Tracking
Track SHA-256 hashes of all memory files. Detect changes, identify hot files.

**API:** `scan()`, `check()`, `getHotFiles(limit)`
**CLI:** `scan | check | changed | hot --limit=N | watch`
**Storage:** `memory/fingerprints.json`, `memory/change-log.ndjson`

### staleness.js — Memory Freshness Monitor
Determine when memory files need updating. Time-based scoring (0-100), 4 freshness levels.

**API:** `check()`, `generateReport()`, `autoFix()`
**CLI:** `check | report | auto-fix | watch`
**Rules:** Per-file maxAge in `STALENESS_RULES` (SOUL.md=30d, MEMORY.md=7d)
**Storage:** `memory/staleness-state.json`

### event-system.js — Structured Action Logging
28 event types, NDJSON append-only log. Sensitive data redaction. Query by type/time/session.

**API:** `emit(type, data, metadata)`, `query(filters)`, `tail(n)`, `stats()`
**CLI:** `emit <type> <data> | query --type=X --since=1h | tail [n] | stats`
**Storage:** `memory/event-log.ndjson`, `memory/current-session.json`

### loop-detection.js — Infinite Loop Prevention
Detect 5 loop patterns: identical, cycle, no-progress, research-spiral, retry.

**API:** `check()`, `detectIdentical()`, `detectCycles()`, `detectNoProgress()`, `detectResearchSpiral()`, `detectRetry()`
**CLI:** `check | history | watch`
**Storage:** `memory/loop-history.json`

### steering-queue.js — Mid-Conversation Guidance
Priority-based message injection (urgent=15m, high=1h, normal=4h, low=24h).

**API:** `add(message, priority)`, `list()`, `flush()`, `getInjectionMessages()`
**CLI:** `add <message> [priority] | list | flush | inject`
**Storage:** `memory/steering-queue.json`

### followup-queue.js — Post-Completion Tasks
Scheduled task execution with 4 priority levels (critical=0m, high=15m, normal=1h, low=4h).

**API:** `add(summary, priority)`, `list()`, `due()`, `complete(id)`, `cancel(id)`, `run()`
**CLI:** `add <summary> [priority] | list | due | complete <id> | cancel <id> | run`
**Storage:** `memory/followup-queue.json`

---

## P3: Advanced Systems

### checkpoint.js — Session State Save/Restore
Capture full conversation state for resumable sessions. Memory refs, runtime context, queue snapshots.

**API:** `save(name, metadata)`, `autoSave()`, `list()`, `load(id)`, `delete(id)`, `prune(keep)`
**CLI:** `save <name> | autosave | list | load <id> | delete <id> | prune [n]`
**Storage:** `memory/checkpoints/cp-XXX.json`

### cost-tracker.js — Token Usage & Cost Monitoring
Per-request cost logging with model-specific pricing. Budget alerts. Export reports.

**API:** `record(inputTokens, outputTokens, model)`, `sessionSummary()`, `totalCost()`, `budgetCheck(budgetUsd)`, `exportReport(format)`
**CLI:** `record <input> <output> [model] | summary | total | budget <usd> | report [format]`
**Pricing:** kimi-k2p6 ($1/$3 per M), kimi-k2p5 ($0.50/$1.50 per M)
**Storage:** `memory/cost-log.ndjson`

---

## P4: Infrastructure

### docker-exec.js — Container Execution Environment
Run code in isolated Docker containers. Multi-language support. Mock mode when Docker unavailable.

**API:** `isAvailable()`, `run(image, command)`, `build(dockerfile, tag)`, `exec(id, command)`, `stop(id)`, `list()`, `logs(id)`
**CLI:** `status | run <image> <command> | build <dockerfile> <tag> | list | stop <id> | logs <id> | template <name>`
**Templates:** `memory/docker-templates/` (node, python, rust)
**Storage:** `memory/docker-config.json`, `memory/docker-executions.ndjson`

---

## Test Infrastructure

### test-all.js — Master Test Runner
Discover and run all test suites. Unified report.

**Usage:** `node scripts/test-all.js [--verbose] [--suite=name] [--fail-fast]`

---

## Integration

All systems share data through `memory/*.json` and `memory/*.ndjson` files:
- **Fingerprinting** → writes `fingerprints.json` → read by staleness, event system
- **Event System** → writes `event-log.ndjson` → read by loop detection, cost tracker
- **Steering Queue** → writes `steering-queue.json` → captured by checkpoints
- **Followup Queue** → writes `followup-queue.json` → captured by checkpoints
- **Cost Tracker** → writes `cost-log.ndjson` → queried by reports

---

## Adding New Scripts

1. Create `scripts/your-script.js` with API exports + CLI main()
2. Create `tests/your-script.test.js` with assertions
3. Add to this README
4. Run `node scripts/test-all.js` to verify

---

*Generated: 2026-05-07 | KClaw0 v1.0*
