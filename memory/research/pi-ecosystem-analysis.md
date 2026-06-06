# Deep Research Report: Pi Ecosystem & AI Agent Architectures
## For KClaw0 — Structure & Automation Gap Analysis

**Date:** 2026-05-08
**Scope:** 5 repositories + 2 supporting systems
**Focus:** STRUCTURE and AUTOMATION features KClaw0 should adopt

---

## Executive Summary

The Pi ecosystem and its derivatives represent the most advanced open-source AI agent architecture available. These systems solve problems KClaw0 is currently struggling with: durable execution, workflow orchestration, context management, subagent coordination, and self-running automation. The key insight is that **KClaw0 needs a workflow engine layer** — something between raw tool execution and the LLM — to make its operations deterministic, resumable, and composable.

---

## 1. STRONGDM ATTRACTOR / jhugman/attractor-pi-dev

### (1) Key Architectural Components

**DOT-based Declarative Pipelines**
- Workflows defined as Graphviz DOT digraphs — nodes are tasks, edges are transitions
- Node types: LLM calls (`prompt="..."`), human gates (`shape=Mdiamond`), shell commands, conditionals, parallel fan-out/fan-in
- Edge conditions with runtime evaluation against execution context
- Graph attributes configure behavior: `graph [goal="Build feature X"]`

**Three-Layer Architecture**
```
@attractor/core          → Parser, graph model, validation, execution engine, handlers
@attractor/backend-pi-dev → LLM backend wrapping pi-mono (pluggable)
@attractor/cli           → CLI entry point
```

**Checkpoint/Resume System**
- Serializable checkpoint saved after EVERY node execution
- `resumeFrom` support in runner (CLI flag pending)
- Crash recovery: resume from last checkpoint, not restart
- Execution context persists across checkpoints

**Handler Plugin System**
- Each node type backed by a handler implementing common interface
- New node types added by registering handlers — engine doesn't know internals
- `CodergenBackend` interface: single `run(prompt, options)` method
- Backend-agnostic: swap LLM provider without changing pipeline definition

**Validation & Classification**
- Structure checks: reachability, dead ends, terminal paths
- Syntax validation: conditions, stylesheet parsing
- Pipeline classification: EXECUTION (code changes), PLANNING (docs only), HYBRID (tools no coding agent), ANALYSIS (LLM-only)

### (2) Automation/Self-Running Features

- **Goal Gates**: Enforce completion criteria before pipeline exit
- **Retry Logic**: Exponential backoff configurable per node
- **Parallel Execution**: Fan-out/fan-in for concurrent node execution
- **Human-in-the-Loop**: Pipeline pauses at designated nodes, presents choices, routes based on human decision
- **Edge-Based Routing**: Transitions controlled by conditions, labels, weights
- **Manager/Supervisor Loops**: Observer pattern for monitoring (partially wired)
- **Variable Substitution**: `${ctx.key}` references in node attributes
- **Stylesheets**: CSS-like rules applying attributes to nodes by selector

### (3) Integration Patterns

- **Event Stream Architecture**: Pipeline engine is headless; TUI/web/IDE frontends consume events and submit human answers
- **Backend Abstraction**: `CodergenBackend` interface enables plugging in Claude Code, Codex, Gemini CLI, or direct API calls
- **Git Worktree Isolation**: Each pipeline run in isolated git worktree (from Kilroy extension)
- **CXDB Execution Database**: Typed run events, artifact storage, resume metadata (from Kilroy)

### (4) Code Structures Worth Copying

**DOT Parser → Graph Model → Execution Engine pattern**
```
// Parse DOT → build directed graph → validate → walk node-by-node
// Each node: execute handler → evaluate edge conditions → select next node → checkpoint → repeat
```

**Pluggable Handler Interface**
```typescript
interface Handler {
  execute(node: Node, context: ExecutionContext): Promise<HandlerResult>;
}
// Register: engine.registerHandler('codergen', new CodergenHandler(backend));
```

**Checkpoint Serialization**
```typescript
interface Checkpoint {
  nodeId: string;
  context: ExecutionContext;
  status: 'completed' | 'failed' | 'pending';
  timestamp: number;
  artifacts: Record<string, string>;
}
```

**TTSR (Time-Traveling Streamed Rules) from oh-my-pi fork**
- Pattern-triggered rule injection that watches model output stream
- When regex matches, stream aborts, rule injects as system reminder, request retries
- ZERO upfront context cost — rules only activate when relevant
- One-shot per session to prevent loops

---

## 2. PI ECOSYSTEM / earendil-works/pi

### (1) Key Architectural Components

**Monorepo Package Structure**
```
packages/ai          → Unified multi-provider LLM API (OpenAI, Anthropic, Google, etc.)
packages/agent       → Agent runtime with tool calling and state management
packages/coding-agent → Interactive coding agent CLI
packages/tui         → Terminal UI library with differential rendering
packages/web-ui      → Web components for AI chat interfaces
```

**Unified LLM Client (`pi-ai`)**
- Single API surface across all providers
- Streaming support with standardized event types
- Model discovery and metadata caching
- Provider-specific request/response translation hidden behind unified interface

**Agent Runtime (`pi-agent-core`)**
- Tool calling framework with JSON schema validation
- State management between turns
- Message history with tree structure for branching
- Session persistence as JSONL with Snowflake-style hex IDs

**Session Tree Structure**
- Sessions stored as JSONL with tree structure (not linear)
- Branching: fork from any previous message into new session file
- In-place navigation: navigate session tree without creating new files
- Labels as bookmarks: `Shift+L` to mark entries

### (2) Automation/Self-Running Features

- **Context Compaction**: Summarizes older messages while keeping recent context. Auto-triggers on overflow or threshold.
- **Autonomous Memory**: Background pipeline extracts durable knowledge from past sessions, injects at startup. Isolated per project.
- **Subagent System (`task` tool)**: Parallel execution with 6 bundled agents (explore, plan, designer, reviewer, task, quick_task)
- **Agent Control Center**: `/agents` dashboard for managing custom agents
- **AI-Powered Agent Creation**: Generate custom agent definitions with architect model
- **Background Mode**: `/background` detaches UI, continues execution
- **Message Queuing**: Submit messages while agent is working; queue behavior configurable

### (3) Integration Patterns

- **Multi-Provider Credential Resolution**: OAuth + API keys, stored in SQLite (`agent.db`), round-robin distribution, usage-aware selection
- **Model Roles**: `default`, `smol`, `slow`, `plan`, `commit` — different models for different purposes
- **Universal Config Discovery**: Loads from 8 AI coding tools (Claude Code, Cursor, Windsurf, Gemini, Codex, Cline, Copilot, VS Code)
- **MCP (Model Context Protocol) Support**: Stdio and HTTP transports, OAuth, browser server filtering
- **Skills System**: Capability packages loaded on-demand from `*/SKILL.md` files
- **Hooks System**: TypeScript modules subscribing to lifecycle events (pre/post tool_call, etc.)
- **Custom Tools**: Auto-discovered from `*/tools/*/index.ts` with JSON schema parameters

### (4) Code Structures Worth Copying

**Unified LLM Client Interface**
```typescript
interface LLMClient {
  complete(prompt: string, options: CompletionOptions): Promise<CompletionResult>;
  stream(prompt: string, options: CompletionOptions): AsyncIterable<StreamEvent>;
  // Provider-agnostic: handles OpenAI, Anthropic, Google, etc.
}
```

**Session Manager with Tree Structure**
```typescript
interface SessionManager {
  createSession(): Session;
  branch(session: Session, messageId: string): Session;
  compact(session: Session, focus?: string): void;
  save(session: Session): void;
  load(id: string): Session;
}
```

**Context Compaction Configuration**
```yaml
compaction:
  enabled: true
  reserveTokens: 16384      # Keep this much headroom
  keepRecentTokens: 20000   # Always keep recent N tokens
  autoContinue: true        # Auto-compact and retry on overflow
```

**Model Role System**
```yaml
modelRoles:
  default: claude-sonnet-4-6
  plan: claude-opus-4-6:high
  smol: anthropic/claude-sonnet-4-6
```

---

## 3. OH-MY-PI / can1357/oh-my-pi

### (1) Key Architectural Components

**Rust N-API Native Engine (~7,500 lines)**
| Module | Lines | Purpose |
|--------|-------|---------|
| grep | ~1,300 | ripgrep-powered regex search, parallel/sequential, fuzzy find |
| shell | ~1,025 | Embedded bash execution with brush-shell, streaming, timeout |
| text | ~1,280 | ANSI-aware width, truncation, wrapping, UTF-16 optimized |
| keys | ~1,300 | Kitty keyboard protocol parser, PHF perfect-hash lookup |
| highlight | ~475 | Syntax highlighting with 11 semantic categories, 30+ langs |
| glob | ~340 | Filesystem discovery, .gitignore respect, mtime sorting |
| task | ~350 | Blocking work scheduler on libuv, cancellation, timeout |
| ps | ~290 | Cross-platform process tree kill (Linux/macOS/Windows) |
| prof | ~250 | Circular buffer profiler, folded-stack, SVG flamegraphs |
| image | ~150 | Decode/encode PNG/JPEG/WebP/GIF, resize with filters |
| clipboard | ~95 | System clipboard text copy/image read |
| html | ~50 | HTML-to-Markdown conversion |

**Hashline Edit System**
- Every line gets short content-hash anchor
- Model references anchors instead of reproducing text
- No whitespace reproduction, no "string not found", no ambiguous matches
- If file changed since last read, hashes won't match → edit rejected BEFORE corruption
- Benchmarked: 10x improvement for Grok Code Fast (6.7% → 68.3%), 61% fewer tokens for Grok 4 Fast

**Todo Tool (Phased Task Tracking)**
- 5 operations: `replace`, `add_phase`, `add_task`, `update`, `remove_task`
- 4 states: `pending`, `in_progress`, `completed`, `abandoned`
- Auto-normalization: exactly one task `in_progress` at all times
- Persistent panel above editor with real-time progress
- Completion reminders when stopping with incomplete todos

**Ask Tool (Interactive Questioning)**
- Multiple choice with descriptions
- Multi-select support
- Multi-part questions via `questions` array

### (2) Automation/Self-Running Features

- **Commit Tool**: AI-powered conventional commit generation with split commits, hunk-level staging, changelog generation
- **Python Tool**: Persistent IPython kernel with streaming output, prelude helpers, custom modules
- **LSP Integration**: 11 operations (diagnostics, definition, hover, rename, code_actions, etc.), format-on-write, 40+ language configs
- **Browser Tool**: Puppeteer with 14 stealth scripts, accessibility snapshots, reader mode
- **SSH Tool**: Persistent connections, OS/shell detection, SSHFS mounts
- **Task Tool (Subagents)**: 
  - 6 bundled agents: explore, plan, designer, reviewer, task, quick_task
  - Parallel exploration with real-time artifact streaming
  - Isolation backends: git worktrees, fuse-overlay, Windows ProjFS
  - Async background jobs with configurable concurrency (up to 100)
  - Agent Control Center for custom agent creation
- **TTSR (Time-Traveling Streamed Rules)**: Zero-cost pattern-triggered rule injection
- **Interactive Code Review**: `/review` command with structured findings (P0-P3 priority)
- **Custom Slash Commands**: TypeScript/Markdown programmable commands with full API access
- **Multi-Credential Support**: Round-robin distribution, usage-aware selection, automatic fallback on rate limits

### (3) Integration Patterns

- **Config Discovery from 8 Tools**: Claude Code, Cursor, Windsurf, Gemini, Codex, Cline, Copilot, VS Code
- **Plugin System**: Hot-loadable from `~/.omp/plugins/`, npm/bun integration
- **Web Search Multi-Provider**: auto, exa, brave, jina, kimi, zai, anthropic, perplexity, gemini, codex, synthetic
- **MCP Support**: Stdio/HTTP transports, OAuth, browser filtering
- **HTML Export**: Session export to HTML with full transcript
- **RPC Mode**: JSON commands on stdin for embedding from other languages

### (4) Code Structures Worth Copying

**Hashline Anchor System**
```typescript
// Each line gets a short hash anchor
const hashline = computeHash(lineContent);
// Edit request references hash, not text
edit: { anchor: "a3f7d2", newText: "replacement" }
// Validation: if hash doesn't match current file, reject edit
```

**Phased Todo System**
```typescript
interface TodoState {
  phases: Phase[];
  currentPhase: string;
}
interface Phase {
  name: string;
  tasks: Task[];
}
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
}
// Auto-normalization: ensures exactly one in_progress
```

**Subagent Isolation Backends**
```typescript
type IsolationMode = 'none' | 'worktree' | 'fuse-overlay' | 'fuse-projfs';
type MergeStrategy = 'patch' | 'branch';
interface TaskConfig {
  isolated: boolean;
  isolation: {
    mode: IsolationMode;
    merge: MergeStrategy;
  };
  maxConcurrency: number;  // up to 100
}
```

**TTSR Rule Format**
```typescript
interface TTSRRule {
  name: string;
  ttsrTrigger: string;  // regex pattern
  prompt: string;         // injected when pattern matches
  oneShot: boolean;       // only trigger once per session
}
// Zero upfront cost: rule not loaded into context until pattern matches
```

---

## 4. PICLAW / rcarmo/piclaw

### (1) Key Architectural Components

**Docker-Based Workspace**
- Single container with chat, editor, terminal, viewers, boards, uploads
- Persistent SQLite-backed state: messages, media, tasks, token usage
- Encrypted keychain for secrets
- Session-scoped SSH/Proxmox/Portainer profiles

**Web UI Architecture**
- Single-user, mobile-friendly, SSE streaming updates
- Ghostty-based web terminal (dock or tab, detachable popouts)
- CodeMirror 6 editor with search/replace, dirty-state tracking
- Draw.io, Office/PDF/CSV/image/video viewers, VNC, kanban boards, mindmaps

**Storage Model**
```
/workspace/.piclaw/store/messages.db  → Chat history, media, task state
/config/.pi/agent/                     → Provider login state, model metadata
/workspace/.env.sh                     → Shell environment overrides
```

**Runtime Stream Sessions**
- Thought/draft panels, steering, queued follow-ups
- Adaptive Cards, `/btw` (by the way) messages, link previews
- Threaded turns, recovery/timeout chips
- Tool/intended status visible during silence probing

### (2) Automation/Self-Running Features

- **Scheduled Tasks**: Cron-like scheduling within the workspace
- **Autoresearch Loops**: Autonomous experiment loop (from pi-autoresearch)
- **Side Prompts**: Secondary prompts running alongside main conversation
- **Visual Artifact Generation**: `/image`, `/flux`, `image_process`
- **MCP Integration**: Via pi-mcp-adapter
- **Cross-Instance IPC**: Optional paired remote peers
- **WhatsApp Integration**: Optional channel integration
- **Dream Memory System**: Background consolidation of session knowledge
- **Web Notification Delivery**: Push notifications for long-running tasks

### (3) Integration Patterns

- **Pi Agent Foundation**: All core Pi functionality + additional runtime layers
- **Add-on System**: `piclaw-addons` repository for additional tools
- **M365 Experimental Extension**: Microsoft 365 integration (optional)
- **Keychain**: Encrypted secret storage with master key
- **PWA Support**: iOS progressive web app reference implementation

### (4) Code Structures Worth Copying

**SQLite-Backed Persistent State**
```typescript
// Single database for all state: messages, media, tasks, tokens
const db = new SQLiteDatabase('/workspace/.piclaw/store/messages.db');
// Never delete — contains all history and task state
```

**Web Terminal Integration**
```typescript
// Ghostty-based terminal in browser
// Supports: dock mode, tab mode, detachable popouts
// Persistent sessions across page reloads
```

**Dream Memory System**
```typescript
// Background consolidation pipeline
// Extracts durable knowledge from sessions
// Injects compact summary at startup
// Full depth available via memory:// protocol
```

---

## 5. DARK FACTORY / coleam00/dark-factory-experiment

### (1) Key Architectural Components

**Fully Autonomous CI/CD Pipeline**
- Humans only: file issues and promote releases
- Everything else: triage, implementation, code review, testing, merging
- Archon workflows running on cron

**RAG Application (The Product)**
- Video transcript chunking with Docling's HybridChunker
- OpenRouter embedding
- Supadata for YouTube channel sync
- Cosine similarity matching
- Top-5 chunks fed to LLM for cited answers

**The Real Point: The Factory**
- AI builds, reviews, and merges the application
- Demonstrates end-to-end autonomous development

### (2) Automation/Self-Running Features

- **Cron-Driven Workflows**: Archon workflows triggered on schedule
- **Automatic Triage**: Issues classified and routed
- **Self-Implementation**: AI implements features from issues
- **Self-Review**: AI reviews its own code
- **Self-Testing**: Automated validation
- **Self-Merging**: PRs merged after passing gates

### (3) Integration Patterns

- **Archon Workflow Engine** (see below for detailed architecture)
- **GitHub Integration**: Issues, PRs, reviews, merges
- **YouTube/Superdata Sync**: External data ingestion

### (4) Code Structures Worth Copying

**The "Dark Factory" Pattern**
```
Human: File issue → AI: Triage → AI: Plan → AI: Implement → 
AI: Test → AI: Review → AI: Merge → Human: Promote release
```
- Complete autonomy in the middle loop
- Human only at boundaries (input and final approval)
- Cron triggers the cycle

---

## 6. ARCHON (Referenced by Dark Factory) / coleam00/archon

### (1) Key Architectural Components

**Workflow Engine Architecture**
```
┌─────────────────────────────────────────────────────────┐
│  Platform Adapters (Web UI, CLI, Telegram, Slack,       │
│                    Discord, GitHub)                      │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     Orchestrator                        │
│          (Message Routing & Context Management)       │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
      ┌───────┴────────┐          ┌───────┴────────┐
      │                │          │                │
      ▼                ▼          ▼                ▼
┌───────────┐  ┌────────────┐  ┌──────────────────────────┐
│  Command  │  │  Workflow  │  │    AI Assistant Clients│
│  Handler  │  │  Executor  │  │   (Claude / Codex / Pi)│
│  (Slash)  │  │  (YAML)    │  │                          │
└───────────┘  └────────────┘  └──────────────────────────┘
      │              │                      │
      └──────────────┴──────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SQLite / PostgreSQL (7 Tables)            │
│   Codebases • Conversations • Sessions • Workflow Runs │
│    Isolation Environments • Messages • Workflow Events │
└─────────────────────────────────────────────────────────┘
```

**YAML Workflow Definition**
```yaml
nodes:
  - id: plan
    prompt: "Explore the codebase and create an implementation plan"

  - id: implement
    depends_on: [plan]
    loop:
      prompt: "Read the plan. Implement the next task. Run validation."
      until: ALL_TASKS_COMPLETE
      fresh_context: true

  - id: run-tests
    depends_on: [implement]
    bash: "bun run validate"

  - id: review
    depends_on: [run-tests]
    prompt: "Review all changes against the plan. Fix any issues."

  - id: approve
    depends_on: [review]
    loop:
      prompt: "Present the changes for review. Address any feedback."
      until: APPROVED
      interactive: true

  - id: create-pr
    depends_on: [approve]
    prompt: "Push changes and create a pull request"
```

**7-Table Database Schema**
- Codebases, Conversations, Sessions, Workflow Runs
- Isolation Environments, Messages, Workflow Events

### (2) Automation/Self-Running Features

- **17 Built-in Workflows**: fix-github-issue, idea-to-pr, plan-to-pr, smart-pr-review, comprehensive-pr-review, create-issue, validate-pr, resolve-conflicts, feature-development, architect, refactor-safely, ralph-dag, remotion-generate, test-loop-dag, piv-loop
- **AI Loops**: Iterate until completion criteria met
- **Human Approval Gates**: Pause for interactive approval
- **Git Worktree Isolation**: Every run gets its own worktree, parallel execution with no conflicts
- **Fire and Forget**: Kick off, do other work, come back to finished PR
- **Composable Nodes**: Mix deterministic (bash, tests, git) with AI nodes (planning, generation, review)

### (3) Integration Patterns

- **Platform Adapters**: Same workflow works from CLI, Web UI, Slack, Telegram, Discord, GitHub
- **AI Assistant Clients**: Claude, Codex, Pi backends
- **Git Integration**: Worktree isolation, branch creation, PR creation
- **Repository-Scoped**: `.archon/workflows/` committed to repo, team shares same process

### (4) Code Structures Worth Copying

**Workflow Node Types**
```typescript
interface WorkflowNode {
  id: string;
  depends_on: string[];
  prompt?: string;        // AI node
  bash?: string;          // Deterministic node
  loop?: {
    prompt: string;
    until: 'ALL_TASKS_COMPLETE' | 'APPROVED' | string;
    fresh_context?: boolean;
    interactive?: boolean;
  };
}
```

**Isolation Environment**
```typescript
interface IsolationEnv {
  worktreePath: string;
  branchName: string;
  createdAt: number;
  status: 'active' | 'cleaned_up';
}
// Every workflow run gets one → parallel runs, no conflicts
```

---

## 7. ABSURD (Referenced by Pi Ecosystem) / earendil-works/absurd

### (1) Key Architectural Components

**Postgres-Native Durable Execution**
- Single SQL file (`absurd.sql`) turns PostgreSQL into durable workflow engine
- No extra services, no message brokers, no coordination layer
- Complexity in SQL stored procedures; SDKs are thin (~1,400 lines TypeScript, ~1,900 Python)

**Task → Step → Checkpoint Model**
```
Task (top-level work unit)
  → Steps (smaller pieces, act as checkpoints)
    → Step completes → result stored in Postgres
    → Crash → resume from last completed step
```

**Pull-Based Scheduling**
- Workers pull tasks from Postgres as they have capacity
- `SELECT ... FOR UPDATE SKIP LOCKED` for queue mechanics
- No coordinator, no push mechanism, trivially self-hostable

### (2) Automation/Self-Running Features

- **Automatic Checkpointing**: Every step result persisted
- **Resume from Crash**: Load checkpoints, skip completed work
- **Sleep/Suspend**: Tasks can suspend for time or await events
- **Event System**: Named events with cached first-emit-wins semantics (race-free)
- **Retry Semantics**: Tasks retry from last checkpoint, steps never retried
- **Step Auto-Counting**: Repeated steps get auto-incremented names (`iteration`, `iteration#2`, etc.)

### (3) Integration Patterns

- **Language SDKs**: TypeScript, Python, Go (experimental)
- **CLI Tool**: `absurdctl` for schema management, queue operations, task inspection
- **Web Dashboard**: `habitat` — Go app showing task state
- **Comparison**: PGMQ, Cadence, Temporal, Inngest, DBOS

### (4) Code Structures Worth Copying

**Step Function Pattern**
```typescript
app.registerTask({ name: 'my-agent' }, async (params, ctx) => {
  let messages = [{role: "user", content: params.prompt}];
  let step = 0;
  while (step++ < 20) {
    const { newMessages, finishReason } = await ctx.step("iteration", async () => {
      return await singleStep(messages);
    });
    messages.push(...newMessages);
    if (finishReason !== "tool-calls") break;
  }
});
// Each ctx.step is checkpointed automatically
// Crash in step 5 → resume from step 4, not beginning
```

**Postgres Queue Mechanics**
```sql
-- FOR UPDATE SKIP LOCKED for claim-based scheduling
-- Stored procedures handle all queue logic
-- No separate message broker needed
```

---

## 🎯 RECOMMENDED ADOPTIONS FOR KCLAW0

### Priority 1: Workflow Engine (Attractor Pattern)
**What**: DOT-based or YAML-based declarative workflow definitions
**Why**: KClaw0 currently runs ad-hoc tool sequences. A workflow engine would make operations deterministic, resumable, and composable.
**How**: 
- Implement a simplified DOT parser or YAML workflow format
- Define node types: `llm`, `tool`, `human_gate`, `conditional`, `parallel`
- Add checkpoint/resume after every node
- Pluggable handlers for different node types

### Priority 2: Durable Execution (Absurd Pattern)
**What**: Checkpoint-based durable execution for long-running tasks
**Why**: KClaw0's subagent tasks can fail mid-execution and lose all progress. Durable execution would resume from last checkpoint.
**How**:
- Implement step-based checkpointing in subagent system
- Store checkpoints in SQLite (KClaw0 already has file-based state)
- Resume from checkpoint on restart
- Each step gets an auto-incremented ID

### Priority 3: Context Compaction (Pi Pattern)
**What**: Automatic summarization of old context while keeping recent messages
**Why**: KClaw0 will hit context limits with long-running sessions
**How**:
- Implement compaction trigger on overflow or token threshold
- Reserve headroom tokens, keep recent tokens intact
- Summarize older messages into a "memory digest"
- Inject digest at start of context window

### Priority 4: Model Roles (oh-my-pi Pattern)
**What**: Different models for different purposes
**Why**: Using one model for everything is inefficient. Fast/cheap models for exploration, powerful models for planning.
**How**:
- Define roles: `default`, `smol` (fast/cheap), `slow` (deep reasoning), `plan` (architecture)
- Role-based routing in LLM abstraction layer
- Configurable per-role model assignments

### Priority 5: TTSR - Time-Traveling Streamed Rules (oh-my-pi Pattern)
**What**: Zero-cost pattern-triggered rule injection
**Why**: KClaw0 currently loads all rules upfront. TTSR would save context by only injecting rules when relevant.
**How**:
- Add regex patterns to rule definitions
- Stream-watch model output for pattern matches
- Inject rule as system reminder when matched
- One-shot per session to prevent loops

### Priority 6: Hashline Edits (oh-my-pi Pattern)
**What**: Content-hash anchors for line-based edits
**Why**: KClaw0's current edit system suffers from "string not found" errors when files change
**How**:
- Compute hash for each line during file read
- Edit requests reference hash instead of text content
- Validate hash before applying edit
- Reject if hash mismatch (file changed since read)

### Priority 7: Subagent Isolation (oh-my-pi Pattern)
**What**: Git worktree or filesystem isolation for parallel subagent execution
**Why**: KClaw0 subagents can conflict when running in parallel on the same files
**How**:
- Create git worktree for each subagent task
- Run subagent in isolated filesystem view
- Merge results via patch or branch merge
- Clean up worktree after completion

### Priority 8: Autonomous Memory (Pi Pattern)
**What**: Background extraction of durable knowledge from sessions
**Why**: KClaw0's memory is currently manual. Autonomous memory would continuously learn.
**How**:
- Background pipeline extracts key learnings from completed sessions
- Store in structured format (memory graph)
- Inject compact summary at startup
- Full depth available on demand

### Priority 9: Phased Todo System (oh-my-pi Pattern)
**What**: Structured task tracking with phases and auto-normalization
**Why**: KClaw0 has no built-in task tracking. This would improve work organization.
**How**:
- Define phases with ordered tasks
- Auto-normalize to exactly one `in_progress` task
- Persistent state across turns
- Completion reminders

### Priority 10: Dark Factory Pattern
**What**: Fully autonomous development loop
**Why**: Ultimate automation — KClaw0 could self-improve without human intervention for routine tasks
**How**:
- Define workflow: issue → triage → plan → implement → test → review → merge
- Run on cron schedule
- Human only at boundaries (issue filing, release promotion)
- Start with simple tasks (documentation updates, dependency bumps)

---

## APPENDIX: Cross-Repository Pattern Matrix

| Pattern | Attractor | Pi | oh-my-pi | PiClaw | Archon | Absurd |
|---------|-----------|-----|----------|--------|--------|--------|
| DOT Workflows | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| YAML Workflows | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Checkpoint/Resume | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Durable Execution | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Multi-Provider LLM | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Subagent System | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Context Compaction | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Model Roles | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| TTSR Rules | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Hashline Edits | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Git Worktree Isolation | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Autonomous Memory | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| SQLite Persistence | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Postgres Persistence | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cron Workflows | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Human-in-the-Loop | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Web UI | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| TUI | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| MCP Support | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Skills System | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hooks System | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| LSP Integration | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Browser Automation | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Python Kernel | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Phased Todos | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Background Jobs | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Dark Factory | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

---

*Report compiled by KClaw0 Research Subagent*
*For integration planning, see: `memory/self-upgrade-queue.md`*
