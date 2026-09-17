# Design theme

```
Hallmark · pre-emit critique: P4 H4 E4 S3 R5 V3
Hallmark · genre: modern-minimal · macrostructure: Workbench (app shell) · theme: Coral
tone: utilitarian · enrichment: none · nav: N3 side-rail (bottom sheet below 48rem) · footer: none
```

Chosen 17 September 2026 (task 2).

## Context

| | |
|---|---|
| Audience | One Microsoft 365 user managing a personal task list inside their tenant |
| Use case | Capture a task in under five seconds; see what is due today |
| Tone | Utilitarian: quiet, scannable, the list is the focus, minimal motion |
| Genre | Modern-minimal |

## Why Coral

The modern-minimal genre offers two catalog themes. **Cobalt** is built for developer tools: code as the hero, a mono label voice, an instrument-panel feel. **Coral** is the warmer sibling: warm-grey paper, one coral accent and Geist throughout. A personal daily list is closer to Coral, and its restraint suits a screen that people look at many times a day.

## Palette

All values live in [`src/styles/tokens.css`](../../src/styles/tokens.css). Nothing else in `src/` may contain a colour value or a font name, and a test enforces it.

| Token | Value | Use | Contrast on paper |
|---|---|---|---|
| `--color-paper` | `oklch(97.5% 0.006 70)` | Page background | — |
| `--color-paper-2` | `oklch(95% 0.008 70)` | Sidebar surface | — |
| `--color-paper-3` | `oklch(92% 0.009 70)` | Hover and pressed surface | — |
| `--color-rule` | `oklch(89% 0.008 70)` | Decorative dividers | — |
| `--color-rule-2` | `oklch(60% 0.01 70)` | Control borders | 3.7:1 (3.1:1 on hover) |
| `--color-muted` | `oklch(50% 0.01 65)` | Secondary text | 5.6:1 |
| `--color-ink-2` | `oklch(34% 0.012 60)` | Body text | 11.0:1 |
| `--color-ink` | `oklch(21% 0.012 60)` | Headings | 16.5:1 |
| `--color-accent` | `oklch(56% 0.17 35)` | Coral: active item, primary fill | 4.7:1; text on the fill 4.9:1 |
| `--color-accent-text` | `oklch(50% 0.16 35)` | Coral used as text | 6.0:1 |
| `--color-focus` | `oklch(55% 0.17 35)` | Focus rings | 4.9:1 |
| `--color-error` | `oklch(50% 0.19 25)` | Error state | 6.2:1 |
| `--color-success` | `oklch(48% 0.11 150)` | Success state | 5.8:1 |

Contrast ratios are WCAG 2.1, computed from the OKLCH values converted to sRGB.

The accent is a highlighter. It should cover no more than a few percent of any screen.

## Type

- **Geist** (variable, 100–900) for everything: body at 400, controls at 500, headings at 650 with −0.025em tracking.
- **Geist Mono** only for keyboard hints (`kbd`).
- Major-third scale from 16px. Headings are always roman.
- Both faces are self-hosted through Fontsource, so the app loads no fonts from a third-party CDN.

## Shell

- **Below 48rem (768px):** a sticky top bar with the wordmark and a **Lists** button. The button opens the list sidebar as a bottom sheet over a scrim. The sheet closes on Escape, from the scrim, or from its **Close lists** button, and focus returns to the toggle.
- **From 48rem:** two panes: a persistent 17rem side rail and the main outlet.
- `html` and `body` use `overflow-x: clip`. `e2e/shell.spec.ts` checks for horizontal scroll at every width below.
- The `.control` button style implements all eight states: default, hover, focus-visible, active, disabled, loading, error and success. Force-state classes (`.is-hover`, `.is-focus`, `.is-active`) exist for previews.
- Motion is limited to the sheet slide (420ms in, 315ms out, ease-out and ease-in). With reduced motion, it becomes a 150ms fade.

## Screenshots

| Width | File |
|---|---|
| 320 | [shell-320.png](shell-320.png) |
| 375 | [shell-375.png](shell-375.png), sheet open: [shell-375-sheet-open.png](shell-375-sheet-open.png) |
| 414 | [shell-414.png](shell-414.png) |
| 768 | [shell-768.png](shell-768.png) |
| 1024 | [shell-1024.png](shell-1024.png) |
| 1440 | [shell-1440.png](shell-1440.png) |

Regenerate with `SHELL_SCREENSHOTS=1 npx playwright test e2e/shell.spec.ts --project desktop-chromium`.

## Critique scores

| Axis | Score | Note |
|---|---|---|
| Philosophy | 4 | Restrained Coral, with the list as the focus |
| Hierarchy | 4 | Wordmark, then page heading, then content; the side rail recedes on a darker surface |
| Execution | 4 | Tokens only, contrast checked, eight control states, reduced motion handled |
| Specificity | 3 | The shell is generic until lists and tasks land in tasks 5 and 6 |
| Restraint | 5 | One accent, not yet used on screen; motion only on the sheet |
| Variety | 3 | A conventional two-pane app layout, which is right for a todo app |
