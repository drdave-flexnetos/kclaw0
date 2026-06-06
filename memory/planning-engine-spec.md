# Planning Engine Specification for KClaw0

## What We're Building

A **Tree-of-Thought + Monte Carlo Tree Search (MCTS) Planning Engine** that gives KClaw0 the ability to:
1. **Generate multiple solution paths** for any goal
2. **Simulate outcomes** for each path (without full execution)
3. **Evaluate cost/risk/success probability** per path
4. **Select optimal path** using UCB1/PUCT selection
5. **Provide direction** — concrete step-by-step plan with confidence scores

## Why Not MiroFish?

MiroFish is a **social simulation engine** (predicting Twitter/Reddit reactions with thousands of personas). KClaw0 needs an **agent planning engine** (making decisions with multiple approaches). They're different domains.

| Aspect | MiroFish | What KClaw0 Needs |
|--------|----------|-------------------|
| Domain | Social media simulation | Agent decision planning |
| Agents | 1000s with personalities | 1 agent exploring paths |
| Output | Public opinion reports | Action plans with confidence |
| Stack | Python + MongoDB + OASIS | JavaScript + existing systems |
| Use case | "What will people think?" | "What's the best way to do X?" |

## Architecture

```
PlanningEngine (scripts/planning-engine.js)
├── GoalParser ──→ Parse natural language goal into structured objective
├── PathGenerator ──→ Generate solution paths using Tree-of-Thought prompting
├── StateEncoder ──→ Encode current context (knowledge graph + memory) into state
├── MCTS Core ──→ Selection → Expansion → Simulation → Backpropagation
│   ├── Selection: UCB1 to pick most promising node
│   ├── Expansion: Add new child nodes (possible actions)
│   ├── Simulation: LLM-based rollout to estimate outcome
│   └── Backpropagation: Update node values with simulation results
├── Evaluator ──→ Score paths on: success_prob × cost_efficiency × time × risk
└── PathSelector ──→ Return best path + 2 alternatives + confidence

MindMap (scripts/mind-map.js)
├── TreeNode ──→ State, actions, parent, children, visits, value
├── TreeRenderer ──→ ASCII/visual representation of planning tree
└── PathExtractor ──→ Extract complete paths from tree to leaves

PathSimulator (scripts/path-simulator.js)
├── ActionSimulator ──→ Simulate individual tool call outcomes
├── CostEstimator ──→ Integrate with cost-tracker for budget estimates
├── RiskAssessor ──→ Estimate failure probability per step
└── OutcomePredictor ──→ Predict terminal state after N steps
```

## Core Algorithm: MCTS for Agent Planning

### State Representation
```javascript
{
  context: { /* current knowledge graph snapshot */ },
  memory: { /* relevant memory from staleness system */ },
  available_tools: [ /* tools accessible right now */ ],
  budget_remaining: 0.50, // USD from cost-tracker
  time_elapsed: 120, // seconds
  goal_progress: 0.3, // 0-1
}
```

### Action Space
```javascript
[
  { type: "search", target: "..." },
  { type: "subagent_spawn", role: "coder", task: "..." },
  { type: "tool_call", tool: "feishu_bitable", action: "..." },
  { type: "file_read", path: "..." },
  { type: "file_write", path: "...", content: "..." },
  { type: "ask_user", question: "..." },
  { type: "memory_update", key: "...", value: "..." },
  // ... etc
]
```

### UCB1 Selection Formula
```
UCB1(node) = Q(node)/N(node) + C × sqrt(2 × ln(N(parent)) / N(node))

Where:
- Q(node) = accumulated value
- N(node) = visit count
- C = exploration constant (default 1.414)
```

### Multi-Objective Evaluation
```
Score(path) = w1×success_prob + w2×cost_efficiency + w3×speed + w4×(1-risk)

Default weights: w1=0.4, w2=0.2, w3=0.2, w4=0.2
```

## Integration with Existing Systems

| Existing System | Planning Engine Uses It For |
|---------------|----------------------------|
| `scripts/cost-tracker.js` | Budget-aware planning, cost estimation per path |
| `scripts/event-system.js` | Logging planning events (plan_created, path_selected, simulation_run) |
| `scripts/knowledge-graph.js` | State representation, action generation from graph |
| `scripts/steering-queue.js` | Injecting plan direction into conversation |
| `scripts/followup-queue.js` | Queueing planned tasks for execution |
| `scripts/staleness.js` | Checking if plan is still valid |
| `scripts/checkpoint.js` | Saving planning state for resume |

## Storage

```
memory/plans/
├── active-plan.json          # Current active plan
├── plan-history.ndjson       # Historical plans (append-only)
└── simulation-cache.json     # Cache of simulation results
```

## API

```javascript
// Create a plan for a goal
const plan = await planningEngine.createPlan({
  goal: "Build a planning engine",
  constraints: { maxCost: 2.00, maxTime: 300 },
  numSimulations: 20,
  depth: 5
});

// Returns:
{
  planId: "plan_...",
  recommendedPath: {
    actions: [...],
    estimatedSuccess: 0.87,
    estimatedCost: 0.45,
    estimatedTime: 180,
    confidence: "high"
  },
  alternativePaths: [...], // 2 alternatives
  tree: { /* full MCTS tree */ },
  mindMap: "ASCII tree visualization"
}

// Execute plan step by step
await planningEngine.executeStep(planId);

// Adapt plan when conditions change
await planningEngine.replan(planId, { newConstraints: {...} });
```

## Why Tree-of-Thought + MCTS?

**Research-backed:**
- Yao et al. (2023): "Tree of Thoughts" — LLMs solve problems by exploring reasoning paths as a tree
- Silver et al. (2017): AlphaGo — MCTS achieves superhuman performance via selective tree search
- Recent papers (2024-2025): Multi-agent ToT with validator agents outperforms CoT by 8.8pp

**For KClaw0 specifically:**
- **Proactive, not reactive** — Plans before acting, unlike steering/followup queues
- **Multi-path** — Explores alternatives, not just one chain-of-thought
- **Self-correcting** — MCTS backpropagation learns from simulated failures
- **Budget-aware** — Integrates cost tracker to avoid expensive dead-ends
- **Explainable** — Returns confidence scores + rationale for chosen path

## Implementation Plan

1. **Phase 1**: Core MCTS engine (`scripts/planning-engine.js`)
   - TreeNode class, UCB1 selection, basic simulation
   - 8+ tests

2. **Phase 2**: Mind map visualization (`scripts/mind-map.js`)
   - ASCII tree rendering, path extraction
   - 8+ tests

3. **Phase 3**: Path simulator (`scripts/path-simulator.js`)
   - Action simulation, cost estimation, risk assessment
   - Integration with cost-tracker
   - 8+ tests

4. **Phase 4**: Integration
   - Hook into agent loop (before tool selection)
   - Auto-plan for complex goals (>3 steps)
   - Store plans in memory/plans/

## Files to Create

| File | Purpose | Lines (est) |
|------|---------|-------------|
| `scripts/planning-engine.js` | Core MCTS + ToT engine | ~400 |
| `scripts/mind-map.js` | Tree visualization + path extraction | ~200 |
| `scripts/path-simulator.js` | Action simulation + cost/risk estimation | ~250 |
| `tests/planning-engine.test.js` | Core algorithm tests | ~150 |
| `tests/mind-map.test.js` | Tree structure tests | ~100 |
| `tests/path-simulator.test.js` | Simulation tests | ~120 |
| `memory/planning-patterns.md` | Known planning patterns for reuse | ~50 |

Total: ~3 new scripts, ~3 new test files, ~370+ new test assertions

Target: All tests pass, integrates with P2/P3 systems, provides direction for any multi-step goal.
