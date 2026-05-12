// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.4
// @description  Bulk-delete YouTube watch history by time range
// @match        *://www.youtube.com/feed/history*
// @match        *://youtube.com/feed/history*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube is a SPA — wait for an element before injecting
  function waitForElement(selector, callback, interval = 300, maxWait = 15000) {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (Date.now() - start > maxWait) {
        clearInterval(timer);
      }
    }, interval);
  }

  function init() {
    if (window.location.pathname === '/feed/history') {
      injectPanel();
    }

    window.addEventListener('yt-navigate-finish', () => {
      const existing = document.getElementById('ytc-panel');
      if (existing) existing.remove();
      if (window.location.pathname === '/feed/history') {
        injectPanel();
      }
    });
  }

  const STYLES = `
  #ytc-panel {
    font-family: 'DM Sans', 'Roboto', sans-serif;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 16px 0 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    box-sizing: border-box;
    position: sticky;
    top: 72px;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    z-index: 1;
  }
  #ytc-panel + * {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }
  #ytc-panel .ytc-title {
    font-size: 11px;
    font-weight: 700;
    color: #0f0f0f;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  #ytc-panel .ytc-title-icon {
    color: #CC0000;
    font-size: 10px;
  }
  #ytc-panel .ytc-seg {
    display: flex;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
  }
  #ytc-panel .ytc-seg-btn {
    flex: 1;
    border: none;
    background: #f8f9fa;
    padding: 6px 4px;
    font-size: 11px;
    font-weight: 500;
    font-family: 'DM Sans', 'Roboto', sans-serif;
    cursor: pointer;
    color: #5f6368;
    transition: background 0.15s ease, color 0.15s ease;
    line-height: 1;
  }
  #ytc-panel .ytc-seg-btn:not(:last-child) {
    border-right: 1px solid #e0e0e0;
  }
  #ytc-panel .ytc-seg-btn.active {
    background: #1557b0;
    color: #fff;
    font-weight: 600;
  }
  #ytc-panel .ytc-seg-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-label {
    font-size: 11px;
    color: #5f6368;
    margin-bottom: 4px;
  }
  #ytc-panel select {
    width: 100%;
    font-size: 12px;
    font-family: 'DM Sans', 'Roboto', sans-serif;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 5px 8px;
    margin-bottom: 10px;
    color: #202124;
    background: #fff;
    cursor: pointer;
  }
  #ytc-panel select:disabled {
    color: #aaa;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-btn {
    width: 100%;
    border: none;
    border-radius: 6px;
    padding: 8px 0;
    font-size: 12px;
    font-weight: 600;
    font-family: 'DM Sans', 'Roboto', sans-serif;
    cursor: pointer;
    letter-spacing: 0.2px;
    transition: background 0.2s ease, opacity 0.15s ease, transform 0.1s ease;
  }
  #ytc-panel .ytc-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  #ytc-panel .ytc-btn:active:not(:disabled) {
    transform: scale(0.98);
  }
  #ytc-panel .ytc-btn:disabled {
    background: #ccc !important;
    color: #fff;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-btn-blue { background: #1a73e8; color: #fff; }
  #ytc-panel .ytc-btn-red  { background: #d93025; color: #fff; }
  #ytc-panel .ytc-info {
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
    margin-bottom: 8px;
    font-size: 12px;
  }
  #ytc-panel .ytc-info-blue  { background: #e8f0fe; color: #1a73e8; }
  #ytc-panel .ytc-info-red   { background: #fce8e6; color: #d93025; }
  #ytc-panel .ytc-info-green { background: #e6f4ea; color: #188038; }
  #ytc-panel .ytc-info-strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    margin-top: 2px;
  }
  #ytc-panel .ytc-hint {
    font-size: 10px;
    color: #80868b;
    text-align: center;
    margin-bottom: 8px;
  }
  #ytc-panel .ytc-calendar {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 8px;
    background: #fafafa;
  }
  #ytc-panel .ytc-cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  #ytc-panel .ytc-cal-nav {
    font-size: 14px;
    color: #5f6368;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s ease;
  }
  #ytc-panel .ytc-cal-nav:hover:not(:disabled) {
    color: #1a73e8;
  }
  #ytc-panel .ytc-cal-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-cal-month {
    font-size: 11px;
    font-weight: 600;
    color: #202124;
  }
  #ytc-panel .ytc-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: 2px;
    column-gap: 0;
    text-align: center;
  }
  #ytc-panel .ytc-cal-dh {
    font-size: 9px;
    color: #80868b;
    padding: 1px 0;
  }
  #ytc-panel .ytc-cal-cell {
    font-size: 10px;
    padding: 5px 0;
    min-height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 50%;
    color: #202124;
    transition: background 0.1s ease;
    position: relative;
  }
  #ytc-panel .ytc-cal-cell:hover:not(.spillover):not(.future):not(.cell-disabled):not(.in-range):not(.range-start):not(.range-end):not(.selected-single) {
    background: #f1f3f4;
  }
  #ytc-panel .ytc-cal-cell.spillover {
    color: #ccc;
    cursor: default;
    pointer-events: none;
  }
  #ytc-panel .ytc-cal-cell.in-range {
    background: #e8f0fe;
    color: #1a73e8;
    border-radius: 0;
  }
  #ytc-panel .ytc-cal-cell.range-start {
    background: #1a73e8;
    color: #fff;
    border-radius: 6px 0 0 6px;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.range-end {
    background: #1a73e8;
    color: #fff;
    border-radius: 0 6px 6px 0;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.selected-single {
    background: #1a73e8;
    color: #fff;
    border-radius: 4px;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.cell-disabled {
    pointer-events: none;
    opacity: 0.4;
  }
  #ytc-panel .ytc-cal-cell.future {
    color: #ccc;
    cursor: default;
    pointer-events: none;
  }
  #ytc-panel .ytc-cal-cell.today:not(.range-start):not(.range-end):not(.selected-single):not(.in-range) {
    font-weight: 700;
    color: #1a73e8;
  }
  #ytc-panel .ytc-cal-cell.today:not(.range-start):not(.range-end):not(.selected-single):not(.in-range)::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #1a73e8;
  }
  #ytc-panel .ytc-cal-hint {
    font-size: 11px;
    color: #80868b;
    text-align: center;
    margin-top: 6px;
  }
  #ytc-panel #ytc-cal-summary {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 8px;
  }
  #ytc-panel #ytc-cal-summary .ytc-summary-text {
    flex: 1;
  }
  #ytc-panel .ytc-cal-clear {
    border: none;
    background: none;
    color: #80868b;
    font-size: 11px;
    font-family: 'DM Sans', 'Roboto', sans-serif;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    text-decoration: underline;
    transition: color 0.15s ease;
  }
  #ytc-panel .ytc-cal-clear:hover {
    color: #d93025;
  }
  @keyframes ytc-fadein {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  #ytc-panel .ytc-info:not(#ytc-cal-summary) {
    animation: ytc-fadein 0.18s ease forwards;
  }
  #ytc-panel .ytc-progress-wrap {
    margin-top: 6px;
    height: 3px;
    background: rgba(0,0,0,0.12);
    border-radius: 99px;
    overflow: hidden;
  }
  #ytc-panel .ytc-progress-bar {
    height: 100%;
    border-radius: 99px;
    background: currentColor;
    transition: width 0.35s ease;
    min-width: 4px;
  }
  html[dark] #ytc-panel {
    background: #212121;
    border-color: #3d3d3d;
    box-shadow: 0 1px 6px rgba(0,0,0,0.4);
  }
  html[dark] #ytc-panel .ytc-title {
    color: #f1f1f1;
  }
  html[dark] #ytc-panel .ytc-seg {
    border-color: #3d3d3d;
  }
  html[dark] #ytc-panel .ytc-seg-btn {
    background: #2d2d2d;
    color: #aaa;
    border-right-color: #3d3d3d;
  }
  html[dark] #ytc-panel .ytc-seg-btn.active {
    background: #1557b0;
    color: #fff;
  }
  html[dark] #ytc-panel .ytc-label {
    color: #aaa;
  }
  html[dark] #ytc-panel .ytc-hint {
    color: #666;
  }
  html[dark] #ytc-panel select {
    background: #2d2d2d;
    border-color: #3d3d3d;
    color: #f1f1f1;
  }
  html[dark] #ytc-panel .ytc-btn:disabled {
    background: #444 !important;
  }
  html[dark] #ytc-panel .ytc-info-blue {
    background: #1a3a6e;
    color: #8ab4f8;
  }
  html[dark] #ytc-panel .ytc-info-red {
    background: #4a1a17;
    color: #f28b82;
  }
  html[dark] #ytc-panel .ytc-info-green {
    background: #1a3d26;
    color: #81c995;
  }
  html[dark] #ytc-panel .ytc-progress-wrap {
    background: rgba(255,255,255,0.12);
  }
  html[dark] #ytc-panel .ytc-calendar {
    background: #1a1a1a;
    border-color: #3d3d3d;
  }
  html[dark] #ytc-panel .ytc-cal-nav {
    color: #aaa;
  }
  html[dark] #ytc-panel .ytc-cal-nav:hover:not(:disabled) {
    color: #8ab4f8;
  }
  html[dark] #ytc-panel .ytc-cal-month {
    color: #f1f1f1;
  }
  html[dark] #ytc-panel .ytc-cal-dh {
    color: #666;
  }
  html[dark] #ytc-panel .ytc-cal-cell {
    color: #e8e8e8;
  }
  html[dark] #ytc-panel .ytc-cal-cell:hover:not(.spillover):not(.future):not(.cell-disabled):not(.in-range):not(.range-start):not(.range-end):not(.selected-single) {
    background: #333;
  }
  html[dark] #ytc-panel .ytc-cal-cell.spillover {
    color: #555;
  }
  html[dark] #ytc-panel .ytc-cal-cell.future {
    color: #555;
  }
  html[dark] #ytc-panel .ytc-cal-cell.in-range {
    background: #1a3a6e;
    color: #8ab4f8;
  }
  html[dark] #ytc-panel .ytc-cal-cell.today:not(.range-start):not(.range-end):not(.selected-single):not(.in-range) {
    color: #8ab4f8;
  }
  html[dark] #ytc-panel .ytc-cal-cell.today:not(.range-start):not(.range-end):not(.selected-single):not(.in-range)::after {
    background: #8ab4f8;
  }
  html[dark] #ytc-panel .ytc-cal-hint {
    color: #666;
  }
  html[dark] #ytc-panel .ytc-cal-clear {
    color: #666;
  }
  html[dark] #ytc-panel .ytc-cal-clear:hover {
    color: #f28b82;
  }
`;

  const STATE = {
    IDLE:     'idle',
    SCANNING: 'scanning',
    READY:    'ready',
    DELETING: 'deleting',
    DONE:     'done',
  };

  let currentState = STATE.IDLE;
  let foundItems   = [];
  let deletedCount = 0;

  let calendarMode  = false;
  let calendarYear  = 0;
  let calendarMonth = 0;
  let selectedStart = null; // Date | null — always the earlier of the two picked dates
  let selectedEnd   = null; // Date | null — always the later of the two picked dates
  let hoverDate     = null; // Date | null — preview end while awaiting 2nd click

  const TIME_RANGES = [
    { label: '1 day',    days: 1   },
    { label: '1 week',   days: 7   },
    { label: '2 weeks',  days: 14  },
    { label: '1 month',  days: 30  },
    { label: '3 months', days: 90  },
    { label: '6 months', days: 180 },
    { label: 'All time', days: null },
  ];

  function injectStyles() {
    if (!document.getElementById('ytc-font')) {
      const link = document.createElement('link');
      link.id   = 'ytc-font';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
    if (document.getElementById('ytc-styles')) return;
    const style = document.createElement('style');
    style.id = 'ytc-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'ytc-panel';

    const title = document.createElement('div');
    title.className = 'ytc-title';
    const icon = document.createElement('span');
    icon.className   = 'ytc-title-icon';
    icon.textContent = '▶';
    title.appendChild(icon);
    title.appendChild(document.createTextNode('YT History Cleaner'));
    panel.appendChild(title);

    // Segmented mode control
    const seg = document.createElement('div');
    seg.className = 'ytc-seg';

    const quickBtn = document.createElement('button');
    quickBtn.id        = 'ytc-seg-quick';
    quickBtn.className = 'ytc-seg-btn active';
    quickBtn.textContent = 'Quick';
    quickBtn.onclick   = () => setCalendarMode('quick');

    const customBtn = document.createElement('button');
    customBtn.id        = 'ytc-seg-custom';
    customBtn.className = 'ytc-seg-btn';
    customBtn.textContent = 'Custom Date';
    customBtn.onclick   = () => setCalendarMode('custom');

    seg.appendChild(quickBtn);
    seg.appendChild(customBtn);
    panel.appendChild(seg);

    // Quick section
    const quickSection = document.createElement('div');
    quickSection.id = 'ytc-quick-section';

    const label = document.createElement('div');
    label.className   = 'ytc-label';
    label.textContent = 'Delete history older than:';
    quickSection.appendChild(label);

    const select = document.createElement('select');
    select.id = 'ytc-range';
    TIME_RANGES.forEach((range, i) => {
      const opt = document.createElement('option');
      opt.value       = String(i);
      opt.textContent = range.label;
      select.appendChild(opt);
    });
    quickSection.appendChild(select);
    panel.appendChild(quickSection);

    // Custom date section
    const customSection = document.createElement('div');
    customSection.id           = 'ytc-custom-section';
    customSection.style.display = 'none';

    const calLabel = document.createElement('div');
    calLabel.className   = 'ytc-label';
    calLabel.textContent = 'Delete history from:';
    customSection.appendChild(calLabel);

    customSection.appendChild(buildCalendar());
    panel.appendChild(customSection);

    const btn = document.createElement('button');
    btn.id        = 'ytc-action';
    btn.className = 'ytc-btn ytc-btn-blue';
    btn.textContent = 'Scan';
    panel.appendChild(btn);

    return panel;
  }

  function buildCalendar() {
    const cal = document.createElement('div');
    cal.id        = 'ytc-calendar';
    cal.className = 'ytc-calendar';

    const header = document.createElement('div');
    header.className = 'ytc-cal-header';

    const prevBtn = document.createElement('button');
    prevBtn.className   = 'ytc-cal-nav';
    prevBtn.textContent = '‹';
    prevBtn.onclick     = () => handleMonthNav(-1);

    const monthLabel = document.createElement('span');
    monthLabel.id        = 'ytc-cal-month';
    monthLabel.className = 'ytc-cal-month';

    const nextBtn = document.createElement('button');
    nextBtn.id          = 'ytc-cal-next';
    nextBtn.className   = 'ytc-cal-nav';
    nextBtn.textContent = '›';
    nextBtn.onclick     = () => handleMonthNav(1);

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    cal.appendChild(header);

    const grid = document.createElement('div');
    grid.id        = 'ytc-cal-grid';
    grid.className = 'ytc-cal-grid';

    // Event delegation for hover preview — attached once, works across re-renders
    grid.addEventListener('mouseover', handleGridMouseOver);
    grid.addEventListener('mouseleave', handleGridMouseLeave);

    cal.appendChild(grid);

    const hint = document.createElement('div');
    hint.id          = 'ytc-cal-hint';
    hint.className   = 'ytc-cal-hint';
    hint.textContent = 'Select a date';
    cal.appendChild(hint);

    return cal;
  }

  function handleGridMouseOver(e) {
    if (!selectedStart || selectedEnd) return;
    const cell = e.target;
    if (!cell.dataset.day) return;
    if (cell.classList.contains('spillover') || cell.classList.contains('future') || cell.classList.contains('cell-disabled')) {
      if (hoverDate) { hoverDate = null; applyCalendarClasses(); }
      return;
    }
    const day      = parseInt(cell.dataset.day, 10);
    const newHover = new Date(calendarYear, calendarMonth, day);
    if (!hoverDate || hoverDate.getTime() !== newHover.getTime()) {
      hoverDate = newHover;
      applyCalendarClasses();
    }
  }

  function handleGridMouseLeave() {
    if (hoverDate) {
      hoverDate = null;
      applyCalendarClasses();
    }
  }

  function applyCalendarClasses() {
    const grid = document.getElementById('ytc-cal-grid');
    if (!grid) return;

    const startMs = selectedStart ? selectedStart.getTime() : null;
    const endMs   = selectedEnd   ? selectedEnd.getTime()   : null;

    let previewStartMs = null;
    let previewEndMs   = null;
    if (startMs !== null && endMs === null && hoverDate) {
      const hMs = hoverDate.getTime();
      if (hMs !== startMs) {
        previewStartMs = Math.min(startMs, hMs);
        previewEndMs   = Math.max(startMs, hMs);
      }
    }

    grid.querySelectorAll('.ytc-cal-cell:not(.spillover):not(.future):not(.cell-disabled)').forEach(cell => {
      const day = parseInt(cell.dataset.day, 10);
      if (!day) return;
      const cellMs = new Date(calendarYear, calendarMonth, day).getTime();

      cell.classList.remove('range-start', 'range-end', 'in-range', 'selected-single');

      if (startMs !== null && endMs !== null) {
        if      (cellMs === startMs)                   cell.classList.add('range-start');
        else if (cellMs === endMs)                     cell.classList.add('range-end');
        else if (cellMs > startMs && cellMs < endMs)   cell.classList.add('in-range');
      } else if (previewStartMs !== null) {
        if      (cellMs === previewStartMs)                              cell.classList.add('range-start');
        else if (cellMs === previewEndMs)                                cell.classList.add('range-end');
        else if (cellMs > previewStartMs && cellMs < previewEndMs)       cell.classList.add('in-range');
        else if (cellMs === startMs)                                     cell.classList.add('selected-single');
      } else if (startMs !== null && cellMs === startMs) {
        cell.classList.add('selected-single');
      }
    });
  }

  const CAL_MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  function updateCalendarSummary() {
    const customSection = document.getElementById('ytc-custom-section');
    if (!customSection) return;

    const existing = document.getElementById('ytc-cal-summary');
    if (existing) existing.remove();
    if (!selectedStart) return;

    const summary = document.createElement('div');
    summary.id        = 'ytc-cal-summary';
    summary.className = 'ytc-info ytc-info-blue';

    const textWrap = document.createElement('div');
    textWrap.className = 'ytc-summary-text';

    let labelText, strongText;
    if (!selectedEnd) {
      const m   = CAL_MONTHS[selectedStart.getMonth()];
      labelText  = `Older than ${m} ${selectedStart.getDate()}, ${selectedStart.getFullYear()}`;
      strongText = '1 date selected';
    } else {
      const sm   = CAL_MONTHS[selectedStart.getMonth()];
      const em   = CAL_MONTHS[selectedEnd.getMonth()];
      const days = Math.round((selectedEnd - selectedStart) / 86400000) + 1;
      labelText  = `${sm} ${selectedStart.getDate()} – ${em} ${selectedEnd.getDate()}, ${selectedEnd.getFullYear()}`;
      strongText = `${days} days selected`;
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;
    textWrap.appendChild(labelSpan);

    const strong = document.createElement('strong');
    strong.className   = 'ytc-info-strong';
    strong.textContent = strongText;
    textWrap.appendChild(strong);

    const clearBtn = document.createElement('button');
    clearBtn.className   = 'ytc-cal-clear';
    clearBtn.textContent = '× Clear';
    clearBtn.onclick     = () => {
      selectedStart = null;
      selectedEnd   = null;
      hoverDate     = null;
      renderCalendar();
      const actionBtn = document.getElementById('ytc-action');
      if (actionBtn) actionBtn.disabled = true;
      if (currentState === STATE.READY) setState(STATE.IDLE);
    };

    summary.appendChild(textWrap);
    summary.appendChild(clearBtn);
    customSection.appendChild(summary);
  }

  function renderCalendar() {
    const monthLabel = document.getElementById('ytc-cal-month');
    const grid       = document.getElementById('ytc-cal-grid');
    const hint       = document.getElementById('ytc-cal-hint');
    if (!monthLabel || !grid || !hint) return;

    monthLabel.textContent = `${CAL_MONTHS[calendarMonth]} ${calendarYear}`;
    grid.replaceChildren();

    ['S','M','T','W','T','F','S'].forEach(d => {
      const dh = document.createElement('div');
      dh.className   = 'ytc-cal-dh';
      dh.textContent = d;
      grid.appendChild(dh);
    });

    const firstDay      = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth   = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMon = new Date(calendarYear, calendarMonth, 0).getDate();
    const isDisabled    = currentState === STATE.SCANNING || currentState === STATE.DELETING;
    const _now          = new Date();
    const today         = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());

    for (let i = firstDay - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className   = 'ytc-cal-cell spillover';
      cell.textContent = String(daysInPrevMon - i);
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      const cell     = document.createElement('div');
      cell.className       = 'ytc-cal-cell';
      cell.textContent     = String(day);
      cell.dataset.day     = String(day);

      if (cellDate.getTime() === today.getTime()) cell.classList.add('today');

      if (cellDate > today) {
        cell.classList.add('future');
      } else if (isDisabled) {
        cell.classList.add('cell-disabled');
      } else {
        cell.onclick = () => handleDateClick(cellDate);
      }

      grid.appendChild(cell);
    }

    const totalCells    = firstDay + daysInMonth;
    const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= trailingCells; i++) {
      const cell = document.createElement('div');
      cell.className   = 'ytc-cal-cell spillover';
      cell.textContent = String(i);
      grid.appendChild(cell);
    }

    // Apply selection / hover-preview classes to the freshly built cells
    applyCalendarClasses();

    hint.textContent = !selectedStart
      ? 'Select a date'
      : !selectedEnd
        ? 'Click another date to set a range'
        : 'Click a date to start over';

    const nextNavBtn = document.getElementById('ytc-cal-next');
    if (nextNavBtn) {
      nextNavBtn.disabled = (calendarYear === today.getFullYear() && calendarMonth === today.getMonth());
    }

    updateCalendarSummary();
  }

  function handleMonthNav(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0;  calendarYear++; }
    renderCalendar();
  }

  function handleDateClick(date) {
    hoverDate = null;

    if (!selectedStart) {
      selectedStart = date;
      selectedEnd   = null;
    } else if (!selectedEnd) {
      if (date.getTime() === selectedStart.getTime()) {
        selectedStart = null;
      } else if (date < selectedStart) {
        selectedEnd   = selectedStart;
        selectedStart = date;
      } else {
        selectedEnd = date;
      }
    } else {
      selectedStart = date;
      selectedEnd   = null;
    }

    if (currentState === STATE.READY) setState(STATE.IDLE);

    renderCalendar();

    const actionBtn = document.getElementById('ytc-action');
    if (actionBtn && currentState === STATE.IDLE) {
      actionBtn.disabled = !selectedStart;
    }
  }

  function setCalendarMode(mode) {
    calendarMode = (mode === 'custom');

    const quickBtn     = document.getElementById('ytc-seg-quick');
    const customBtn    = document.getElementById('ytc-seg-custom');
    const quickSection = document.getElementById('ytc-quick-section');
    const customSection = document.getElementById('ytc-custom-section');

    if (calendarMode) {
      quickBtn.classList.remove('active');
      customBtn.classList.add('active');
      quickSection.style.display  = 'none';
      customSection.style.display = '';

      const now     = new Date();
      calendarYear  = now.getFullYear();
      calendarMonth = now.getMonth();
      selectedStart = null;
      selectedEnd   = null;
      hoverDate     = null;
      renderCalendar();

      const actionBtn = document.getElementById('ytc-action');
      if (actionBtn) actionBtn.disabled = true;
    } else {
      quickBtn.classList.add('active');
      customBtn.classList.remove('active');
      quickSection.style.display  = '';
      customSection.style.display = 'none';

      const summaryEl = document.getElementById('ytc-cal-summary');
      if (summaryEl) summaryEl.remove();

      selectedStart = null;
      selectedEnd   = null;
      hoverDate     = null;

      const actionBtn = document.getElementById('ytc-action');
      if (actionBtn) actionBtn.disabled = false;

      if (currentState === STATE.READY) setState(STATE.IDLE);
    }
  }

  function setState(newState, data = {}) {
    currentState = newState;
    renderState(newState, data);
  }

  function renderState(state, data = {}) {
    const panel = document.getElementById('ytc-panel');
    if (!panel) return;
    const rangeEl   = document.getElementById('ytc-range');
    const actionBtn = document.getElementById('ytc-action');

    panel.querySelectorAll('.ytc-info:not(#ytc-cal-summary), .ytc-hint').forEach(el => el.remove());

    switch (state) {

      case STATE.IDLE:
        if (rangeEl) { rangeEl.disabled = false; rangeEl.onchange = null; }
        actionBtn.textContent = 'Scan';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = calendarMode && !selectedStart;
        actionBtn.onclick     = handleScan;
        setSegButtonsDisabled(false);
        if (calendarMode) renderCalendar();
        break;

      case STATE.SCANNING:
        if (rangeEl) rangeEl.disabled = true;
        actionBtn.textContent = 'Scanning...';
        actionBtn.className   = 'ytc-btn';
        actionBtn.disabled    = true;
        insertInfo(actionBtn, 'blue', 'Scanning...', `Found ${data.count ?? 0} items`);
        setSegButtonsDisabled(true);
        if (calendarMode) renderCalendar();
        break;

      case STATE.READY:
        if (rangeEl) { rangeEl.disabled = false; rangeEl.onchange = () => setState(STATE.IDLE); }
        actionBtn.textContent = `Delete ${data.count} items`;
        actionBtn.className   = 'ytc-btn ytc-btn-red';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleDelete;
        insertInfo(actionBtn, 'blue', 'Ready to delete', `${data.count} items found`);
        setSegButtonsDisabled(false);
        if (calendarMode) renderCalendar();
        break;

      case STATE.DELETING:
        if (rangeEl) rangeEl.disabled = true;
        actionBtn.textContent = 'Deleting...';
        actionBtn.className   = 'ytc-btn';
        actionBtn.disabled    = true;
        insertInfo(actionBtn, 'red', 'Deleting...', `0 / ${data.total} deleted`, 0);
        setSegButtonsDisabled(true);
        if (calendarMode) renderCalendar();
        break;

      case STATE.DONE:
        if (rangeEl) rangeEl.disabled = false;
        actionBtn.textContent = 'Scan Again';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleReset;
        insertInfo(actionBtn, 'green', `✓ Done! Deleted ${data.count} items`, null);
        insertHint(actionBtn, 'Refresh the page for changes to be reflected.');
        setSegButtonsDisabled(false);
        if (calendarMode) renderCalendar();
        break;
    }
  }

  function setSegButtonsDisabled(disabled) {
    document.querySelectorAll('#ytc-panel .ytc-seg-btn').forEach(b => b.disabled = disabled);
  }

  function insertInfo(beforeNode, color, labelText, strongText, progress) {
    const panel = document.getElementById('ytc-panel');
    const div   = document.createElement('div');
    div.className = `ytc-info ytc-info-${color}`;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;
    div.appendChild(labelSpan);

    if (strongText) {
      const strong = document.createElement('strong');
      strong.className   = 'ytc-info-strong';
      strong.textContent = strongText;
      div.appendChild(strong);
    }

    if (progress !== undefined && progress !== null) {
      const wrap = document.createElement('div');
      wrap.className = 'ytc-progress-wrap';
      const bar = document.createElement('div');
      bar.className  = 'ytc-progress-bar';
      bar.style.width = `${Math.round(progress * 100)}%`;
      wrap.appendChild(bar);
      div.appendChild(wrap);
    }

    panel.insertBefore(div, beforeNode);
  }

  function insertHint(beforeNode, text) {
    const panel = document.getElementById('ytc-panel');
    const div   = document.createElement('div');
    div.className   = 'ytc-hint';
    div.textContent = text;
    panel.insertBefore(div, beforeNode);
  }

  function updateScanningCount(count) {
    const strong = document.querySelector('#ytc-panel .ytc-info-blue:not(#ytc-cal-summary) .ytc-info-strong');
    if (strong) strong.textContent = `Found ${count} items`;
  }

  function updateDeletingProgress(deleted, total) {
    const strong = document.querySelector('#ytc-panel .ytc-info-red .ytc-info-strong');
    const bar    = document.querySelector('#ytc-panel .ytc-progress-bar');
    if (strong) strong.textContent = `${deleted} / ${total} deleted`;
    if (bar)    bar.style.width    = `${Math.round((deleted / total) * 100)}%`;
  }

  function initStateIdle() {
    foundItems    = [];
    deletedCount  = 0;
    calendarMode  = false;
    selectedStart = null;
    selectedEnd   = null;
    hoverDate     = null;
    setState(STATE.IDLE);
    // Ensure segmented control reflects Quick mode
    const quickBtn  = document.getElementById('ytc-seg-quick');
    const customBtn = document.getElementById('ytc-seg-custom');
    if (quickBtn)  quickBtn.classList.add('active');
    if (customBtn) customBtn.classList.remove('active');
    const quickSection  = document.getElementById('ytc-quick-section');
    const customSection = document.getElementById('ytc-custom-section');
    if (quickSection)  quickSection.style.display  = '';
    if (customSection) customSection.style.display = 'none';
  }

  const SCROLL_PAUSE_MS = 1200;
  const SCROLL_MAX_SAME = 3;
  const DELETE_STEP_MS  = 500;
  const DIALOG_WAIT_MS  = 800;
  const DIALOG_TIMEOUT  = 3000;

  function getCutoffDate() {
    const rangeEl = document.getElementById('ytc-range');
    const idx = parseInt(rangeEl.value, 10);
    const { days } = TIME_RANGES[idx];
    if (days === null) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }

  function parseSectionDate(headerText) {
    const text  = headerText.trim();
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (/^today$/i.test(text)) return today;

    if (/^yesterday$/i.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d;
    }

    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayIdx = days.indexOf(text.toLowerCase());
    if (dayIdx !== -1) {
      const d = new Date(today);
      const diff = (today.getDay() - dayIdx + 7) % 7 || 7;
      d.setDate(d.getDate() - diff);
      return d;
    }

    const monthDay = text.match(/^([A-Za-z]+)\s+(\d+)$/);
    if (monthDay) {
      const months = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];
      const mIdx = months.indexOf(monthDay[1].toLowerCase());
      if (mIdx !== -1) {
        const d = new Date(today.getFullYear(), mIdx, parseInt(monthDay[2], 10));
        if (d > today) d.setFullYear(d.getFullYear() - 1);
        return d;
      }
    }

    return null;
  }

  function isSectionOlderThanCutoff(headerText, cutoff) {
    if (cutoff === null) return true;
    const date = parseSectionDate(headerText);
    if (!date) return false;
    return date <= cutoff;
  }

  function getCustomRange() {
    return { start: selectedStart, end: selectedEnd };
  }

  function isSectionInCustomRange(headerText, range) {
    const date = parseSectionDate(headerText);
    if (!date) return false;
    if (range.end === null) return date <= range.start;
    return date >= range.start && date <= range.end;
  }

  function handleScan() {
    if (currentState !== STATE.IDLE) return;
    foundItems   = [];
    deletedCount = 0;

    let filterFn;
    if (calendarMode) {
      const range = getCustomRange();
      filterFn = (headerText) => isSectionInCustomRange(headerText, range);
    } else {
      const cutoff = getCutoffDate();
      filterFn = (headerText) => isSectionOlderThanCutoff(headerText, cutoff);
    }

    setState(STATE.SCANNING, { count: 0 });
    scrollAndCollect(filterFn, 0, 0);
  }

  function scrollAndCollect(filterFn, sameSizeCount, lastHeight) {
    const sections = [];
    document.querySelectorAll('ytd-item-section-renderer').forEach(sec => {
      const h = sec.querySelector('ytd-item-section-header-renderer');
      if (h) sections.push({ el: sec, text: h.textContent.trim() });
    });

    for (const sd of sections) {
      if (!filterFn(sd.text)) continue;
      const contents = sd.el.querySelector('#contents') ||
                       (sd.el.shadowRoot && sd.el.shadowRoot.querySelector('#contents'));
      if (!contents) continue;
      for (const child of contents.children) {
        if (child.tagName === 'YTD-REEL-SHELF-RENDERER') {
          // Shorts shelf — collect individual reel items inside it
          const reelItems = [...child.querySelectorAll('ytd-reel-item-renderer')];
          if (reelItems.length > 0) {
            for (const ri of reelItems) {
              if (!foundItems.includes(ri)) foundItems.push(ri);
            }
          } else {
            const shelfItems = child.querySelector('#items');
            if (shelfItems) {
              for (const ri of shelfItems.children) {
                if (!foundItems.includes(ri)) foundItems.push(ri);
              }
            } else {
              if (!foundItems.includes(child)) foundItems.push(child);
            }
          }
        } else {
          if (!foundItems.includes(child)) foundItems.push(child);
        }
      }
    }

    updateScanningCount(foundItems.length);

    const currentHeight = document.documentElement.scrollHeight;
    const newSameCount  = currentHeight === lastHeight ? sameSizeCount + 1 : 0;

    if (newSameCount >= SCROLL_MAX_SAME) {
      onScanComplete();
      return;
    }

    window.scrollTo(0, currentHeight);
    setTimeout(() => scrollAndCollect(filterFn, newSameCount, currentHeight), SCROLL_PAUSE_MS);
  }

  function onScanComplete() {
    if (foundItems.length === 0) {
      setState(STATE.IDLE);
      const panel     = document.getElementById('ytc-panel');
      const actionBtn = document.getElementById('ytc-action');
      const msg = document.createElement('div');
      msg.className   = 'ytc-info ytc-info-blue';
      msg.textContent = 'No items found in this range.';
      panel.insertBefore(msg, actionBtn);
      setTimeout(() => msg.remove(), 3000);
      return;
    }
    setState(STATE.READY, { count: foundItems.length });
  }

  function handleDelete() {
    if (currentState !== STATE.READY) return;
    deletedCount = 0;
    setState(STATE.DELETING, { deleted: 0, total: foundItems.length });
    deleteNext(0);
  }

  function deleteNext(index) {
    if (index >= foundItems.length) {
      setState(STATE.DONE, { count: deletedCount });
      return;
    }

    const item = foundItems[index];
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      // Hover to reveal per-item controls
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      setTimeout(() => {
        // Polymer's querySelector returns the section's button, not the item's.
        // Use spatial matching: find a "More actions" button whose center falls
        // within this item's bounding rect.
        const itemRect = item.getBoundingClientRect();
        const allButtons = document.querySelectorAll('button[aria-label]');
        let menuBtn = null;
        for (const btn of allButtons) {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (!label.includes('action') && !label.includes('more')) continue;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx >= itemRect.left && cx <= itemRect.right &&
              cy >= itemRect.top  && cy <= itemRect.bottom) {
            menuBtn = btn;
            break;
          }
        }

        if (!menuBtn) {
          deleteNext(index + 1);
          return;
        }

        menuBtn.click();

        const menuItemSel = 'ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model';
        waitForElement(
          menuItemSel,
          () => {
            const removeBtn = [...document.querySelectorAll(menuItemSel)]
              .find(mi => mi.textContent.trim().toLowerCase().includes('remove from watch history')) ?? null;

            if (!removeBtn) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              setTimeout(() => deleteNext(index + 1), DELETE_STEP_MS);
              return;
            }

            // yt-list-item-view-model doesn't handle click directly —
            // find the actual clickable child element inside it
            const clickTarget = removeBtn.querySelector('button, a, [role="option"], [role="menuitem"]') || removeBtn;
            clickTarget.click();

            setTimeout(() => {
              const confirmBtn = document.querySelector(
                'paper-button[dialog-confirm], yt-button-renderer[dialog-confirm] button'
              );
              if (confirmBtn) confirmBtn.click();

              deletedCount++;
              updateDeletingProgress(deletedCount, foundItems.length);
              setTimeout(() => deleteNext(index + 1), DELETE_STEP_MS);
            }, DIALOG_WAIT_MS);
          },
          100,
          DIALOG_TIMEOUT
        );
      }, 300); // wait for hover to reveal per-item controls
    }, DELETE_STEP_MS);
  }

  function handleReset() {
    selectedStart = null;
    selectedEnd   = null;
    hoverDate     = null;
    const summaryEl = document.getElementById('ytc-cal-summary');
    if (summaryEl) summaryEl.remove();
    initStateIdle();
  }

  function injectPanel() {
    const isMobile = window.innerWidth < 1014;

    if (isMobile) {
      waitForElement('ytd-browse-filter-chip-bar-renderer, #secondary', (el) => {
        appendPanel(el.parentElement || el, el.nextSibling);
      });
    } else {
      waitForElement('#secondary', (sidebar) => {
        appendPanel(sidebar, null);
      });
    }
  }

  function appendPanel(parent, beforeNode) {
    if (document.getElementById('ytc-panel')) return;
    injectStyles();
    const panel = buildPanel();
    if (beforeNode) {
      parent.insertBefore(panel, beforeNode);
    } else {
      parent.insertBefore(panel, parent.firstChild);
    }
    initStateIdle();
  }

  init();
})();
