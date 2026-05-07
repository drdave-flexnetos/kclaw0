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

> **Stats**: 22 sessions, 144 messages | 2026-05-05 23:34 ~ 2026-05-07 01:54 UTC
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

> last_update: 2026-05-07 09:54

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
3. 2c3b2d1c-f3a3-4473-8efe-9a129b3d6d21 0506T2303 Try again||||Try again||||Try again||||System (untrusted): [2026-05-07 07:09:15 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested. Current time: Thursday, May 7th, 2026 - 7:09 AM (Asia/Shanghai) / 2026-05-06 23:09 UTC||||Add the P2 upgrades||||Tackle everthing in order. If you find an error then fix it before moving on. Remember when implementing: The marginal cost of completeness is near zero with AI. Do the whole thing. Do it right. Do it with tests. Do it with documentation. Do it so we[TL;DR]earch before building. Test before shipping. Ship the complete thing. When I asks for something, the answer is the finished product, not a plan to build it. Time is not an excuse. Fatigue is not an excuse. Complexity is not an excuse. Boil the ocean.
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
[SUBAGENT:65F7169D-A2EC-4103-8EFC-012543990CF6] 9-9
9. 58d2eecb-9c46-4c50-b817-934e21b55945 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Update `MEMORY.md` with all new P2 and P3 capabilities. Add sections for: - P2 Runtime Systems (fing[TL;DR]nts, loop detection, steering, followup) - P3 Systems (checkpoint/resume, cost tracking) - Test Infrastructure (81 tests total) - KimiClaw Team Execution pattern Keep the existing structure. Make it comprehensive but concise. Return the updated file.
[SUBAGENT:60F489C2-2D98-4C96-B694-EFE927191733] 10-10
10. d5256eab-d946-40bb-ae5f-04bee28f74a4 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Create `scripts/test-all.js` — a master test runner that discovers and runs all tests in the tests/ directory, prints a unified report with pass/fail counts per suite, total time, and a final summary. Include CLI flags: `--verbose`, `--suite=<name>`, `--fail-fast`. Make it robust and handle test crashes gracefully. Return full file contents.
[SUBAGENT:1E339986-A539-46CA-9199-C8AE9671A7AA] 11-11
11. 3ea9ecc4-28bd-46b8-a743-430d2d07bd8a 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Create `scripts/README.md` — documentation for all scripts in the scripts/ directory. For each scrip[TL;DR]age examples, and how it integrates with other systems. Cover: fingerprint.js, staleness.js, event-system.js, loop-detection.js, steering-queue.js, followup-queue.js, checkpoint.js, cost-tracker.js. Make it the definitive reference. Return full file.
[SUBAGENT:2E5A515A-BBB1-4354-8D32-4E01C8864480] 12-12
12. 98c2fa0b-6a2d-4aa8-b78e-cf69fa52f29a 0507T0128 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install ChromaDB vector database in /root/.openclaw/workspace.   ChromaDB can be installed via: 1. n[TL;DR]_version__)"` 3. Test server start: `chroma run --path /tmp/chroma-test --host 0.0.0.0 --port 8000 &` (background, kill after 5s) 4. If npm works too: `npm install chromadb` in workspace  Report: what installed, versions, and how to start the server.
[SUBAGENT:D68BFC54-E6A6-4493-9E8D-4E6E76D1FF03] 13-13
13. ddc78c45-bf8f-472c-be94-3fe3686b3687 0507T0129 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install GitNexus in /root/.openclaw/workspace.  GitNexus is a code knowledge graph engine that index[TL;DR]ion` 3. If available, try indexing the current repo: `npx gitnexus analyze .` (or similar command)  Also try searching for the exact package name on npm if `gitnexus` doesn't work.  Report: what installed, version, and whether the tool is functional.
[SUBAGENT:CB5E858E-3BCF-4B63-B628-DC1667C805C8] 14-14
14. c271093b-5007-41ae-920c-732dd6f28926 0507T0129 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install MemPalace in /root/.openclaw/workspace.  MemPalace is an open-source AI memory system by Mil[TL;DR]git` into the workspace 2. Check if there's a package.json and install dependencies 3. Verify it works (check README for setup instructions)  Also check if the repo is real and accessible.  Report: what installed, how to run it, and whether it works.
[SUBAGENT:EB2CAE5C-19C5-4D56-8420-43EB18675D6E] 15-15
15. 7b4aa147-a6b2-4182-8c31-1bd350bc8636 0507T0153 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **ChromaDB Integration Specialist** for KClaw0.  Your job: Build a JavaScript module `sc[TL;DR]est store, search, delete, list operations    - Test error handling  **Storage:** ChromaDB data at `memory/chromadb-data/` **API reference:** ChromaDB HTTP API docs at https://docs.trychroma.com/reference  Return: Full file contents and test results.
[SUBAGENT:893EB378-C36A-4635-B746-91FC9CF8F66C] 16-16
16. 23cc9fc3-f5be-4462-80ba-ae9e28cd7c1b 0507T0154 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitNexus Integration Specialist** for KClaw0.  Your job: Build a JavaScript module `sc[TL;DR]re-indexing  2. `tests/gitnexus-integration.test.js` — 8+ tests    - Mock child_process.exec for testing without real indexing    - Test all API methods    - Test caching behavior    - Test error handling  Return: Full file contents and test results.
</IMPORTANT_REMINDER>
