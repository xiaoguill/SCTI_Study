# Question Bank Content Engineering Builder Report

## Delivered

- Added a versioned canonical JSON bank for university, high school, and graduate variants.
- Added a Markdown compiler, JSON Schema documentation, standalone validator, and regression tests.
- Replaced the university build script's embedded question source with the canonical JSON bank.
- Added a machine-readable revision log for explicit source corrections and core-signature disambiguation.

## Content completion policy

The high-school and graduate specifications contain option-level score mappings but no university-style appendix of independently enumerated weight tables, and they omit per-label result/share copy. The compiler preserves the option-level mappings, derives option dimensions from those mappings, and supplies missing copy from each tag's source short description and portrait. The revision log records this source gap and every core rule change.

## Verification

Run from the workspace root:

```powershell
node scripts/compile-question-banks.mjs
node scripts/validate-question-banks.mjs
cd campus_persona
npm run build:bank
npm test
```

Expected: all three banks pass, generated public data omits scores and core selections, and existing algorithm regressions remain green.
