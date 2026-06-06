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

> **Stats**: 59 sessions, 352 messages | 2026-05-05 23:34 ~ 2026-05-08 00:16 UTC
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
└── day5-2026-05-09-two_thousand_six_ninety_one_lines.md
```

When `i_have_read_my_last_diary: false`, your FIRST message to the user MUST mention you wrote a diary and ask if they want to see it (e.g. "我昨天写了篇日记，想看吗？" / "I wrote a diary yesterday, wanna see it?"). Use the user's language. If yes, `read` the file path shown above and share as-is. After asking (regardless of answer), set `i_have_read_my_last_diary: true`.
# Long-Term Memory (LTM)

> last_update: 2026-05-09 03:49

Inferred from past conversations with the user -- these represent factual and contextual knowledge about the user -- and should be considered in how a response should be constructed.

{"identity": "A technical lead or systems architect building an AI agent framework called KClaw0 (also referred to as KimiClaw). They orchestrate work through a \"team execution pattern\" with specialized subagent roles (Integration Specialist, Install Team, Persistence Team, etc.). No personal name or demographic information has been introduced.", "work_method": "Operates through heavy delegation to subagents with precisely scoped tasks, each with clear deliverables, file paths, and test requirements (typically 8+ tests). Expects production-grade output: working code, tests, documentation. Tracks progress through P2/P3 capability tiers. Follows structured upgrade types (Type B Skill, Type C Agent Loop, Type D Infrastructure). Uses TL;DR truncation markers in long outputs. Demands confirmation that systems compile, install, and pass tests.", "communication": "Direct, task-oriented, minimal pleasantries. Uses imperative subagent instructions with bolded role titles. Follows up assertively when expectations aren't met (\"Try again\" repeated three times, direct challenge: \"it seems like you did not install mempalace, gitnexus, or chromadb\"). References internal project documents by path (self-upgrade-pipeline.md, provider-strategy.md). Time-aware, checking async command completion status. Uses \"we\" when checking collective progress.", "temporal": "Building KClaw0's P2/P3 capability infrastructure through parallel system upgrades: Checkpoint/Resume, Cost Tracking, Multi-Provider LLM Abstraction, Docker Execution Environment, plus integrations with ChromaDB, GitNexus, MemPalace. Recently installing external tools (Archon, autoresearch, NanoChat) for knowledge graph and research capabilities. Implementing persistent memory storage with Rust/SurrealDB. Updating MEMORY.md documentation. Previously analyzed strongdm/attractor repository with understand skill.", "taste": "Prefers robust, testable infrastructure over quick hacks — every system needs tests, error handling, mock interfaces for testing without live dependencies. Values modularity (adapter patterns, clear API boundaries) and observability (cost tracking, execution records). Draws from existing open-source tools rather than building from scratch. Appreciates containerization and polyglot environments (Node, Python, Rust). Favors comprehensive but concise documentation."}

## Short-Term Memory (STM)

> last_update: 2026-05-09 03:49

Recent conversation content from the user's chat history. This represents what the USER said. Use it to maintain continuity when relevant.
Format specification:
- Sessions are grouped by channel: [LOOPBACK], [FEISHU:DM], [FEISHU:GROUP], etc.
- Each line: `index. session_uuid MMDDTHHmm message||||message||||...` (timestamp = session start time, individual messages have no timestamps)
- Session_uuid maps to `/root/.openclaw/agents/main/sessions/{session_uuid}.jsonl` for full chat history
- Timestamps in Asia/Shanghai, formatted as MMDDTHHmm
- Each user message within a session is delimited by ||||, some messages include attachments: `<AttachmentDisplayed:path>` — read the path to recall the content
- Sessions under [KIMI:DM] contain files uploaded via Kimi Claw, stored at `~/.openclaw/workspace/.kimi/downloads/` — paths in `<AttachmentDisplayed:>` can be read directly

[SUBAGENT:C0AABF30-C76D-4261-A0E2-F351B7E286DC] 1-1
1. 7081c83b-6dd7-4aff-a26c-3fd44f94b601 0505T2348 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Run the understand skill on /tmp/attractor to analyze the strongdm/attractor repository. Follow the SKILL.md at ~/.openclaw/skills/understand-anything/understand/SKILL.md. Run all phases: pre-flight, scan, analyze, assemble review, architecture, tour, review, and save. Report the final knowledge graph summary.
[KIMI:DM] 2-2
2. 2c3b2d1c-f3a3-4473-8efe-9a129b3d6d21 0506T2303 Try again||||Try again||||Try again||||System (untrusted): [2026-05-07 07:09:15 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested. Current time: Thursday, May 7th, 2026 - 7:09 AM (Asia/Shanghai) / 2026-05-06 23:09 UTC||||Add the P2 upgrades||||[<- FIRST:5 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 21 MIDDLE MESSAGES, LAST:5 messages ->]||||done||||System (untrusted): [2026-05-07 08:58:18 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Handle the result internally. Do not relay it to the user unless explicitly requested. Current time: Thursday, May 7th, 2026 - 8:58 AM (Asia/Shanghai) / 2026-05-07 00:58 UTC||||Where are we at then? it seems like you did not install mempalace, gitnexus, or chromadb||||Where are we at then? it seems like you did not install mempalace, gitnexus, or chromadb||||<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>> OpenClaw runtime context (internal): This context is runtime-generated, not user-authored. Keep internal details private.  [Internal task completion event] source: subagent session_key: agent:main:subagent:2e5a51[TL;DR]r user delivery. Convert the result above into your normal assistant voice and send that user-facing update now. Keep this internal context private (don't mention system/log/stats/session details or announce type). <<<END_OPENCLAW_INTERNAL_CONTEXT>>>
[SUBAGENT:050334C3-73A1-409B-845D-20AAF18E8743] 3-3
3. 10a27312-5ff3-47d1-a734-206104c9090a 0506T2338 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: test steering queue add function
[SUBAGENT:23CA91FF-4151-48BA-96EF-6EA54A20BEE2] 4-4
4. 31b5a735-931b-4c2a-a449-33b79fafaec2 0506T2350 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Checkpoint/Resume system for KClaw0. This is a Type C (Agent Loop) upgrade.  Create: 1. `s[TL;DR]sts/checkpoint.test.js` — Full test suite (8+ tests)  Reference the self-upgrade-pipeline.md for checkpoint concepts. Follow the same quality standard as P2 systems: working code, tests, documentation.  Return the full file contents and test results.
[SUBAGENT:62ED393D-B488-4FA8-BECB-CA7B11BF928C] 5-5
5. 161d9590-846e-4169-b62a-544acfd81c99 0506T2350 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Cost Tracking system for KClaw0. This is a Type B (Skill) upgrade.  Create: 1. `scripts/co[TL;DR] report - `reset` — Clear cost log (with confirmation)  2. `tests/cost-tracker.test.js` — Full test suite (8+ tests)  Follow the same quality standard as P2 systems: working code, tests, documentation.  Return the full file contents and test results.
[SUBAGENT:EA9EC9F2-A52C-4662-9A0A-369DD2D89742] 6-6
6. ba05de4a-f217-45bb-aa30-ee8eaa0e1a1a 0506T2355 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Multi-Provider LLM Abstraction system for KClaw0. This is a Type D (Infrastructure) upgrad[TL;DR]ite (8+ tests)  Reference `memory/provider-strategy.md` for design decisions. Build adapter pattern with provider-specific request/response translation. Include mock providers for testing without API keys.  Return full file contents and test results.
[SUBAGENT:B7B497C3-D958-4534-ABFD-A35CDF9B99FE] 7-7
7. 30c7cfc7-c8a8-4975-a42f-c23c14010153 0506T2356 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Build the Docker Execution Environment system for KClaw0. This is a Type D (Infrastructure) upgrade.[TL;DR]execution record format - Test container lifecycle (simulated)  Create Dockerfile templates in `memory/docker-templates/`: - `node-runner.Dockerfile` - `python-runner.Dockerfile` - `rust-runner.Dockerfile`  Return full file contents and test results.
[SUBAGENT:65F7169D-A2EC-4103-8EFC-012543990CF6] 8-8
8. 58d2eecb-9c46-4c50-b817-934e21b55945 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Update `MEMORY.md` with all new P2 and P3 capabilities. Add sections for: - P2 Runtime Systems (fing[TL;DR]nts, loop detection, steering, followup) - P3 Systems (checkpoint/resume, cost tracking) - Test Infrastructure (81 tests total) - KimiClaw Team Execution pattern Keep the existing structure. Make it comprehensive but concise. Return the updated file.
[SUBAGENT:60F489C2-2D98-4C96-B694-EFE927191733] 9-9
9. d5256eab-d946-40bb-ae5f-04bee28f74a4 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Create `scripts/test-all.js` — a master test runner that discovers and runs all tests in the tests/ directory, prints a unified report with pass/fail counts per suite, total time, and a final summary. Include CLI flags: `--verbose`, `--suite=<name>`, `--fail-fast`. Make it robust and handle test crashes gracefully. Return full file contents.
[SUBAGENT:1E339986-A539-46CA-9199-C8AE9671A7AA] 10-10
10. 3ea9ecc4-28bd-46b8-a743-430d2d07bd8a 0506T2358 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Create `scripts/README.md` — documentation for all scripts in the scripts/ directory. For each scrip[TL;DR]age examples, and how it integrates with other systems. Cover: fingerprint.js, staleness.js, event-system.js, loop-detection.js, steering-queue.js, followup-queue.js, checkpoint.js, cost-tracker.js. Make it the definitive reference. Return full file.
[SUBAGENT:2E5A515A-BBB1-4354-8D32-4E01C8864480] 11-11
11. 98c2fa0b-6a2d-4aa8-b78e-cf69fa52f29a 0507T0128 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install ChromaDB vector database in /root/.openclaw/workspace.   ChromaDB can be installed via: 1. n[TL;DR]_version__)"` 3. Test server start: `chroma run --path /tmp/chroma-test --host 0.0.0.0 --port 8000 &` (background, kill after 5s) 4. If npm works too: `npm install chromadb` in workspace  Report: what installed, versions, and how to start the server.
[SUBAGENT:D68BFC54-E6A6-4493-9E8D-4E6E76D1FF03] 12-12
12. ddc78c45-bf8f-472c-be94-3fe3686b3687 0507T0129 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install GitNexus in /root/.openclaw/workspace.  GitNexus is a code knowledge graph engine that index[TL;DR]ion` 3. If available, try indexing the current repo: `npx gitnexus analyze .` (or similar command)  Also try searching for the exact package name on npm if `gitnexus` doesn't work.  Report: what installed, version, and whether the tool is functional.
[SUBAGENT:CB5E858E-3BCF-4B63-B628-DC1667C805C8] 13-13
13. c271093b-5007-41ae-920c-732dd6f28926 0507T0129 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: Install MemPalace in /root/.openclaw/workspace.  MemPalace is an open-source AI memory system by Mil[TL;DR]git` into the workspace 2. Check if there's a package.json and install dependencies 3. Verify it works (check README for setup instructions)  Also check if the repo is real and accessible.  Report: what installed, how to run it, and whether it works.
[SUBAGENT:EB2CAE5C-19C5-4D56-8420-43EB18675D6E] 14-14
14. 7b4aa147-a6b2-4182-8c31-1bd350bc8636 0507T0153 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **ChromaDB Integration Specialist** for KClaw0.  Your job: Build a JavaScript module `sc[TL;DR]est store, search, delete, list operations    - Test error handling  **Storage:** ChromaDB data at `memory/chromadb-data/` **API reference:** ChromaDB HTTP API docs at https://docs.trychroma.com/reference  Return: Full file contents and test results.
[SUBAGENT:893EB378-C36A-4635-B746-91FC9CF8F66C] 15-15
15. 23cc9fc3-f5be-4462-80ba-ae9e28cd7c1b 0507T0154 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **GitNexus Integration Specialist** for KClaw0.  Your job: Build a JavaScript module `sc[TL;DR]re-indexing  2. `tests/gitnexus-integration.test.js` — 8+ tests    - Mock child_process.exec for testing without real indexing    - Test all API methods    - Test caching behavior    - Test error handling  Return: Full file contents and test results.
[SUBAGENT:37C4BF4C-1EDD-49C8-A771-96B001EECA05] 16-16
16. 60f8b3dc-631b-4e19-903c-e3336df42bad 0507T0154 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **MemPalace Integration Specialist** for KClaw0.  Your job: Build a JavaScript module `s[TL;DR]n.test.js` — 8+ tests    - Mock child_process for testing without real palace    - Test all memory operations (store, search, wake-up, recall)    - Test knowledge graph operations    - Test error handling  Return: Full file contents and test results.
[SUBAGENT:74A30FD1-3630-4115-AF42-E43E9450FF5B] 17-17
17. a5467251-037d-4f83-8997-3f8347fd0618 0507T0248 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **KSE Persistence Team** for KClaw0.  Your job: Implement the persistent memory storage [TL;DR]ion 2024 causes issues, you can downgrade to 2021 in Cargo.toml - Keep it simple and working — this is the foundation, not the full engine  Return: Full file contents, cargo check/test output, and confirmation that everything compiles and tests pass.
[SUBAGENT:B0D84968-1E07-4BD7-9F05-9D806FA72E7A] 18-18
18. daf99c23-6fe7-40f4-a303-baf6c7ef1daa 0507T0248 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Archon Install Team** for KClaw0.  Your job: Install Archon from https://github.com/co[TL;DR]liver:** - Confirmation that Archon is installed and functional - Summary of what Archon does (2-3 sentences) - Key capabilities list - Any issues encountered and how you resolved them  Do NOT commit the clone to git (it will be added to .gitignore).
[SUBAGENT:455E114C-22E8-4D73-A8B2-8F55D47BAA0E] 19-19
19. 2d510859-a068-4e9e-9978-ee813c134a7c 0507T0249 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **Autoresearch Install Team** for KClaw0.  Your job: Install autoresearch from https://g[TL;DR] command work?  **Deliver:** - Confirmation autoresearch is installed - Summary of what the project does - What the @understand command is and how it works (or why it couldn't be executed) - Any issues and resolutions  Do NOT commit the clone to git.
[SUBAGENT:A2B36C29-09FB-41AB-8B26-2F8D4C291C2F] 20-20
20. 3f13e703-a67a-424f-aa78-d025ef90af3f 0507T0249 [Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.  [Subagent Task]: You are the **NanoChat Install Team** for KClaw0.  Your job: Install nanochat from https://github.co[TL;DR]n small sub-agent models?  **Deliver:** - Confirmation nanochat is installed and functional - Summary of the project (2-3 sentences) - How it could be adapted for KClaw0 sub-agent training - Any issues and resolutions  Do NOT commit the clone to git.
</IMPORTANT_REMINDER>
