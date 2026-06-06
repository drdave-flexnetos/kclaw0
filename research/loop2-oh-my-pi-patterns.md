# oh-my-pi Source Code Analysis — Research Loop 2 Report

**Date:** 2026-05-08
**Researcher:** KClaw0 Subagent (loop2-oh-my-pi-patterns)
**Scope:** Deep analysis of oh-my-pi implementation patterns for adaptation to KClaw0 (Node.js, OpenClaw platform)

---

## Table of Contents
1. [Task Tool (Subagent System)](#1-task-tool-subagent-system)
2. [Tool Registry](#2-tool-registry)
3. [Session Management](#3-session-management)
4. [Job Queue](#4-job-queue)
5. [Agent Profiles](#5-agent-profiles)
6. [Adaptation Recommendations for KClaw0](#6-adaptation-recommendations)

---

## 1. Task Tool (Subagent System)

### 1.1 Architecture Overview

The `task` tool in oh-my-pi is a sophisticated multi-mode subagent delegation system with three execution paths:

```
┌─────────────────────────────────────────────────────────────┐
│                     Task Tool Architecture                    │
├─────────────────────────────────────────────────────────────┤
│  Discovery → Profile Resolution → Execution Mode Selection   │
│                    ↓                                         │
│    ┌───────────────┬───────────────┬───────────────┐         │
│    │  Single Agent │ Parallel Agents│ In-Process    │         │
│    │  (subprocess) │ (subprocess)  │ (same thread) │         │
│    │  runSingle()  │ runParallel() │ runInProcess()│         │
│    └───────────────┴───────────────┴───────────────┘         │
│                    ↓                                         │
│           Result Consolidation & Event Streaming              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Agent Discovery System

**File:** `packages/coding-agent/src/task/agent-discovery.ts`

Agents are discovered from multiple sources with priority ordering:

```typescript
// Discovery sources (highest priority first)
const AGENT_SEARCH_PATHS = [
  // Project-level agents
  path.join(projectDir, ".omp/agents/*.md"),
  path.join(projectDir, ".pi/agents/*.md"),
  path.join(projectDir, ".claude/agents/*.md"),
  // User-level agents
  path.join(agentDir, "agents/*.md"),
];
```

**Agent file format:** Markdown with YAML frontmatter:
```markdown
---
name: Designer
description: Creates visual designs and CSS
effort: high
capabilities:
  - browser
  - image_generation
---

You are a design specialist. Your job is to...
```

**Key discovery function pattern:**
```typescript
export async function discoverAgents(agentDir: string, projectDir: string): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [...BUNDLED_AGENTS]; // Always include built-ins first
  
  // Scan filesystem paths
  for (const pattern of AGENT_SEARCH_PATHS) {
    const files = await glob(pattern);
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      agents.push({
        name: frontmatter.name,
        description: frontmatter.description,
        prompt: body,
        effort: frontmatter.effort || "medium",
        capabilities: frontmatter.capabilities || [],
        source: file.includes(projectDir) ? "project" : "user",
      });
    }
  }
  
  return agents;
}
```

### 1.3 Execution Modes

**Three execution modes with distinct capabilities:**

| Mode | Context | Custom Schema | Use Case |
|------|---------|---------------|----------|
| `default` | Full session context | Yes | Complex tasks needing context |
| `schema-free` | Full session context | No | Simple tasks, faster parsing |
| `independent` | Isolated context | No | Parallel execution, no interference |

```typescript
// From simple-mode.ts
export const TASK_SIMPLE_MODES = ["default", "schema-free", "independent"] as const;

const TASK_SIMPLE_MODE_CAPABILITIES: Record<TaskSimpleMode, TaskSimpleModeCapabilities> = {
  default: { contextEnabled: true, customSchemaEnabled: true },
  "schema-free": { contextEnabled: true, customSchemaEnabled: false },
  independent: { contextEnabled: false, customSchemaEnabled: false },
};
```

### 1.4 Single Agent Execution (Subprocess)

**File:** `packages/coding-agent/src/task/run-single.ts`

```typescript
export async function runSingleAgent(options: SingleAgentOptions): Promise<AgentToolResult> {
  const { agent, prompt, context, outputSchema, workingDir, simpleMode } = options;
  
  // 1. Prepare agent prompt with context injection
  const fullPrompt = buildAgentPrompt(agent.prompt, prompt, context, simpleMode);
  
  // 2. Spawn subprocess with constrained environment
  const child = spawn("omp", ["run", "--agent", agent.name, "--prompt", fullPrompt], {
    cwd: workingDir,
    env: { ...process.env, OMP_AGENT_MODE: "subagent" },
  });
  
  // 3. Stream progress events back to parent
  const eventStream = new EventEmitter();
  child.stdout.on("data", (data) => {
    const events = parseAgentEvents(data.toString());
    for (const event of events) {
      eventStream.emit("progress", event);
    }
  });
  
  // 4. Collect final result
  const result = await new Promise((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(parseAgentOutput(child.stdoutBuffer));
      } else {
        reject(new Error(`Agent exited with code ${code}`));
      }
    });
  });
  
  return { content: [{ type: "text", text: result }] };
}
```

### 1.5 Parallel Execution with Concurrency Control

**File:** `packages/coding-agent/src/task/run-parallel.ts`

Uses a **worker pool pattern** with configurable concurrency:

```typescript
export interface ParallelAgentOptions {
  agents: AgentDefinition[];
  prompt: string;
  context?: string;
  maxConcurrency?: number; // Default: 3
  outputSchema?: TSchema;
  simpleMode?: TaskSimpleMode;
}

export interface ParallelResult {
  results: (AgentToolResult | undefined)[];
  aborted: boolean;
}

export async function runParallelAgents(options: ParallelAgentOptions): Promise<ParallelResult> {
  const { agents, maxConcurrency = 3 } = options;
  const abortController = new AbortController();
  
  // Worker pool execution
  const pool = new PromisePool(maxConcurrency);
  const results: (AgentToolResult | undefined)[] = new Array(agents.length);
  
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const task = async () => {
      if (abortController.signal.aborted) return undefined;
      try {
        const result = await runSingleAgent({ ...options, agent });
        results[i] = result;
        return result;
      } catch (error) {
        results[i] = {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
        return undefined;
      }
    };
    pool.add(task);
  }
  
  await pool.run();
  return { results, aborted: abortController.signal.aborted };
}
```

### 1.6 In-Process Execution (Same Thread)

**File:** `packages/coding-agent/src/task/run-in-process.ts`

For lightweight tasks that don't need process isolation:

```typescript
export async function runInProcessAgent(options: InProcessOptions): Promise<AgentToolResult> {
  const { agent, prompt, modelRegistry, thinkingLevel } = options;
  
  // Create a lightweight agent instance in the same process
  const subAgent = createSubAgent({
    model: modelRegistry.resolveModel(agent.modelPreference),
    thinkingLevel,
    systemPrompt: agent.prompt,
  });
  
  // Forward events to parent for progress tracking
  const unsubscribe = subAgent.subscribe((event) => {
    emitTaskProgress(event);
  });
  
  try {
    const result = await subAgent.prompt(prompt);
    return { content: result.content };
  } finally {
    unsubscribe();
    subAgent.dispose();
  }
}
```

### 1.7 Event Streaming for Progress Tracking

**JSON event stream format** for real-time progress:

```typescript
interface AgentEvent {
  type: "progress" | "tool_call" | "tool_result" | "complete" | "error";
  timestamp: number;
  data: unknown;
}

// Events are newline-delimited JSON (NDJSON)
// Example stream:
// {"type":"progress","timestamp":1234567890,"data":{"message":"Analyzing codebase..."}}
// {"type":"tool_call","timestamp":1234567891,"data":{"tool":"read","args":{"path":"/src/main.ts"}}}
// {"type":"complete","timestamp":1234567892,"data":{"result":"Analysis complete"}}
```

### 1.8 Result Consolidation

**Multiple consolidation strategies:**

```typescript
type ConsolidationStrategy = "concatenate" | "summarize" | "merge-json" | "first-wins";

function consolidateResults(results: AgentToolResult[], strategy: ConsolidationStrategy): AgentToolResult {
  switch (strategy) {
    case "concatenate":
      return {
        content: results.flatMap(r => r.content),
      };
    case "summarize":
      return {
        content: [{ type: "text", text: generateSummary(results) }],
      };
    case "merge-json":
      return {
        content: [{ type: "text", text: JSON.stringify(mergeJsonResults(results)) }],
      };
    case "first-wins":
      return results.find(r => !r.isError) || results[0];
  }
}
```

---

## 2. Tool Registry

### 2.1 Dynamic Tool Registration

**File:** `packages/coding-agent/src/tools/index.ts`

The tool registry uses a **Map-based registration system** with capability gating:

```typescript
// Core tool registry structure
export class ToolRegistry {
  readonly #tools = new Map<string, AgentTool>();
  readonly #discoverableTools = new Map<string, DiscoverableTool>();
  readonly #mcpTools = new Map<string, MCPTool>();
  readonly #customTools = new Map<string, CustomTool>();
  
  // Feature gates
  readonly #enabledTools = new Set<string>();
  readonly #disabledTools = new Set<string>();
  readonly #toolCapabilities = new Map<string, string[]>();
  
  register(tool: AgentTool): void {
    this.#tools.set(tool.name, tool);
    if (tool.loadMode === "discoverable") {
      this.#discoverableTools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        category: inferCategory(tool.name),
      });
    }
  }
  
  registerMCP(serverName: string, tools: MCPTool[]): void {
    for (const tool of tools) {
      const qualifiedName = `${serverName}.${tool.name}`;
      this.#mcpTools.set(qualifiedName, tool);
    }
  }
  
  getActiveTools(): AgentTool[] {
    return Array.from(this.#tools.values()).filter(tool => 
      this.#enabledTools.has(tool.name) && !this.#disabledTools.has(tool.name)
    );
  }
}
```

### 2.2 Tool Discovery System

**File:** `packages/coding-agent/src/tool-discovery/tool-index.ts`

Tools can be marked as **discoverable** (hidden by default, searchable when needed):

```typescript
export interface DiscoverableTool {
  name: string;
  description: string;
  category: string;
  keywords?: string[];
}

export interface DiscoverableToolSearchIndex {
  tools: DiscoverableTool[];
  search(query: string): DiscoverableTool[];
}

// Build searchable index
type ToolLoadMode = "always" | "discoverable" | "hidden";

// Tools declare their visibility
interface AgentTool {
  name: string;
  loadMode: ToolLoadMode;
  // ...
}
```

**Search implementation** (fuzzy matching):
```typescript
export function buildDiscoverableToolSearchIndex(tools: DiscoverableTool[]): DiscoverableToolSearchIndex {
  return {
    tools,
    search(query: string): DiscoverableTool[] {
      const lowerQuery = query.toLowerCase();
      return tools.filter(tool => {
        const nameMatch = tool.name.toLowerCase().includes(lowerQuery);
        const descMatch = tool.description.toLowerCase().includes(lowerQuery);
        const keywordMatch = tool.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
        return nameMatch || descMatch || keywordMatch;
      });
    },
  };
}
```

### 2.3 Feature Gates & Capability System

**File:** `packages/coding-agent/src/capability/`

Tools declare required capabilities; the runtime checks availability:

```typescript
// Capability check pattern
interface CapabilityCheck {
  capability: string;
  check: () => boolean | Promise<boolean>;
}

const CAPABILITY_CHECKS: CapabilityCheck[] = [
  { capability: "browser", check: () => !!process.env.BROWSER_ENABLED },
  { capability: "image_generation", check: () => !!process.env.IMAGE_API_KEY },
  { capability: "mcp", check: async () => await checkMCPAvailable() },
];

// Tool definition with capability requirements
const browserTool: AgentTool = {
  name: "browser",
  requiredCapabilities: ["browser"],
  // ...
};

// Runtime filtering
function getAvailableTools(tools: AgentTool[]): AgentTool[] {
  return tools.filter(async tool => {
    if (!tool.requiredCapabilities) return true;
    const checks = await Promise.all(
      tool.requiredCapabilities.map(cap => checkCapability(cap))
    );
    return checks.every(Boolean);
  });
}
```

### 2.4 MCP (Model Context Protocol) Integration

**File:** `packages/coding-agent/src/mcp/`

MCP tools are dynamically discovered and namespaced:

```typescript
// MCP tool naming: serverName.toolName
const MCP_TOOL_PREFIX = "mcp:";

function qualifyMcpToolName(serverName: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${serverName}.${toolName}`;
}

// Tool selection persistence
interface MCPToolSelectionEntry extends SessionEntry {
  type: "mcp_tool_selection";
  selectedToolNames: string[];
}

// Discovery mode: tools hidden until explicitly activated
class McpDiscoveryManager {
  #availableTools = new Map<string, MCPTool>();
  #selectedTools = new Set<string>();
  
  enableDiscoveryMode(): void {
    // All MCP tools start hidden
    for (const [name, tool] of this.#availableTools) {
      if (!this.#selectedTools.has(name)) {
        this.#disableTool(name);
      }
    }
  }
  
  selectTool(name: string): void {
    this.#selectedTools.add(name);
    this.#enableTool(name);
    this.#persistSelection();
  }
}
```

---

## 3. Session Management

### 3.1 JSONL Session Format

**File:** `packages/coding-agent/src/session/session-manager.ts`

Sessions are stored as **JSON Lines** (`.jsonl`) with a tree structure:

```typescript
// Session file structure (each line is a JSON object)
// Line 1: Header
{"type":"session","version":3,"id":"uuid","timestamp":"2026-01-01T00:00:00Z","cwd":"/project"}

// Line 2+: Entries with parent-child tree structure
{"type":"message","id":"abc123","parentId":null,"timestamp":"...","message":{"role":"user","content":"..."}}
{"type":"message","id":"def456","parentId":"abc123","timestamp":"...","message":{"role":"assistant","content":"..."}}
{"type":"compaction","id":"ghi789","parentId":"def456","timestamp":"...","summary":"...","firstKeptEntryId":"abc123","tokensBefore":50000}
```

**Entry types:**
| Type | Purpose |
|------|---------|
| `session` | File header with metadata |
| `message` | LLM conversation message |
| `compaction` | Context compression summary |
| `branch_summary` | Branch point summary |
| `custom` | Extension-specific data (not in LLM context) |
| `custom_message` | Extension-injected messages (in LLM context) |
| `thinking_level_change` | Model thinking level change |
| `model_change` | Model switch event |
| `mcp_tool_selection` | MCP tool activation state |
| `ttsr_injection` | Time-traveling rule injection tracking |

### 3.2 Tree-Structured Entries

Every entry has `id` and `parentId` forming a tree:

```typescript
interface SessionEntryBase {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
}

// Building session context from tree
export function buildSessionContext(
  entries: SessionEntry[],
  leafId?: string | null,
): SessionContext {
  // Build UUID index
  const byId = new Map<string, SessionEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  
  // Find leaf (default: last entry)
  const leaf = leafId ? byId.get(leafId) : entries[entries.length - 1];
  
  // Walk from leaf to root
  const path: SessionEntry[] = [];
  let current: SessionEntry | undefined = leaf;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  
  // Extract context from path
  const messages: AgentMessage[] = [];
  let compaction: CompactionEntry | null = null;
  
  for (const entry of path) {
    if (entry.type === "message") {
      messages.push(entry.message);
    } else if (entry.type === "compaction") {
      compaction = entry;
    }
    // ... handle other entry types
  }
  
  return { messages, thinkingLevel: "off", /* ... */ };
}
```

### 3.3 Session Compaction

**File:** `packages/coding-agent/src/session/compact.ts`

**Compaction replaces old messages with a summary** when context approaches limits:

```typescript
interface CompactionOptions {
  threshold?: number;    // Token threshold (default: 80% of context window)
  strategy?: "summarize" | "truncate" | "selective";
  preserveRecent?: number; // Always keep N most recent messages
}

interface CompactionResult {
  summary: string;
  shortSummary?: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  tokensAfter: number;
}

async function compactSession(
  entries: SessionEntry[],
  options: CompactionOptions,
): Promise<CompactionResult> {
  const totalTokens = calculateContextTokens(entries);
  const threshold = options.threshold || 0.8 * MAX_CONTEXT_TOKENS;
  
  if (totalTokens < threshold) {
    return { summary: "", firstKeptEntryId: entries[0].id, tokensBefore: totalTokens, tokensAfter: totalTokens };
  }
  
  // Select messages to compact (skip recent N)
  const preserveCount = options.preserveRecent || 4;
  const compactableEntries = entries.slice(0, -preserveCount);
  const keptEntries = entries.slice(-preserveCount);
  
  // Generate summary using LLM
  const summary = await generateSummary(compactableEntries);
  
  // Create compaction entry
  const compactionEntry: CompactionEntry = {
    type: "compaction",
    id: generateId(),
    parentId: compactableEntries[compactableEntries.length - 1]?.id || null,
    timestamp: new Date().toISOString(),
    summary,
    firstKeptEntryId: keptEntries[0].id,
    tokensBefore: totalTokens,
  };
  
  return { summary, firstKeptEntryId: keptEntries[0].id, tokensBefore: totalTokens, tokensAfter: calculateTokens(summary) };
}
```

**Auto-compaction triggers:**
- Token threshold reached (configurable, default 80%)
- Context overflow error from provider
- Idle timeout (optional)

### 3.4 Session Branching

**File:** `packages/coding-agent/src/session/session-branching.ts`

Branching creates a **fork** at any point in the conversation tree:

```typescript
interface BranchOptions {
  entryId: string;      // Branch point
  title?: string;       // Branch name
  carryForward?: boolean; // Include history before branch point
}

async function createBranch(
  sessionManager: SessionManager,
  options: BranchOptions,
): Promise<SessionManager> {
  const { entryId, carryForward = true } = options;
  
  // Get path from root to branch point
  const entries = sessionManager.getEntries();
  const byId = buildByIdIndex(entries);
  const path = walkToRoot(entries[entries.length - 1], byId);
  
  // Find branch point
  const branchIndex = path.findIndex(e => e.id === entryId);
  if (branchIndex === -1) throw new Error("Entry not found");
  
  // Create new session
  const newSession = await sessionManager.createSession({
    parentSession: sessionManager.getSessionFile(),
  });
  
  if (carryForward) {
    // Copy history up to branch point
    const historyToCopy = path.slice(0, branchIndex + 1);
    for (const entry of historyToCopy) {
      newSession.appendEntry(cloneEntry(entry));
    }
  }
  
  // Add branch summary
  newSession.appendBranchSummary({
    fromId: entryId,
    summary: `Branched from ${sessionManager.getSessionId()} at ${entryId}`,
  });
  
  return newSession;
}
```

### 3.5 Session Resume & Persistence

**Persistence strategy:**
- Every message appended immediately flushes to disk
- Atomic writes: write to temp file, then rename
- Blob store for large binary data (images, files)

```typescript
class SessionManager {
  #storage: SessionStorage;
  #entries: SessionEntry[] = [];
  #sessionFile: string;
  
  appendMessage(message: AgentMessage): void {
    const entry: SessionMessageEntry = {
      type: "message",
      id: generateId(),
      parentId: this.getLeafId(),
      timestamp: new Date().toISOString(),
      message,
    };
    this.#entries.push(entry);
    this.#flush();
  }
  
  async #flush(): Promise<void> {
    const content = this.#entries.map(e => JSON.stringify(e)).join("\n");
    const tempFile = `${this.#sessionFile}.tmp`;
    await this.#storage.writeText(tempFile, content);
    await this.#storage.atomicRename(tempFile, this.#sessionFile);
  }
}
```

**Resume from breadcrumb:**
```typescript
// Terminal breadcrumb for --continue
function writeTerminalBreadcrumb(cwd: string, sessionFile: string): void {
  const terminalId = getTerminalId();
  const breadcrumbFile = path.join(getTerminalSessionsDir(), terminalId);
  const content = `${cwd}\n${sessionFile}\n`;
  Bun.write(breadcrumbFile, content).catch(() => {});
}

async function readTerminalBreadcrumb(cwd: string): Promise<string | null> {
  const terminalId = getTerminalId();
  try {
    const content = await Bun.file(breadcrumbFile).text();
    const [breadcrumbCwd, sessionFile] = content.trim().split("\n");
    if (path.resolve(breadcrumbCwd) === path.resolve(cwd)) {
      return sessionFile;
    }
  } catch { /* breadcrumb missing */ }
  return null;
}
```

### 3.6 Session Storage Abstraction

```typescript
interface SessionStorage {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  atomicRename(from: string, to: string): Promise<void>;
  ensureDirSync(dir: string): void;
  listFilesSync(dir: string, pattern: string): string[];
  statSync(path: string): { mtimeMs: number };
}

// File-based implementation
class FileSessionStorage implements SessionStorage {
  async readText(path: string): Promise<string> {
    return fs.readFile(path, "utf-8");
  }
  
  async writeText(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, "utf-8");
  }
  
  async atomicRename(from: string, to: string): Promise<void> {
    await fs.rename(from, to);
  }
  
  // ...
}

// Memory-based for testing
class MemorySessionStorage implements SessionStorage {
  #files = new Map<string, string>();
  // ...
}
```

---

## 4. Job Queue

### 4.1 Async Job Manager

**File:** `packages/coding-agent/src/async/job-manager.ts`

The job manager handles **background execution** with delivery retry logic:

```typescript
interface AsyncJob {
  id: string;
  type: "bash" | "task";
  status: "running" | "completed" | "failed" | "cancelled";
  startTime: number;
  label: string;
  abortController: AbortController;
  promise: Promise<unknown>;
  resultText?: string;
  errorText?: string;
}

interface AsyncJobManagerOptions {
  onJobComplete: (jobId: string, text: string, job?: AsyncJob) => void | Promise<void>;
  maxRunningJobs?: number;    // Default: 15
  retentionMs?: number;       // Default: 5 minutes
}
```

### 4.2 Job Registration & Execution

```typescript
class AsyncJobManager {
  readonly #jobs = new Map<string, AsyncJob>();
  readonly #deliveries: AsyncJobDelivery[] = [];
  readonly #maxRunningJobs: number;
  
  register(
    type: "bash" | "task",
    label: string,
    run: (ctx: {
      jobId: string;
      signal: AbortSignal;
      reportProgress: (text: string, details?: Record<string, unknown>) => Promise<void>;
    }) => Promise<string>,
    options?: AsyncJobRegisterOptions,
  ): string {
    // Concurrency limit check
    const runningCount = this.getRunningJobs().length;
    if (runningCount >= this.#maxRunningJobs) {
      throw new Error(`Background job limit reached (${this.#maxRunningJobs})`);
    }
    
    const id = this.#resolveJobId(options?.id);
    const abortController = new AbortController();
    
    const job: AsyncJob = {
      id, type, status: "running",
      startTime: Date.now(), label,
      abortController,
      promise: Promise.resolve(),
    };
    
    // Wrap execution
    job.promise = (async () => {
      try {
        const text = await run({
          jobId: id,
          signal: abortController.signal,
          reportProgress: async (text, details) => {
            if (options?.onProgress) {
              await options.onProgress(text, details);
            }
          },
        });
        job.status = "completed";
        job.resultText = text;
        this.#enqueueDelivery(id, text);
      } catch (error) {
        job.status = "failed";
        job.errorText = error instanceof Error ? error.message : String(error);
        this.#enqueueDelivery(id, job.errorText);
      }
      this.#scheduleEviction(id);
    })();
    
    this.#jobs.set(id, job);
    return id;
  }
}
```

### 4.3 Delivery Retry Loop

**Exponential backoff with jitter** for reliable delivery:

```typescript
const DELIVERY_RETRY_BASE_MS = 500;
const DELIVERY_RETRY_MAX_MS = 30_000;
const DELIVERY_RETRY_JITTER_MS = 200;

async #runDeliveryLoop(): Promise<void> {
  while (this.#deliveries.length > 0) {
    const delivery = this.#deliveries[0];
    
    // Wait until next retry time
    const waitMs = delivery.nextAttemptAt - Date.now();
    if (waitMs > 0) await Bun.sleep(waitMs);
    
    try {
      await this.#onJobComplete(delivery.jobId, delivery.text, this.#jobs.get(delivery.jobId));
      this.#deliveries.shift(); // Success - remove from queue
    } catch (error) {
      // Retry with exponential backoff
      delivery.attempt += 1;
      delivery.lastError = error instanceof Error ? error.message : String(error);
      delivery.nextAttemptAt = Date.now() + this.#getRetryDelay(delivery.attempt);
      
      // Move to back of queue for retry
      this.#deliveries.shift();
      if (!this.isDeliverySuppressed(delivery.jobId)) {
        this.#deliveries.push(delivery);
      }
    }
  }
}

#getRetryDelay(attempt: number): number {
  const exp = Math.min(Math.max(attempt - 1, 0), 8);
  const backoffMs = DELIVERY_RETRY_BASE_MS * 2 ** exp; // 500ms, 1s, 2s, 4s, ... 128s
  const jitterMs = Math.floor(Math.random() * DELIVERY_RETRY_JITTER_MS);
  return Math.min(DELIVERY_RETRY_MAX_MS, backoffMs + jitterMs);
}
```

### 4.4 Job Lifecycle & Eviction

```typescript
#scheduleEviction(jobId: string): void {
  if (this.#retentionMs <= 0) {
    this.#jobs.delete(jobId);
    return;
  }
  
  const timer = setTimeout(() => {
    this.#jobs.delete(jobId);
    this.#suppressedDeliveries.delete(jobId);
    this.#watchedJobs.delete(jobId);
  }, this.#retentionMs);
  timer.unref(); // Don't block process exit
  this.#evictionTimers.set(jobId, timer);
}

// Graceful shutdown
dispose(): void {
  this.#disposed = true;
  this.cancelAll();
  await this.waitForAll();
  await this.drainDeliveries({ timeoutMs: 3000 });
}
```

### 4.5 Job Watching & Acknowledgment

```typescript
// Watch specific jobs (delivery suppressed until unwatch)
watchJobs(jobIds: string[]): number {
  for (const jobId of jobIds) {
    this.#watchedJobs.add(jobId);
  }
  return jobIds.length;
}

// Acknowledge deliveries (mark as received)
acknowledgeDeliveries(jobIds: string[]): number {
  for (const jobId of jobIds) {
    this.#suppressedDeliveries.add(jobId);
  }
  // Remove acknowledged deliveries from queue
  this.#deliveries = this.#deliveries.filter(
    d => !this.isDeliverySuppressed(d.jobId)
  );
}
```

### 4.6 Concurrency Control in AgentSession

The `AgentSession` integrates the job manager for **tool-initiated background jobs**:

```typescript
class AgentSession {
  #asyncJobManager?: AsyncJobManager;
  
  constructor(config: AgentSessionConfig) {
    this.#asyncJobManager = config.asyncJobManager;
  }
  
  // Tools call this to spawn background work
  async runBackgroundTask(label: string, task: () => Promise<string>): Promise<string> {
    if (!this.#asyncJobManager) {
      throw new Error("Background jobs not enabled");
    }
    
    return this.#asyncJobManager.register("task", label, async ({ signal, reportProgress }) => {
      // Report progress periodically
      const result = await task();
      return result;
    });
  }
  
  getAsyncJobSnapshot(): AsyncJobSnapshot | null {
    if (!this.#asyncJobManager) return null;
    return {
      running: this.#asyncJobManager.getRunningJobs().map(job => ({
        id: job.id, type: job.type, status: job.status,
        label: job.label, startTime: job.startTime,
      })),
      recent: this.#asyncJobManager.getRecentJobs(5).map(job => ({
        id: job.id, type: job.type, status: job.status,
        label: job.label, startTime: job.startTime,
      })),
    };
  }
}
```

---

## 5. Agent Profiles

### 5.1 Agent Definition Schema

**File:** `packages/coding-agent/src/task/agent-types.ts`

Agents are defined with rich metadata:

```typescript
export type AgentSource = "bundled" | "user" | "project";
export type AgentEffort = "low" | "medium" | "high";

export interface AgentDefinition {
  name: string;
  description: string;
  prompt: string;           // Full system prompt
  effort: AgentEffort;      // Affects model selection
  capabilities: string[];   // Required tool capabilities
  source: AgentSource;
  
  // Optional overrides
  modelPreference?: string; // Specific model hint
  maxIterations?: number;   // Auto-stop limit
  outputSchema?: TSchema;   // Structured output schema
}

// Agent role in profile system
export type AgentRole = 
  | "default"    // Standard agent
  | "smol"       // Lightweight/fast agent
  | "slow"       // Thorough/deep agent
  | "expert"     // Specialized domain agent
  | "reviewer";   // Code review agent
```

### 5.2 Bundled Agent Registration

**File:** `packages/coding-agent/src/task/bundled-agents.ts`

Agents are **embedded at build time** using Bun's text import:

```typescript
// Embed markdown files at build time
import designerMd from "../prompts/agents/designer.md" with { type: "text" };
import exploreMd from "../prompts/agents/explore.md" with { type: "text" };
import agentFrontmatterTemplate from "../prompts/agents/frontmatter.md" with { type: "text" };

function parseBundledAgent(markdown: string, name: string, effort: Effort): AgentDefinition {
  const { frontmatter, body } = parseFrontmatter(markdown);
  return {
    name: frontmatter.name || name,
    description: frontmatter.description || `${name} agent`,
    prompt: body,
    effort: frontmatter.effort || effort,
    capabilities: frontmatter.capabilities || [],
    source: "bundled",
  };
}

export const BUNDLED_AGENTS: AgentDefinition[] = [
  parseBundledAgent(designerMd, "Designer", "high"),
  parseBundledAgent(exploreMd, "Explorer", "medium"),
  // ... more agents
];
```

### 5.3 Agent Dispatch System

The `task` tool resolves agent names to definitions and dispatches:

```typescript
// Tool execution entry point
class TaskTool implements AgentTool {
  readonly name = "task";
  readonly parameters = TaskSchema;
  
  async execute(
    toolCallId: string,
    params: TaskParams,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback,
  ): Promise<AgentToolResult> {
    // 1. Resolve agent by name
    const agent = this.#resolveAgent(params.agent);
    if (!agent) {
      return {
        content: [{ type: "text", text: `Agent "${params.agent}" not found` }],
        isError: true,
      };
    }
    
    // 2. Determine execution mode
    const simpleMode = params.simpleMode || "default";
    const capabilities = getTaskSimpleModeCapabilities(simpleMode);
    
    // 3. Build prompt with context injection
    const prompt = this.#buildPrompt(params, agent, capabilities);
    
    // 4. Dispatch based on mode
    if (params.parallel && Array.isArray(params.parallel)) {
      // Parallel multi-agent
      const result = await runParallelAgents({
        agents: params.parallel.map(name => this.#resolveAgent(name)!),
        prompt,
        maxConcurrency: params.maxConcurrency || 3,
        simpleMode,
      });
      return this.#consolidateParallelResults(result);
    }
    
    // Single agent
    if (simpleMode === "independent" || params.inProcess) {
      return runInProcessAgent({ agent, prompt, ... });
    }
    
    return runSingleAgent({ agent, prompt, ... });
  }
  
  #resolveAgent(name: string): AgentDefinition | undefined {
    // Search: bundled → user → project
    const allAgents = [
      ...BUNDLED_AGENTS,
      ...this.#userAgents,
      ...this.#projectAgents,
    ];
    return allAgents.find(a => 
      a.name.toLowerCase() === name.toLowerCase()
    );
  }
}
```

### 5.4 Agent Prompt Construction

**Context injection pattern** for subagents:

```typescript
function buildAgentPrompt(
  agentPrompt: string,
  userTask: string,
  sessionContext: string,
  simpleMode: TaskSimpleMode,
): string {
  const capabilities = getTaskSimpleModeCapabilities(simpleMode);
  
  const parts: string[] = [];
  
  // Agent's base prompt (system role)
  parts.push(agentPrompt);
  
  // Inject session context if enabled
  if (capabilities.contextEnabled && sessionContext) {
    parts.push(`\n## Session Context\n${sessionContext}`);
  }
  
  // User's task
  parts.push(`\n## Your Task\n${userTask}`);
  
  return parts.join("\n");
}
```

### 5.5 Agent Registry (Process-Global)

**File:** `packages/coding-agent/src/registry/agent-registry.ts`

Tracks all live agent sessions for **inter-agent communication**:

```typescript
export const MAIN_AGENT_ID = "0-Main";

export type AgentStatus = "running" | "idle" | "completed" | "aborted";
export type AgentKind = "main" | "sub";

export interface AgentRef {
  id: string;            // e.g., "0-Main", "1-Designer"
  displayName: string;
  kind: AgentKind;
  status: AgentStatus;
  session?: AgentSession;
}

export class AgentRegistry {
  readonly #agents = new Map<string, AgentRef>();
  
  register(id: string, ref: AgentRef): void {
    this.#agents.set(id, ref);
  }
  
  unregister(id: string): void {
    this.#agents.delete(id);
  }
  
  getPeers(excludeId?: string): AgentRef[] {
    return Array.from(this.#agents.values())
      .filter(a => a.id !== excludeId && a.status === "running");
  }
  
  // For IRC-style communication between agents
  sendMessage(fromId: string, toId: string, message: string): boolean {
    const target = this.#agents.get(toId);
    if (!target?.session) return false;
    target.session.emitExternalEvent({ type: "irc_message", message });
    return true;
  }
}
```

### 5.6 Agent Output ID Allocator

**File:** `packages/coding-agent/src/task/sequencer.ts`

Ensures **unique IDs across subagent invocations**:

```typescript
export class AgentIdAllocator {
  #counter = 0;
  #parentPrefix?: string;
  
  constructor(parentPrefix?: string) {
    this.#parentPrefix = parentPrefix;
  }
  
  allocate(name: string): string {
    const prefix = this.#parentPrefix 
      ? `${this.#parentPrefix}.${this.#counter}` 
      : `${this.#counter}`;
    this.#counter++;
    return `${prefix}-${name}`;
  }
  
  // Produces IDs like:
  // Parent: "0-Main"
  // Child:  "0-AuthProvider", "1-AuthApi"
  // Nested: "0-Auth.1-Subtask"
}
```

---

## 6. Adaptation Recommendations for KClaw0

### 6.1 Task Tool (Subagent System)

**What to adapt:**

| oh-my-pi Pattern | KClaw0 Adaptation |
|-----------------|-------------------|
| Subprocess spawn (`omp run --agent`) | Use OpenClaw subagent system with `sessions_yield` |
| In-process execution | Direct function calls or worker_threads |
| Parallel execution | Promise.allSettled with concurrency limiter |
| JSON event streaming | OpenClaw's built-in event streaming |
| Agent discovery from `.omp/agents/*.md` | KClaw0 agent definitions in `agents/` or `memory/agents/` |

**Recommended implementation for KClaw0:**

```typescript
// scripts/task-tool.js — KClaw0 adaptation
class KClaw0TaskTool {
  async execute(params) {
    const agent = this.resolveAgent(params.agent);
    
    // For OpenClaw, use the native subagent system
    if (params.inProcess) {
      // Lightweight: run in same thread
      return await this.runInProcess(agent, params.prompt);
    }
    
    // Full subagent: spawn via OpenClaw
    const subagent = await this.spawnSubagent({
      agent: agent.name,
      prompt: this.buildPrompt(agent, params),
      // OpenClaw handles the lifecycle
    });
    
    // Stream progress
    subagent.on("progress", (event) => {
      this.emitToolUpdate(event);
    });
    
    // Wait for completion
    const result = await subagent.waitForCompletion();
    return this.formatResult(result);
  }
}
```

### 6.2 Tool Registry

**Key patterns to adopt:**

```typescript
// scripts/tool-registry.js — KClaw0 adaptation
class KClaw0ToolRegistry {
  #tools = new Map();
  #discoverable = new Map();
  #capabilities = new Map();
  
  // 1. Load from skills (OpenClaw skill system)
  async loadFromSkills() {
    const skills = await this.discoverSkills();
    for (const skill of skills) {
      if (skill.tools) {
        for (const tool of skill.tools) {
          this.register(tool);
        }
      }
    }
  }
  
  // 2. Feature gate checking
  isToolAvailable(toolName) {
    const tool = this.#tools.get(toolName);
    if (!tool) return false;
    if (tool.requiredCapabilities) {
      return tool.requiredCapabilities.every(cap => this.checkCapability(cap));
    }
    return true;
  }
  
  // 3. Dynamic discovery
  searchTools(query) {
    const all = Array.from(this.#discoverable.values());
    return fuzzySearch(all, query);
  }
}
```

### 6.3 Session Management

**Adapt JSONL sessions for KClaw0:**

```typescript
// scripts/session-manager.js — KClaw0 adaptation
class KClaw0SessionManager {
  #entries = [];
  #sessionFile: string;
  
  constructor(sessionId: string) {
    this.#sessionFile = path.join(
      process.env.OPENCLAW_WORKSPACE,
      "sessions",
      `${sessionId}.jsonl`
    );
  }
  
  // Same JSONL format as oh-my-pi for compatibility
  appendMessage(message) {
    const entry = {
      type: "message",
      id: this.generateId(),
      parentId: this.getLeafId(),
      timestamp: Date.now(),
      message,
    };
    this.#entries.push(entry);
    this.flush();
  }
  
  // Compaction with token counting
  async compactIfNeeded() {
    const tokens = this.estimateTokens();
    if (tokens > COMPACTION_THRESHOLD) {
      await this.compact();
    }
  }
  
  // Tree-based context building
  buildContext(leafId?: string) {
    return buildSessionContext(this.#entries, leafId);
  }
}
```

### 6.4 Job Queue

**Simplified adaptation for Node.js:**

```typescript
// scripts/job-queue.js — KClaw0 adaptation
class KClaw0JobQueue {
  #jobs = new Map();
  #maxRunning = 15;
  #retentionMs = 5 * 60 * 1000;
  
  async submit(type, label, task) {
    if (this.getRunningCount() >= this.#maxRunning) {
      throw new Error(`Job limit reached: ${this.#maxRunning}`);
    }
    
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const controller = new AbortController();
    
    const job = {
      id, type, label,
      status: "running",
      startTime: Date.now(),
      abort: () => controller.abort(),
    };
    
    this.#jobs.set(id, job);
    
    // Execute with cleanup
    task({ signal: controller.signal, jobId: id })
      .then(result => {
        job.status = "completed";
        job.result = result;
        this.scheduleDelivery(id, result);
      })
      .catch(error => {
        job.status = "failed";
        job.error = error.message;
        this.scheduleDelivery(id, error.message);
      })
      .finally(() => {
        setTimeout(() => this.#jobs.delete(id), this.#retentionMs);
      });
    
    return id;
  }
}
```

### 6.5 Agent Profiles

**KClaw0 agent profile format:**

```markdown
<!-- agents/code-reviewer.md — KClaw0 agent definition -->
---
name: CodeReviewer
description: Reviews code for bugs, style issues, and security problems
effort: medium
capabilities:
  - read
  - edit
  - bash
model: kimi/k2p5
---

You are a meticulous code reviewer. Your job is to:
1. Find bugs and logic errors
2. Check for security vulnerabilities
3. Verify test coverage
4. Suggest improvements

Be thorough but constructive. Always provide specific line references.
```

**Agent loader for KClaw0:**

```typescript
// scripts/agent-loader.js
async function loadAgents(workspacePath: string): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];
  
  // 1. Built-in agents from KClaw0 core
  agents.push(...BUILT_IN_AGENTS);
  
  // 2. User agents from workspace
  const userAgentDir = path.join(workspacePath, "agents");
  if (fs.existsSync(userAgentDir)) {
    const files = await glob("*.md", { cwd: userAgentDir });
    for (const file of files) {
      const content = await fs.readFile(path.join(userAgentDir, file), "utf-8");
      agents.push(parseAgentMarkdown(content));
    }
  }
  
  // 3. Project agents from current project
  const projectAgentDir = path.join(process.cwd(), ".kclaw/agents");
  if (fs.existsSync(projectAgentDir)) {
    const files = await glob("*.md", { cwd: projectAgentDir });
    for (const file of files) {
      const content = await fs.readFile(path.join(projectAgentDir, file), "utf-8");
      agents.push(parseAgentMarkdown(content, "project"));
    }
  }
  
  return agents;
}
```

---

## 7. Key Architectural Decisions to Copy

### 7.1 From oh-my-pi → KClaw0

1. **JSONL session format** — Proven, append-only, human-readable, git-friendly
2. **Tree-structured entries** with `id`/`parentId` — Enables branching and time-travel
3. **Compaction with summaries** — Essential for long-running sessions
4. **Delivery retry loop with backoff** — Reliable background job completion
5. **Agent discovery hierarchy** — bundled → user → project
6. **Discoverable tools pattern** — Hide advanced tools, search when needed
7. **Feature-gated capabilities** — Check runtime availability before exposing tools
8. **AbortController throughout** — Proper cancellation propagation
9. **Blob store for large data** — Keep JSONL lean, externalize binaries
10. **Agent ID allocator** — Unique namespaced IDs prevent collisions

### 7.2 Differences to Account For

| Aspect | oh-my-pi | KClaw0 |
|--------|---------|--------|
| Runtime | Bun | Node.js |
| Platform | Terminal TUI | OpenClaw (multi-channel) |
| Session storage | Local filesystem | Workspace + channel-specific |
| Subagents | Subprocess | OpenClaw native subagent system |
| Events | EventEmitter | OpenClaw message passing |
| Model access | Direct API | Via OpenClaw gateway |

---

## 8. File Reference Map

| File | Key Concepts |
|------|-------------|
| `src/task/index.ts` | Task tool entry point, agent resolution |
| `src/task/agent-discovery.ts` | Filesystem agent scanning |
| `src/task/run-single.ts` | Single agent subprocess execution |
| `src/task/run-parallel.ts` | Parallel execution with PromisePool |
| `src/task/run-in-process.ts` | In-thread agent execution |
| `src/task/simple-mode.ts` | Execution mode capabilities |
| `src/task/agent-types.ts` | Agent definition types |
| `src/task/bundled-agents.ts` | Build-time agent embedding |
| `src/task/sequencer.ts` | Agent ID allocation |
| `src/tools/index.ts` | Tool registry, dynamic loading |
| `src/tool-discovery/tool-index.ts` | Discoverable tool search |
| `src/session/session-manager.ts` | JSONL persistence, tree building |
| `src/session/agent-session.ts` | Core session class, event handling |
| `src/session/compact.ts` | Compaction logic |
| `src/async/job-manager.ts` | Background jobs, delivery retry |
| `src/registry/agent-registry.ts` | Process-global agent tracking |
| `src/extensibility/skills.ts` | Skill loading from directories |

---

*Report compiled from direct source code analysis of github.com/can1357/oh-my-pi*
