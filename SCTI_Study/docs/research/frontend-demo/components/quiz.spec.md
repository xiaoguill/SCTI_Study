# Quiz Screen Native Contract

## Overview

The quiz screen renders one bank question, answer options, progress, recoverable submission feedback, and manual navigation. It maps source `quiz` / `.quiz-page` to native `quiz` / `.quiz-screen`.

## Source DOM Structure

```html
<section class="page quiz-page">
  <div class="mini-header">identity back, quiz label, welcome close</div>
  <div class="quiz-topline"><span class="quiz-count">…</span><span class="quiz-percent">…</span></div>
  <div class="progress-track"><div class="progress-value" style="width:…"></div></div>
  <p class="question-kicker">emoji and effect label</p><div class="question-card"><h2>question.text</h2><p>question hint</p></div>
  <div class="quiz-error">optional error and retry button</div>
  <div class="options-list"><button class="option-button is-selected">letter and option text</button></div>
  <div class="quiz-footer"><button class="text-button">previous</button><button class="primary-button mini-next">next or result</button></div>
</section>
```

## Native WXML Structure

```xml
<view class="quiz-screen page">
  <view class="mini-header"><button class="back-button" bindtap="goIdentity">←</button><text class="mini-brand">{{activeVersion.quiz_label}}</text><button class="icon-button" bindtap="goWelcome">×</button></view>
  <view class="quiz-topline"><text class="quiz-count">第 {{questionIndex + 1}} 题 / 共 {{bank.questions.length}} 题</text><text class="quiz-percent">{{progress}}%</text></view><view class="progress-track"><view class="progress-value" style="width: {{progress}}%" /></view>
  <text class="question-kicker">{{currentQuestion.emoji_type || '✦'}} {{questionKicker}}</text><view class="question-card"><text class="question-title">{{currentQuestion.text}}</text><text class="question-hint">{{questionHint}}</text></view>
  <view wx:if="{{error}}" class="quiz-error" role="alert"><text>{{error}}</text><button wx:if="{{canRetry}}" class="retry-button" bindtap="retryResult">重新生成结果</button></view>
  <view class="options-list"><button wx:for="{{currentQuestion.options}}" wx:key="id" class="option-button {{selectedOption === index ? 'is-selected' : ''}}" data-index="{{index}}" bindtap="selectOption"><text class="option-letter">{{letters[index]}}</text><text class="option-text">{{item.text}}</text></button></view>
  <view class="quiz-footer"><button class="text-button" disabled="{{questionIndex === 0}}" bindtap="previousQuestion">← 上一题</button><button class="primary-button mini-next" bindtap="nextQuestion">{{isLastQuestion ? '查看结果' : '下一题 →'}}</button></view>
</view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- Topline bottom margin `13px -> 25rpx`; count and percent size `12px -> 23.08rpx`, weight 900; percent color `#559079`.
- Progress track: height `12px -> 23.08rpx`, `2px -> 3.85rpx` border, pill radius, white background, `28px -> 53.85rpx` bottom margin. Its value inherits height/radius, uses `var(--version-accent)`, and has `width .25s ease` transition.
- Kicker bottom margin `12px -> 23.08rpx`, `12px -> 23.08rpx` size, weight 900, color `#559079`.
- Question card: `22px -> 42.31rpx` padding, `4px -> 7.69rpx` ink border, `28px -> 53.85rpx` radius, `var(--version-card)` fill, and `0 8px 0 rgba(23, 23, 23, .08) -> 0 15.38rpx 0 rgba(23, 23, 23, .08)` shadow. Title is `24px -> 46.15rpx`, line-height `1.35`, letter spacing `-.04em`; hint has `13px -> 25rpx` top margin, `11px -> 21.15rpx` size, and `#7d7240` color.
- Error: margins `16px 0 0 -> 30.77rpx 0 0`, padding `10px 12px -> 19.23rpx 23.08rpx`, `2px -> 3.85rpx` `#b24c4c` border, `14px -> 26.92rpx` radius, `#fff0f0` background, `#8f3030` text, `12px -> 23.08rpx` size. Retry uses `9px -> 17.31rpx` top margin, `6px 10px -> 11.54rpx 19.23rpx` padding, and `11px -> 21.15rpx` text.
- Options list: `20px -> 38.46rpx` top margin, `12px -> 23.08rpx` gap. Option: minimum height `60px -> 115.38rpx`, padding `10px 13px -> 19.23rpx 25rpx`, `3px -> 5.77rpx` `#74cda9` border, `20px -> 38.46rpx` radius, `#e7ffe9` fill, columns `28px 1fr -> 53.85rpx 1fr`, and `11px -> 21.15rpx` gap.
- Selected option changes border to `#171717`, fill to `var(--version-accent)`, and shifts right `3px -> 5.77rpx`. Letter circle is `28px -> 53.85rpx` with mint fill and `12px -> 23.08rpx` text; selected letter uses ink fill and white text. Option copy is `12px -> 23.08rpx`, weight 700, line-height `1.45`.
- Footer has `auto` top margin and `28px -> 53.85rpx` top padding. Previous text button has `8px 0 -> 15.38rpx 0` padding, `12px -> 23.08rpx` text, muted color, and disabled opacity `.35`. Next button has `42px -> 80.77rpx` minimum height, `18px -> 34.62rpx` horizontal padding, and `12px -> 23.08rpx` text plus the shared primary-button border, radius, mint, and shadow.

## WXSS Mapping

Use the source header mapping from identity. Use native press feedback in place of desktop option hover, but retain the selected `translateX(5.77rpx)` and color change. The footer sits at the end of the flex column when the viewport permits; on smaller heights it follows the option list in normal scroll flow. Use literal source colors and rpx conversions above; retain percentage progress width as a percentage.

## States and Behaviors

On the first unanswered option, update selection and persistence immediately, then schedule the guarded 280 ms advance; on Q20 schedule guarded submit. In review mode, option selection persists without scheduling. Previous cancels the continuation, decrements one question, and enters review. Next requires a current answer, manually advances unless final, and clears review at the first unanswered question. The header identity/welcome actions, version changes, restart, unload, and submission invalidate a pending continuation.

Q20 validation is mandatory before rendering its submit path and before result submission: the bank must expose Q20 as `self_perception_only` with exactly 16 choices, whose option IDs are exactly `A` through `P`. The selected Q20 answer must resolve to one of those 16 choices; an absent, out-of-range, or non-`A`–`P` choice is invalid and must keep the user in `quiz` with recoverable feedback rather than enter `analysis`.

## Data Bindings

`bank.questions`, `questionIndex`, and `currentQuestion` provide question ID, text, options, effect, and emoji. `answers[currentQuestion.id]` provides `selectedOption`; `progress = round((questionIndex + 1) / bank.questions.length * 100)`; `isLastQuestion` is the final index. `q20OptionIds` is the exact ordered set `A` through `P`, and `q20Valid` requires Q20's `self_perception_only` effect, exactly 16 options, those IDs, and an in-range selected option. `questionHint` and `questionKicker` derive from `result_effect`; `error` and `canRetry` control feedback. `activeVersion.quiz_label` is the header label.

## Assets

No image files are used. The only visual asset-like values are the bank-supplied emoji type and built-in option letters A onward. Native code derives the letter by option index.

## Text Content

Fixed text is `第`, `题 / 共`, `题`, `上一题`, `下一题`, `查看结果`, and `重新生成结果`. Question copy, option copy, emoji, quiz label, effect label, hint, and errors are dynamic. The self-perception hint states that the final self-perception answer does not participate in the main label or four-dimension calculation.

## Mobile Responsive Behavior

The 390 px reference keeps the options full width and the two-column option interior at `53.85rpx 1fr`. Long option text wraps inside the text column while preserving its letter circle. Page scroll must keep all options and the footer reachable; never horizontally scroll the question card or options.
