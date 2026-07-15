# Frontend Demo Page Topology

This contract maps only the app content rendered into `#app` and the source share dialog. The native implementation owns navigation chrome and the 390 px reference canvas; it does not reproduce the desktop prototype frame.

| Source state | Source root | Native state | Native root |
|---|---|---|---|
| welcome | `.welcome-page` | `welcome` | `.welcome-screen` |
| identity | `.identity-page` | `identity` | `.identity-screen` |
| loading | `.loading-page` | `loading` | `.center-screen` |
| quiz | `.quiz-page` | `quiz` | `.quiz-screen` |
| analysis | `.analysis-page` | `analysis` | `.center-screen` |
| result | `.result-page` | `result` | `.result-screen` |
| share | `.share-modal` | native share/result fallback | result share controls |

## Port boundary

Explicitly exclude `.prototype-intro`, `.phone-device`, `.phone-speaker`, `.status-bar`, and `.home-indicator` from the native port. They are desktop-demo framing only, not mini-program page content.

`#app.app-content` supplies the source content inset of 23 px top, 24 px horizontal, and 42 px bottom; native pages use the platform safe area plus their page-specific WXSS spacing instead. The source `page` root has a 700 px minimum height and a 0.24 s upward page-in animation; native roots preserve the vertical, full-page layout and may use a 240 ms entrance transition where supported.

## Source state guards

- Before the registry loads, the source always renders `loading`.
- A requested `quiz` state without a loaded bank falls back to `identity`.
- A requested `result` state without a result falls back to `quiz` when a bank exists, otherwise `identity`.
- The share surface is not an app state. It is opened only from a complete result after native sharing is unavailable or share-recording feedback must be shown.

## Native ownership boundary

Tasks 4 and 5 consume these topology names as the only screen-state vocabulary. The mini-program page must not create a nested device shell or simulate system status/home controls. Version registry, bank, answer, result, and share data remain supplied by their canonical runtime interfaces; this documentation does not copy bank or algorithm content.
