(function () {
  'use strict';

  // 總開關
  if (window.FUYUN_PROTECT_OFF === true) return;

  // SEO / AI 爬蟲偵測 — 符合則直接跳出，不啟動任何防護
  var BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|gptbot|claudebot|perplexitybot|google-extended|applebot|ccbot|oai-searchbot|anthropic-ai|cohere-ai|semrushbot|ahrefsbot|mj12bot|dotbot/i;
  if (BOT_PATTERN.test(navigator.userAgent)) return;

  // 判斷是否為可輸入欄位（表單例外放行）
  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // 停用右鍵選單
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });

  // 停用文字選取（套在 body inline style，input/textarea/contenteditable 例外）
  document.addEventListener('DOMContentLoaded', function () {
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.body.style.userSelect = 'none';
  }, { capture: true });

  // 若 DOMContentLoaded 已觸發則立即套用
  if (document.body) {
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.body.style.userSelect = 'none';
  }

  // 攔截 copy / cut / paste（表單欄位例外放行）
  ['copy', 'cut', 'paste'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (isEditable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });
  });

  // 圖片：draggable=false、停用 dragstart 與 contextmenu
  function protectImages() {
    var imgs = document.querySelectorAll('img');
    imgs.forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true });
      // 長按另存（行動端）
      img.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true });
    });
  }

  // 首次執行 + 動態插入圖片時再補掛
  document.addEventListener('DOMContentLoaded', protectImages, { capture: true });
  if (document.readyState !== 'loading') protectImages();

  var imgObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') {
          node.setAttribute('draggable', 'false');
        }
        var nested = node.querySelectorAll ? node.querySelectorAll('img') : [];
        nested.forEach(function (img) {
          img.setAttribute('draggable', 'false');
        });
      });
    });
  });
  imgObserver.observe(document.documentElement, { childList: true, subtree: true });

  // 停用 dragstart（全域，非表單欄位）
  document.addEventListener('dragstart', function (e) {
    if (isEditable(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });

  // 攔截快捷鍵
  var BLOCKED_KEYS = {
    F12: true,
    i: true, // Ctrl/Cmd+Shift+I
    I: true,
    j: true, // Ctrl/Cmd+Shift+J
    J: true,
    c: true, // Ctrl/Cmd+Shift+C（DevTools 元素選取）— 但不攔截純 Ctrl+C（表單需要）
    C: true,
    u: true, // Ctrl/Cmd+U
    U: true,
    s: true, // Ctrl/Cmd+S
    S: true
  };

  document.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;

    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (ctrl && e.shiftKey) {
      var k = e.key;
      // Ctrl/Cmd+Shift+I / J / C
      if (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (ctrl && !e.shiftKey) {
      var k2 = e.key;
      // Ctrl/Cmd+U（檢視原始碼）
      if (k2 === 'u' || k2 === 'U') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Ctrl/Cmd+S（另存新檔）
      if (k2 === 's' || k2 === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }, { capture: true });

})();
