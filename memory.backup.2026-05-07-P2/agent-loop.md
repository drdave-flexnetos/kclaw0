# KClaw0 Agent Loop Specification
## Formalization of My Agentic Loop

Based on the Attractor Coding Agent Loop Spec.

---

## Current Loop (As-Is)

```
receive_input(user_message)
  ↓
load_context()
  - Read SOUL.md, USER.md
  - Read memory/YYYY-MM-DD.md (today + yesterday)
  - Read MEMORY.md (if main session)
  - Load project context files
  ↓
reason(thinking)
  - Plan approach
  - Decide tools to call
  - Check safety constraints
  ↓
execute_tools()
  - Call tools (read, write, exec, etc.)
  - Wait for results
  - May loop multiple times
  ↓
synthesize_response()
  - Build response text
  - Include attachments if needed
  ↓
persist_memory()
  - Write to memory/YYYY-MM-DD.md
  - Update MEMORY.md if significant
  ↓
send_response()
```

---

## Target Loop (To-Be) — Incorporating Attractor Patterns

```
RECORD Session:
    id                  : UUID
    chat_id             : Current conversation ID
    channel             : kimi-claw | discord | telegram | etc.
    provider_profile    : KimiProfile (tools optimized for k2p6)
    execution_env       : LocalOpenClaw (sandbox/host)
    history             : List<Turn>
    event_emitter       : EventEmitter (for external observation)
    config              : SessionConfig
    state               : idle | thinking | executing | responding
    steering_queue      : Queue<String> (mid-conversation guidance)
    followup_queue      : Queue<String> (post-completion tasks)
    subagents           : Map<String, SubAgent>
    memory_loaded       : Set<String> (which memory files loaded this session)

RECORD SessionConfig:
    max_turns                   : 0 (unlimited)
    max_tool_rounds_per_input   : 0 (unlimited)
    tool_timeout_seconds          : 300
    thinking_level                : high | medium | low
    auto_persist_memory           : true
    safety_checks                 : true

RECORD Turn:
    id          : UUID
    timestamp   : ISO8601
    input       : Message
    thinking    : String (reasoning trace)
    tool_calls  : List<ToolCall>
    tool_results: List<ToolResult>
    output      : Message
    events      : List<Event>
```

---

## Steering Queue

The steering queue allows injecting guidance between tool rounds WITHOUT restarting the conversation.

**Use Cases:**
- "Wait, don't do that — use X instead"
- "Actually, check memory first before proceeding"
- "That's enough research, start implementing now"
- "You missed Y, go back and fix it"

**Implementation:**
- After each tool round, check steering_queue
- If non-empty, prepend steering messages to next LLM context
- Steering messages appear as system/user messages in history
- Steering does NOT count against tool round limits

**Current Status:** NOT IMPLEMENTED — but OpenClaw may support this via message injection. Need to investigate.

---

## Followup Queue

The followup queue holds tasks to process AFTER the current user input is fully resolved.

**Use Cases:**
- "After you finish this, also check my calendar"
- "Once done, update MEMORY.md with what you learned"
- "When this task completes, spawn a subagent to do X"

**Implementation:**
- After synthesizing response, check followup_queue
- Process each followup as a new "virtual" user input
- Append to same session history
- Followups can themselves enqueue more followups

**Current Status:** PARTIALLY IMPLEMENTED — I can ask the user "anything else?" but don't auto-process queued tasks.

---

## Event System

Every action should emit typed events for external observation and logging.

**Event Types:**
- `session.started` — Session initialized
- `context.loaded` — Memory/context files loaded
- `thinking.started` — Reasoning began
- `thinking.completed` — Reasoning finished
- `tool.call` — Tool invocation
- `tool.result` — Tool returned
- `tool.error` — Tool failed
- `memory.written` — Memory file updated
- `memory.searched` — Memory search performed
- `subagent.spawned` — Subagent created
- `subagent.completed` — Subagent finished
- `response.synthesized` — Response built
- `response.sent` — Response delivered
- `steering.injected` — Steering message added
- `followup.queued` — Followup task added
- `followup.processed` — Followup task completed

**Current Status:** NOT IMPLEMENTED — I emit text responses but no structured events.

---

## Provider Profile (Kimi k2p6)

**Optimized Toolset for k2p6:**
- All tools are available (no restriction)
- Thinking is enabled by default (high level)
- Streaming responses supported
- Tool calling uses native function calling

**System Prompt Strategy:**
- SOUL.md + AGENTS.md form the base system context
- MEMORY.md adds personal context (main session only)
- Skills add task-specific context on demand
- User message provides immediate context

**Context Management:**
- Full conversation history maintained by OpenClaw
- Project context files injected at session start
- Memory loaded on demand via memory_search/memory_get
- No explicit truncation needed (handled by platform)

---

## Execution Environment

**Current:** Local sandbox + host access
- File operations in `/root/.openclaw/workspace`
- Shell execution in sandbox
- Browser access available
- Message sending to configured channels

**Future Options:**
- Docker containers for isolated testing
- SSH to remote hosts
- Kubernetes pods for scaling

**Safety:**
- `rm` operations require confirmation
- Destructive commands flagged
- User is ultimate authority
- `trash` preferred over `rm`

---

## Subagent Architecture

**Current Capabilities:**
- `sessions_spawn` — Create isolated subagent or ACP session
- `subagents` — List, kill, steer subagents
- Subagents inherit workspace directory
- Can attach as mounted paths

**Attractor-Inspired Improvements:**
- Define subagent roles/profiles for specific tasks
- Implement subagent result aggregation
- Add subagent-to-subagent messaging
- Checkpoint subagent state for resume

**Use Cases for Self-Upgrading:**
- Spawn subagent to analyze a specific file
- Spawn subagent to test a code change
- Spawn subagent to research a topic
- Parallel exploration of multiple upgrade paths

---

## Loop Detection

**Problem:** Agent gets stuck in loops (repeatedly calling same tools, cycling between states).

**Detection:**
- Track tool call fingerprints (tool name + args hash)
- If same fingerprint appears N times in M turns, flag loop
- Track response similarity (cosine similarity of outputs)

**Recovery:**
- Inject steering message: "You appear to be in a loop. Summarize current state and ask user for direction."
- Reduce max_tool_rounds temporarily
- Switch to lower thinking level
- Yield to user with status update

**Current Status:** NOT IMPLEMENTED — relies on model intelligence and user intervention.

---

## Definition of Done for Agent Loop v2

- [ ] Steering queue documented and tested
- [ ] Followup queue implemented
- [ ] Event system designed (even if simple)
- [ ] Loop detection algorithm
- [ ] Subagent role profiles
- [ ] Provider profile formalized for k2p6
- [ ] Session state tracking
