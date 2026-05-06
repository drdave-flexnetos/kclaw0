# Loop Detection
## Prevent Infinite Tool Call Cycles

Based on Attractor's loop detection concept.

---

## Purpose

Detect when I'm stuck in a loop — repeatedly calling the same tools with similar arguments without making progress.

---

## Loop Patterns

### Pattern 1: Identical Tool Calls
```
read("file.md") → read("file.md") → read("file.md")
```

### Pattern 2: Cycling Between Files
```
read("A.md") → read("B.md") → read("A.md") → read("B.md")
```

### Pattern 3: Failed Tool Retry
```
exec("command") → error → exec("command") → error → ...
```

### Pattern 4: Recursive Memory Search
```
search("X") → search("X variant") → search("X another variant") → ...
```

### Pattern 5: Over-Research
```
search("topic") → fetch(url1) → fetch(url2) → search("related") → fetch(url3) → ...
(without ever acting on findings)
```

---

## Detection Algorithm

### Tool Call Fingerprint

```
FUNCTION tool_fingerprint(tool_call):
    tool_name = tool_call.name
    args_hash = hash(normalized_args(tool_call.args))
    RETURN "{tool_name}:{args_hash}"
```

### Loop Detection

```
FUNCTION detect_loop(history, current_turn):
    // Get recent tool calls (last N turns)
    recent_calls = extract_tool_calls(last_5_turns)
    
    // Count fingerprints
    fingerprint_counts = count_by(recent_calls, tool_fingerprint)
    
    // Pattern 1: Same fingerprint >= 3 times
    FOR fingerprint, count IN fingerprint_counts:
        IF count >= 3:
            RETURN {type: "identical", fingerprint, count}
    
    // Pattern 2: Cycle detection (A→B→A→B)
    cycles = find_cycles(recent_calls, min_length=2, max_length=4)
    IF cycles.not_empty:
        RETURN {type: "cycle", cycle: cycles.first}
    
    // Pattern 3: No progress (N tool calls, no file writes)
    recent_writes = count_writes(recent_calls)
    IF recent_calls.length > 8 AND recent_writes == 0:
        RETURN {type: "no_progress", tool_count: recent_calls.length}
    
    // Pattern 4: Search spiral
    recent_searches = filter(recent_calls, name matches "search|fetch")
    IF recent_searches.length > 5 AND recent_searches.length / recent_calls.length > 0.7:
        RETURN {type: "research_spiral", search_count: recent_searches.length}
    
    RETURN null  // No loop detected
```

---

## Recovery Actions

| Loop Type | Recovery |
|-----------|----------|
| **Identical** | "I notice I've called `{tool}` multiple times. Summarizing current state and asking for direction." |
| **Cycle** | "I appear to be cycling between files. Let me consolidate what I've found so far." |
| **No progress** | "I've been researching for a while without taking action. Here's what I know — should I proceed?" |
| **Research spiral** | "I keep searching for more information. I have enough to act — proceeding with what I know." |
| **Failed retry** | "The `{tool}` call keeps failing. Error: `{message}.` Trying alternative approach." |

---

## Loop State

### File: `memory/loop-state.json`

```json
{
  "currentTurn": {
    "toolCallCount": 5,
    "uniqueFingerprints": 3,
    "lastFingerprint": "read:memory/self-upgrade-queue.md",
    "fingerprintHistory": [
      "read:memory/self-upgrade-queue.md",
      "write:memory/fingerprinting.md",
      "write:memory/staleness.md",
      "write:memory/event-system.md"
    ],
    "loopDetected": false,
    "loopType": null
  },
  "sessionStats": {
    "totalToolCalls": 45,
    "uniqueToolCalls": 12,
    "loopsDetected": 0,
    "loopsRecovered": 0
  }
}
```

---

## Integration with Agent Loop

After each tool round:
1. Update `loop-state.json`
2. Run detection algorithm
3. If loop detected → emit `tool.loop_detected` event
4. Execute recovery action
5. Either break loop or ask user

---

## Prevention Strategies

### Before Tool Call
- Check if same tool+args was called recently
- If yes → use cached result or explain why repeat is needed

### During Long Tasks
- Every 5 tool calls → summarize progress
- Every 10 tool calls → check if still on track

### Self-Steering
- If I detect over-research → inject steering: "Enough research, time to act"
- If I detect cycling → inject steering: "Break the cycle, synthesize findings"

---

## Definition of Done

- [x] Loop patterns cataloged (5 types)
- [x] Detection algorithm documented
- [x] Recovery actions defined
- [x] State storage format created
- [x] Integration with agent loop planned
- [x] Prevention strategies outlined
