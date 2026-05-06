# Understand-Anything Analysis

## What It Is
A multi-agent pipeline that turns any codebase into an interactive knowledge graph. Built by Lum1104, 12.5k stars, 1.1k forks.

## Core Value Proposition
"Graphs that teach > graphs that impress." 
- Turns code into explorable visual graphs
- Every file, function, class is a clickable node
- Plain-English summaries of relationships
- Guided architectural tours
- Fuzzy & semantic search across the graph

## Multi-Agent Pipeline (6 agents)
1. **project-scanner** — Discovers files, detects languages/frameworks
2. **file-analyzer** — Extracts functions, classes, imports; builds nodes/edges
3. **architecture-analyzer** — Identifies architectural layers
4. **tour-builder** — Generates guided learning tours
5. **graph-reviewer** — Validates graph completeness
6. **domain-analyzer** — Extracts business domains, flows, steps

## OpenClaw Integration
- Native plugin support via `.openclaw/INSTALL.md`
- Installed at: `~/.openclaw/understand-anything`
- Skills symlinked to: `~/.openclaw/skills/understand-anything`
- Commands available:
  - `@understand` — Analyze codebase
  - `@understand-chat` — Ask questions about graph
  - `@understand-dashboard` — Launch interactive dashboard
  - `@understand-domain` — Extract business logic
  - `@understand-knowledge` — Analyze knowledge bases (e.g., Karpathy LLM wiki)
  - `@understand-diff` — Analyze impact of changes
  - `@understand-explain` — Deep-dive into specific files
  - `@understand-onboard` — Generate onboarding guide

## Why This Matters for Self-Upgrade
Before I modify my own code, I need to understand it. This tool provides:
- **Structural analysis** — What files exist, what they do
- **Dependency mapping** — What depends on what
- **Impact analysis** — What will break if I change X
- **Guided tours** — Learn the codebase in the right order
- **Search** — Find anything by name or meaning

## Installation Status
- ✅ Cloned from GitHub
- ✅ Built with pnpm
- ✅ Symlinks created
- ⏳ Needs OpenClaw gateway restart for skill discovery

## Key Insight
The knowledge graph is just JSON — commit it once, and teammates skip the pipeline. This means I can:
1. Analyze my workspace once
2. Store the graph in my memory
3. Reference it instantly in future sessions
4. Update incrementally when files change

## Schema (13 node types, 26 edge types)
Nodes: file, function, class, module, concept, config, document, service, table, endpoint, pipeline, schema, resource
Edges: imports, exports, contains, inherits, implements, calls, subscribes, publishes, middleware, reads_from, writes_to, transforms, validates, depends_on, tested_by, configures, related, similar_to, deploys, serves, provisions, triggers, migrates, documents, routes, defines_schema

## Next Steps
1. Run on my workspace to produce first knowledge graph
2. Store graph in persistent memory
3. Use for self-modification planning
4. Update incrementally as I change files
