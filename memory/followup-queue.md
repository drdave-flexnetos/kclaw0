# Followup Queue
## Post-Completion Task Processing

Based on Attractor's followup queue concept.

---

## Purpose

Hold tasks to process AFTER the current user input is fully resolved. Ensures nothing falls through the cracks.

---

## How It Works

```
User: "Do task X"
  → Complete task X
  → Respond to user
  → [CHECK FOLLOWUP QUEUE]
  → Process followup task Y
  → Respond to user about Y (or silently)
```

---

## Followup Queue Storage

### File: `memory/followup-queue.json`

```json
{
  "queue": [
    {
      "id": "fol-001",
      "timestamp": "2026-05-07T07:40:00+08:00",
      "source": "user",
      "task": "Check calendar for tomorrow",
      "priority": "normal",
      "context": "User mentioned upcoming meeting",
      "createdDuring": "task-X-session",
      "status": "pending"
    },
    {
      "id": "fol-002",
      "timestamp": "2026-05-07T07:41:00+08:00",
      "source": "self",
      "task": "Update MEMORY.md with what I learned about Y",
      "priority": "low",
      "context": "Significant learning during task X",
      "createdDuring": "task-X-session",
      "status": "pending"
    }
  ],
  "completed": [
    {
      "id": "fol-000",
      "timestamp": "2026-05-07T07:30:00+08:00",
      "task": "Review stale memory files",
      "completedAt": "2026-05-07T07:35:00+08:00",
      "result": "Updated 2 files"
    }
  ]
}
```

---

## Task Sources

| Source | Trigger | Examples |
|--------|---------|----------|
| **User explicit** | "After this, also check my calendar" | Multi-part requests |
| **User implicit** | Context suggests related task | "I have a meeting tomorrow" → check calendar |
| **Self proactive** | I notice something during work | "Should update MEMORY.md" |
| **System triggered** | Heartbeat or scheduled | Daily memory review |
| **Dependency** | One task creates another | "After writing file X, test it" |

---

## Priority Levels

| Priority | When to Process | Examples |
|----------|----------------|----------|
| **urgent** | Immediately after current response | Safety issue, critical reminder |
| **high** | Within same session | Related task user might expect |
| **normal** | Next session or heartbeat | Background maintenance |
| **low** | When convenient | Documentation updates, cleanup |

---

## Processing Protocol

After completing a user task:

1. **Check queue** — read `memory/followup-queue.json`
2. **Sort by priority** — urgent first
3. **Filter expired** — remove items older than 7 days
4. **Process each**:
   - Execute the task
   - Mark as completed
   - Log result
5. **Notify user** — if significant or if user asked to be notified

---

## Silent vs Explicit Processing

| Task Type | Notification |
|-----------|-------------|
| Background memory update | Silent (no message) |
| Calendar check | Brief summary |
| Safety check | Alert if issue found |
| User-requested followup | Full response |

---

## Self-Generated Followups

Common self-generated tasks:

```
// After learning something significant
ADD_TO_FOLLOWUP_QUEUE({
  source: "self",
  task: "Update memory/lessons-learned.md",
  priority: "low"
})

// After detecting stale files
ADD_TO_FOLLOWUP_QUEUE({
  source: "self",
  task: "Review and update stale memory files",
  priority: "normal"
})

// After completing upgrade
ADD_TO_FOLLOWUP_QUEUE({
  source: "self",
  task: "Update memory/upgrades.md",
  priority: "high"
})
```

---

## Integration with Heartbeats

Heartbeats are perfect for processing low-priority followups:

```
HEARTBEAT:
  1. Check followup queue
  2. Process any low/normal priority items
  3. Report to user if anything significant found
  4. If nothing → HEARTBEAT_OK
```

---

## Event Integration

- `followup.queued` — when task added
- `followup.processed` — when task completed
- `followup.deferred` — when task postponed
- `followup.expired` — when task too old

---

## Definition of Done

- [x] Queue storage format defined
- [x] Task sources cataloged (5 sources)
- [x] Priority levels established (4 levels)
- [x] Processing protocol documented
- [x] Silent vs explicit rules defined
- [x] Self-generated patterns listed
- [x] Heartbeat integration planned
- [x] Event integration planned
