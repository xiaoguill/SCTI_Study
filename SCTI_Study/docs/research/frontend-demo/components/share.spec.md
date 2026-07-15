# Share Fallback Native Contract

## Overview

The source share modal is a result-adjacent fallback, not a page root. Native first attempts WeChat sharing; when that is unavailable or feedback must remain visible, it exposes the same poster and feedback content from result share controls.

## Source DOM Structure

```html
<div id="share-modal" class="modal-backdrop" hidden>
  <div class="share-modal" role="dialog">
    <button class="modal-close" data-action="close-modal">×</button><span class="result-kicker">分享卡片预览</span>
    <div class="share-poster"><div class="poster-sparkle">✦</div><div class="poster-avatar">☁</div><span data-share-version>…</span><strong data-share-tag>…</strong><p data-share-copy>…</p><small data-share-hashtags>…</small><div class="poster-code">小程序码</div></div>
    <h2>生成我的校园人设卡</h2><p class="share-feedback" data-share-feedback hidden></p><p>Demo explanation</p><button class="primary-button full-width" data-action="close-modal">知道啦</button>
  </div>
</div>
```

## Native WXML Structure

```xml
<view wx:if="{{shareFallbackVisible}}" class="share-backdrop" bindtap="closeShareFallback">
  <view class="share-modal" catchtap="stopPropagation">
    <button class="modal-close" bindtap="closeShareFallback">×</button><text class="result-kicker">分享卡片预览</text>
    <view class="share-poster"><text class="poster-sparkle">✦</text><view class="poster-avatar">{{activeVersion.icon}}</view><text>{{shareSnapshot.versionTitle}}</text><text class="share-tag">{{shareSnapshot.tag_name}}</text><text class="share-copy">{{shareSnapshot.share_copy}}</text><text class="share-hashtags">#{{shareSnapshot.versionTitle}} #校园人设测试 #{{shareSnapshot.tag_name}}</text><view class="poster-code">小程序码</view></view>
    <text class="share-title">生成我的校园人设卡</text><text wx:if="{{shareFeedback}}" class="share-feedback">{{shareFeedback}}</text><text class="share-description">Demo 里先展示海报结构，正式版可替换为 Canvas 生成图片。</text><button class="primary-button full-width" bindtap="closeShareFallback">知道啦</button>
  </view>
</view>
```

## Exact Source CSS Values

Reference conversion is `1 px = 750 / 390 rpx = 1.9230769 rpx`.

- Backdrop is fixed inset 0, centered grid, `20px -> 38.46rpx` padding, `rgba(23,23,23,.5)` background, z-index 10. Hidden state has no display.
- Modal width is `min(360px, 100%) -> min(692.31rpx, 100%)`; padding `28px -> 53.85rpx`; `4px -> 7.69rpx` ink border; `30px -> 57.69rpx` radius; paper `#fffdf3` fill; `10px 10px 0 #171717 -> 19.23rpx 19.23rpx 0 #171717` shadow.
- Close button: top/right `13px -> 25rpx`, `30px -> 57.69rpx` square, `2px -> 3.85rpx` border, circular radius, white fill.
- Modal title: margins `20px 0 8px -> 38.46rpx 0 15.38rpx`, `22px -> 42.31rpx` size. Standard modal paragraph: margin `0 0 18px -> 0 0 34.62rpx`, muted `12px -> 23.08rpx` text, line-height `1.6`.
- Feedback: bottom margin `10px -> 19.23rpx`, padding `8px 10px -> 15.38rpx 19.23rpx`, `2px -> 3.85rpx` `#b24c4c` border, `12px -> 23.08rpx` radius, `#fff0f0` fill, `#8f3030` text.
- Poster: `20px -> 38.46rpx` padding, `3px -> 5.77rpx` border, `24px -> 46.15rpx` radius, `var(--version-accent-light)` fill, centered column layout, and `10px -> 19.23rpx` gap. Sparkle is top `10px -> 19.23rpx`, right `18px -> 34.62rpx`, accent color, `22px -> 42.31rpx` size.
- Poster avatar: `68px -> 130.77rpx` square, `3px -> 5.77rpx` border, circular radius, `30px -> 57.69rpx` glyph. Poster version is `11px -> 21.15rpx`; tag is `24px -> 46.15rpx`; poster copy and hashtags are `10px -> 19.23rpx` with `1.5` line-height; hashtags use `#875d67`.
- Poster code: `58px -> 111.54rpx` square, `2px -> 3.85rpx` border, `10px -> 19.23rpx` radius, white fill, `9px -> 17.31rpx` text. The closing primary button keeps its `54px -> 103.85rpx` height, 3 px border, pill radius, mint fill, and 5 px ink shadow conversion.

## WXSS Mapping

Use a native overlay/pop-up component or a conditional full-screen view. Its panel is capped at `692.31rpx` and uses the source paper, border, radius, and hard shadow. Map every listed geometric source value to rpx. A native share API does not need this visual surface on success; the fallback must remain scroll-safe on short devices.

## States and Behaviors

From result share controls, snapshot `record_id`, `tag_id`, `tag_name`, `share_copy`, active version ID/title, and bank version before asynchronous work. Attempt native WeChat sharing and share-recording under the current operation token. On stale operation, do nothing. On native success with no feedback, leave fallback hidden. On unavailable/rejected native share or failed record response, set feedback and show fallback. Close via backdrop, ×, or `知道啦`; closing affects only `shareFallbackVisible`.

## Data Bindings

`shareFallbackVisible` controls rendering. `shareSnapshot.versionTitle`, `shareSnapshot.tag_name`, and `shareSnapshot.share_copy` populate the poster; `activeVersion.icon` supplies its avatar. Derive hashtags exactly as `#{{shareSnapshot.versionTitle}} #校园人设测试 #{{shareSnapshot.tag_name}}`. `shareFeedback` is empty when hidden and contains recoverable share/record feedback when shown.

## Assets

No image asset is required for the fallback preview. Use the active version glyph, `✦`, native text, and the source CSS-shaped poster/code box. Canvas generation is outside this extraction contract.

## Text Content

Fixed copy is `分享卡片预览`, `小程序码`, `生成我的校园人设卡`, `Demo 里先展示海报结构，正式版可替换为 Canvas 生成图片。`, and `知道啦`. Version title, tag name, share copy, hashtags, and feedback are dynamic.

## Mobile Responsive Behavior

At the 390 px reference width, the modal cap is `692.31rpx`, leaving the `38.46rpx` backdrop inset on each side where possible. On a short viewport, allow the overlay panel to scroll internally so the close action remains reachable. Do not port desktop prototype framing; native share controls originate from the result screen.
