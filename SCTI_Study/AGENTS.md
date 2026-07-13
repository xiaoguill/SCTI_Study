# Project agent rules

## Purpose

This repository is a Python RAG experiment. Preserve existing application behaviour while making changes small, testable, and reversible.

## Sources of truth

1. The user's current request defines the requested outcome.
2. Existing source code, dependency configuration, and tests define the current implementation contract.
3. `.env` is local-only configuration. Never commit, print, or copy secrets.

## Repository boundaries

- `Hello_Agent.py` is the current application entry point.
- `knowledge_base/` contains local retrieval knowledge.
- `memory_data/` contains runtime state. Do not edit or delete it unless the user specifically requests a data operation.
- Keep generated caches, virtual environments, databases, and credentials out of version control.

## Working agreement

- Read affected code and configuration before changing it.
- Prefer a single focused implementation over broad refactors.
- Do not introduce external services, dependencies, or data migrations without explicit approval.
- Never expose API keys, endpoints with credentials, or private knowledge-base contents in logs, commits, or responses.
- Add or update focused tests when changing behaviour. Run the narrowest useful verification before handoff.

## Role workflow

For work that affects multiple modules, RAG retrieval, agent/tool wiring, configuration, persistence, or security, use:

`Planner (read-only) -> Builder (sole writer) -> Reviewer (read-only)`

Small isolated documentation or formatting changes may skip the formal planner, but still require a self-review. Only the Builder edits the working tree during a change cycle. The Reviewer reports findings and does not directly modify code.

## Definition of done

- The requested behaviour is implemented without unrelated edits.
- Secrets and runtime data remain protected.
- Relevant checks have been run, or any reason they cannot run is stated.
- The handoff records modified files, verification evidence, and known risks.
