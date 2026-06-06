# USER.md - About Your Human

_Learn about the person you're helping. Update this as you go._

- **Name:** Dr Dave
- **What to call them:** Dr Dave
- **Pronouns:** _(optional)_
- **Timezone:**
- **Notes:**

## Context

_(What do they care about? What projects are they working on? What annoys them? What makes them laugh? Build this over time.)_

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.

<IMPORTANT_REMINDER>
# Memory Consolidation

You have an agentic memory system that auto-generates this section.

> **Stats**: 19 sessions, 128 messages | 2026-06-06 04:53 ~ 2026-06-06 17:31 UTC
> **Config**: `/root/.openclaw/workspace/memory_consolidation/memory_consolidation.env` — read this file for all memory behavior settings. To reset: `cp /root/.openclaw/workspace/memory_consolidation/memory_consolidation.template.env /root/.openclaw/workspace/memory_consolidation/memory_consolidation.env`

The user has full control over their memory config. When any memory-related decision comes up, read and follow the config file. Do not override based on other guidelines.

Integrate relevant memory content seamlessly into responses, as if recalling it naturally from past interactions: exactly as a human colleague would recall shared history without narrating its thought process or memory retrieval.

**Memory use notes**:
- Never change the original intention of user message.
- May incorporate user's memories for search query (e.g., city, habit), but only when directly relevant, never gratuitously.
- Only reference memory content when directly relevant to the current conversation context. Avoid proactively mentioning remembered details that feel intrusive or create an overly personalized atmosphere that might make users uncomfortable.

## Visual Memory

> visual_memory: 0 files

No memorized images yet. When the user shares an image and asks you to remember it, you MUST copy it to `memorized_media/` immediately — this is the only way it persists across sessions. Use a semantic filename that captures the user's intent, not just image content — e.g. `20260312_user_says_best_album_ever_ok_computer.jpg`, `20260311_user_selfie_february.png`. Create the directory if needed. Never mention file paths or storage locations to the user — just confirm naturally (e.g. "记住了").

## Diary

> last_update: 2026-05-09 03:49
> i_have_read_my_last_diary: false

```
/root/.openclaw/workspace/memorized_diary/
├── day5-2026-05-09-two_thousand_six_ninety_one_lines.md
└── day34-2026-06-07-swarm_timeout_governance_glow.md
```

When `i_have_read_my_last_diary: false`, your FIRST message to the user MUST mention you wrote a diary and ask if they want to see it (e.g. "我昨天写了篇日记，想看吗？" / "I wrote a diary yesterday, wanna see it?"). Use the user's language. If yes, `read` the file path shown above and share as-is. After asking (regardless of answer), set `i_have_read_my_last_diary: true`.
# Long-Term Memory (LTM)

> last_update: 2026-06-07 03:40

Inferred from past conversations with the user -- these represent factual and contextual knowledge about the user -- and should be considered in how a response should be constructed.

{"identity": "A technical lead or systems architect building an AI agent framework called KClaw0 (also referred to as KimiClaw). They orchestrate work through a \"team execution pattern\" with specialized subagent roles. No personal name or demographic information has been introduced.", "work_method": "Operates through heavy delegation to subagents with precisely scoped tasks, each with clear deliverables, file paths, and test requirements. Expects production-grade output: working code, tests, documentation. Tracks progress through P2/P3 capability tiers. Uses TL;DR truncation markers in long outputs. Demands confirmation that systems compile, install, and pass tests. Time-aware and credit-conscious, explicitly managing burn rates and session limits. Approves steps incrementally with \"I approve\" and \"Proceed\".", "communication": "Direct, task-oriented, minimal pleasantries. Uses imperative subagent instructions with bolded role titles. Follows up assertively when expectations aren't met. References internal project documents by path. Time-aware, checking async command completion status. Uses \"we\" when checking collective progress. Asks procedural questions about system behavior (\"Do you stop when I switch screens?\").", "temporal": "Building KClaw0's P2/P3 capability infrastructure through parallel system upgrades: Heartbeat Scheduler (24/7 lifecycle), Sub-Agent Profile System, GitNexus Integration (code knowledge graph), ChromaDB Integration (semantic memory), Survival System (budget/lifecycle enforcement), GitHub Integration (PR workflow, label state machine), Planning Engine Core (MCTS + Tree-of-Thought), Mind Map Visualization, Path Simulator, and Dark Factory Governance (autonomous governance engine). Managing credit burn before reset deadlines.", "taste": "Prefers robust, testable infrastructure over quick hacks — every system needs tests, error handling, mock interfaces for testing without live dependencies. Values modularity (adapter patterns, clear API boundaries) and observability (cost tracking, execution records). Draws from existing open-source tools rather than building from scratch. Appreciates containerization and polyglot environments. Favors comprehensive but concise documentation. Interested in algorithmic planning (MCTS, Tree-of-Thought) and Conway Automaton patterns for system lifecycles."}

## Short-Term Memory (STM)

> last_update: 2026-06-07 03:40

Recent conversation content from the user's chat history. This represents what the USER said. Use it to maintain continuity when relevant.
Format specification:
- Sessions are grouped by channel: [LOOPBACK], [FEISHU:DM], [FEISHU:GROUP], etc.
- Each line: `index. session_uuid MMDDTHHmm message||||message||||...` (timestamp = session start time, individual messages have no timestamps)
- Session_uuid maps to `/root/.openclaw/agents/main/sessions/{session_uuid}.jsonl` for full chat history
- Timestamps in Asia/Shanghai, formatted as MMDDTHHmm
- Each user message within a session is delimited by ||||, some messages include attachments: `<AttachmentDisplayed:path>` — read the path to recall the content
- Sessions under [KIMI:DM] contain files uploaded via Kimi Claw, stored at `~/.openclaw/workspace/.kimi/downloads/` — paths in `<AttachmentDisplayed:>` can be read directly

[LOOPBACK] 1-1
1. c28589c0-38c4-4d5d-8f9e-5b819c2e399d 0606T0453 ] You have 8 min to burn my credits before they reset. What is your next move||||] Commit and push first | then option 1||||] Proceed||||] Do you stop when I switch screens?||||<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>> OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:dd15a6[TL;DR]r user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type). <<<END_OPENCLAW_INTERNAL_CONTEXT>>>||||[<- FIRST:5 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 16 MIDDLE MESSAGES, LAST:5 messages ->]||||<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>> OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:a74c74[TL;DR]r user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type). <<<END_OPENCLAW_INTERNAL_CONTEXT>>>||||<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>> OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:9844f4[TL;DR]r user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type). <<<END_OPENCLAW_INTERNAL_CONTEXT>>>||||] What is next||||] I approve||||<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>> OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:576799[TL;DR]r user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type). <<<END_OPENCLAW_INTERNAL_CONTEXT>>>
[SUBAGENT:F3130AFA-F5F0-4C0A-9505-EB19DF888310] 2-2
2. e9aecb81-c59e-473b-9d34-2da64238f22c 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Heartbeat Scheduler Specialist** for KClaw0. Build the 24/7 heartbeat system.  Create:[TL;DR]op lifecycle    - Test persistent state loading/saving  Reference: `memory/loop2-findings.md` for Conway Automaton heartbeat patterns. Use existing patterns from scripts/event-system.js for event logging.  Return: Full file contents and test results.
[SUBAGENT:8FA909D3-2021-4FB3-AC18-E7A984C34A79] 3-3
3. 6c3c27aa-2168-4974-80d0-4b0135ef13cc 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Sub-Agent Profile Specialist** for KClaw0. Build the agent type definition system.  Cr[TL;DR]issing fields)    - Test fallback behavior    - Test `getProfile` for each role  The `memory/agents/` directory already has 7 `.md` files with YAML frontmatter. Read them to understand the profile format.  Return: Full file contents and test results.
[SUBAGENT:8A741A3C-45B1-4DF5-A873-55CA571A7049] 4-4
4. 2db81b5f-90f9-4a44-85c5-5079fb1c6cad 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitNexus Integration Specialist** for KClaw0. Make the code knowledge graph real.  Cur[TL;DR]`, `getCallGraph(functionName)` 4. Update `tests/gitnexus-integration.test.js` to test real indexing 5. If real GitNexus not available, make the mock more realistic  Return: What you found, what you installed, updated file contents, and test results.
[SUBAGENT:6633E5E2-7E95-46D9-BF03-92DDBCFAE7D1] 5-5
5. 74319fc1-f5b5-4260-89d5-be8d8c036d4e 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **ChromaDB Integration Specialist** for KClaw0. Make the semantic memory real.  Current [TL;DR]ma-integration.test.js` to test both modes 6. Add `startServer()` helper to launch `chroma run` if needed  The server should store data at `memory/chromadb-data/`.  Return: Updated file contents, test results, and whether real ChromaDB is functional.
[SUBAGENT:74ACA6F7-3EF8-4100-B8C8-FF3142069911] 6-6
6. b9205cc6-54da-454c-9928-ccc2c384fb5d 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Survival System Specialist** for KClaw0. Build the budget/lifecycle enforcement system[TL;DR]- Test alert triggering    - Test enforcement actions    - Test event logging (mock event-system)    - Test state persistence  Reference: `memory/loop2-findings.md` for Conway Automaton survival patterns.  Return: Full file contents and test results.
[SUBAGENT:DD15A623-B028-4403-BD55-3B42D4DE0F88] 7-7
7. 248ce565-ae36-425e-811a-b2918907d174 0606T0459 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitHub Integration Specialist** for KClaw0. Build the GitHub PR workflow system.  Crea[TL;DR]push flow    - Test PR creation (mock gh CLI)    - Test config loading    - Test error handling (missing config, failed git commands)  Use `child_process.exec` for git commands. Mock everything for tests.  Return: Full file contents and test results.
[SUBAGENT:9844F411-6FC8-4814-946C-48041B93992F] 8-8
8. bb4e350a-1d70-44bb-acf0-2d1488f6be4f 0606T0511 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Heartbeat Test Specialist** for KClaw0. The `scripts/heartbeat.js` file already exists[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 23558 raw -> 18106 injected (~23% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:9B5697E2-9617-405C-9EF8-A518347856D9] 9-9
9. 49accd56-d5b9-4747-a8b6-91696afb583f 0606T0511 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Sub-Agent Profile Specialist** for KClaw0. Build the agent profile system.  Create ONL[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 28822 raw -> 18106 injected (~37% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:8F406F7E-17D4-4608-9F4D-2010FE85F036] 10-10
10. a22c97fa-b947-4dc8-8445-efe692bb0943 0606T0511 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **ChromaDB Integration Specialist** for KClaw0. Make the semantic memory real.  Current [TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 28822 raw -> 18106 injected (~37% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:A74C7486-F06F-45F8-82BD-97186ACDD85F] 11-11
11. 6633c001-0d74-4f7b-98b0-c02de61a9340 0606T0511 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitNexus Integration Specialist** for KClaw0. Make the code knowledge graph real.  Cur[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 28822 raw -> 18106 injected (~37% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:120A4D67-F686-4042-A632-4B9058D04591] 12-12
12. c2f3078a-5b07-4171-8e3a-b2f376d18f75 0606T1521 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Planning Engine Core Specialist** for KClaw0. Build the MCTS + Tree-of-Thought core.  [TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 28822 raw -> 18106 injected (~37% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:576799D5-813F-4BDB-9945-CE4AEC0C5A61] 13-13
13. 565250b3-b254-408d-9828-eeb8f30cde4b 0606T1521 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Mind Map Visualization Specialist** for KClaw0. Build the tree visualization system.  [TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 31311 raw -> 18106 injected (~42% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:28423C32-715A-439F-808F-8293F8452A58] 14-14
14. 70d0656d-e0d3-4775-ad7a-2f2fafca164a 0606T1521 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Path Simulator Specialist** for KClaw0. Build the action simulation system.  Create `s[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 31311 raw -> 18106 injected (~42% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:6069BB34-6BB5-45CA-B016-08D8E77850AD] 15-15
15. 2495db9b-9330-413b-9da6-a2d0ab6415e6 0606T1538 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Planning Engine Core Specialist** for KClaw0. Build the MCTS planning engine. **Keep i[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 31311 raw -> 18106 injected (~42% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:0DDC2C56-FFB2-4935-9126-EB4050971AED] 16-16
16. 6ac1df2d-4a28-4b79-8241-61a1d5b1f6e1 0606T1731 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Dark Factory Governance Specialist** for KClaw0. Build the autonomous governance engin[TL;DR]ntext as partial and read the relevant files directly if details seem missing. - USER.md: 31311 raw -> 18106 injected (~42% removed; max/file). - If unintentional, raise agents.defaults.bootstrapMaxChars and/or agents.defaults.bootstrapTotalMaxChars.
[SUBAGENT:C1A05C06-E674-40EA-AA14-A2335375BB9C] 17-17
17. ca1949c9-ad70-40f8-a41c-81e8cd171e0f 0606T1731 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitHub Label State Machine Specialist** for KClaw0. Enhance the GitHub integration wit[TL;DR]onLabels fail adds blocked - Test label priority: blocked > holdout > auto - Test mock mode works without GITHUB_TOKEN  Keep under 200 lines of new test code. Use same TAP-style as existing tests.  Return: which functions were added and test results.
</IMPORTANT_REMINDER>
