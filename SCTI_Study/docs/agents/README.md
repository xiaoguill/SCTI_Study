# Agent workflow

The repository uses one stable root rule file and three role prompts:

```text
AGENTS.md
  └─ Planner (read-only) → Builder (writes) → Reviewer (read-only)
```

Use the full workflow for changes involving retrieval, agent/tool wiring, configuration, persistence, security, or multiple modules. The Planner prepares `HANDOFF_TEMPLATE.md`; the Builder implements and verifies; the Reviewer checks the result independently. For small, isolated changes, the Builder may work directly and record a concise handoff.

These files describe collaboration responsibilities. They do not alter runtime behaviour of `Hello_Agent.py`.
