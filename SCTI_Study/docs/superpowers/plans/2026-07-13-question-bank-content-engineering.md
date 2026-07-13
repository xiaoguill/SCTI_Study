# Question Bank Content Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the three V5 Markdown specifications into validated, versioned JSON question banks that are the only source of page question content.

**Architecture:** Canonical private banks live under `data/banks`; the university build script derives the current private deployment bank and a score-free public bank from that source. A compiler extracts high-school and graduate data from their Markdown specifications, and a Node-only validator enforces structural and algorithmic invariants.

**Tech Stack:** Node.js ESM, Node test runner, JSON, JSON Schema documentation.

## Global Constraints

- Preserve current university application behaviour and service-side score privacy.
- Do not add dependencies, services, migrations, generated caches, or credentials.
- Q1-Q19 have four options; Q20 has sixteen; each bank has sixteen tags and twenty questions.
- Weights are only `0`, `1`, or `2`; every four-dimension vector is within `1..5`.
- Every tag has two or three core selections and complete result/share copy.

---

### Task 1: Canonical source and compiler

**Files:**
- Create: `scripts/compile-question-banks.mjs`
- Create: `data/banks/*.v5.0.0.json`
- Create: `data/banks/revision-log.v5.0.0.json`

**Interfaces:**
- Produces canonical banks with `tags`, `questions`, `easter_eggs`, and `source` metadata.

- [ ] **Step 1: Compile the Markdown-backed banks**

Run: `node scripts/compile-question-banks.mjs`
Expected: `Compiled university:20Q/16T, high_school:20Q/16T, graduate:20Q/16T`

### Task 2: Schema and automated validation

**Files:**
- Create: `schemas/question-bank.schema.json`
- Create: `scripts/validate-question-banks.mjs`
- Create: `tests/question-banks.test.js`

**Interfaces:**
- Consumes: `data/banks/*.v5.0.0.json`
- Produces: non-zero exit with bank/tag/question-specific validation errors.

- [ ] **Step 1: Write failing validation tests**

```js
assert.throws(() => validateBank(invalidBank), /Q20/);
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/question-banks.test.js`
Expected: fail before validator implementation and pass afterwards.

### Task 3: University build pipeline migration

**Files:**
- Modify: `campus_persona/scripts/build-university-bank.mjs`
- Modify: `campus_persona/package.json`

**Interfaces:**
- Consumes: `data/banks/university.v5.0.0.json`
- Produces: private server bank and public score-free bank.

- [ ] **Step 1: Rebuild and run algorithm regression tests**

Run: `npm run build:bank; npm test`
Expected: generated public bank omits scores and all existing algorithm tests pass.

### Task 4: Documentation and acceptance

**Files:**
- Modify: `campus_persona/README.md`
- Create: `docs/superpowers/reports/question-bank-content-engineering-builder.md`

- [ ] **Step 1: Run all three-bank validation**

Run: `node scripts/validate-question-banks.mjs`
Expected: three banks pass without front-end repair data.
