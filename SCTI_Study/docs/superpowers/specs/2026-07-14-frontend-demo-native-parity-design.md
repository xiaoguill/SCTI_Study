# Frontend Demo to Native Mini Program Parity Design

## Goal

Port the visual structure and interaction quality of `frontend-demo` into the existing native WeChat Mini Program without changing canonical question banks, private scoring, version selection, or result semantics.

The native client remains one data-driven page for high school, university, and graduate versions. The browser demo is the visual and interaction reference; root generated data remains the content source of truth.

## Chosen Approach

Use a native WXML/WXSS parity port. Extract the browser demo's phone-canvas topology, design tokens, component structure, responsive measurements, and state transitions, then reproduce them with native Mini Program components.

Rejected alternatives:

- A `web-view` wrapper would be visually exact but would require a hosted HTTPS domain, weaken native sharing, and prevent the requested offline-local workflow.
- Small style adjustments to the current native page would be faster but would preserve structural drift and require repeated visual patching.

The Next.js-specific `ai-website-cloner sync` command will not be run because this is an existing native Mini Program, not a Next.js scaffold. The skill's extraction, component-specification, interaction-sweep, and visual-QA rules will be applied directly to WXML/WXSS.

## Scope

In scope:

- Welcome, identity, loading, quiz, analysis, result, and sharing states.
- Browser-demo typography, spacing, colors, borders, shadows, card proportions, and motion adapted to native `rpx` units.
- First-answer auto-advance and review-mode manual navigation.
- Local result-service health and actionable error messages.
- A configurable result-character image slot driven by public result presentation configuration.
- Visual comparison in WeChat DevTools at the mobile simulator size.

Out of scope:

- Question-bank, scoring, Q20, tag, or dimension algorithm changes.
- Generating the final set of 16 or 48 character illustrations in this implementation.
- CloudBase deployment or production domain configuration.
- Embedding the browser demo through `web-view`.

## Source of Truth and Data Boundaries

- Canonical questions and private scoring remain under root `data/`.
- The existing build pipeline continues to generate `miniprogram/data/runtime.js` with public question data only.
- Native WXML contains no hard-coded question or tag content.
- Visual tokens shared by all versions live in native WXSS; version theme values continue to come from the generated registry.
- Result-character presentation uses a generated public map keyed by stable `tag_id`. It may contain image paths and decorative presentation fields, but never private scores, target vectors, core-question mappings, or ranking data.

## Clone Extraction Artifacts

Before changing native components, create auditable extraction files:

- `docs/research/frontend-demo/PAGE_TOPOLOGY.md`
- `docs/research/frontend-demo/BEHAVIORS.md`
- `docs/research/frontend-demo/components/welcome.spec.md`
- `docs/research/frontend-demo/components/identity.spec.md`
- `docs/research/frontend-demo/components/quiz.spec.md`
- `docs/research/frontend-demo/components/analysis.spec.md`
- `docs/research/frontend-demo/components/result.spec.md`
- `docs/research/frontend-demo/components/share.spec.md`

Each component specification records its native target, hierarchy, exact source CSS values, WXML/WXSS mapping, interaction states, text/data bindings, and mobile responsive behavior. The browser demo's desktop explanatory column and outer phone frame are reference tooling and are not copied into the Mini Program.

## Native Page Architecture

Keep the existing one-page state machine and separate responsibilities:

- `controller.js`: pure state transitions and operation guards.
- `index.js`: Mini Program lifecycle, timers, persistence, service calls, and view-model mapping.
- `index.wxml`: state-specific native structure driven only by view data.
- `index.wxss`: parity tokens and component styling.
- `quiz-service.js`: local/CloudBase transport selection and health checks.

No new page is needed. The state names remain compatible with the current flow so transport and result validation do not need architectural changes.

## Quiz Interaction Model

The page tracks a navigation mode:

- `auto`: the user is answering a question for the first time.
- `review`: the user navigated backward into already answered questions.

### First-time answering

For Q1-Q19:

1. The user taps an option.
2. The selected card renders immediately.
3. The answer and progress are persisted.
4. After 280 ms, the page advances if the page generation, version, bank version, question index, and answer still match the captured operation.
5. The next question scrolls to its top.

For Q20, the same guarded 280 ms delay calls the existing submission flow instead of incrementing the question index.

### Review navigation

- Tapping Previous cancels any pending auto-advance timer and enters `review` mode.
- Changing an answer on an already answered review page never auto-advances.
- Previous and Next remain available for explicit paging in review mode.
- When Next reaches the first unanswered question, navigation mode returns to `auto`.
- If all later questions were already answered, manual review remains active through Q20; the explicit result action submits.
- Version changes, page unload, restart, submission, and leaving the quiz invalidate pending timers.

This reproduces the browser demo's fast initial flow without preventing deliberate answer review.

## Quiz Layout Behavior

- The question header, progress bar, observation label, question card, and options follow the browser demo hierarchy.
- Initial answer mode does not rely on a below-the-fold Next button.
- Review mode shows Previous and Next as a stable navigation bar.
- Q20 keeps sixteen vertically scrollable choices and its self-perception-only explanation.
- Entering a new question resets the native page scroll position to the question top.
- Error cards appear without permanently shifting navigation out of reach.

## Local Result Service

Local mode still submits only version, bank version, answers, and allowed metadata to `http://127.0.0.1:4175/api/submit-quiz`.

Add a lightweight health route and service method so the native welcome/identity flow can show:

- Local service connected.
- Local service not running: run `frontend-demo\\npm start`.
- Localhost request blocked by WeChat DevTools: disable legal-domain validation for local development only.

The application cannot start a computer-side process itself. `urlCheck` remains a user-controlled DevTools security setting. Production and physical-device tests use CloudBase and never fall back to localhost.

## Result and Character Presentation

The result page adopts the browser demo's hero/card hierarchy and adds a configurable character area above the persona title.

The presentation model supports:

```json
{
  "character_image": "/assets/personas/example-tag-id.webp",
  "character_alt": "校园人设角色",
  "character_position": "center bottom",
  "decorations": []
}
```

Missing images fall back to the existing version icon without breaking the result. The image path is configuration, not a WXML branch. Web and native clients can consume the same generated public mapping. The actual illustration generation is a separate content task after the final 16-versus-48 character scope is approved.

## Error Handling and Stale Operations

- Auto-advance timers are guarded by generation, version, bank version, question index, and selected answer.
- Selecting a different version or leaving the quiz invalidates all pending continuations.
- Result submission failure returns to the same answered Q20 with retry controls intact.
- A blocked localhost request is never described as a scoring failure.
- Cloud mode errors remain cloud errors and never trigger localhost fallback.
- Missing character assets affect only illustration rendering, not result content.

## Testing Strategy

Use test-driven development for each behavior change.

Automated tests cover:

- First-time Q1-Q19 answers schedule one 280 ms guarded advance.
- Q20 schedules submission instead of changing persona inputs.
- Previous cancels a pending advance and enters review mode.
- Review answer changes do not auto-advance.
- Next returns to auto mode on the first unanswered question.
- Stale timers cannot skip questions or cross versions.
- Local service health distinguishes unavailable and DevTools-blocked errors where the platform supplies enough evidence.
- Character presentation resolves by `tag_id` and has a safe fallback.
- All three banks still expose 20 questions with sixteen Q20 options.

Manual DevTools acceptance covers:

- Side-by-side state comparison with `frontend-demo` at a mobile-sized viewport.
- Three identity themes and complete quiz flow.
- Initial auto-advance, backward review, manual forward paging, and resumed auto mode.
- Q20, analysis, result, configurable character slot, and share button.
- No compiler errors or unhandled console errors.

## Definition of Done

- Native mobile states materially match the browser demo's internal phone UI, excluding the desktop explanation and device frame.
- Initial answering does not require Next; review navigation remains fully controllable.
- Local service state is visible and recovery instructions identify the actual boundary failure.
- Result-character presentation is data-configurable and does not require page-code changes.
- Existing bank, algorithm, privacy, transport, result, and Q20 tests remain green.
- The reviewed implementation is synchronized to `E:\\SCTI_Study` and compiles in the already-open WeChat DevTools project.
