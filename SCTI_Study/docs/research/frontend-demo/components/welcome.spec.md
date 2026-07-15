# Welcome Screen Native Contract

## Overview

The welcome screen introduces the active campus-test version, presents a hand-drawn campus illustration, and moves to identity selection. It maps source `welcome` / `.welcome-page` to native `welcome` / `.welcome-screen`.

## Source DOM Structure

```html
<section class="page welcome-page">
  <div>
    <div class="welcome-top"><div class="brand-mark"><span class="brand-icon">✦</span>…</div><span class="mini-version">…</span></div>
    <div class="welcome-copy"><p class="section-label">…</p><h1 class="hero-title">…<span class="scribble">…</span></h1><p class="hero-subtitle">…</p></div>
    <div class="campus-art">sparkles, tree, ground, and three student figures</div>
    <div class="hero-card"><h2>…</h2><p>…</p><div class="meta-row"><span class="meta-pill">…</span></div></div>
  </div>
  <button class="primary-button full-width" data-action="go-identity">…</button>
</section>
```

## Native WXML Structure

```xml
<view class="welcome-screen page">
  <view>
    <view class="welcome-top"><view class="brand-mark"><text class="brand-icon">✦</text><text>校园人设实验室</text></view><text class="mini-version">{{versionTitles}}</text></view>
    <view class="welcome-copy"><text class="section-label">{{activeVersion.welcome_label}}</text><view class="hero-title">测试你是哪种<text class="scribble">校园人设</text></view><text class="hero-subtitle">{{activeVersion.welcome_copy}}</text></view>
    <view class="campus-art" aria-hidden="true">
      <text class="art-spark spark-one">✦</text><text class="art-spark spark-two">✦</text>
      <view class="art-tree"><view class="art-trunk" /></view><view class="art-ground" />
      <view class="student student-one"><view class="student-head">☁</view><view class="student-body" /></view>
      <view class="student student-two"><view class="student-head">♟</view><view class="student-body" /></view>
      <view class="student student-three"><view class="student-head">◒</view><view class="student-body" /></view>
    </view>
    <view class="hero-card"><text class="hero-card-title">{{activeVersion.title}} · V{{activeVersion.bank_version}}</text><text class="hero-card-copy">可在 {{versionTitles}} 中选择当前校园阶段。</text><view class="meta-row"><text class="meta-pill">{{enabledVersions.length}} 个版本可选</text><text class="meta-pill">约 3 分钟</text><text class="meta-pill">没有标准答案</text></view></view>
  </view>
  <button class="primary-button full-width" bindtap="goIdentity">选择身份并开始 <text>→</text></button>
</view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- Global paper `#fffdf3`; ink `#171717`; muted `#77756f`; white `#ffffff`; mint `#82ebc6`; mint-light `#e7ffe9`; yellow `#fff1a6`; pink `#ffd6df`; blue `#cdeeff`; purple `#e7d8ff`; soft shadow `0 8px 0 rgba(23, 23, 23, 0.08)`.
- Page minimum height: `700px -> 1346.15rpx`; `page-in` is `0.24s ease-out` from `translateY(8px -> 15.38rpx)`.
- Welcome copy top margin: `42px -> 80.77rpx`; title size: `42px -> 80.77rpx`; subtitle top margin: `12px -> 23.08rpx`, size `13px -> 25rpx`, line-height `1.7`.
- Brand icon: `28px -> 53.85rpx` square, `3px -> 5.77rpx` border, `10px 10px 10px 2px -> 19.23rpx 19.23rpx 19.23rpx 3.85rpx` radius, rotated `-8deg`; brand gap `8px -> 15.38rpx`; brand size `14px -> 26.92rpx`.
- Campus art: height `270px -> 519.23rpx`; margins `22px -8px 8px -> 42.31rpx -15.38rpx 15.38rpx`. Ground is `290px x 55px -> 557.69rpx x 105.77rpx` with `4px -> 7.69rpx` border; tree is `52px x 130px -> 100rpx x 250rpx` with the same border; heads are `60px -> 115.38rpx`, bodies `66px x 88px -> 126.92rpx x 169.23rpx`.
- Campus-art positional rules: use `position: relative`. Ground is absolute at `bottom: 20px -> 38.46rpx; left: 16px -> 30.77rpx`, rotated `-3deg`. Tree is absolute at `right: 20px -> 38.46rpx; bottom: 65px -> 125rpx`, rotated `8deg`; its trunk is absolute at `bottom: -48px -> -92.31rpx; left: 17px -> 32.69rpx`, `13px x 52px -> 25rpx x 100rpx`, with a `4px -> 7.69rpx` border, no top border, and `#d79f72` fill. All students are absolute and bottom-aligned at `59px -> 113.46rpx`; student one is `left: 39px -> 75rpx` and rotated `-5deg`, student two is `left: 122px -> 234.62rpx; bottom: 51px -> 98.08rpx` and rotated `2deg`, and student three is `left: 207px -> 398.08rpx` and rotated `7deg`. Sparkles are absolute: first `top: 35px -> 67.31rpx; left: 48px -> 92.31rpx; rotate(-16deg)`, second `top: 80px -> 153.85rpx; right: 76px -> 146.15rpx`; both use `28px -> 53.85rpx` `#d7a400` text.
- Hero card: `22px -> 42.31rpx` padding, `4px -> 7.69rpx` border, `28px -> 53.85rpx` radius, soft shadow. Card title `23px -> 44.23rpx`; supporting copy `12px -> 23.08rpx` with `6px -> 11.54rpx` top margin.
- Meta row: `18px -> 34.62rpx` top margin and `8px -> 15.38rpx` gap. Pills use `7px 10px -> 13.46rpx 19.23rpx` padding and `10px -> 19.23rpx` text.
- Primary action: minimum height `54px -> 103.85rpx`, horizontal padding `22px -> 42.31rpx`, `3px -> 5.77rpx` border, pill radius, `0 5px 0 #171717 -> 0 9.62rpx 0 #171717` shadow. Pressed state translates `3px -> 5.77rpx` and uses `0 2px 0 -> 0 3.85rpx 0` shadow.

## WXSS Mapping

Use `background: #fffdf3; color: #171717; font-family: "PingFang SC", "Microsoft YaHei", sans-serif`. Apply `min-height: 1346.15rpx; display: flex; flex-direction: column; justify-content: space-between` to `.welcome-screen`. Apply the named positional rules above to `.campus-art`, `.art-ground`, `.art-tree`, `.art-trunk`, `.student-one`, `.student-two`, `.student-three`, `.spark-one`, and `.spark-two`; assign `#cdeeff`, `#ffd6df`, and `#e7d8ff` to the first, second, and third student bodies respectively. Map all geometric values above to rpx, keep color values literal, and retain `line-height` and degree values unchanged.

## States and Behaviors

`goIdentity` changes the native state to `identity`. The welcome screen is available after registry initialization and after the header close action. It uses the active version without loading or changing the bank. Version changes, restart, unload, and submit invalidate any pending quiz continuation as specified in the behavior contract.

## Data Bindings

`activeVersion` provides `welcome_label`, `welcome_copy`, `title`, and `bank_version`; `enabledVersions` supplies `versionTitles` and its length. The three meta pills have one dynamic count and two fixed strings. No question, answer, result, or share data is read here.

## Assets

No image file is used. The source uses text glyphs (`✦`, `☁`, `♟`, and `◒`), CSS color fills, borders, and pseudo-element-like shapes. Native WXML uses `<text>` glyphs and nested `<view>` shapes.

## Text Content

Fixed copy is `校园人设实验室`, `测试你是哪种`, `校园人设`, `可在 {{versionTitles}} 中选择当前校园阶段。`, `约 3 分钟`, `没有标准答案`, and `选择身份并开始`. Version-specific welcome label, welcome copy, title, and version list are dynamic.

## Mobile Responsive Behavior

The source reference canvas is 390 px wide. Port its interior geometry proportionally using rpx, allow the page to scroll vertically, and keep the primary action at the lower end of the content flow. Do not port the desktop 850 px or 440 px prototype-shell media queries, phone frame, status bar, or home indicator; safe-area handling belongs to the native page shell.
