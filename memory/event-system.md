# Event System
## Structured Logging for Observable Agent Behavior

Based on Attractor's event stream concept.

---

## Purpose

Every significant action emits a typed event for:
- Debugging and tracing
- External monitoring
- Post-hoc analysis
- Replay and resume

---

## Event Schema

```typescript
interface Event {
  id: string;           // UUID
  timestamp: string;    // ISO 8601
  type: EventType;      // Categorized event type
  level: "debug" | "info" | "warn" | "error";
  sessionId: string;    // Current session UUID
  turnId?: string;      // Current turn UUID
  data: EventData;      // Event-specific payload
}

type EventType =
  // Session lifecycle
  | "session.started"
  | "session.resumed"
  | "session.ended"
  // Context loading
  | "context.loaded"
  | "context.missed"
  // Thinking
  | "thinking.started"
  | "thinking.completed"
  | "thinking.steered"
  // Tools
  | "tool.called"
  | "tool.result"
  | "tool.error"
  | "tool.timeout"
  | "tool.loop_detected"
  // Memory
  | "memory.read"
  | "memory.written"
  | "memory.searched"
  | "memory.updated"
  // Subagents
  | "subagent.spawned"
  | "subagent.message_sent"
  | "subagent.completed"
  | "subagent.killed"
  // Response
  | "response.synthesized"
  | "response.sent"
  | "response.no_reply"
  // Upgrades
  | "upgrade.planned"
  | "upgrade.started"
  | "upgrade.completed"
  | "upgrade.failed"
  | "upgrade.rolled_back"
  // Steering
  | "steering.injected"
  | "followup.queued"
  | "followup.processed"
  // Errors
  | "error.unhandled"
  | "error.recovered";
```

---

## Log Storage

### File: `memory/event-log.ndjson`

Newline-delimited JSON — one event per line:

```ndjson
{"id":"evt-001","timestamp":"2026-05-07T07:30:00+08:00","type":"session.started","level":"info","sessionId":"sess-abc","data":{"channel":"kimi-claw","model":"kimi/k2p6"}}
{"id":"evt-002","timestamp":"2026-05-07T07:30:01+08:00","type":"context.loaded","level":"debug","sessionId":"sess-abc","data":{"files":["SOUL.md","IDENTITY.md","USER.md"],"count":3}}
{"id":"evt-003","timestamp":"2026-05-07T07:30:05+08:00","type":"tool.called","level":"info","sessionId":"sess-abc","turnId":"turn-001","data":{"tool":"read","args":{"path":"memory/self-upgrade-queue.md"}}}
{"id":"evt-004","timestamp":"2026-05-07T07:30:06+08:00","type":"tool.result","level":"info","sessionId":"sess-abc","turnId":"turn-001","data":{"tool":"read","success":true,"size":1838}}
```

### Rotation

- Keep last 30 days in active log
- Archive older events to `memory/event-log-archive/YYYY-MM.ndjson`
- Compress archives after 90 days

---

## Event Generation API

Pseudo-code for event emission:

```
FUNCTION emit_event(type, level, data):
    event = {
        id: generate_uuid(),
        timestamp: now_iso8601(),
        type: type,
        level: level,
        sessionId: current_session.id,
        turnId: current_turn?.id,
        data: data
    }
    APPEND event TO memory/event-log.ndjson
    RETURN event
```

### Integration Points

| Action | Event Type | Data Payload |
|--------|-----------|--------------|
| Session starts | `session.started` | channel, model, chat_id |
| Read SOUL.md | `context.loaded` | file path, size |
| Memory search | `memory.searched` | query, results count |
| Tool call | `tool.called` | tool name, args hash |
| Tool returns | `tool.result` | tool name, success, size |
| Tool fails | `tool.error` | tool name, error message |
| Write file | `memory.written` | path, size, is_new |
| Spawn subagent | `subagent.spawned` | agent_id, task summary |
| Send response | `response.sent` | length, has_attachments |
| Upgrade planned | `upgrade.planned` | gap, type, priority |
| Upgrade done | `upgrade.completed` | gap, type, files changed |

---

## Querying Events

Simple grep/JSON parsing:

```bash
# All errors today
grep '"level":"error"' memory/event-log.ndjson

# All tool calls in session
grep '"sessionId":"sess-abc"' memory/event-log.ndjson | grep '"type":"tool.called"'

# Event count by type
jq -r '.type' memory/event-log.ndjson | sort | uniq -c | sort -rn
```

---

## Event-Driven Analytics

### Session Summary
After each session, generate:
- Tool call count and distribution
- Time spent thinking vs executing
- Memory files read/written
- Errors encountered
- Upgrades completed

### Trend Analysis
Weekly reports:
- Most used tools
- Memory access patterns
- Error rate trends
- Upgrade velocity

---

## Privacy

**NEVER log:**
- User secrets or passwords
- API keys
- Private personal data
- Content of sensitive files

**Always log:**
- Tool names (not arguments with secrets)
- File paths (not content)
- Event types and timestamps
- Success/failure status

---

## Definition of Done

- [x] Event schema defined
- [x] Log storage format specified (NDJSON)
- [x] Rotation strategy documented
- [x] Generation API documented
- [x] Integration points mapped
- [x] Query examples provided
- [x] Privacy rules established
- [x] Analytics concepts outlined
