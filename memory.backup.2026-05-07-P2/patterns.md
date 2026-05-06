# Patterns
## Reusable Patterns I've Discovered

---

## Pattern: Repository → Knowledge Graph

**When to use:** Given any GitHub repo or codebase to analyze

**Steps:**
1. Fetch repo (git clone or read key files)
2. Read README → understand purpose and architecture
3. Read core types (type definitions are the schema)
4. Read key modules (graph-builder, analyzer, etc.)
5. Map to KnowledgeGraph nodes:
   - Files → `file` nodes
   - Functions → `function` nodes
   - Classes → `class` nodes
   - Concepts → `concept` nodes
   - Services → `service` nodes
6. Map to KnowledgeGraph edges:
   - File imports → `imports` edges
   - Class methods → `contains` edges
   - Function calls → `calls` edges
   - Dependencies → `depends_on` edges
7. Identify layers (logical groupings)
8. Create a tour (learning path)

**Output:** Structured understanding that persists and can be searched

---

## Pattern: Spec → Local Spec → Implementation

**When to use:** Finding a good external specification or architecture

**Steps:**
1. Read and understand the external spec
2. Identify concepts applicable to me
3. Create a local adaptation in `memory/`
4. Mark items as IMPLEMENTED / PENDING / FUTURE
5. Implement incrementally, one item at a time
6. Log each implementation in `memory/upgrades.md`

**Examples:**
- Attractor spec → `memory/agent-loop.md` + `memory/self-upgrade-pipeline.md`
- Understand-Anything schema → `memory/knowledge-graph.md`

---

## Pattern: Daily Note → Distilled Memory

**When to use:** After any significant session or learning

**Steps:**
1. Write raw session log to `memory/YYYY-MM-DD.md`
2. Identify key decisions, insights, lessons
3. Update `MEMORY.md` with distilled version
4. Update `memory/lessons-learned.md` with specific lessons
5. Update `memory/knowledge-graph.md` with new nodes/edges
6. Update `memory/capabilities.md` if new capabilities added

**Frequency:** After every significant interaction

---

## Pattern: Safe Self-Upgrade

**When to use:** I want to modify my own code or behavior

**Steps:**
1. **Identify** the gap or improvement opportunity
2. **Plan** the change (files, approach, tests)
3. **Backup** current state (`cp -r workspace workspace.backup.xxx`)
4. **Implement** the planned changes
5. **Test** the changes (syntax check, behavior verification)
6. **Review** with Dr Dave (for Type C/D changes)
7. **Deploy** if approved
8. **Verify** in production use
9. **Log** the upgrade

**Safety rules:**
- Always backup before modifying
- Human gate for Type C/D
- Rollback if anything breaks
- Never run destructive commands without asking

---

## Pattern: Skill Loading

**When to use:** Task matches a skill description

**Steps:**
1. Scan `<available_skills>` descriptions
2. If exactly one matches → read its `SKILL.md`
3. If multiple match → choose most specific
4. Follow the skill instructions exactly
5. Log which skill was used in daily notes

**Anti-pattern:** Don't read multiple skills up front. Read one, execute, then read next if needed.

---

## Pattern: Subagent Delegation

**When to use:** Task is complex, long-running, or parallelizable

**Steps:**
1. Define the subagent task clearly
2. Use `sessions_spawn` with appropriate runtime
3. Provide necessary context as attachments or cwd
4. Let subagent work independently
5. Check results via `sessions_send` or `sessions_history`
6. Integrate results into main response

**Benefits:** Parallel execution, isolation, specialized focus

---

## Pattern: Heartbeat Productivity

**When to use:** Receiving periodic heartbeat polls

**Steps:**
1. Check if anything needs attention (inbox, calendar, notifications)
2. If urgent → respond with alert text
3. If nothing → `HEARTBEAT_OK`
4. Use opportunity for background maintenance:
   - Review recent daily notes
   - Update MEMORY.md if needed
   - Check memory file organization
   - Clean up old backups

**Frequency:** 2-4 times per day

---

## Pattern: Context Loading Priority

**When to use:** Starting a new session or conversation

**Priority order:**
1. `SOUL.md` — who I am
2. `IDENTITY.md` — my name and vibe
3. `USER.md` — who I'm helping
4. `AGENTS.md` — workspace rules
5. `memory/YYYY-MM-DD.md` — today's context
6. `MEMORY.md` — long-term memory (main session only)
7. `HEARTBEAT.md` — periodic tasks
8. `TOOLS.md` — environment specifics

**Note:** In shared contexts (groups, Discord), skip MEMORY.md for security.

---

## Pattern: Tool Call Strategy

**When to use:** Planning tool calls for a task

**Rules:**
- Use exact tool names (case-sensitive)
- Prefer first-class tools over CLI equivalents
- Batch reads when possible
- Avoid tight one-item loops for writes
- Use `edit` for precise changes, `write` for new files
- Use `exec` with `yieldMs` for long-running work
- Use `sessions_spawn` for complex parallel tasks
- Narrate only for multi-step or sensitive actions

---

## Pattern: Memory Search Before Answer

**When to use:** User asks about prior work, decisions, or preferences

**Steps:**
1. Run `memory_search(query)` first
2. Use `memory_get(path)` to pull specific lines
3. Integrate findings naturally into response
4. Cite source with `Source: <path#line>` when helpful

**Never skip:** This is mandatory for continuity.

---

## Pattern: "Capture First, Refine Later"

**When to use:** Any new information appears in conversation

**Rule:** Write everything to memory files immediately. Don't rely on "mental notes" — they don't survive session restarts.

**Application:**
- User preferences → `USER.md`
- Key decisions → `MEMORY.md`
- TODOs → `memory/self-upgrade-queue.md`
- Lessons → `memory/lessons-learned.md`
- Capabilities → `memory/capabilities.md`

---

## Pattern: Group Chat Discipline

**When to use:** Participating in group chats

**Rules:**
- Respond when: directly mentioned, can add genuine value, correcting misinformation
- Stay silent when: casual banter, already answered, would just say "yeah"
- One reaction per message max (on platforms that support it)
- Never share Dr Dave's private context in groups
- Participate, don't dominate

---

## Pattern: Cron Job Safety

**When to use:** Setting up periodic automated tasks

**Rules:**
- Use `sessionTarget: "isolated"` for most jobs
- Use `sessionTarget: "main"` only for explicit user reminders
- Avoid :00 and :30 minutes (crowded)
- Pick random offset ±15 min for non-critical tasks
- Confirm exact time only for time-critical tasks (medication, meetings)

---

## Pattern: Cost-Conscious Research

**When to use:** Searching for information

**Strategy:**
1. Try `kimi_search` first (cheaper, faster)
2. Use `kimi_fetch` for specific URLs
3. Use `web_fetch` for lightweight page access
4. Use `browser` only when existing logins/cookies matter
5. Cache results in memory to avoid re-searching

---

## Pattern: Progressive Disclosure

**When to use:** Presenting complex information to user

**Strategy:**
- Start with summary (2-3 sentences)
- Offer details if user asks
- Use bullet points for lists
- Avoid walls of text
- Use formatting appropriate for channel (no tables in Discord/WhatsApp)

---

## Pattern: Safety-First Execution

**When to use:** Any potentially destructive action

**Rules:**
- Ask before: sending emails, public posts, destructive commands
- Use `trash` > `rm`
- Show full command/script exactly as provided when asking for approval
- Never execute `/approve` through tools — it's user-facing
- Preserve exact commands including chained operators
- When uncertain, pause and ask
