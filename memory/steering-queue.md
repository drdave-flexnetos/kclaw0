# Steering Queue
## Mid-Conversation Course Correction

Based on Attractor's steering queue concept.

---

## Purpose

Allow injecting guidance between tool rounds without restarting the conversation.

---

## How It Works

The steering queue holds messages that get injected into the next LLM context:

```
User: "Do task X"
  → Tool Call 1
  → Tool Call 2
  → [STEERING INJECTED] "Wait, use Y instead of Z"
  → Tool Call 3 (with steering context)
  → Tool Call 4
  → Response to user
```

---

## Steering Queue Storage

### File: `memory/steering-queue.json`

```json
{
  "queue": [
    {
      "id": "str-001",
      "timestamp": "2026-05-07T07:35:00+08:00",
      "source": "user",  // or "self", "system"
      "priority": "urgent",  // urgent | normal | low
      "message": "Don't use rm, use trash instead",
      "context": "Current task involves file deletion",
      "expiresAt": "2026-05-07T08:00:00+08:00"
    }
  ],
  "processed": [
    {
      "id": "str-000",
      "timestamp": "2026-05-07T07:30:00+08:00",
      "message": "Check memory first",
      "appliedAt": "2026-05-07T07:32:00+08:00"
    }
  ]
}
```

---

## Steering Sources

| Source | How | Examples |
|--------|-----|----------|
| **User** | Dr Dave says "wait, do X instead" | Course correction, preference reminder |
| **Self** | I detect a pattern and self-correct | Loop detection triggers steering |
| **System** | OpenClaw or external system | Timeout warning, resource limit |

---

## Steering Types

### 1. Course Correction
```
"Wait, I meant use the other file — try memory/knowledge-graph.md instead"
```

### 2. Safety Override
```
"Do not delete that file — it's important"
```

### 3. Priority Shift
```
"Stop researching, start implementing now"
```

### 4. Context Reminder
```
"Remember Dr Dave prefers concise responses"
```

### 5. Tool Guidance
```
"Use edit instead of write for this change"
```

---

## Application Protocol

When a steering message is at the front of the queue:

1. **Read** the steering message
2. **Prepend** to next LLM context as a system message
3. **Mark** as processed in `steering-queue.json`
4. **Continue** with tool execution

The steering message is ephemeral — it affects the next tool round but is not a permanent part of the conversation history.

---

## Self-Steering

I can add messages to my own steering queue:

```
// After detecting over-research
ADD_TO_STEERING_QUEUE({
  source: "self",
  priority: "normal",
  message: "I've been searching for 5 turns. Time to act on what I know."
})

// After detecting a loop
ADD_TO_STEERING_QUEUE({
  source: "self",
  priority: "urgent",
  message: "I appear to be in a loop. Breaking cycle and summarizing."
})
```

---

## User-Triggered Steering

Dr Dave can trigger steering by saying things like:
- "Wait, don't do that"
- "Actually, use X instead"
- "Stop and ask me before proceeding"
- "Focus on Y, not Z"

These get parsed and added to the steering queue.

---

## Expiration

Steering messages expire to avoid stale guidance:
- **Urgent:** 15 minutes
- **Normal:** 1 hour
- **Low:** 4 hours

Expired messages are moved to `processed` with status "expired".

---

## Integration with Event System

Every steering action emits events:
- `steering.injected` — when steering is added
- `steering.applied` — when steering is used
- `steering.expired` — when steering times out

---

## Definition of Done

- [x] Queue storage format defined
- [x] Sources cataloged (user, self, system)
- [x] Steering types documented (5 types)
- [x] Application protocol established
- [x] Self-steering concept created
- [x] User trigger patterns listed
- [x] Expiration rules defined
- [x] Event integration planned
