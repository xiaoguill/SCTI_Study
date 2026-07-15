# Result Screen Native Contract

## Overview

The result screen presents a complete server result, its four dimensions, self-perception, eggs, share copy, and share/restart actions. It maps source `result` / `.result-page` to native `result` / `.result-screen`.

## Source DOM Structure

```html
<section class="page result-page">
  <div class="mini-header">quiz back, completion brand, welcome close</div><p class="result-kicker">…</p>
  <div class="result-hero"><div class="result-avatar">version icon</div><h2>tag name</h2><p>short description</p><div class="tags"><span class="tag">keyword</span></div></div>
  <div class="result-section">three full-description paragraphs</div><div class="result-section">dimension bars and optional match method</div>
  <div class="result-section">self-perception</div><div class="result-section">egg rows</div><div class="result-section share-copy-section">share copy</div>
  <div class="result-actions">share primary button, restart secondary button</div>
</section>
```

## Native WXML Structure

```xml
<scroll-view class="result-screen page" scroll-y>
  <view class="mini-header"><button class="back-button" bindtap="goQuiz">←</button><text class="mini-brand">{{activeVersion.title}} · 测试完成</text><button class="icon-button" bindtap="goWelcome">×</button></view><text class="result-kicker">✦ 你的校园隐藏人设是</text>
  <view class="result-hero"><text class="result-sparkle">✦</text><view class="result-avatar">{{activeVersion.icon}}</view><text class="result-name">{{result.tag_name}}</text><text class="result-short-desc">{{result.tag_short_desc}}</text><view class="tags"><text wx:for="{{result.keywords}}" wx:key="*this" class="tag">{{item}}</text></view></view>
  <view class="result-section"><text class="section-heading">完整人设解读</text><text wx:for="{{descriptionParagraphs}}" wx:key="*this" class="result-paragraph">{{item}}</text></view>
  <view class="result-section"><text class="section-heading">你的四维度轨迹</text><view class="dimension-bars"><view wx:for="{{dimensions}}" wx:key="label" class="dimension-row"><text>{{item.label}}</text><view class="dimension-track"><view class="dimension-value" style="width: {{item.width}}%" /></view><text>{{item.value}}</text></view></view><text wx:if="{{result.match_method}}" class="match-method">{{result.match_method}}</text></view>
  <view class="result-section"><text class="section-heading">你的直觉自我认知</text><text>{{result.self_perception.text}}</text><text class="match-method">Q{{result.self_perception.qid}} · 不参与主标签和四维计算</text></view>
  <view class="result-section"><text class="section-heading">趣味彩蛋</text><view wx:for="{{result.easter_eggs}}" wx:key="qid" class="egg-row"><text>{{item.qid}} · 趣味彩蛋</text><text>{{item.value}}</text></view></view><view class="result-section share-copy-section"><text class="section-heading">分享文案</text><text>{{result.share_copy}}</text></view>
  <view class="result-actions"><button class="primary-button full-width" bindtap="shareResult">分享我的校园人设</button><button class="secondary-button" bindtap="restart">重新测试</button></view>
</scroll-view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- Result page bottom padding is `12px -> 23.08rpx`. Kicker uses `11px -> 21.15rpx`, weight 800, letter spacing `.16em`, and `#5b8c7a`.
- Hero: `6px -> 11.54rpx` top margin, `23px -> 44.23rpx` padding, `4px -> 7.69rpx` ink border, `30px -> 57.69rpx` radius, `var(--version-accent-light)` fill, and `0 8px 0 rgba(23,23,23,.08) -> 0 15.38rpx 0 rgba(23,23,23,.08)` shadow. Decorative sparkle sits `16px -> 30.77rpx` from top and `20px -> 38.46rpx` from right at `30px -> 57.69rpx` size.
- Avatar: `100px -> 192.31rpx` square, margins `4px auto 18px -> 7.69rpx auto 34.62rpx`, `4px -> 7.69rpx` border, `50% 45% 52% 46%` radius, mint fill, `48px -> 92.31rpx` glyph, rotated `-6deg`. Hero name is `28px -> 53.85rpx`; short description has `8px -> 15.38rpx` top margin, muted `11px -> 21.15rpx` text, and `1.6` line-height.
- Tags: `16px -> 30.77rpx` top margin, `7px -> 13.46rpx` gap. Each tag has `7px 10px -> 13.46rpx 19.23rpx` padding, `2px -> 3.85rpx` border, pill radius, white fill, `10px -> 19.23rpx` text, weight 800.
- Result section: `18px -> 34.62rpx` top margin, `16px -> 30.77rpx` padding, `2px -> 3.85rpx` `#e8e1cf` border, `22px -> 42.31rpx` radius, `rgba(255,255,255,.78)` fill. Heading is `14px -> 26.92rpx` with `8px -> 15.38rpx` bottom margin. Paragraphs are muted `11px -> 21.15rpx`, `1.7` line-height, with `8px -> 15.38rpx` spacing. Share-copy section changes border to `var(--version-accent)` and fill to `var(--version-accent-light)`.
- Match method has `13px -> 25rpx` top margin and `10px -> 19.23rpx` muted text. Egg row has `12px -> 23.08rpx` gap, `9px -> 17.31rpx` vertical padding, `1px -> 1.92rpx` dashed `#e8e1cf` bottom border, and `10px -> 19.23rpx` text.
- Dimension bars: `13px -> 25rpx` top margin, `10px -> 19.23rpx` gap. Row columns are `55px 1fr 28px -> 105.77rpx 1fr 53.85rpx` with `8px -> 15.38rpx` gap and `10px -> 19.23rpx` text. Track height `8px -> 15.38rpx`, pill radius, `#ece6dc` fill; value uses `var(--version-accent)`.
- Actions: `20px -> 38.46rpx` top margin and `10px -> 19.23rpx` gap. Secondary action has `46px -> 88.46rpx` minimum height, `3px -> 5.77rpx` border, pill radius, white fill, and `12px -> 23.08rpx` weight-900 text. The primary action keeps the documented `54px -> 103.85rpx` height and source primary styling.

## WXSS Mapping

Use a vertically scrollable result root. Preserve the white paper/card hierarchy, 4 px major hero border, 28 px-class large rounding (the result hero is 30 px), and 8 px soft shadow in rpx. Set `.result-hero { position: relative; overflow: hidden; }` and `.result-sparkle { position: absolute; top: 30.77rpx; right: 38.46rpx; color: var(--version-accent); font-size: 57.69rpx; }` so the explicit WXML sparkle reproduces the source pseudo-element. Build each dimension width from `value / 5 * 100`, clamped to 0–100. Keep the egg rows and result sections in source order.

## States and Behaviors

Render only after complete result validation: nonempty tag fields and keywords, three description paragraphs, four finite 1–5 dimensions, valid eggs, and Q20 self-perception. `goQuiz` returns to a loaded quiz; `goWelcome` changes screen only. `restart` clears saved progress and result state, invalidates continuation, and enters identity. `shareResult` starts the native-share/fallback contract without mutating the result.

## Data Bindings

`activeVersion.title` and `activeVersion.icon` feed the header and avatar. `result` supplies `tag_name`, `tag_short_desc`, `keywords`, `tag_full_desc.paragraph_1` through `paragraph_3`, `dimensions.labels`, `dimensions.user_vector`, optional `match_method`, `self_perception`, `easter_eggs`, and `share_copy`. Bind `dimensions` as label/value/percentage view models, not raw unbounded style strings.

## Assets

No images. The avatar is the active version glyph; the sparkle is `✦`; all other decoration is border, color, radius, and native layout.

## Text Content

Fixed headings are `测试完成`, `你的校园隐藏人设是`, `完整人设解读`, `你的四维度轨迹`, `你的直觉自我认知`, `不参与主标签和四维计算`, `趣味彩蛋`, `分享文案`, `分享我的校园人设`, and `重新测试`. Result-specific narrative is server data.

## Mobile Responsive Behavior

At 390 px, all cards and actions use the available page width and scroll vertically. Keep the dimension label/value columns fixed at `105.77rpx` and `53.85rpx`, leaving the track flexible. Long tag names, keywords, egg values, and server copy wrap inside their cards; they must not overflow horizontally.
