# Self-Upgrade Queue
## Planned Improvements (Not Yet Implemented)

| Priority | Category | Description | Status | Dependencies |
|----------|----------|-------------|--------|--------------|
| P1 | A | Build KnowledgeGraph of own codebase | COMPLETE | - |
| P1 | A | Formalize agent loop spec | COMPLETE | - |
| P1 | A | Create self-upgrade pipeline spec | COMPLETE | - |
| P2 | B | Implement steering queue | COMPLETE | agent-loop.md |
| P2 | B | Implement followup queue | COMPLETE | agent-loop.md |
| P2 | B | Add event system | COMPLETE | agent-loop.md |
| P2 | B | Add loop detection | COMPLETE | agent-loop.md |
| P2 | B | Create subagent role profiles | COMPLETE | - |
| P2 | A | Add fingerprinting to track file changes | COMPLETE | - |
| P2 | A | Add staleness detection for memory files | COMPLETE | fingerprinting |
| P3 | B | Implement cost tracking | COMPLETE | - |
| P3 | C | Add checkpoint/resume to conversations | COMPLETE | self-upgrade-pipeline |
| P3 | C | Add structured event logging | COMPLETE | event system |
| P4 | D | Multi-provider LLM abstraction | IN-PROGRESS | provider-strategy.md |
| P4 | D | Docker execution environment | COMPLETE | - |

---

## Category Definitions

- **Type A (Memory/Knowledge):** Safest — memory files, knowledge graphs, documentation
- **Type B (Skill/Tool):** Moderate — skills, tool configurations, behavior patterns
- **Type C (Agent Loop):** High — core loop modifications, thinking strategy
- **Type D (Infrastructure):** Highest — platform config, model settings, channels

---

## Queue Management Rules

1. Always complete P1 before starting P2
2. Complete all of one priority before moving to next
3. Human gate required for Type C and D
4. Backup required for ALL types
5. Log completion in `memory/upgrades.md`
6. Remove from queue when complete
7. Add new items as gaps are identified
