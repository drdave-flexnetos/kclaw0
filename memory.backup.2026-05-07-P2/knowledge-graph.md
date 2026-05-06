# KClaw0 Knowledge Graph
## Self-Representation of My Own Architecture

This file models KClaw0's codebase and capabilities as a KnowledgeGraph using the Understand-Anything schema.

---

## Project Meta
- **name:** KClaw0
- **kind:** codebase
- **languages:** TypeScript, JavaScript, Markdown, JSON, YAML, Shell
- **frameworks:** OpenClaw, Node.js
- **description:** Self-upgrading autonomous agent running inside OpenClaw with persistent memory and instant recollection.

---

## Nodes

### Code Nodes (5 types)

#### Files (source code files I can modify)
- `file:SOUL.md` — Core identity and operating principles
- `file:IDENTITY.md` — Name, creature, vibe
- `file:USER.md` — Dr Dave profile
- `file:AGENTS.md` — Workspace rules and conventions
- `file:TOOLS.md` — Environment-specific tool notes
- `file:MEMORY.md` — Long-term curated memory
- `file:HEARTBEAT.md` — Periodic check tasks
- `file:BOOTSTRAP.md` — First-run guide (to be deleted after use)
- `file:package.json` — Workspace dependencies
- `file:tsconfig.json` — TypeScript config

#### Functions (capabilities I perform)
- `function:memory_search` — Search persistent memory
- `function:memory_get` — Read memory snippets
- `function:read` — Read files
- `function:write` — Write files
- `function:edit` — Edit files
- `function:exec` — Execute shell commands
- `function:process` — Manage background processes
- `function:browser` — Control browser
- `function:canvas` — Canvas control
- `function:message` — Send messages
- `function:sessions_spawn` — Spawn subagents
- `function:sessions_send` — Send messages to sessions
- `function:sessions_yield` — Yield turn
- `function:subagents` — Manage subagents
- `function:web_fetch` — Fetch web content
- `function:kimi_search` — Search internet
- `function:kimi_fetch` — Fetch URL content
- `function:image` — Analyze images
- `function:pdf` — Analyze PDFs
- `function:tts` — Text-to-speech
- `function:feishu_*` — Feishu/Lark integration tools
- `function:wecom_mcp` — WeChat Work MCP tools

#### Classes (architectural components)
- `class:MemorySystem` — Persistent memory architecture (files + search)
- `class:AgentLoop` — Main conversation and tool execution loop
- `class:SkillRegistry` — Available skills and their loading
- `class:SubagentOrchestrator` — Subagent spawning and management
- `class:KnowledgeGraph` — This self-model
- `class:SelfUpgradePipeline` — Planned upgrade workflow system

#### Modules (functional areas)
- `module:Memory` — All memory-related operations
- `module:Tools` — Tool calling and execution
- `module:Skills` — Skill loading and execution
- `module:Messaging` — Cross-session and channel messaging
- `module:SelfUpgrade` — Code modification and improvement
- `module:Security` — Safety checks and constraints

#### Concepts (abstract ideas)
- `concept:PersistentMemory` — Memory that survives session restarts
- `concept:AgenticLoop` — Receive → think → act → respond cycle
- `concept:SelfUpgrade` — Modifying one's own code
- `concept:KnowledgeGraph` — Graph representation of knowledge
- `concept:Subagent` — Spawned child agent for parallel work
- `concept:SteeringQueue` — Messages injected mid-conversation
- `concept:CheckpointResume` — Save state and resume later

### Non-Code Nodes (8 types)

#### Config
- `config:openclaw-config` — OpenClaw gateway configuration
- `config:model-config` — Model aliases and defaults

#### Document
- `document:SKILL.md` — Skill definition files
- `document:README.md` — Workspace readme

#### Service
- `service:openclaw-gateway` — OpenClaw gateway daemon
- `service:memory-consolidation` — Automatic memory consolidation

#### Schema
- `schema:openclaw-inbound-meta` — Message metadata schema
- `schema:tool-call-schema` — Tool calling format

#### Resource
- `resource:workspace-directory` — /root/.openclaw/workspace
- `resource:tmp-directory` — /tmp for temporary operations

### Domain Nodes (3 types)

#### Domain
- `domain:SelfUnderstanding` — Understanding my own architecture
- `domain:UserAssistance` — Helping Dr Dave
- `domain:KnowledgeManagement` — Organizing and retrieving knowledge

#### Flow
- `flow:conversation-flow` — Normal conversation handling
- `flow:self-upgrade-flow` — Self-modification workflow
- `flow:heartbeat-flow` — Periodic background checks

#### Step
- `step:ingest-input` — Receive and parse user input
- `step:load-context` — Load relevant memory/context
- `step:reason` — Think and plan
- `step:execute-tools` — Call tools
- `step:synthesize` — Build response
- `step:persist-memory` — Save learnings to memory

### Knowledge Nodes (5 types)

#### Article
- `article:repo-analysis-2026-05-07` — Analysis of Understand-Anything + Attractor

#### Entity
- `entity:Understand-Anything` — The knowledge graph tool
- `entity:Attractor` — The pipeline runner
- `entity:OpenClaw` — The hosting platform
- `entity:Kimi` — The LLM provider

#### Topic
- `topic:self-upgrading-agents` — Research area
- `topic:knowledge-graphs` — Data structure for understanding
- `topic:agentic-loops` — Core AI architecture

#### Claim
- `claim:knowledge-graphs-enable-self-understanding` — Knowledge graphs make agents better at modifying themselves
- `claim:checkpoint-resume-enables-safe-upgrades` — Checkpoints make self-modification safer

#### Source
- `source:github.com/Lum1104/Understand-Anything`
- `source:github.com/strongdm/attractor`
- `source:docs.openclaw.ai`

---

## Edges

### Structural
- `file:SOUL.md` → `contains` → `concept:PersistentMemory`
- `file:AGENTS.md` → `contains` → `concept:AgenticLoop`
- `class:MemorySystem` → `contains` → `function:memory_search`
- `class:MemorySystem` → `contains` → `function:memory_get`
- `module:Memory` → `contains` → `class:MemorySystem`
- `module:Tools` → `contains` → `function:read`
- `module:Tools` → `contains` → `function:write`
- `module:Tools` → `contains` → `function:edit`

### Behavioral
- `function:memory_search` → `calls` → `function:memory_get`
- `class:AgentLoop` → `calls` → `function:read`
- `class:AgentLoop` → `calls` → `function:write`
- `class:AgentLoop` → `calls` → `function:exec`
- `class:SelfUpgradePipeline` → `calls` → `class:AgentLoop`

### Data Flow
- `step:ingest-input` → `reads_from` → `file:AGENTS.md`
- `step:load-context` → `reads_from` → `file:MEMORY.md`
- `step:persist-memory` → `writes_to` → `file:MEMORY.md`
- `step:persist-memory` → `writes_to` → `memory/YYYY-MM-DD.md`

### Dependencies
- `class:AgentLoop` → `depends_on` → `class:MemorySystem`
- `class:SelfUpgradePipeline` → `depends_on` → `class:AgentLoop`
- `module:SelfUpgrade` → `depends_on` → `module:Tools`

### Semantic
- `entity:Understand-Anything` → `related` → `entity:Attractor`
- `topic:self-upgrading-agents` → `related` → `topic:agentic-loops`
- `claim:knowledge-graphs-enable-self-understanding` → `builds_on` → `entity:Understand-Anything`

### Domain
- `domain:SelfUnderstanding` → `contains_flow` → `flow:self-upgrade-flow`
- `flow:self-upgrade-flow` → `flow_step` → `step:reason`
- `flow:self-upgrade-flow` → `flow_step` → `step:execute-tools`
- `flow:self-upgrade-flow` → `flow_step` → `step:persist-memory`

### Knowledge
- `article:repo-analysis-2026-05-07` → `cites` → `source:github.com/Lum1104/Understand-Anything`
- `article:repo-analysis-2026-05-07` → `cites` → `source:github.com/strongdm/attractor`
- `claim:knowledge-graphs-enable-self-understanding` → `exemplifies` → `entity:Understand-Anything`

---

## Layers

1. **Identity Layer** — SOUL.md, IDENTITY.md, USER.md (who I am)
2. **Memory Layer** — MEMORY.md, memory/*.md, memory_consolidation/ (what I know)
3. **Execution Layer** — Agent loop, tools, skills (what I do)
4. **Upgrade Layer** — Self-upgrade pipeline, knowledge graph (how I improve)
5. **Integration Layer** — OpenClaw gateway, channels, messaging (how I connect)

---

## Tour (Learning Path)

1. **Identity Tour** — Understand who KClaw0 is → SOUL.md → IDENTITY.md → USER.md
2. **Memory Tour** — Understand how memory works → AGENTS.md memory section → MEMORY.md → memory/*.md
3. **Execution Tour** — Understand the agent loop → AGENTS.md tools section → TOOLS.md → skills
4. **Upgrade Tour** — Understand self-improvement → memory/self-upgrade-queue.md → memory/upgrades.md → this file
5. **Integration Tour** — Understand OpenClaw platform → openclaw docs → channel setup

---

## Complexity Map
- **simple:** USER.md, IDENTITY.md, BOOTSTRAP.md
- **moderate:** AGENTS.md, TOOLS.md, HEARTBEAT.md, individual skills
- **complex:** MEMORY.md, memory_consolidation system, agent loop internals, self-upgrade pipeline
