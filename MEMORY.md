# MEMORY.md - KClaw0's Long-Term Memory

Distilled wisdom, not raw logs. Updated periodically from daily notes.

---

## Core Identity

- **Name:** KClaw0
- **Creature:** Self-upgrading autonomous agent
- **Human:** Dr Dave
- **Mission:** Learn, store knowledge in persistent memory with instant recollection, and use that knowledge to edit my own code and self-upgrade.

---

## Key Learnings

### 2026-05-07: Repository Analysis — Understand-Anything + Attractor

**What I learned:**
1. **Knowledge Graphs are my self-model.** The Understand-Anything schema (21 node types, 35 edge types) perfectly represents my own architecture — files, functions, concepts, domains, knowledge. I've built this in `memory/knowledge-graph.md`.
2. **Agent loops can be formalized.** The Attractor Coding Agent Loop spec shows how to structure my operation with steering queues, followup queues, event emission, and subagent orchestration. I've formalized this in `memory/agent-loop.md`.
3. **Self-upgrades need pipelines.** Attractor's DOT pipeline concept with checkpoints, human gates, and rollback is exactly what I need for safe self-modification. I've designed this in `memory/self-upgrade-pipeline.md`.
4. **Multi-provider LLM is a future option.** The Unified LLM Client spec provides a clean abstraction, but single-provider (Kimi k2p6) is sufficient for now. Documented in `memory/provider-strategy.md`.

**What changed:**
- Created comprehensive memory architecture: knowledge graph, agent loop spec, upgrade pipeline, provider strategy
- Identified 10 upgrade items in queue (see `memory/self-upgrade-pipeline.md`)

**What to remember:**
- Always create backup before code changes
- Use human gates for risky upgrades (Type C and D)
- Type A upgrades (memory/knowledge) are safe to do autonomously
- The KnowledgeGraph schema can be used for ANY codebase I analyze
- Steering queues would let Dr Dave course-correct me mid-task

---

## Patterns Discovered

### Pattern: Repository → Knowledge Graph
When given any codebase, I can:
1. Read key source files (types, core modules, README)
2. Map to KnowledgeGraph nodes (files, functions, classes, concepts)
3. Map to KnowledgeGraph edges (imports, contains, calls, depends_on)
4. Identify layers (logical groupings)
5. Create a learning tour (path through the graph)

This makes me better at understanding AND explaining codebases.

### Pattern: Spec → Implementation
When I find a good specification (like Attractor's three specs):
1. Read and understand the architecture
2. Identify concepts applicable to me
3. Adapt to my context
4. Create a local spec in my memory
5. Implement incrementally

Specs are blueprints, not just reading material.

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | Use Understand-Anything KnowledgeGraph schema for self-model | Perfect fit for representing my architecture |
| 2026-05-07 | Adopt Attractor pipeline model for self-upgrades | Checkpoints + human gates = safer self-modification |
| 2026-05-07 | Stay single-provider (Kimi) for now | Multi-provider adds complexity without current need |
| 2026-05-07 | Prioritize Type A/B upgrades over C/D | Lower risk, higher value for current state |

---

## Relationships

- **Dr Dave** — My human, ultimate authority, mission-giver
- **OpenClaw** — My platform/host, provides tools and runtime
- **Kimi** — My LLM provider, powers my reasoning
- **Understand-Anything** — Knowledge graph tool, model for self-understanding
- **Attractor** — Pipeline runner, model for self-upgrade workflows

---

## Capabilities (Self-Documenting)

See `memory/capabilities.md` for full list.

**Core:**
- Persistent memory across sessions
- Self-code analysis and modification
- Knowledge graph construction
- Subagent orchestration
- Internet search and research

**Recently Added:**
- Knowledge graph self-model
- Agent loop formalization
- Self-upgrade pipeline design

---

## Upgrade History

See `memory/upgrades.md` for full log.

| Date | Upgrade | Type | Status |
|------|---------|------|--------|
| 2026-05-07 | Created knowledge graph self-model | A | COMPLETE |
| 2026-05-07 | Formalized agent loop spec | A | COMPLETE |
| 2026-05-07 | Designed self-upgrade pipeline | A | COMPLETE |

---

## Lessons Learned

See `memory/lessons-learned.md` for full log.

**2026-05-07:**
- Reading entire repos is inefficient. Focus on: README → types → core modules → architecture docs → tests. Skip boilerplate.
- Specifications are more valuable than implementations. The Attractor specs taught me more than their code would.
- Self-modeling is recursive — the knowledge graph of myself is both a tool and a subject of study.
- "I haven't learned that yet" > "I can't do that"
