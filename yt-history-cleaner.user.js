// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.0
// @description  Bulk-delete YouTube watch history by time range
// @match        https://www.youtube.com/feed/history
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube is a SPA — wait for the sidebar to exist before injecting
  function waitForElement(selector, callback, interval = 300, maxWait = 15000) {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (Date.now() - start > maxWait) {
        clearInterval(timer);
        console.warn('[YT History Cleaner] Timed out waiting for', selector);
      }
    }, interval);
  }

  function init() {
    injectPanel();
  }

  function injectPanel() {
    // Desktop: right sidebar container
    // Mobile: below the "Manage all history" section
    // Both cases: append AFTER existing items
    const isMobile = window.innerWidth < 1014;

    if (isMobile) {
      waitForElement('ytd-secondary-search-container-renderer, #secondary', (el) => {
        appendPanel(el.parentElement || el, el.nextSibling);
      });
    } else {
      waitForElement('#secondary', (sidebar) => {
        appendPanel(sidebar, null); // append to end
      });
    }
  }

  function appendPanel(parent, beforeNode) {
    const wrapper = document.createElement('div');
    wrapper.id = 'ytc-panel';
    wrapper.textContent = 'YT History Cleaner placeholder';
    if (beforeNode) {
      parent.insertBefore(wrapper, beforeNode);
    } else {
      parent.appendChild(wrapper);
    }
    console.log('[YT History Cleaner] Panel injected');
  }

  init();
})();
