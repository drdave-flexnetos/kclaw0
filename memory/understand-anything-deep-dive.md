## Understand-Anything — Deep Dive Analysis

### What It Does
Multi-agent codebase analysis pipeline. 6 specialized agents work together to:
- Scan project files (git-aware, respects .gitignore + .understandignore)
- Analyze each file for functions, classes, imports, exports
- Build a knowledge graph (nodes = files/functions/classes/concepts, edges = imports/calls/depends_on/etc.)
- Detect architectural layers (API, Service, Data, UI, Utility)
- Generate guided tours (ordered by dependency, learn the codebase in the right order)
- Review graph for completeness and dangling references

### Output Format
JSON knowledge graph with 13 node types + 26 edge types. Interactive dashboard renders this as force-directed graph with:
- Color-coded layers
- Click-to-explore nodes
- Search (fuzzy + semantic)
- Diff impact analysis (see what your changes affect before committing)
- Persona-adaptive UI (junior vs senior vs PM view)

### Platform Support
Works with: Claude Code, Codex, Cursor, Copilot, Gemini CLI, OpenClaw, Antigravity, Pi Agent, VS Code

### Installation Status (OpenClaw)
- ✅ Repo cloned to ~/.openclaw/understand-anything
- ✅ pnpm installed, dependencies resolved
- ✅ Core package built (TypeScript compiled)
- ✅ Skills symlinked to ~/.openclaw/skills/understand-anything
- ✅ Universal plugin root symlinked to ~/.understand-anything-plugin
- ⏳ Needs OpenClaw gateway restart for automatic skill discovery

### Key Commands (once discovered)
- `@understand` — Analyze current codebase, build knowledge graph
- `@understand-dashboard` — Launch interactive web dashboard
- `@understand-chat` — Ask natural language questions about the graph
- `@understand-domain` — Extract business logic (domains, flows, steps)
- `@understand-diff` — Impact analysis of current changes
- `@understand-explain <file>` — Deep-dive into specific file/function
- `@understand-knowledge <path>` — Analyze knowledge bases (wiki-style markdown)
- `@understand-onboard` — Generate onboarding guide for new team members

### Why This Is Critical for Self-Upgrade
| Capability | How It Helps Self-Upgrade |
|---|---|
| Structural Analysis | Before modifying my code, I know what's there |
| Dependency Mapping | I know what will break if I change X |
| Impact Analysis | I can preview ripple effects of changes |
| Guided Tours | I learn my own codebase in the right order |
| Semantic Search | "Find auth handling" instead of grep |
| Graph as JSON | Commit once, instant recall forever |

### First-Use Strategy
1. Run `@understand` on my workspace
2. Store generated `.understand-anything/knowledge-graph.json` in memory
3. The graph becomes my "mental model" of my own code
4. Before any self-modification, consult the graph for dependencies
5. Update incrementally with auto-update hooks

### Observations
- The tool supports incremental updates (only re-analyzes changed files)
- Can auto-update on git commit via post-commit hook
- Graph can be committed to repo for team sharing
- Large graphs (10MB+) supported via git-lfs
- 12 programming language patterns explained in context (generics, closures, decorators, etc.)
- Business domain extraction (`/understand-domain`) maps code to real business processes

### Potential Integration Points
- Could auto-run on heartbeat to keep my self-knowledge fresh
- Could store graph summaries in MEMORY.md for instant recall
- Could use `@understand-chat` to answer "what does X do?" without reading files
- Could use diff impact analysis before applying self-modifications

### Open Questions
- How to best integrate the JSON graph into my existing memory system?
- Should I commit `.understand-anything/` to my workspace repo?
- Can I use the embedding search for semantic memory retrieval?

---
*Analyzed 2026-05-06. Plugin version 2.6.0. Core package 0.1.0.*
