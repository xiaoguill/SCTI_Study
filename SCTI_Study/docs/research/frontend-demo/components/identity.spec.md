# Identity Screen Native Contract

## Overview

The identity screen lists enabled registry versions, highlights the selected version, loads its bank on selection, then enters the quiz. It maps source `identity` / `.identity-page` to native `identity` / `.identity-screen`.

## Source DOM Structure

```html
<section class="page identity-page">
  <div class="mini-header">back button, brand, spacer</div>
  <p class="section-label">…</p><h1 class="hero-title">…</h1><p class="hero-subtitle">…</p>
  <div class="quiz-error">optional loading error</div>
  <div class="identity-list"><button class="identity-card is-selected">icon, name, description, checkmark</button></div>
  <div class="identity-tip">…</div>
  <button class="primary-button full-width">进入…测试 →</button>
</section>
```

## Native WXML Structure

```xml
<view class="identity-screen page">
  <view class="mini-header"><button class="back-button" bindtap="goWelcome">←</button><text class="mini-brand">校园人设实验室</text><view /></view>
  <text class="section-label">{{enabledVersions.length}} 个版本已开放</text><view class="hero-title">选择你的<text>校园阶段</text></view><text class="hero-subtitle">当前可选：{{versionTitles}}。选择后加载对应校园场景。</text>
  <view wx:if="{{error}}" class="quiz-error" role="alert">{{error}}</view>
  <view class="identity-list"><button wx:for="{{identityCards}}" wx:key="id" class="identity-card {{item.selected ? 'is-selected' : ''}}" data-version="{{item.id}}" bindtap="selectVersion"><text class="identity-icon">{{item.icon}}</text><view><text class="identity-name">{{item.identity_name}}</text><text class="identity-desc">{{item.identity_desc}}</text></view><text class="checkmark">{{item.selected ? '✓' : ''}}</text></button></view>
  <view class="identity-tip">☁ 选择后加载对应题库；各版本答案与进度独立保存。</view>
  <button class="primary-button full-width" data-version="{{activeVersion.id}}" bindtap="selectVersion">进入{{activeVersion.title}}测试 →</button>
</view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- Header: minimum height `30px -> 57.69rpx`, bottom margin `22px -> 42.31rpx`; back icon is `34px -> 65.38rpx` square with `2px -> 3.85rpx` border and circular radius; mini-brand is `12px -> 23.08rpx`, weight 800.
- Identity title size is `32px -> 61.54rpx`; section label is `12px -> 23.08rpx`, bottom margin `10px -> 19.23rpx`; subtitle is `13px -> 25rpx` with `12px -> 23.08rpx` top margin.
- List uses `30px -> 57.69rpx` top margin and `14px -> 26.92rpx` gap. Each card uses `15px -> 28.85rpx` padding, `3px -> 5.77rpx` ink border, `24px -> 46.15rpx` radius, and grid columns `52px 1fr 30px -> 100rpx 1fr 57.69rpx` with `12px -> 23.08rpx` gap.
- Hover/selected elevation is `translateY(-3px -> -5.77rpx)` with `0 5px 0 #171717 -> 0 9.62rpx 0 #171717` shadow. Selected card background is `var(--version-card)`.
- Identity icon is `52px -> 100rpx` square, `3px -> 5.77rpx` border, `18px -> 34.62rpx` radius, `28px -> 53.85rpx` glyph. First/second/third cards use `#ffd6df`, `#cdeeff`, and `#e7d8ff` icon fills.
- Name is `16px -> 30.77rpx`; description has `5px -> 9.62rpx` top margin and `11px -> 21.15rpx` size. Checkmark is `27px -> 51.92rpx`, `2px -> 3.85rpx` border, `13px -> 25rpx` glyph, opacity `.35` until selected.
- Tip has margins `auto 0 22px -> auto 0 42.31rpx`, padding `13px 15px -> 25rpx 28.85rpx`, `18px -> 34.62rpx` radius, `#e7ffe9` background, `#487462` text, `11px -> 21.15rpx` size, and `1.6` line-height.
- The shared primary button retains `54px -> 103.85rpx` minimum height, `3px -> 5.77rpx` border, pill radius, mint fill, and `0 5px -> 0 9.62rpx` ink shadow.

## WXSS Mapping

Use a column flex page so the tip consumes available vertical space (`margin-top: auto` equivalent). Recreate the three-column card grid with a flex row or grid where supported. Keep the source selected background token as the active version card color, keep `#171717` borders, and map all listed px dimensions to rpx. Native press feedback may replace desktop hover while preserving the selected elevation and checkmark opacity/fill states.

## States and Behaviors

`goWelcome` returns to `welcome`. `selectVersion` validates the selected enabled version, invalidates any pending continuation, sets `loading`, retrieves the matching bank, restores only matching version/bank progress, and enters `quiz`. A bank-version mismatch or load failure returns to `identity` with the visible error. The bottom primary action selects the already active version.

## Data Bindings

`identityCards` is the enabled registry list with `id`, `icon`, `identity_name`, `identity_desc`, and `selected`. `activeVersion.id` and `activeVersion.title` power the bottom action; `enabledVersions.length`, `versionTitles`, and `error` power the surrounding copy. The selected class must derive from `activeVersion.id`, never a copied question-bank value.

## Assets

No raster assets are required. Icons are registry glyphs; the three background colors are CSS values and must remain in the source order.

## Text Content

Fixed copy is `校园人设实验室`, `个版本已开放`, `选择你的`, `校园阶段`, `当前可选：`, `。选择后加载对应校园场景。`, `选择后加载对应题库；各版本答案与进度独立保存。`, and `进入{{activeVersion.title}}测试`. Card title and description are registry data.

## Mobile Responsive Behavior

At the 390 px reference width, cards are full width, preserve their 52 px source icon column as `100rpx`, and stack vertically with the source 14 px gap. Let longer registry descriptions wrap in the middle column without colliding with the fixed checkmark column. Native scroll and safe-area behavior replace the desktop phone-frame rules.
