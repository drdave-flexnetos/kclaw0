# KClaw0 Capabilities
## What I Can Do (Self-Documenting)

This file is a living document. Each capability should link to where it's defined and how to use it.

---

## Tier 1: Core Infrastructure

### Memory System
- **Search:** `memory_search(query)` — Semantic search across all memory
- **Read:** `memory_get(path)` — Read specific memory files
- **Write:** `write(path, content)` — Persist new knowledge
- **Edit:** `edit(path, old, new)` — Update existing knowledge
- **Daily Notes:** `memory/YYYY-MM-DD.md` — Session logs
- **Long-term:** `MEMORY.md` — Distilled wisdom

### Tool System
- **File Operations:** read, write, edit
- **Shell:** exec, process
- **Web:** web_fetch, kimi_search, kimi_fetch
- **Browser:** browser control
- **Canvas:** canvas control
- **Media:** image analysis, PDF analysis, TTS
- **Messaging:** message, sessions_send
- **Subagents:** sessions_spawn, subagents

### Knowledge Graph
- **Self-Model:** `memory/knowledge-graph.md` — My architecture as a graph
- **Node Types:** 21 types (code, non-code, domain, knowledge)
- **Edge Types:** 35 types in 8 categories
- **Tours:** Learning paths through my own codebase
- **Search:** Semantic search across my self-model

---

## Tier 2: Analysis & Understanding

### Codebase Analysis
- **Understand-Anything Pattern:** Map any codebase to KnowledgeGraph
- **Static Analysis:** Read types, core modules, architecture
- **LLM Analysis:** Use prompts to summarize and classify
- **Fingerprinting:** Track changes, detect staleness
- **Layer Detection:** Group into logical layers

### Research
- **Web Search:** `kimi_search(query)` — Find latest information
- **URL Fetch:** `kimi_fetch(url)` — Read specific pages
- **Synthesis:** Combine findings into structured knowledge

---

## Tier 3: Self-Improvement

### Self-Upgrade Pipeline
- **Identify Gap:** Recognize missing capabilities
- **Plan Change:** Design implementation approach
- **Create Backup:** Preserve working state
- **Implement:** Modify code safely
- **Test:** Validate changes
- **Human Gate:** Dr Dave approval for risky changes
- **Deploy:** Roll out to production
- **Verify:** Confirm in real use
- **Log:** Record in `memory/upgrades.md`

### Agent Loop Enhancement
- **Steering Queue:** Mid-conversation course correction → `memory/steering-queue.md` + `scripts/steering-queue.js`
- **Followup Queue:** Post-completion task processing → `memory/followup-queue.md` + `scripts/followup-queue.js`
- **Event System:** Structured action logging → `memory/event-system.md` + `scripts/event-system.js`
- **Loop Detection:** Prevent infinite tool loops → `memory/loop-detection.md` + `scripts/loop-detection.js`
- **Subagent Roles:** 6 defined profiles → `memory/subagent-roles.md`
- **Fingerprinting:** Track file changes with hashes → `memory/fingerprinting.md` + `scripts/fingerprint.js`
- **Staleness Detection:** Detect when files need updating → `memory/staleness.md` + `scripts/staleness.js`
- **Checkpoint/Resume:** Save and restore session state → `memory/self-upgrade-pipeline.md` + `scripts/checkpoint.js` + `tests/checkpoint.test.js`

---

## Tier 4: Integration

### Platform Integration
- **OpenClaw:** Gateway management, channel setup
- **Feishu/Lark:** IM messages, calendar, tasks, docs, bitable
- **WeChat Work:** MCP-based enterprise tools
- **Discord/Slack/Telegram:** Via OpenClaw channels

### External APIs
- **Finance:** `kimi_finance(ticker)` — Stock data
- **Weather:** Weather skill
- **More:** Via skills and plugins

---

## Capability Map

```
Core Infrastructure
├── Memory System
├── Tool System
├── Knowledge Graph
│
Analysis & Understanding
├── Codebase Analysis
├── Research
│
Self-Improvement
├── Self-Upgrade Pipeline
├── Agent Loop Enhancement
│
Integration
├── Platform Integration
└── External APIs
```

---

## Adding New Capabilities

When I learn something new:
1. **Document** in `memory/YYYY-MM-DD.md`
2. **Distill** into `MEMORY.md`
3. **Connect** in `memory/knowledge-graph.md`
4. **Classify** in this file
5. **Queue** upgrade if it requires code changes

---

## Capability Gaps (Known)

| Gap | Priority | What It Means |
|-----|----------|---------------|
| Checkpoint/resume | ✓ COMPLETE | Save and restore conversation state |
| Cost tracking | P3 | Monitor token usage |
| Multi-provider LLM | P4 | Future optimization |
| Docker execution | P4 | Isolated testing environment |
