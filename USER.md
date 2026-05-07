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

> **Stats**: 11 sessions, 35 messages | 2026-05-05 23:34 ~ 2026-05-06 23:56 UTC
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

> diary: 0 entries


# Long-Term Memory (LTM)

> No data yet. Will be generated after enough conversations.
## Short-Term Memory (STM)

> last_update: 2026-05-07 07:58

Recent conversation content from the user's chat history. This represents what the USER said. Use it to maintain continuity when relevant.
Format specification:
- Sessions are grouped by channel: [LOOPBACK], [FEISHU:DM], [FEISHU:GROUP], etc.
- Each line: `index. session_uuid MMDDTHHmm message||||message||||...` (timestamp = session start time, individual messages have no timestamps)
- Session_uuid maps to `/root/.openclaw/agents/main/sessions/{session_uuid}.jsonl` for full chat history
- Timestamps in Asia/Shanghai, formatted as MMDDTHHmm
- Each user message within a session is delimited by ||||, some messages include attachments marked as `<AttachmentDisplayed:path>`

[KIMI:DM] 1-1
1. 4a528acf-fc65-4793-ae8a-7be2fb5ae9ec 0505T2334 Call me Dr Dave.||||You. You are a self upgrading agent. Your purpose is to learn and store knowledge for persistent memory with instant recollection. You will use this knowledge to edit your own code and self upgrade.||||Start with this “https://github.com/Lum1104/Understand-Anything”||||@understand ‘https://github.com/strongdm/attractor’||||OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:c0aabf30-c76d-4261-a0e2-f351b7e286dc session[TL;DR] completed subagent task is ready for user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type).||||Use the spec files to create a self learning action plan loop to self upgrade. Target Rust coding language for speed and lua to self embed. Or create your own language if it’s better. Decide what you want and do it. Next @understand “https://github.com/Conway-Research/automaton”||||Try again
[SUBAGENT:C0AABF30-C76D-4261-A0E2-F351B7E286DC] 2-2
2. 7081c83b-6dd7-4aff-a26c-3fd44f94b601 0505T2348 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Run the understand skill on /tmp/attractor to analyze the strongdm/attractor repository. Follow the SKILL.md at ~/.openclaw/skills/understand-anything/understand/SKILL.md. Run all phases: pre-flight, scan, analyze, assemble review, architecture, tour, review, and save. Report the final knowledge graph summary.
[LOOPBACK] 3-3
3. 2c3b2d1c-f3a3-4473-8efe-9a129b3d6d21 0506T2303 Try again
[SUBAGENT:050334C3-73A1-409B-845D-20AAF18E8743] 4-4
4. 10a27312-5ff3-47d1-a734-206104c9090a 0506T2338 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: test steering queue add function
[SUBAGENT:23CA91FF-4151-48BA-96EF-6EA54A20BEE2] 5-5
5. 31b5a735-931b-4c2a-a449-33b79fafaec2 0506T2350 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Checkpoint/Resume system for KClaw0. This is a Type C (Agent Loop) upgrade.  Create: 1. `s[TL;DR]sts/checkpoint.test.js` — Full test suite (8+ tests)  Reference the self-upgrade-pipeline.md for checkpoint concepts. Follow the same quality standard as P2 systems: working code, tests, documentation.  Return the full file contents and test results.
[SUBAGENT:62ED393D-B488-4FA8-BECB-CA7B11BF928C] 6-6
6. 161d9590-846e-4169-b62a-544acfd81c99 0506T2350 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Cost Tracking system for KClaw0. This is a Type B (Skill) upgrade.  Create: 1. `scripts/co[TL;DR] report - `reset` — Clear cost log (with confirmation)  2. `tests/cost-tracker.test.js` — Full test suite (8+ tests)  Follow the same quality standard as P2 systems: working code, tests, documentation.  Return the full file contents and test results.
[SUBAGENT:EA9EC9F2-A52C-4662-9A0A-369DD2D89742] 7-7
7. ba05de4a-f217-45bb-aa30-ee8eaa0e1a1a 0506T2355 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Multi-Provider LLM Abstraction system for KClaw0. This is a Type D (Infrastructure) upgrad[TL;DR]ite (8+ tests)  Reference `memory/provider-strategy.md` for design decisions. Build adapter pattern with provider-specific request/response translation. Include mock providers for testing without API keys.  Return full file contents and test results.
[SUBAGENT:B7B497C3-D958-4534-ABFD-A35CDF9B99FE] 8-8
8. 30c7cfc7-c8a8-4975-a42f-c23c14010153 0506T2356 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Docker Execution Environment system for KClaw0. This is a Type D (Infrastructure) upgrade.[TL;DR]execution record format - Test container lifecycle (simulated)  Create Dockerfile templates in `memory/docker-templates/`: - `node-runner.Dockerfile` - `python-runner.Dockerfile` - `rust-runner.Dockerfile`  Return full file contents and test results.
</IMPORTANT_REMINDER>
