# Frontend Demo Behavior Contract

## Required answer-continuation rules

- First unanswered option tap: selected immediately, persist, guarded 280 ms auto-advance.
- First unanswered Q20 option tap: selected immediately, persist, guarded 280 ms submit.
- Previous: cancel pending continuation, enter review mode, decrement one question.
- Review option tap: persist without auto-advance.
- Review Next: advance manually; switch to auto at the first unanswered question.
- Version/restart/unload/submit: invalidate pending continuation.

## Native continuation model

Maintain `pendingContinuation` with the scheduled question index and a runtime/version token, plus `reviewMode`. On a first answer in auto mode, save the selected option and schedule exactly one guarded 280 ms continuation. It may advance only when the active screen is `quiz`, the current question is still the scheduled question, the runtime token is current, and the continuation remains valid.

`Previous` cancels the timer before moving back. Any tap that changes version, restarts, unloads the page, or starts submission invalidates the token and clears the timer. This prevents an old continuation from moving a newly selected, restored, or restarted quiz.

When a user returns to an answered question, `reviewMode` is true. Selecting an option writes the answer and persists it but does not schedule a continuation. `Review Next` moves forward one question. On reaching the first unanswered question, clear `reviewMode`; the next first-answer tap resumes the normal automatic continuation.

## Submission and navigation rules

- Persist progress after every selected option and after manual question navigation, keyed by active version and bank version.
- `Next` does nothing for an unanswered current question. On the final answered question it submits; otherwise it advances one question.
- Submission validates every answer before entering `analysis`. If an answer is missing, return to that question and show the recoverable quiz error.
- Q20 is mandatory and must be the `self_perception_only` question with exactly 16 choices. Its option IDs are exactly `A` through `P`; the selected answer must be one of those 16 positions before Q20 can schedule the guarded submit.
- While a submit is in flight, do not start another submit. A stale response cannot change the active version, bank, progress, or result state.
- A successful submit clears saved progress for its version/bank and enters `result`; a failed submit returns to `quiz`, keeps progress, and exposes retry when all answers exist.
- Native share is attempted from a complete result. If it is unavailable, rejected, or share-recording feedback is needed, show the result share fallback surface; closing it changes no quiz or result data.

## Source parity notes

The source demo protects delayed actions with its operation token and `shouldAutoAdvance(screen, currentIndex, scheduledIndex)`. The native contract adds explicit timer cancellation and review-mode vocabulary so Tasks 4 and 5 can make the same user-visible behavior deterministic across page lifecycle events.
