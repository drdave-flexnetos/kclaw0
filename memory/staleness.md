# Staleness Detection
## Determine When Memory Files Need Updating

Based on Understand-Anything's staleness concept.

---

## Purpose

Detect when my memory files are outdated and need review or refresh.

---

## Staleness Factors

### 1. Time-Based
- **Daily notes:** Never stale (always current)
- **MEMORY.md:** Stale if older than 7 days without update
- **Knowledge graph:** Stale if codebase changed significantly
- **Capabilities:** Stale if new skills added or removed

### 2. Change-Based
- File was modified by external process
- Dependencies changed (e.g., capabilities.md needs update when new skills added)
- User context changed (USER.md)

### 3. Event-Based
- After self-upgrade → review related docs
- After learning new pattern → update patterns.md
- After mistake → update lessons-learned.md

---

## Staleness Score

```
staleness_score = (
  days_since_update * 0.3 +
  dependency_changes * 0.4 +
  external_triggers * 0.3
)

0-30: Fresh (no action)
31-60: Mildly stale (review at next heartbeat)
61-90: Stale (priority update needed)
90+: Very stale (update immediately)
```

---

## File: `memory/staleness-state.json`

```json
{
  "lastCheck": "2026-05-07T07:20:00+08:00",
  "files": {
    "MEMORY.md": {
      "lastUpdate": "2026-05-07T07:10:00+08:00",
      "stalenessScore": 0,
      "status": "fresh",
      "nextReview": "2026-05-14T07:10:00+08:00"
    },
    "memory/knowledge-graph.md": {
      "lastUpdate": "2026-05-07T07:05:00+08:00",
      "stalenessScore": 0,
      "status": "fresh",
      "nextReview": "2026-05-14T07:05:00+08:00"
    }
  }
}
```

---

## Staleness Rules

| File | Max Age | Dependencies | Check Trigger |
|------|---------|--------------|---------------|
| `SOUL.md` | 30 days | None | Heartbeat (weekly) |
| `IDENTITY.md` | 30 days | None | Heartbeat (weekly) |
| `USER.md` | 7 days | User interactions | After each session |
| `MEMORY.md` | 7 days | Daily notes | Heartbeat (daily) |
| `memory/knowledge-graph.md` | 14 days | File changes | After code changes |
| `memory/capabilities.md` | 14 days | Skill changes | After skill usage |
| `memory/patterns.md` | 7 days | New patterns | When pattern used |
| `memory/lessons-learned.md` | 3 days | Mistakes | When lesson learned |
| `memory/upgrades.md` | 0 days | Upgrades | Immediate on upgrade |
| `memory/self-upgrade-queue.md` | 1 day | Plans | Daily review |

---

## Heartbeat Integration

During heartbeat checks:
1. Read `memory/staleness-state.json`
2. Calculate staleness for each file
3. If any file is stale → add to followup queue or alert user
4. Update state with new check timestamp

---

## Auto-Refresh Strategy

**Type A files (safe to auto-update):**
- `memory/staleness-state.json` itself
- `memory/fingerprints.json`
- Daily notes

**Type B files (review before update):**
- `MEMORY.md`
- `memory/knowledge-graph.md`
- `memory/capabilities.md`

**Type C files (human approval needed):**
- `SOUL.md`
- `IDENTITY.md`
- `AGENTS.md`

---

## Definition of Done

- [x] Staleness factors defined (time, change, event)
- [x] Scoring algorithm documented
- [x] State storage format created
- [x] Per-file rules established
- [x] Heartbeat integration planned
- [x] Auto-refresh strategy by file type
