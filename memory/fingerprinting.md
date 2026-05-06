# Fingerprinting System
## Track File Changes for Smart Updates

Based on Understand-Anything's fingerprinting concept.

---

## Purpose

Track hashes of my memory and config files to:
- Detect what changed between sessions
- Determine if re-analysis is needed
- Identify "hot files" that change frequently (upgrade hotspots)
- Support incremental memory updates

---

## Implementation

### File: `memory/fingerprints.json`

Stores SHA-256 hashes of tracked files:

```json
{
  "version": "1.0",
  "lastUpdated": "2026-05-07T07:15:00+08:00",
  "files": {
    "SOUL.md": { "hash": "abc123...", "size": 1234, "lines": 45 },
    "IDENTITY.md": { "hash": "def456...", "size": 567, "lines": 20 },
    "USER.md": { "hash": "ghi789...", "size": 890, "lines": 15 },
    "MEMORY.md": { "hash": "jkl012...", "size": 3456, "lines": 120 },
    "memory/knowledge-graph.md": { "hash": "mno345...", "size": 8901, "lines": 250 },
    "memory/agent-loop.md": { "hash": "pqr678...", "size": 6789, "lines": 180 },
    "memory/self-upgrade-pipeline.md": { "hash": "stu901...", "size": 7890, "lines": 200 },
    "memory/capabilities.md": { "hash": "vwx234...", "size": 4567, "lines": 130 },
    "memory/patterns.md": { "hash": "yzA567...", "size": 6789, "lines": 170 },
    "memory/lessons-learned.md": { "hash": "BCD890...", "size": 2345, "lines": 80 }
  }
}
```

### Update Procedure

When I modify files, I update fingerprints:

1. Read current file content
2. Compute hash (contentHash function)
3. Compare with stored hash
4. If different → update fingerprint + mark as "changed"
5. Log changes to `memory/change-log.md`

### Command to Generate

```bash
# For a single file
sha256sum SOUL.md

# For all tracked files
for f in SOUL.md IDENTITY.md USER.md MEMORY.md memory/*.md; do
  echo "$f: $(sha256sum $f | cut -d' ' -f1)"
done
```

---

## Change Classification

Based on Understand-Anything's change-classifier:

| Change Type | Trigger | Action |
|-------------|---------|--------|
| **Content edit** | Line count changes < 10% | Update fingerprint only |
| **Major rewrite** | Line count changes > 30% | Re-analyze structure |
| **New file** | Not in fingerprint store | Add to store + analyze |
| **Deleted file** | File missing | Remove from store + log |
| **Renamed file** | Old missing, new appears with similar hash | Update path |

---

## Hot File Tracking

Files that change most frequently indicate active development areas:

```json
{
  "hotFiles": [
    { "path": "memory/self-upgrade-queue.md", "changeCount": 5 },
    { "path": "memory/upgrades.md", "changeCount": 3 },
    { "path": "USER.md", "changeCount": 2 }
  ]
}
```

---

## Integration with Staleness

Fingerprints feed into staleness detection (see `memory/staleness.md`):
- Changed files → potentially stale
- Unchanged for long time → may need review
- Hot files → upgrade hotspots to monitor

---

## Usage in Agent Loop

Before starting work:
1. Check `memory/fingerprints.json` for current state
2. After completing work → update fingerprints
3. Report changes to user if significant

---

## Definition of Done

- [x] Fingerprint storage format defined
- [x] Update procedure documented
- [x] Change classification rules established
- [x] Hot file tracking concept created
- [x] Integration with staleness documented
