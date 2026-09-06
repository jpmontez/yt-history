// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.21
// @description  Bulk-delete YouTube watch history by time range
// @match        *://www.youtube.com/*
// @match        *://youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube is a SPA — wait for an element before injecting
  function waitForElement(selector, callback, interval = 100, maxWait = 15000) {
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
    const handleNav = () => {
      const onHistory = window.location.pathname === '/feed/history';
      const existing  = document.getElementById('ytc-panel');
      if (!onHistory && existing) {
        existing.remove();
        teardownRowHoverListeners();
      } else if (onHistory && !existing) {
        injectPanel();
      }
    };

    handleNav();

    // Listen on both document and window — YT dispatches custom events on
    // document.documentElement, which bubble to both, but some pages/extensions
    // can interfere with one or the other.
    document.addEventListener('yt-navigate-finish',   handleNav);
    document.addEventListener('yt-page-data-updated', handleNav);
    window.addEventListener('yt-navigate-finish',     handleNav);
    window.addEventListener('yt-page-data-updated',   handleNav);

    // Fallback: detect SPA URL changes via polling in case YT events don't
    // fire as expected for this transition. A subtree MutationObserver was
    // tried here first but fired on every thumbnail load/recommendation
    // re-render across all of YouTube, not just history — heavy CPU cost
    // for a check this cheap.
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNav();
      }
    }, 500);

    // Wake locks auto-release when the tab is hidden — reacquire once it's
    // visible again if a scan/deletion is still mid-flight.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' &&
          (currentState === STATE.SCANNING || currentState === STATE.DELETING)) {
        acquireWakeLock();
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
    margin: 12px 60px 12px 40px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    box-sizing: border-box;
    position: sticky;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    z-index: 1;
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
  #ytc-panel .ytc-btn-blue   { background: #1a73e8; color: #fff; }
  #ytc-panel .ytc-btn-red    { background: #d93025; color: #fff; }
  #ytc-panel .ytc-btn-cancel {
    background: transparent;
    color: #5f6368;
    border: 1px solid #dadce0;
  }
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
    color: #fff;
  }
  html[dark] #ytc-panel .ytc-btn-cancel {
    color: #aaa;
    border-color: #3d3d3d;
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
  html[dark] #ytc-panel .ytc-cal-cell.range-start,
  html[dark] #ytc-panel .ytc-cal-cell.range-end,
  html[dark] #ytc-panel .ytc-cal-cell.selected-single {
    background: #1a73e8;
    color: #fff;
  }

  /* Manual per-row delete button. Lives inside YouTube's own thumbnail
     markup, not the panel, and sits over an arbitrary photograph — so its
     rest state borrows the same dark scrim YouTube's own duration badge
     uses rather than assuming anything about page background or theme.

     TOP-LEFT IS LOAD-BEARING, not an aesthetic preference. Verified on the
     live page: YouTube's hover overlay puts "Watch later" at almost exactly
     the box this button used to occupy on the right (ours 307-347, theirs
     311-343), and it wins the paint order — our button came 8th of 8 in
     elementsFromPoint at its own centre, so it was invisible AND unclickable.
     Raising z-index does NOT fix it (tested at 60: still covered), because
     that overlay sits in a stacking context ours can't reach from inside
     yt-thumbnail-view-model. The left corner holds only the thumbnail image,
     so moving there fixes both problems at the original z-index. */
  #ytc-row-x {
    position: absolute;
    top: 0;
    left: 0;
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-sizing: border-box;
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.94);
    transition: opacity 0.12s ease, transform 0.12s ease;
    z-index: 3;
  }
  /* The scrim disc. z-index here is NOT decoration: an absolutely-positioned
     pseudo-element paints in a later phase than static in-flow children, so
     without an explicit order this disc covers the glyph it is supposed to sit
     behind — the ✕ showed through at ~28% over the rest state and vanished
     entirely under the opaque hover fill.
     0.86 rather than the duration badge's 0.72: that value carries text at a
     known size, this carries a thin line glyph and needs more separation. The
     hairline ring is what keeps a dark disc from disappearing into a dark
     thumbnail — the one case a scrim alone cannot cover. */
  #ytc-row-x::before {
    content: '';
    position: absolute;
    inset: 5px;
    z-index: 0;
    border-radius: 50%;
    background: rgba(15, 15, 15, 0.86);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
    transition: background-color 0.15s ease;
  }
  #ytc-row-x.ytc-row-x-visible {
    opacity: 1;
    transform: scale(1);
  }
  #ytc-row-x:hover::before,
  #ytc-row-x:focus-visible::before {
    background: #CC0000;
  }
  #ytc-row-x:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  #ytc-row-x:disabled {
    cursor: default;
  }
  #ytc-row-x .ytc-row-x-icon,
  #ytc-row-x .ytc-row-x-spinner {
    color: #fff;
    position: relative;
    z-index: 1;
  }
  #ytc-row-x .ytc-row-x-spinner {
    display: none;
  }
  #ytc-row-x.ytc-row-x-busy .ytc-row-x-icon {
    display: none;
  }
  #ytc-row-x.ytc-row-x-busy .ytc-row-x-spinner {
    display: block;
    animation: ytc-row-x-spin 0.8s linear infinite;
  }
  @keyframes ytc-row-x-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    #ytc-row-x {
      transition: none;
      transform: none;
    }
    #ytc-row-x.ytc-row-x-busy .ytc-row-x-spinner {
      animation: none;
    }
  }
`;

  const STATE = {
    IDLE:      'idle',
    SCANNING:  'scanning',
    READY:     'ready',
    DELETING:  'deleting',
    DONE:      'done',
    CANCELLED: 'cancelled',
  };

  let currentState      = STATE.IDLE;
  let foundItems        = new Set();
  let deletedCount      = 0;
  let skippedCount      = 0;
  let cancelRequested   = false;
  let _navAbortFn       = null;
  let deletionStartTime = 0;
  let wakeLockSentinel  = null;

  let calendarMode  = false;
  let calendarYear  = 0;
  let calendarMonth = 0;
  let selectedStart = null;
  let selectedEnd   = null;
  let hoverDate     = null;

  const TIME_RANGES = [
    { label: '1 day',    days: 1   },
    { label: '3 days',   days: 3   },
    { label: '1 week',   days: 7   },
    { label: '2 weeks',  days: 14  },
    { label: '1 month',  days: 30  },
    { label: '3 months', days: 90  },
    { label: '6 months', days: 180 },
    { label: 'All time', days: null },
  ];

  // Web Worker-based sleep so timers keep running in background tabs.
  // Falls back to setTimeout if the worker can't be created (e.g., CSP).
  let _timerWorker = null;
  let _workerFailed = false;
  let _timerSeq    = 0;

  function getTimerWorker() {
    if (_workerFailed) return null;
    if (_timerWorker)  return _timerWorker;
    try {
      const src = 'self.onmessage=function(e){setTimeout(function(){self.postMessage(e.data[0]);},e.data[1]);};';
      const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      const w = new Worker(url);
      w.addEventListener('error', () => { _workerFailed = true; _timerWorker = null; });
      _timerWorker = w;
      return w;
    } catch (err) {
      _workerFailed = true;
      return null;
    }
  }

  // Hidden tabs clamp setTimeout to ~1s, so a 150ms-per-item deletion stretches
  // to seconds per item and starts skipping rows outright. The Worker above can
  // never help on YouTube — Trusted Types rejects the blob URL, and CSP blocks
  // blob: workers even past that — but the audio clock runs on its own thread
  // and is not throttled while the tab is hidden. Scheduling a silent source to
  // stop and waiting for its 'ended' event gives a timer that needs no URL at
  // all, so nothing in YouTube's CSP has anything to bite on.
  let _audioCtx    = null;
  let _audioSink   = null;
  let _audioFailed = false;

  function getAudioClock() {
    if (_audioFailed) return null;
    if (_audioCtx)    return _audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { _audioFailed = true; return null; }
      const ctx = new Ctx();
      // The graph has to reach the destination for the context to keep running,
      // so it terminates in a zero gain node and never makes a sound.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);
      _audioCtx  = ctx;
      _audioSink = sink;
      return ctx;
    } catch (err) {
      _audioFailed = true;
      return null;
    }
  }

  // Autoplay policy only lets a context start from a user gesture, so this is
  // called synchronously from the Scan/Delete click, not lazily from sleep().
  function startAudioClock() {
    const ctx = getAudioClock();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // Closing it drops the tab's audio indicator as soon as a run finishes.
  function stopAudioClock() {
    if (_audioCtx) {
      _audioCtx.close().catch(() => {});
      _audioCtx  = null;
      _audioSink = null;
    }
  }

  function audioSleep(ms) {
    const ctx = getAudioClock();
    if (!ctx || ctx.state !== 'running') return null;
    try {
      const src = ctx.createConstantSource();
      src.connect(_audioSink);
      const ended = new Promise(resolve => { src.onended = resolve; });
      src.start();
      src.stop(ctx.currentTime + ms / 1000);
      return ended;
    } catch (err) {
      return null;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };

      // Always-on backup: setTimeout guarantees the promise resolves
      // even if the worker is dead, throttled, or silently blocked.
      setTimeout(finish, ms);

      // Unthrottled in hidden tabs, where the setTimeout above is clamped to
      // ~1s. Purely additive — if the context never started, this is a no-op
      // and the timer above still carries the run.
      const audio = audioSleep(ms);
      if (audio) audio.then(finish);

      const worker = getTimerWorker();
      if (!worker) return;

      const id = ++_timerSeq;
      const handler = e => {
        if (e.data === id) {
          worker.removeEventListener('message', handler);
          finish();
        }
      };
      worker.addEventListener('message', handler);
      try {
        worker.postMessage([id, ms]);
      } catch (err) {
        worker.removeEventListener('message', handler);
      }
    });
  }

  // Screen Wake Lock — keeps the display from sleeping/locking while a scan
  // or deletion is in progress. Only deters *screen* sleep; the spec releases
  // the lock automatically when the tab is hidden, so it can't fight tab
  // backgrounding (see visibilitychange handler in init() for reacquisition).
  async function acquireWakeLock() {
    // Must run synchronously off the originating click — see startAudioClock.
    startAudioClock();
    if (!('wakeLock' in navigator) || wakeLockSentinel) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
    } catch (err) {
      wakeLockSentinel = null;
    }
  }

  function releaseWakeLock() {
    stopAudioClock();
    if (wakeLockSentinel) {
      wakeLockSentinel.release().catch(() => {});
      wakeLockSentinel = null;
    }
  }

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

      case STATE.DELETING: {
        if (rangeEl) rangeEl.disabled = true;
        actionBtn.textContent = 'Cancel';
        actionBtn.className   = 'ytc-btn ytc-btn-cancel';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleCancel;
        insertInfo(actionBtn, 'red', 'Deleting...', `0 / ${data.total} deleted`, 0);
        const infoBox = document.querySelector('#ytc-panel .ytc-info-red');
        if (infoBox) {
          const eta = document.createElement('span');
          eta.id = 'ytc-eta';
          eta.style.cssText = 'display:block;font-size:11px;opacity:0.75;margin-top:3px;';
          infoBox.appendChild(eta);
        }
        setSegButtonsDisabled(true);
        if (calendarMode) renderCalendar();
        break;
      }

      case STATE.DONE: {
        if (rangeEl) rangeEl.disabled = false;
        actionBtn.textContent = 'Scan Again';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleReset;
        const doneLabel = data.skipped > 0
          ? `✓ Done! ${data.count} deleted, ${data.skipped} skipped`
          : `✓ Done! Deleted ${data.count} items`;
        insertInfo(actionBtn, 'green', doneLabel, null);
        insertRefreshButton(actionBtn);
        setSegButtonsDisabled(false);
        if (calendarMode) renderCalendar();
        break;
      }

      case STATE.CANCELLED: {
        if (rangeEl) rangeEl.disabled = false;
        actionBtn.textContent = 'Scan Again';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleReset;
        const cancelLabel = data.deleted > 0
          ? `Cancelled — ${data.deleted} deleted`
          : 'Cancelled';
        insertInfo(actionBtn, 'blue', cancelLabel, data.skipped > 0 ? `${data.skipped} skipped` : null);
        setSegButtonsDisabled(false);
        if (calendarMode) renderCalendar();
        break;
      }
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

  function insertRefreshButton(beforeNode) {
    const panel = document.getElementById('ytc-panel');
    const btn   = document.createElement('button');
    btn.className      = 'ytc-btn ytc-btn-cancel';
    btn.textContent    = 'Refresh Page';
    btn.style.marginBottom = '8px';
    btn.onclick = () => window.location.reload();
    panel.insertBefore(btn, beforeNode);
  }

  // Cached because this runs on every scan iteration. Self-healing: renderState
  // replaces the info box, so a disconnected node just triggers a re-query.
  let _scanCountEl = null;

  function updateScanningCount(count) {
    if (!_scanCountEl || !_scanCountEl.isConnected) {
      _scanCountEl = document.querySelector('#ytc-panel .ytc-info-blue:not(#ytc-cal-summary) .ytc-info-strong');
    }
    if (_scanCountEl) _scanCountEl.textContent = `Found ${count} items`;
  }

  function updateDeletingProgress(deleted, total, skipped) {
    const strong = document.querySelector('#ytc-panel .ytc-info-red .ytc-info-strong');
    const bar    = document.querySelector('#ytc-panel .ytc-progress-bar');
    const eta    = document.getElementById('ytc-eta');
    if (strong) {
      strong.textContent = skipped > 0
        ? `${deleted} deleted, ${skipped} skipped / ${total}`
        : `${deleted} / ${total} deleted`;
    }
    if (bar) bar.style.width = `${Math.round((deleted / total) * 100)}%`;
    if (eta && deleted > 0 && deleted < total) {
      const avgMs  = (Date.now() - deletionStartTime) / deleted;
      const remSec = Math.round(avgMs * (total - deleted) / 1000);
      eta.textContent = remSec >= 90
        ? `~${Math.round(remSec / 60)}m remaining`
        : `~${remSec}s remaining`;
    }
  }

  function initStateIdle() {
    foundItems      = new Set();
    deletedCount    = 0;
    skippedCount    = 0;
    cancelRequested = false;
    calendarMode    = false;
    selectedStart   = null;
    selectedEnd     = null;
    hoverDate       = null;
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

  const SCROLL_PAUSE_MS     = 800;  // ceiling for a scroll batch, not a fixed wait
  const SCROLL_POLL_MS      = 25;
  const SCROLL_MAX_SAME     = 2;
  const DELETE_STEP_MS      = 60;   // starting value; _stepMs adapts between MIN and MAX
  const STEP_MIN_MS         = 25;
  const STEP_MAX_MS         = 300;
  const SETTLE_MS           = 60;
  const MENU_POLL_MS        = 25;
  const DIALOG_TIMEOUT      = 1500;
  const CONFIRM_PROBE_ITEMS = 3;

  // Adaptive pacing for the deletion loop. _stepMs backs off when items get
  // skipped (YouTube lagging or throttling) and decays back down on a run of
  // clean deletions, so a responsive page isn't held to a worst-case delay.
  let _stepMs        = DELETE_STEP_MS;
  let _cleanStreak   = 0;
  let _lastScrollY   = -1;
  let _lastDocHeight = -1;

  // Whether YouTube actually raises a confirmation dialog for "Remove from
  // watch history". Measured rather than assumed: the first few deletions
  // probe for one, and if none ever appears the wait collapses to a single
  // synchronous check. Seeing one even once re-enables the full wait.
  let _confirmSeen   = 0;
  let _confirmProbes = 0;

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

    // YouTube renders older sections with an abbreviated month and no year,
    // e.g. "Jun 3", "May 26" — and occasionally a full name / trailing year.
    // Match on the month-name prefix so both "Jun" and "June" resolve.
    const monthDay = text.match(/^([A-Za-z]+)\s+(\d+)(?:,?\s+(\d{4}))?$/);
    if (monthDay) {
      const months = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];
      const key  = monthDay[1].toLowerCase();
      const mIdx = months.findIndex(m => m.startsWith(key));
      if (mIdx !== -1) {
        const year = monthDay[3] ? parseInt(monthDay[3], 10) : today.getFullYear();
        const d = new Date(year, mIdx, parseInt(monthDay[2], 10));
        if (!monthDay[3] && d > today) d.setFullYear(d.getFullYear() - 1);
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
    if (_manualBusy) return; // a row's ✕ click is still resolving
    foundItems      = new Set();
    deletedCount    = 0;
    cancelRequested = false;

    let filterFn;
    if (calendarMode) {
      const range = getCustomRange();
      filterFn = (headerText) => isSectionInCustomRange(headerText, range);
    } else {
      const cutoff = getCutoffDate();
      filterFn = (headerText) => isSectionOlderThanCutoff(headerText, cutoff);
    }

    // All-time scans used to drop the pause to 200ms for speed, which risked
    // reading a slow batch as a stall and stopping early. waitForGrowth gives
    // the same speed without that trade, so one ceiling now serves both.
    // Before any scrolling: continuation responses carry the tokens for every
    // row past the first screenful, and they are only observable in flight.
    installTokenHarvester();
    setState(STATE.SCANNING, { count: 0 });
    acquireWakeLock();
    scrollAndCollect(filterFn);
  }

  // Resolve as soon as the feed grows past prevHeight, or at maxMs. YouTube
  // usually appends the next batch well inside the ceiling, so waiting the
  // full pause on every iteration was most of the scan's wall time.
  async function waitForGrowth(prevHeight, maxMs) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await sleep(SCROLL_POLL_MS);
      if (document.documentElement.scrollHeight > prevHeight) return true;
    }
    return false;
  }

  async function scrollAndCollect(filterFn) {
    let sameSizeCount = 0;
    let lastHeight    = 0;

    // Per-run caches so each iteration costs O(new items) instead of
    // O(everything collected so far).
    //   verdicts: filterFn result per section, re-checked only if the header
    //             text changed (a section can be re-rendered in place).
    //   absorbed: how many #contents children were already walked.
    const verdicts = new WeakMap();
    const absorbed = new WeakMap();

    while (true) {
      for (const sec of document.querySelectorAll('ytd-item-section-renderer')) {
        const h = sec.querySelector('ytd-item-section-header-renderer');
        if (!h) continue;

        const headerText = h.textContent.trim();
        let verdict = verdicts.get(sec);
        if (!verdict || verdict.text !== headerText) {
          verdict = { text: headerText, match: filterFn(headerText) };
          verdicts.set(sec, verdict);
          absorbed.delete(sec);
        }
        if (!verdict.match) continue;

        const contents = sec.querySelector('#contents') ||
                         (sec.shadowRoot && sec.shadowRoot.querySelector('#contents'));
        if (!contents) continue;

        const children = contents.children;
        // Rewind one child: the last one seen may have still been rendering.
        // Re-adding is a no-op, foundItems is a Set.
        const from = Math.max(0, (absorbed.get(sec) ?? 0) - 1);
        for (let i = from; i < children.length; i++) {
          const child = children[i];
          if (child.tagName === 'YTD-REEL-SHELF-RENDERER') {
            const reelItems = [...child.querySelectorAll('ytd-reel-item-renderer')];
            if (reelItems.length > 0) {
              reelItems.forEach(ri => foundItems.add(ri));
            } else {
              const shelfItems = child.querySelector('#items');
              if (shelfItems) {
                [...shelfItems.children].forEach(ri => foundItems.add(ri));
              } else {
                foundItems.add(child);
              }
            }
          } else {
            foundItems.add(child);
          }
        }
        absorbed.set(sec, children.length);
      }

      updateScanningCount(foundItems.size);

      const currentHeight = document.documentElement.scrollHeight;
      sameSizeCount = currentHeight === lastHeight ? sameSizeCount + 1 : 0;
      lastHeight = currentHeight;

      // A feed with more to load keeps a continuation spinner at the bottom.
      // Once that is gone and the page has stopped growing, the end is certain,
      // so stop there rather than spending SCROLL_MAX_SAME further ceilings —
      // up to 1.6s of dead wait — confirming it by timeout.
      if (sameSizeCount >= 1 && !document.querySelector('ytd-continuation-item-renderer')) break;
      if (sameSizeCount >= SCROLL_MAX_SAME) break;

      window.scrollTo(0, currentHeight);
      await waitForGrowth(currentHeight, SCROLL_PAUSE_MS);
    }

    onScanComplete();
  }

  function onScanComplete() {
    document.getElementById('ytc-panel')?.scrollIntoView({ block: 'start' });
    releaseWakeLock();

    if (foundItems.size === 0) {
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
    setState(STATE.READY, { count: foundItems.size });
  }

  function removeNavAbort() {
    if (_navAbortFn) {
      window.removeEventListener('yt-navigate-finish', _navAbortFn);
      _navAbortFn = null;
    }
  }

  function handleDelete() {
    if (currentState !== STATE.READY) return;
    if (_manualBusy) return; // a row's ✕ click is still resolving
    deletedCount      = 0;
    skippedCount      = 0;
    cancelRequested   = false;
    _navAbortFn       = () => { cancelRequested = true; };
    deletionStartTime = Date.now();
    // Re-probe pacing and confirm-dialog behaviour from scratch each run.
    _stepMs        = DELETE_STEP_MS;
    _cleanStreak   = 0;
    _lastScrollY   = -1;
    _lastDocHeight = -1;
    _confirmSeen   = 0;
    _confirmProbes = 0;
    window.addEventListener('yt-navigate-finish', _navAbortFn, { once: true });
    const items = [...foundItems];
    setState(STATE.DELETING, { deleted: 0, total: items.length });
    acquireWakeLock();
    deleteNext(items);
  }

  const isMenuButton = btn => {
    // Never our own row-✕ button: it lives inside the row like YouTube's own
    // menu button does, so an unguarded label match here would let the batch
    // deleter click it as if it were "More actions".
    if (btn.dataset.ytcX) return false;
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    return label.includes('action') || label.includes('more');
  };

  // Expensive: scans every aria-label button on the page and measures each
  // box. Every getBoundingClientRect forces a layout reflow, so on a 1000+
  // item feed this is the most CPU-hungry call in the script. It runs at most
  // once per item — only when the cheap scoped lookup below fails entirely.
  function findMenuButtonByGeometry(item) {
    const itemRect = item.getBoundingClientRect();
    for (const btn of document.querySelectorAll('button[aria-label]')) {
      if (!isMenuButton(btn)) continue;
      const r = btn.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
      if (cx >= itemRect.left && cx <= itemRect.right &&
          cy >= itemRect.top  && cy <= itemRect.bottom) {
        return btn;
      }
    }
    return null;
  }

  async function waitForMenuButton(item, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return null;

      // Fast path: the action button is a descendant of the item. Match by
      // aria-label only — no getBoundingClientRect — so the poll loop never
      // forces a layout reflow. YouTube renders this button at zero size until
      // the row is hovered, but a programmatic .click() fires regardless of
      // visibility, so we must NOT gate on its measured box (doing so would
      // make every poll fall through to the costly global scan below).
      for (const btn of item.querySelectorAll('button[aria-label]')) {
        if (isMenuButton(btn)) return btn;
      }

      await sleep(30);
    }

    // Scoped lookup timed out (rare: e.g. a renderer that hosts the button in
    // an overlay outside the item subtree). Run the costly geometric scan
    // exactly once here as a last resort, never on the per-poll hot path.
    return cancelRequested ? null : findMenuButtonByGeometry(item);
  }

  const CONFIRM_SEL = [
    'yt-confirm-dialog-renderer #confirm-button button',
    'tp-yt-paper-dialog[opened] #confirm-button button',
    'paper-button[dialog-confirm]',
    'yt-button-renderer[dialog-confirm] button',
  ].join(', ');

  // "Remove from watch history" does not normally raise a confirmation dialog
  // — it removes the row and shows a snackbar. Polling a fixed 600ms for one
  // therefore burned that full budget on every single item, over half the
  // per-item cost. So probe on the first few deletions and, if nothing ever
  // appears, drop to a single synchronous check. If a dialog does show up
  // (now, or after some future YouTube change), the full wait re-engages for
  // the rest of the run.
  async function waitForConfirmButton() {
    const immediate = document.querySelector(CONFIRM_SEL);
    if (immediate) { _confirmSeen++; return immediate; }

    let timeout;
    if (_confirmSeen > 0)                        timeout = 600;
    else if (_confirmProbes < CONFIRM_PROBE_ITEMS) timeout = 400;
    else                                         return null;

    _confirmProbes++;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return null;
      await sleep(20);
      const btn = document.querySelector(CONFIRM_SEL);
      if (btn) { _confirmSeen++; return btn; }
    }
    return null;
  }

  // The one dropdown YouTube reuses for every row's overflow menu. It stays in
  // the DOM between items and is marked aria-hidden while closed, so "a menu is
  // open" means an instance of this selector without that attribute.
  const DROPDOWN_SEL  = 'ytd-popup-container tp-yt-iron-dropdown:not([aria-hidden="true"])';
  const MENU_ITEM_SEL = 'ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model';

  function dismissOpenMenu() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  // Dismiss the menu the previous item left open, and wait until it is really
  // gone. Clicking the next row's menu button while the old dropdown is still
  // on screen makes YouTube treat that click as a dismiss and never open the
  // new menu — and because the dropdown node is reused, waitForMenuOption then
  // matches the *previous* row's "Remove from watch history" entry. Clicking
  // that is a no-op against a row that is already deleted, so the current row
  // survives while still being counted as removed. Until v1.12 the 200ms step
  // delay plus an unconditional 200ms settle happened to cover the close
  // animation; v1.14's tighter pacing no longer does, so close it explicitly.
  async function closeOpenMenu(timeout = 500) {
    if (!document.querySelector(DROPDOWN_SEL)) return true;
    dismissOpenMenu();
    // Re-check before paying for a poll: deleteNext now dismisses the menu as
    // soon as the previous row is handled, so by the time we get here the
    // animation has usually already finished and this returns without sleeping.
    if (!document.querySelector(DROPDOWN_SEL)) return true;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(MENU_POLL_MS);
      if (!document.querySelector(DROPDOWN_SEL)) return true;
    }
    return false;
  }

  // Which video a row is currently showing. Polymer recycles a row's node for
  // the next video instead of removing it, so node identity alone cannot tell
  // "this row is gone" from "this row now holds the next item".
  function itemFingerprint(item) {
    const a = item.querySelector('a#video-title, a#thumbnail, a[href*="/watch"]');
    return a ? a.getAttribute('href') : null;
  }

  // Removing a row is fire-and-forget, so confirming it happened is the only
  // way to tell a real deletion from a click that landed on a stale menu.
  // Detachment is NOT that signal: YouTube leaves the node in the document and
  // hides, collapses, or recycles it, which made every genuine deletion read as
  // a failure. scrollItemIntoView guarantees a non-zero box in view just before
  // the click, so a box that has since collapsed is meaningful.
  function isRemoved(item, fingerprint) {
    if (!item.isConnected)        return true;
    if (item.offsetParent === null) return true;
    const r = item.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return true;
    return fingerprint !== null && itemFingerprint(item) !== fingerprint;
  }

  async function waitForRemoval(item, fingerprint, timeout = 1200) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (isRemoved(item, fingerprint)) return true;
      await sleep(MENU_POLL_MS);
    }
    return false;
  }

  // Deleting a row shrinks the feed above the rows below it, so the next item
  // slides into place without window.scrollY ever changing. Gating the settle
  // on scrollY alone therefore skipped it in the common case and probed rows
  // mid-reflow, so watch the document height too.
  function viewportSettled() {
    const height  = document.documentElement.scrollHeight;
    const settled = window.scrollY === _lastScrollY && height === _lastDocHeight;
    _lastScrollY   = window.scrollY;
    _lastDocHeight = height;
    return settled;
  }

  // Two animation frames is the real "layout has settled" signal and usually
  // lands in ~32ms against the old flat 60ms. rAF never fires in a hidden tab
  // though, so race it against that same fixed wait: the foreground gets the
  // cut, a background tab still resolves on the timer.
  function settleFrames() {
    const frames = new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    return Promise.race([frames, sleep(SETTLE_MS)]);
  }

  // Bring a row into the viewport before interacting with it. item.scrollIntoView
  // ({behavior:'instant'}) is unreliable in Safari and silently no-ops there,
  // which left every row below the fold off-screen — YouTube never renders an
  // off-screen row's hover menu, so those deletions were all skipped. We scroll
  // with window.scrollTo (proven reliable during the scan), then verify the row
  // actually landed in view and retry before giving up.
  async function scrollItemIntoView(item) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const rect = item.getBoundingClientRect();

      // A row YouTube has not laid out yet measures as an all-zero box, and the
      // centre test below reads those zeros as "already in view" (0 >= 0 and
      // 0 <= innerHeight). That silently exempted exactly the rows that needed
      // scrolling: no scroll, no settle, straight to a menu that isn't there.
      // Give it a step to acquire a box instead of trusting the zeros.
      if (rect.width === 0 && rect.height === 0) {
        await sleep(_stepMs);
        continue;
      }

      const center = rect.top + rect.height / 2;
      if (center >= 0 && center <= window.innerHeight) {
        // Already in view. The first pass used to settle for a full step delay
        // unconditionally, which — together with the step delay at the end of
        // deleteNext — bracketed every item with two waits. Only settle if the
        // viewport actually moved since the last item; if it didn't, there is
        // nothing to settle and we can go straight to the menu.
        if (attempt === 0 && !viewportSettled()) await settleFrames();
        return true;
      }
      const absoluteTop = rect.top + window.scrollY;
      window.scrollTo(0, Math.max(0, absoluteTop - window.innerHeight / 2));
      _lastScrollY   = window.scrollY;
      _lastDocHeight = document.documentElement.scrollHeight;
      await sleep(_stepMs);
    }
    const rect = item.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  // ---------------------------------------------------------------------------
  // InnerTube fast path
  //
  // Deleting through the UI costs a scroll, a hover, a menu open, a click and a
  // removal check per row. The menu entry those clicks eventually reach is just
  // a POST to /youtubei/v1/feedback carrying an opaque feedbackToken, and that
  // endpoint takes an ARRAY of tokens — so the whole run can collapse into a
  // handful of requests.
  //
  // Verified against the live page (2026-09-05):
  //   - Rows render as yt-lockup-view-model. The ELEMENT exposes no token at
  //     all: rawProps, componentProps, _signalValues, slotProps, _signalProps
  //     and queuingData were all searched and are empty of it. There is no
  //     Polymer .data on these, so the token has to come from the JSON.
  //   - In the payload it sits at
  //       lockupViewModel -> ... -> listItemViewModel{title "Remove from watch
  //       history"} -> rendererContext.commandContext.onTap.innertubeCommand
  //       -> feedbackEndpoint.feedbackToken
  //   - lockupViewModel.contentId is the videoId, which is also in the row's
  //     /watch?v= href — that is the join between DOM row and token.
  //   - 55/55 visible rows resolved this way, zero misses.
  const _tokenMap = new Map();   // videoId -> { tok, ctp }
  let _harvestInstalled = false;
  let _apiUsable = null;         // null = unproven, true/false = measured

  // Find the token for the "Remove from watch history" entry specifically.
  // Taking the first feedbackToken in the subtree is NOT safe: at page level
  // the earliest ones belong to the sidebar's "Clear all watch history" button,
  // and firing one of those would wipe the entire history instead of one row.
  // Depth caps are also a trap here — this nests deeper than it looks (a cap of
  // 14 finds nothing, 25 finds a fraction), so the walk is uncapped and relies
  // on the WeakSet to terminate.
  function removeCommandOfLockup(lockup) {
    let found = null;
    const seen = new WeakSet();
    (function walk(x) {
      if (found || !x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      const li = x.listItemViewModel;
      if (li && li.title && typeof li.title.content === 'string' &&
          /remove from watch history/i.test(li.title.content)) {
        const inner = new WeakSet();
        (function dig(y) {
          if (found || !y || typeof y !== 'object' || inner.has(y)) return;
          inner.add(y);
          // Prefer the innertubeCommand itself: it carries the token in
          // .feedbackEndpoint AND its own clickTrackingParams as a sibling, so
          // one match yields both halves of the request.
          if (y.feedbackEndpoint && typeof y.feedbackEndpoint.feedbackToken === 'string') {
            found = { tok: y.feedbackEndpoint.feedbackToken,
                      ctp: typeof y.clickTrackingParams === 'string' ? y.clickTrackingParams : null };
            return;
          }
          // Fallback for a shape that hangs the token somewhere else; the
          // request still goes out, just without clickTracking.
          if (typeof y.feedbackToken === 'string') { found = { tok: y.feedbackToken, ctp: null }; return; }
          for (const k of Object.keys(y)) { try { dig(y[k]); } catch (e) {} }
        })(li);
        if (found) return;
      }
      for (const k of Object.keys(x)) { try { walk(x[k]); } catch (e) {} }
    })(lockup);
    return found;
  }

  function harvestTokens(root) {
    if (!root || typeof root !== 'object') return;
    const seen = new WeakSet();
    (function walk(o) {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      const lk = o.lockupViewModel;
      if (lk && lk.contentId && !_tokenMap.has(lk.contentId)) {
        const c = removeCommandOfLockup(lk);
        if (c) _tokenMap.set(lk.contentId, c);
      }
      for (const k of Object.keys(o)) { try { walk(o[k]); } catch (e) {} }
    })(root);
  }

  // ytInitialData only covers the first screenful. Everything the scan scrolls
  // to arrives in /youtubei/v1/browse continuations, so the harvester has to be
  // in place BEFORE scrolling or most rows will have no token. The wrapper
  // never alters the request or the returned promise — it clones the response
  // and reads it on the side, so a failure here cannot break the page.
  function installTokenHarvester() {
    if (_harvestInstalled) return;
    _harvestInstalled = true;
    try { harvestTokens(window.ytInitialData); } catch (e) {}
    const origFetch = window.fetch;
    if (typeof origFetch !== 'function') return;
    window.fetch = function (...args) {
      const promise = origFetch.apply(this, args);
      try {
        const req = args[0];
        const url = typeof req === 'string' ? req : (req && req.url) || '';
        if (/\/youtubei\/v1\/(browse|next)/.test(url)) {
          promise.then(res => {
            try {
              res.clone().json().then(j => { try { harvestTokens(j); } catch (e) {} }, () => {});
            } catch (e) {}
          }, () => {});
        }
      } catch (e) {}
      return promise;
    };
  }

  function videoIdOf(item) {
    const a = item.querySelector('a[href*="/watch"]');
    const m = a && (a.getAttribute('href') || '').match(/[?&]v=([^&]+)/);
    return m ? m[1] : null;
  }

  // One POST, many tokens. Resolves to the number the server reported as
  // processed, or -1 if the call itself failed (auth, shape, network) so the
  // caller can fall back to the DOM rather than silently counting nothing.
  async function apiDeleteBatch(tokens, clickTrackingParams) {
    let key, context;
    try {
      key     = window.ytcfg && ytcfg.get('INNERTUBE_API_KEY');
      context = window.ytcfg && ytcfg.get('INNERTUBE_CONTEXT');
    } catch (e) { return -1; }
    if (!key || !context) return -1;

    let res;
    try {
      res = await fetch('/youtubei/v1/feedback?key=' + encodeURIComponent(key) + '&prettyPrint=false', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The top-level envelope below was already correct — a hand-captured
          // request from YouTube's own UI carries exactly these four keys with
          // these two boolean values. What the first attempt got HTTP 400
          // "Request contains an invalid argument" for was the CONTEXT:
          // ytcfg's INNERTUBE_CONTEXT has no clickTracking, and the endpoint
          // wants the clickTrackingParams belonging to the very menu command
          // the token came from. Harvested together in removeCommandOfLockup.
          context: clickTrackingParams
            ? Object.assign({}, context, { clickTracking: { clickTrackingParams } })
            : context,
          feedbackTokens:            tokens,
          isFeedbackTokenUnencrypted: false,
          shouldMerge:                false,
        }),
      });
    } catch (e) { return -1; }
    if (!res.ok) return -1;

    let json;
    try { json = await res.json(); } catch (e) { return -1; }
    const responses = json && json.feedbackResponses;
    if (!Array.isArray(responses)) {
      // No per-token breakdown. Trust it only if the request itself succeeded.
      return json && json.responseContext ? tokens.length : -1;
    }
    return responses.filter(r => r && r.isProcessed).length;
  }

  // Delete everything we hold a token for, and return the rows that still need
  // the DOM path. The first row goes out ALONE and is confirmed against the DOM
  // before anything is batched: an endpoint that answers 200 while changing
  // nothing would otherwise burn the whole queue reporting a clean run over
  // history that is still there — the exact failure v1.16 was written to stop.
  async function deleteViaApi(items, total) {
    if (!items.length) return items;

    const pending = [];
    for (const item of items) {
      const id  = item.isConnected ? videoIdOf(item) : null;
      const cmd = id && _tokenMap.get(id);
      if (cmd) pending.push({ item, tok: cmd.tok, ctp: cmd.ctp });
    }
    if (!pending.length) return items;

    const done = new Set();

    if (_apiUsable === null) {
      const probe       = pending[0];
      const fingerprint = itemFingerprint(probe.item);
      const processed   = await apiDeleteBatch([probe.tok], probe.ctp);
      if (processed === 1 && await waitForRemoval(probe.item, fingerprint, 3000)) {
        _apiUsable = true;
        done.add(probe.item);
        deletedCount++;
        updateDeletingProgress(deletedCount, total, skippedCount);
      } else {
        // Either the call failed or the row outlived it. Either way the fast
        // path is not trustworthy on this account today — hand everything back.
        _apiUsable = false;
        return items;
      }
    }
    if (_apiUsable !== true) return items;

    const BATCH = 50;
    const rest  = pending.filter(p => !done.has(p.item));
    for (let i = 0; i < rest.length; i += BATCH) {
      if (cancelRequested) break;
      const slice     = rest.slice(i, i + BATCH);
      const processed = await apiDeleteBatch(slice.map(p => p.tok), slice[0].ctp);
      if (processed < 0) break;                 // fall back for the remainder
      for (const p of slice) done.add(p.item);
      deletedCount += Math.min(processed, slice.length);
      updateDeletingProgress(deletedCount, total, skippedCount);
    }

    return items.filter(it => !done.has(it));
  }

  // The click sequence for one row: hover -> open its ⋮ menu -> click "Remove
  // from watch history" -> confirm if asked -> verify the row actually went
  // away. Shared by the batch loop below and the single-row ✕ button, so a fix
  // to this sequence only ever needs to happen once. Callers own everything
  // this does NOT do: counters, pacing/backoff, and the trailing step delay —
  // see the reason -> behavior table in the plan this was built from.
  async function domRemoveItem(item) {
    if (!await scrollItemIntoView(item)) {
      // Couldn't get the row on-screen, so YouTube won't render its hover
      // menu — skip rather than click a button that isn't really there.
      return { ok: false, reason: 'scroll' };
    }

    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true }));
    const menuBtn = await waitForMenuButton(item, 300);

    if (!menuBtn) {
      return { ok: false, reason: 'menu' };
    }

    await closeOpenMenu();
    menuBtn.click();

    const removeBtn = await waitForMenuOption(MENU_ITEM_SEL, DIALOG_TIMEOUT);

    if (!removeBtn) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { ok: false, reason: 'option' };
    }

    const fingerprint = itemFingerprint(item);

    // yt-list-item-view-model doesn't handle click directly —
    // find the actual clickable child element inside it
    const clickTarget = removeBtn.querySelector('button, a, [role="option"], [role="menuitem"]') || removeBtn;
    clickTarget.click();

    const confirmBtn = await waitForConfirmButton();
    if (confirmBtn) confirmBtn.click();

    // Start the dropdown closing now so its animation overlaps waitForRemoval
    // and the step delay the caller pays, instead of being paid serially at
    // the top of the next item. closeOpenMenu() then normally finds it already
    // gone. This has to come *after* the confirm handling: an Escape dispatched
    // while a confirmation dialog is up dismisses the dialog itself and
    // cancels the very deletion we are waiting to observe.
    dismissOpenMenu();

    // Counting the click as a deletion is what made failures invisible: a
    // row that never went away still incremented the total, so the panel
    // reported a clean run over history that was still sitting there.
    if (await waitForRemoval(item, fingerprint)) {
      return { ok: true, reason: 'ok' };
    }
    return { ok: false, reason: 'removal' };
  }

  async function deleteNext(items) {
    // The step delay is the safety valve that lets the other waits run tight.
    // A row that wouldn't give up its menu means YouTube is lagging behind us,
    // so slow down; a clean run of deletions earns the pace back.
    const backOff = () => {
      _stepMs      = Math.min(_stepMs + 50, STEP_MAX_MS);
      _cleanStreak = 0;
    };
    const noteClean = () => {
      if (++_cleanStreak >= 5) {
        _cleanStreak = 0;
        _stepMs      = Math.max(_stepMs - 25, STEP_MIN_MS);
      }
    };

    // Fast path first; whatever it could not resolve falls through to the DOM
    // loop below, which stays exactly as it was.
    const total = items.length;
    items = await deleteViaApi(items, total);

    for (let i = 0; i < items.length; i++) {
      if (!items[i].isConnected) {
        skippedCount++;
        updateDeletingProgress(deletedCount, total, skippedCount);
        continue;
      }
      if (cancelRequested) {
        removeNavAbort();
        releaseWakeLock();
        setState(STATE.CANCELLED, { deleted: deletedCount, skipped: skippedCount });
        return;
      }

      const item = items[i];
      const { ok, reason } = await domRemoveItem(item);

      if (ok) {
        deletedCount++;
        noteClean();
        updateDeletingProgress(deletedCount, total, skippedCount);
        await sleep(_stepMs);
        continue;
      }

      skippedCount++;
      backOff();
      updateDeletingProgress(deletedCount, total, skippedCount);

      // 'scroll' and 'menu' failures paid no wait in the original loop — the
      // row was never actually interacted with, so there's nothing to settle.
      if (reason === 'scroll' || reason === 'menu') continue;
      await sleep(_stepMs);
    }

    removeNavAbort();
    releaseWakeLock();
    setState(STATE.DONE, { count: deletedCount, skipped: skippedCount });
  }

  // Keep polling until the "Remove from watch history" entry actually shows up.
  // Bailing on the first non-empty query (the previous behaviour) surrendered
  // to half-rendered popups and to leftovers from the prior item, turning a
  // deletable row into a skip — and a skip costs more time than waiting does.
  // Scoping to the live dropdown is what makes a stale popup unable to match.
  async function waitForMenuOption(menuItemSel, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return null;

      const root     = document.querySelector(DROPDOWN_SEL);
      const fallback = !root;

      for (const mi of (root || document).querySelectorAll(menuItemSel)) {
        if (!mi.textContent.trim().toLowerCase().includes('remove from watch history')) continue;
        // Scoping to the live dropdown is what makes a stale popup unable to
        // match. On the unscoped fallback that guarantee is gone, so pay for a
        // measurement there and reject an entry with no box on screen.
        if (fallback) {
          const r = mi.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
        }
        return mi;
      }
      await sleep(MENU_POLL_MS);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Manual per-row delete (the ✕ button)
  //
  // One reusable button is moved into whichever row's thumbnail is hovered or
  // focused, driven by delegated listeners on the history page's browse
  // element — never a per-row injection, and never a MutationObserver (see the
  // note in init() about the CPU cost that caused on this project).
  //
  // Everything below is written around one constraint: this must never be able
  // to interfere with a scan or a batch delete in progress. Each guard has a
  // number; see the plan's "Non-interference contract" for the full reasoning.

  const ROW_SEL = 'yt-lockup-view-model, ytd-video-renderer';

  // Tried in order; the first match hosts the button. The fallback — the same
  // watch-page anchor videoIdOf/itemFingerprint already rely on — is always
  // present, just less precisely scoped to the thumbnail image itself.
  const THUMB_HOST_SELECTORS = ['ytd-thumbnail', 'yt-thumbnail-view-model', '#thumbnail'];

  function findThumbHost(row) {
    for (const sel of THUMB_HOST_SELECTORS) {
      const el = row.querySelector(sel);
      if (el) return el;
    }
    return row.querySelector('a[href*="/watch"]');
  }

  let _manualBusy    = false; // guard 4/6/7: a ✕ click is resolving; blocks scan/delete
  let _rowXBtn       = null;  // the one reusable button element
  let _rowXRow       = null;  // which row it's currently attached to, if any
  let _rowXThumbHost = null;  // the thumbnail host it's parented to right now
  let _rowXBrowseEl  = null;  // the browse element carrying our delegated listeners

  // Builds an <svg> via the SVG namespace rather than an innerHTML string.
  // YouTube enforces Trusted Types (the same block that killed the blob
  // Worker, per this project's notes) — an innerHTML string assignment is
  // exactly the kind of sink that policy can reject outright.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function buildSvgIcon(className, shapeTag, shapeAttrs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', className);
    // Rendered 1:1 against the 24-unit viewBox — no fractional downscale, so
    // the strokes land on whole pixels. The ✕ path spans 12 of those units,
    // giving a 12px glyph in a 30px disc: the same glyph-to-circle ratio
    // YouTube's own hover-overlay buttons use right next to it. At 14px the
    // icon read as visibly daintier than its neighbours.
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(SVG_NS, shapeTag);
    for (const [k, v] of Object.entries(shapeAttrs)) shape.setAttribute(k, v);
    svg.appendChild(shape);
    return svg;
  }

  function ensureRowXBtn() {
    if (_rowXBtn) return _rowXBtn;
    const btn = document.createElement('button');
    btn.id   = 'ytc-row-x';
    btn.type = 'button';
    btn.dataset.ytcX = '1'; // guard 1: invisible to isMenuButton
    btn.setAttribute('aria-label', 'Remove from watch history');
    btn.title = 'Remove from watch history';
    btn.appendChild(buildSvgIcon('ytc-row-x-icon', 'path', {
      d: 'M6 6 L18 18 M18 6 L6 18', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round',
    }));
    // r:8 keeps the busy ring inside the same optical circle the ✕ occupies,
    // so swapping one for the other doesn't change the button's weight.
    btn.appendChild(buildSvgIcon('ytc-row-x-spinner', 'circle', {
      cx: '12', cy: '12', r: '8', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round',
      'stroke-dasharray': '30 20',
    }));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = _rowXRow;
      if (row) handleRowX(row);
    });
    _rowXBtn = btn;
    return btn;
  }

  function showRowXOn(row) {
    if (_rowXRow === row) return;
    const host = findThumbHost(row);
    if (!host) { hideRowX(); return; }

    hideRowX();

    const btn = ensureRowXBtn();
    // Guard 9: only claim position:relative if the host doesn't already have
    // one (most YT thumbnail hosts do — they anchor the duration badge the
    // same way), and always give it back.
    if (getComputedStyle(host).position === 'static') {
      host.dataset.ytcPosPatched = '1';
      host.style.position = 'relative';
    }
    host.appendChild(btn);
    btn.classList.remove('ytc-row-x-visible');
    void btn.offsetWidth; // force reflow so the reveal transition replays per row
    btn.classList.add('ytc-row-x-visible');

    _rowXRow       = row;
    _rowXThumbHost = host;
  }

  function hideRowX() {
    if (_rowXBtn) {
      _rowXBtn.classList.remove('ytc-row-x-visible');
      if (_rowXBtn.parentElement) _rowXBtn.remove();
    }
    if (_rowXThumbHost && _rowXThumbHost.dataset.ytcPosPatched) {
      _rowXThumbHost.style.position = '';
      delete _rowXThumbHost.dataset.ytcPosPatched;
    }
    _rowXRow       = null;
    _rowXThumbHost = null;
  }

  // Guard 3: a batch run owns the page. The synthetic mouseenter/mouseover it
  // dispatches at every row would otherwise drag this button along behind it,
  // and a manual click mid-run would fight the batch over YouTube's one shared
  // dropdown — the exact failure closeOpenMenu()'s comment documents.
  function handleRowPointerEvent(e) {
    if (currentState === STATE.SCANNING || currentState === STATE.DELETING) {
      hideRowX();
      return;
    }
    const row = e.target.closest(ROW_SEL);
    if (!row) return;
    showRowXOn(row);
  }

  // mouseout, not mouseleave: mouseleave never bubbles, so a delegated
  // listener using it would only fire once — when the pointer leaves the
  // whole feed — instead of once per row.
  function handleRowPointerLeave(e) {
    if (!_rowXRow) return;
    if (e.relatedTarget && _rowXRow.contains(e.relatedTarget)) return;
    hideRowX();
  }

  function installRowHoverListeners(browseEl) {
    if (!browseEl || _rowXBrowseEl === browseEl) return;
    teardownRowHoverListeners();
    browseEl.addEventListener('mouseover', handleRowPointerEvent);
    browseEl.addEventListener('focusin',   handleRowPointerEvent);
    browseEl.addEventListener('mouseout',  handleRowPointerLeave);
    _rowXBrowseEl = browseEl;
  }

  // Guard 10: torn down in the same handleNav branch that removes #ytc-panel
  // when leaving /feed/history.
  function teardownRowHoverListeners() {
    hideRowX();
    if (!_rowXBrowseEl) return;
    _rowXBrowseEl.removeEventListener('mouseover', handleRowPointerEvent);
    _rowXBrowseEl.removeEventListener('focusin',   handleRowPointerEvent);
    _rowXBrowseEl.removeEventListener('mouseout',  handleRowPointerLeave);
    _rowXBrowseEl = null;
  }

  // Mirrors onScanComplete's "No items found" box: built by hand (not via
  // insertInfo) so we keep a reference to remove it after a few seconds, and
  // deliberately given no .ytc-info-strong child — updateDeletingProgress
  // finds its number via "#ytc-panel .ytc-info-red .ytc-info-strong" and must
  // never match this one-off message.
  function showRowXFailure() {
    const panel     = document.getElementById('ytc-panel');
    const actionBtn = document.getElementById('ytc-action');
    if (!panel || !actionBtn) return;
    const msg = document.createElement('div');
    msg.className   = 'ytc-info ytc-info-red';
    msg.textContent = "Couldn't remove that video. Try again, or use the ⋮ menu.";
    panel.insertBefore(msg, actionBtn);
    setTimeout(() => msg.remove(), 3000);
  }

  // Guards 4-8 live here. This calls the same domRemoveItem() the batch loop
  // uses and nothing else — no InnerTube fast path (guard 6), no batch
  // counters/pacing/wake lock (guard 7).
  async function handleRowX(row) {
    if (_manualBusy) return; // guard 4: no overlapping manual clicks
    // Guard 3, belt & suspenders: handleScan/handleDelete already refuse to
    // start while _manualBusy is true, so this should be unreachable, but a
    // click already in flight when a run starts must still be inert.
    if (currentState === STATE.SCANNING || currentState === STATE.DELETING) return;

    _manualBusy = true;
    // Guard 5: a Cancel from an earlier run must not silently block this
    // click — every wait helper below short-circuits on cancelRequested, and
    // nothing else clears it once a run finishes cancelled.
    cancelRequested = false;
    if (_rowXBtn) {
      _rowXBtn.disabled = true;
      _rowXBtn.classList.add('ytc-row-x-busy');
    }

    let result;
    try {
      result = await domRemoveItem(row);
    } finally {
      _manualBusy = false;
      if (_rowXBtn) {
        _rowXBtn.disabled = false;
        _rowXBtn.classList.remove('ytc-row-x-busy');
      }
    }

    if (result.ok) {
      // Only tidy up the button if it's still parented to the row we just
      // removed — the user may have moved the pointer to a different row
      // while this was resolving, and that row's button shouldn't vanish
      // out from under them.
      if (_rowXRow === row) hideRowX();

      // Guard 8: keep a pending READY count and the batch's pacing honest.
      // Without this, a later delete run walks into the tombstone this row
      // just became, finds no menu button, and pays a skip *and* a backoff
      // for a row that was already gone.
      if (foundItems.has(row)) {
        foundItems.delete(row);
        if (currentState === STATE.READY) {
          if (foundItems.size === 0) setState(STATE.IDLE);
          else setState(STATE.READY, { count: foundItems.size });
        }
      }
    } else {
      showRowXFailure();
    }
  }

  function handleCancel() {
    if (currentState !== STATE.DELETING) return;
    cancelRequested = true;
    const actionBtn = document.getElementById('ytc-action');
    if (actionBtn) {
      actionBtn.disabled    = true;
      actionBtn.textContent = 'Cancelling…';
    }
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

    // Wait for the history page itself to mount — #secondary alone exists on
    // many YT pages, so without this guard we can inject into a stale sidebar
    // that YouTube then replaces during the SPA transition.
    const historyPageSel = 'ytd-browse[page-subtype="history"]';

    if (isMobile) {
      waitForElement(historyPageSel, (browseEl) => {
        const el = document.querySelector('ytd-browse-filter-chip-bar-renderer, #secondary');
        if (el) appendPanel(el.parentElement || el, el.nextSibling);
        installRowHoverListeners(browseEl);
      });
    } else {
      waitForElement(historyPageSel, (browseEl) => {
        const sidebar = document.querySelector('ytd-browse[page-subtype="history"] #secondary') ||
                        document.querySelector('#secondary');
        if (sidebar) appendPanel(sidebar, null);
        installRowHoverListeners(browseEl);
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
