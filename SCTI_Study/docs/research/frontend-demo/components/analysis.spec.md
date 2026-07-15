# Analysis Screen Native Contract

## Overview

The analysis screen is the centered transient state shown after complete-answer validation while the result request runs. It maps source `analysis` / `.analysis-page` to native `analysis` / `.center-screen`.

## Source DOM Structure

```html
<section class="page analysis-page">
  <div class="analysis-orbit">✦</div><p class="section-label">quiz label · answers received</p>
  <h1 class="hero-title">正在整理你的<br><span class="scribble">校园轨迹</span></h1>
  <p class="hero-subtitle">main-label and four-dimension note</p>
  <div class="analysis-steps"><span>✓ question complete</span><span>✓ server calculation</span><span>· generating result</span></div>
</section>
```

## Native WXML Structure

```xml
<view class="center-screen page analysis-screen">
  <view class="analysis-orbit"><text>✦</text></view><text class="section-label">{{activeVersion.quiz_label}} · 答案已收到</text>
  <view class="hero-title"><text class="title-line">正在整理你的</text><text class="title-line scribble">校园轨迹</text></view>
  <text class="hero-subtitle">主标签与四维计算不包含最后一道自我认知题</text>
  <view class="analysis-steps"><text>✓ 题目完成</text><text>✓ 服务端计算</text><text>· 生成结果</text></view>
</view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- The page has `700px -> 1346.15rpx` minimum height; `.analysis-page` centers children horizontally and vertically with centered text.
- Orbit: `92px -> 176.92rpx` square, `28px -> 53.85rpx` bottom margin, `4px -> 7.69rpx` ink border, asymmetric `42% 58% 55% 45%` radius, `var(--version-accent-light)` background, and `44px -> 84.62rpx` glyph.
- Orbit animation is `1.4s ease-in-out infinite`: rotation `-8deg` to `8deg`, with mid-point upward translation `-7px -> -13.46rpx`.
- Section label has `10px -> 19.23rpx` bottom margin, muted color, `12px -> 23.08rpx` size, and weight 700. Hero title is `34px -> 65.38rpx`, `1.13` line-height, and `-.06em` spacing; scribble color is `#5b8c7a` with `-4deg` rotation. Subtitle has `12px -> 23.08rpx` top margin, muted color, `13px -> 25rpx` size, and `1.7` line-height.
- Steps use `32px -> 61.54rpx` top margin, full width, `10px -> 19.23rpx` gap, muted `12px -> 23.08rpx` text. Each step has `10px 15px -> 19.23rpx 28.85rpx` padding, pill radius, and white fill.

## WXSS Mapping

Apply a flex column with `align-items: center; justify-content: center; text-align: center`. Set `.title-line { display: block; }` so `正在整理你的` and the scribble `校园轨迹` retain the source `<br>` line break. Use `176.92rpx` for the orbit dimensions and retain its percentage radius and animation degrees. If native animation support differs, preserve the 1.4 s bob/rotate rhythm; it is decorative and must not block submission or navigation.

## States and Behaviors

Enter this state only after every answer validates and the submission operation starts. Invalidate any pending quiz continuation before entry. While submission is active, prevent duplicate submits. A current successful response enters `result` and clears progress; an error returns to `quiz` with persisted answers and recoverable feedback. Ignore a response whose version/bank operation token is stale.

## Data Bindings

Only `activeVersion.quiz_label` is dynamic in visible analysis content. `submitting` determines whether this state can be entered and prevents duplicate requests. Result data is not rendered here.

## Assets

No external assets. Use the `✦` text glyph, source palette, border, and animated native view.

## Text Content

Fixed copy is `答案已收到`, `正在整理你的`, `校园轨迹`, `主标签与四维计算不包含最后一道自我认知题`, `题目完成`, `服务端计算`, and `生成结果`.

## Mobile Responsive Behavior

The centered layout fills the native content area at the 390 px reference width and remains vertically centered after safe-area insets. The full-width steps use page horizontal padding and wrap their text only if localization requires it; no desktop phone shell is ported.
