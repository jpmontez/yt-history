# Custom Date Picker — Design Spec

**Date:** 2026-05-11
**Feature:** Custom date / date-range picker for YT History Cleaner
**Scope:** Additive change to `yt-history-cleaner.user.js` only

---

## Overview

Adds a custom date picker to the existing YT History Cleaner panel. Users can pick an arbitrary cutoff date or a specific date range — without changing any of the existing preset options (1 day, 1 week, etc.).

---

## UI Changes

### Trigger

The dropdown row gains an inline 📅 icon button flush to the right of the `<select>`. The dropdown shrinks to fill remaining space (`flex: 1`). The button matches the dropdown's height.

**Idle state:** 1px `#ccc` border, white background.
**Active state:** 1px `#1a73e8` border, `#e8f0fe` background.

The active state makes it unambiguous whether calendar mode is on or off.

### Label

When calendar mode is active, the label above the row changes from `"Delete history older than:"` to `"Delete history from:"`. It reverts when calendar mode is dismissed.

### Dropdown while calendar is open

The preset `<select>` is disabled and visually grayed out (`color: #aaa`, `background: #f5f5f5`) while the calendar is open. This prevents conflicting selection modes.

### Calendar widget

A plain `<div>`-based calendar grid rendered inside the existing panel, below the dropdown row. No external libraries.

Structure:
- Header: `‹ May 2026 ›` — clicking arrows navigates to previous/next month.
- Grid: 7-column layout, day-of-week headers (S M T W T F S), then date cells.
- Prior-month spillover cells are shown in light gray and are non-interactive.
- A hint line below the grid updates to guide the user through the two-click flow.

### Selection summary box

Replaces the hint line below the calendar once a selection is made. Matches the existing `.ytc-info-blue` style.

| State | Summary text |
|---|---|
| Single date | `"Older than May 7, 2026"` |
| Range | `"May 7 – May 14, 2026 / 8 days"` |

---

## Interaction Model

### Two-click range picker

1. **First click** — sets the start date. The cell gets a solid blue circle. Hint reads `"Click another date to set a range."` Scan button activates immediately (single date is a valid end state).
2. **Second click** — sets the end date, order-independent. The earlier of the two clicked dates becomes the start, the later becomes the end. In-between cells fill with `#e8f0fe`; endpoint cells get solid blue circles with the inner edge squared off so the highlight connects visually.
3. **Third click** — resets selection entirely and starts over.

### Month navigation

`‹` / `›` arrows in the calendar header navigate between months. No year picker — month navigation is sufficient for typical history ranges.

### Dismissing the calendar

Clicking the 📅 icon again closes the calendar, re-enables the dropdown, reverts the label, and clears any date selection.

---

## Filter Logic

The existing `getCutoffDate()` and `isSectionOlderThanCutoff()` are unchanged and continue to handle all preset selections.

Custom date mode adds:

**`getCustomRange()`** — returns `{ start: Date, end: Date | null }` from the calendar's internal state. `end` is `null` when only one date is picked.

**`isSectionInCustomRange(headerText, range)`** — used instead of `isSectionOlderThanCutoff` when custom mode is active:
- `range.end === null`: include the section if its date ≤ `range.start` (same semantics as a preset cutoff, but with a user-chosen date).
- `range.end` is set: include the section if its date falls between `range.start` and `range.end` inclusive.

`scrollAndCollect` accepts either mode — its signature changes slightly to take a filter function rather than a raw cutoff date, keeping the scanning and deletion loops themselves unchanged.

---

## State Machine

The five existing states (IDLE, SCANNING, READY, DELETING, DONE) are unchanged in structure. The calendar widget responds to them:

| State | Calendar icon | Calendar cells | Calendar visibility |
|---|---|---|---|
| IDLE | Enabled | Interactive | Toggle freely |
| SCANNING | Disabled | Non-interactive | Stays visible |
| READY | Enabled | Interactive | Stays visible; changing the date selection or switching back to a preset resets to IDLE |
| DELETING | Disabled | Non-interactive | Stays visible |
| DONE | Enabled | Interactive | Persists showing last selection; "Scan Again" clears it |

`renderState` gains calendar icon enable/disable logic alongside the existing dropdown handling. No other changes to the state machine.

---

## Out of Scope

- Year picker (month navigation is sufficient)
- Keyboard navigation of the calendar grid
- Persisting the last custom selection across page navigations
- Any changes to the deletion loop or confirmation dialog logic
