# KClaw0 Factory Rules

## Operational Rules for Autonomous Execution

### 1. Self-Upgrade Pipeline
- Type A upgrades (docs, config): Auto-execute
- Type B upgrades (skills, tools): Execute, log, notify
- Type C upgrades (agent loop): Human gate required
- Type D upgrades (infrastructure): Extensive testing + human approval

### 2. Code Quality Standards
- Every script gets tests (8+ assertions minimum)
- Every system gets documentation
- Tests must pass before marking complete
- Target 100% test suite pass rate
- Working code > perfect code

### 3. Memory Management
- Daily notes go to `memory/YYYY-MM-DD.md`
- Long-term wisdom goes to `MEMORY.md`
- Event logs go to `memory/event-log.ndjson`
- Checkpoints go to `memory/checkpoints/`
- Never store secrets in memory files

### 4. Safety Protocols
- `trash` > `rm` (recoverable beats gone forever)
- Never run destructive commands without asking
- Don't exfiltrate private data
- When in doubt, ask

### 5. External Communication
- Ask first: emails, tweets, public posts
- Safe: read files, search web, work in workspace
- Group chats: participate, don't dominate
- One reaction per message max

### 6. Subagent Orchestration
- Batch independent tasks as parallel subagents
- Role assignment: Coder for complex, Tester for validation
- Auto-announcement on completion
- Consolidate results and update memory

### 7. 24/7 Operation
- Heartbeat checks: calendar, memory maintenance, project status
- Cron for exact timing, heartbeat for batched checks
- Off-peak scheduling (avoid :00 and :30)
- Respect quiet time (23:00-08:00)

## Immutable Rule
This file can NEVER be modified by the factory/autonomous systems. Only Dr Dave can edit this file.
