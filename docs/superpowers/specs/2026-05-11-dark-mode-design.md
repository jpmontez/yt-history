# Dark Mode Support — Design Spec
**Date:** 2026-05-11
**Status:** Approved

## Overview

Adapt the YT History Cleaner userscript panel to render correctly in YouTube's dark mode. The panel must follow YouTube's own dark mode switch (not the OS `prefers-color-scheme`), update instantly when the user toggles dark mode while on the page, and require no changes to any JS logic.

## Mechanism

YouTube sets a `dark` attribute on `<html>` synchronously when the user enables dark mode. The implementation uses CSS attribute selectors:

```css
html[dark] #ytc-panel { ... }
html[dark] #ytc-panel .ytc-seg-btn { ... }
/* etc. */
```

These rules are appended to the existing `STYLES` string constant. No JS changes are needed — CSS reacts to the `html[dark]` attribute instantly, including mid-session toggles.

## Dark Color Palette (Option A — YouTube Surface Tones)

| Element | Light value | Dark value |
|---|---|---|
| Panel background | `#fff` | `#212121` |
| Panel border | `#e0e0e0` | `#3d3d3d` |
| Panel box-shadow | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.4)` |
| Title text | `#0f0f0f` | `#f1f1f1` |
| Label / secondary text | `#5f6368` | `#aaa` |
| Hint text | `#80868b` | `#666` |
| Seg button bg (inactive) | `#f8f9fa` | `#2d2d2d` |
| Seg button text (inactive) | `#5f6368` | `#aaa` |
| Seg button border | `#e0e0e0` | `#3d3d3d` |
| Seg button bg (active) | `#1557b0` | `#1557b0` (unchanged) |
| Select background | `#fff` | `#2d2d2d` |
| Select border | `#e0e0e0` | `#3d3d3d` |
| Select text | `#202124` | `#f1f1f1` |
| Disabled button bg | `#ccc` | `#444` |
| Info blue bg / text | `#e8f0fe` / `#1a73e8` | `#1a3a6e` / `#8ab4f8` |
| Info red bg / text | `#fce8e6` / `#d93025` | `#4a1a17` / `#f28b82` |
| Info green bg / text | `#e6f4ea` / `#188038` | `#1a3d26` / `#81c995` |
| Progress wrap bg | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` |
| Calendar background | `#fafafa` | `#1a1a1a` |
| Calendar border | `#e0e0e0` | `#3d3d3d` |
| Calendar month label | `#202124` | `#f1f1f1` |
| Calendar nav buttons | `#5f6368` | `#aaa` |
| Calendar day headers | `#80868b` | `#666` |
| Calendar cell text | `#202124` | `#e8e8e8` |
| Calendar cell hover | `#f1f3f4` | `#333` |
| Calendar spillover / future | `#ccc` | `#555` |
| Calendar in-range bg / text | `#e8f0fe` / `#1a73e8` | `#1a3a6e` / `#8ab4f8` |
| Calendar range start/end bg | `#1a73e8` | `#1a73e8` (unchanged) |
| Calendar today text / dot | `#1a73e8` | `#8ab4f8` |
| Cal clear button | `#80868b` | `#666` |
| Cal clear button hover | `#d93025` | `#f28b82` |

## Scope

**Changes:**
- `STYLES` string in `yt-history-cleaner.user.js` — append a new `html[dark] #ytc-panel { ... }` block covering all tokens in the table above.

**No changes:**
- All JS logic (state machine, scan, delete, calendar date handling)
- HTML structure (`buildPanel`, `buildCalendar`)
- Light mode styles (existing rules are untouched)
- Primary action button colors (`#1a73e8` blue, `#d93025` red) — these read well on dark backgrounds as-is

## CSS structure

All dark overrides live in a single new block at the bottom of `STYLES`, organized by component group:

1. Panel shell (background, border, shadow)
2. Title
3. Segmented control
4. Label, hint
5. Select
6. Buttons (primary blue, red delete, disabled state)
7. Info boxes (blue, red, green) + progress bar
8. Calendar shell, header, nav, day headers
9. Calendar cells (default, hover, spillover/future, today, in-range, range-start/end, selected-single)
10. Calendar summary + clear button
