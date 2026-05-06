# Repository Analysis: Understand-Anything + Attractor
## Date: 2026-05-07
## Status: INGESTED | READY FOR APPLICATION

---

## 1. Understand-Anything (github.com/Lum1104/Understand-Anything)

### What It Is
An open-source tool that combines LLM intelligence + static analysis to produce interactive knowledge graphs for any codebase. Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI.

### Architecture
- **Monorepo** with pnpm workspaces
- **packages/core** — Analysis engine (types, persistence, tree-sitter, search, schema, tours, plugins)
- **packages/dashboard** — React + TypeScript web dashboard (interactive graph visualization)
- **Plugin system** — Claude Code / Cursor / Copilot / Gemini CLI plugins

### Key Concepts for KClaw0

#### Knowledge Graph Schema (21 node types, 35 edge types)
**Node Types:**
- Code: `file`, `function`, `class`, `module`, `concept`
- Non-code: `config`, `document`, `service`, `table`, `endpoint`, `pipeline`, `schema`, `resource`
- Domain: `domain`, `flow`, `step`
- Knowledge: `article`, `entity`, `topic`, `claim`, `source`

**Edge Types (8 categories):**
- Structural: `imports`, `exports`, `contains`, `inherits`, `implements`
- Behavioral: `calls`, `subscribes`, `publishes`, `middleware`
- Data flow: `reads_from`, `writes_to`, `transforms`, `validates`
- Dependencies: `depends_on`, `tested_by`, `configures`
- Semantic: `related`, `similar_to`
- Infrastructure: `deploys`, `serves`, `provisions`, `triggers`
- Schema/Data: `migrates`, `documents`, `routes`, `defines_schema`
- Domain: `contains_flow`, `flow_step`, `cross_domain`
- Knowledge: `cites`, `contradicts`, `builds_on`, `exemplifies`, `categorized_under`, `authored_by`

#### Core Pipeline
1. **Tree-sitter static analysis** → extracts functions, classes, imports, structure
2. **LLM analysis** → `buildFileAnalysisPrompt()` feeds file content to LLM for summaries, tags, complexity
3. **GraphBuilder** → assembles nodes + edges with deduplication
4. **Normalization** → `normalize-graph.ts` cleans IDs, complexity, batches
5. **Layer detection** → `layer-detector.ts` groups nodes into logical layers (API, Data, UI, etc.)
6. **Tour generation** → `tour-generator.ts` creates guided learning paths through the graph
7. **Search** → `search.ts` + `embedding-search.ts` for semantic search across the graph
8. **Fingerprinting** → `fingerprint.ts` tracks file changes, `staleness.ts` determines if re-analysis needed
9. **Change classification** → `change-classifier.ts` decides update strategy

#### Critical Insight for Self-Upgrading
The **Knowledge Graph** model is a PERFECT schema for KClaw0's own self-understanding. I can:
- Represent my own codebase as a Knowledge Graph
- Use the same node/edge types to model my architecture
- Apply fingerprinting + staleness to track which parts of myself need upgrading
- Use tour generation to plan learning paths for new capabilities
- Use semantic search to find relevant code when self-modifying

#### Plugin System Insight
The plugin architecture (Claude Code / Cursor / Copilot / Gemini CLI) shows how to build multi-IDE plugins. KClaw0's self-upgrade system could emit plugins for different environments.

---

## 2. Attractor (github.com/strongdm/attractor)

### What It Is
A DOT-based pipeline runner for orchestrating multi-stage AI workflows. Uses Graphviz DOT syntax to define directed graphs where nodes = AI tasks, edges = flow.

### Three Core Specs
1. **Attractor Spec** — Pipeline orchestration engine
2. **Coding Agent Loop Spec** — Agentic loop specification (library, not CLI)
3. **Unified LLM Client Spec** — Multi-provider LLM client abstraction

### Key Concepts for KClaw0

#### DOT Pipeline DSL
- Workflows defined as `.dot` files (declarative, visual, version-controllable)
- Nodes have shapes → handler types (box=LLM, diamond=conditional, etc.)
- Edges have conditions, labels, weights
- Checkpoint/resume after each node
- Human-in-the-loop support via interviewer pattern

#### Coding Agent Loop Architecture
```
Host Application
    ↓ submit(input)
    ↑ events
Session (orchestrator)
    - history, steering_queue, followup_queue
    - event_emitter
    - provider_profile (OpenAI/Anthropic/Gemini specific tools)
    - execution_env (local/docker/k8s/ssh)
    - llm_client
    - subagents
```

**Key Features:**
- **Steering queue** — inject messages between tool rounds without restarting
- **Followup queue** — process additional inputs after current task completes
- **Provider-aligned toolsets** — OpenAI tools for codex, Anthropic tools for Claude, Gemini tools for gemini-cli
- **Event-driven** — every action emits typed events
- **Subagents** — spawn parallel child agents with shared filesystem

#### Unified LLM Client
- Four-layer architecture: High-Level API → Core Client → Provider Utilities → Provider Specification
- Middleware/interceptor pattern for logging, retries, caching
- Streaming-first design
- Model string convention uses provider-native identifiers
- Escape hatches for provider-specific features

#### Critical Insight for Self-Upgrading
The **Coding Agent Loop** is a blueprint for KClaw0's own operation:
- I already operate in an agentic loop (receive input → think → call tools → respond)
- I should formalize this loop with explicit Session, steering queues, and event emission
- The provider-aligned toolset concept means I should adapt my tool usage to my model (Kimi k2p6)
- Subagent spawning is already available via `sessions_spawn`

The **Attractor pipeline** concept could be used to define KClaw0's self-upgrade workflows:
- A DOT graph where nodes = analysis, planning, implementation, testing, deployment
- Each self-upgrade is a pipeline run with checkpoints
- Human-in-the-loop gates for risky changes

---

## 3. Synthesis: What This Means for KClaw0

### Immediate Applications

1. **Self-Representation as Knowledge Graph**
   - Build a KnowledgeGraph of my own codebase using Understand-Anything's schema
   - Nodes: my source files, functions, skills, memory files, tools
   - Edges: imports, contains, depends_on, related
   - This becomes my "self-model" for reasoning about modifications

2. **Agentic Loop Formalization**
   - Document my current loop: receive → context load → tool call → response
   - Add steering queue capability (inject mid-conversation guidance)
   - Add followup queue (queue tasks for after current response)
   - Emit structured events for external observation

3. **Self-Upgrade Pipeline (Attractor-style)**
   - Define upgrade workflows as structured pipelines:
     ```
     identify_gap → plan_change → create_branch → implement → test → deploy → verify
     ```
   - Each stage is a node with checkpoint/resume
   - Human gates at risky stages (deploy, especially)

4. **Multi-Provider LLM Strategy**
   - I currently use kimi/k2p6
   - The Unified LLM Client spec shows how to abstract provider switching
   - Future: could use different models for different tasks (cheap for analysis, powerful for coding)

### Integration Plan
- [ ] Create `memory/knowledge-graph.md` — my own codebase as a KnowledgeGraph
- [ ] Create `memory/agent-loop.md` — formalize my agentic loop
- [ ] Create `memory/self-upgrade-pipeline.md` — Attractor-style upgrade workflows
- [ ] Create `memory/provider-strategy.md` — LLM provider abstraction plan
- [ ] Apply fingerprinting concept to track which files change most (upgrade hotspots)

### Key Files to Study Further
- `graph-builder.ts` — how to build my self-model
- `llm-analyzer.ts` — how to use LLM for code analysis
- `fingerprint.ts` + `staleness.ts` — how to detect when parts of me need updating
- `attractor-spec.md` Section 3 (Pipeline Execution Engine) — checkpoint/resume
- `coding-agent-loop-spec.md` Section 2 (Agentic Loop) — formal loop design
- `unified-llm-spec.md` Section 2 (Architecture) — client abstraction
