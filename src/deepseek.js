/* 内容脚本：悬停回答出现剪藏按钮 + 接收侧边栏/快捷键指令 */
(function () {
  'use strict';

  if (window.__dscClipLoaded) return;
  window.__dscClipLoaded = true;

  var MSG = '.ds-message';
  var MD = '.ds-markdown';

  var opts = {};
  Object.keys(DSC.DEFAULTS).forEach(function (k) { opts[k] = DSC.DEFAULTS[k]; });

  function readOptions(cb) {
    try {
      chrome.storage.sync.get('dscOptions', function (res) {
        var saved = res && res.dscOptions;
        if (saved) Object.keys(saved).forEach(function (k) { opts[k] = saved[k]; });
        if (cb) cb();
      });
    } catch (e) {
      if (cb) cb();
    }
  }
  readOptions();

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'sync' && changes.dscOptions && changes.dscOptions.newValue) {
        var v = changes.dscOptions.newValue;
        Object.keys(v).forEach(function (k) { opts[k] = v[k]; });
      }
    });
  } catch (e) { /* 页面刷新前的旧上下文 */ }

  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'dsc-fab';
  fab.title = '把这条回答复制成保留排版的富文本，粘贴到印象笔记';
  fab.innerHTML = '<span class="dsc-dot"></span><span>剪藏到印象笔记</span>';
  (document.body || document.documentElement).appendChild(fab);

  var toastEl = null;
  var toastTimer = 0;

  function hideToast() {
    if (toastEl) {
      toastEl.classList.remove('show');
    }
  }

  function toast(text, withOpen) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'dsc-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '';
    var label = document.createElement('span');
    label.textContent = text;
    toastEl.appendChild(label);

    if (withOpen) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dsc-toast-act';
      btn.textContent = '打开印象笔记';
      btn.addEventListener('click', function () {
        chrome.runtime.sendMessage({ type: 'OPEN_YINXIANG' });
        hideToast();
      });
      toastEl.appendChild(btn);
    }

    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, withOpen ? 8000 : 3200);
  }

  var current = null;

  function place(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.bottom < 0 || rect.top > window.innerHeight) {
      hide();
      return;
    }
    var w = 132;
    var left = Math.min(rect.right - w - 12, window.innerWidth - w - 12);
    var top = Math.max(rect.top + 8, 8);
    fab.style.left = Math.max(left, 8) + 'px';
    fab.style.top = top + 'px';
    fab.style.display = 'inline-flex';
  }

  function hide() {
    current = null;
    fab.style.display = 'none';
  }

  function sync() {
    if (current && current.isConnected) place(current);
    else hide();
  }

  document.addEventListener('mousemove', function (e) {
    if (e.target === fab || fab.contains(e.target)) return;
    var node = null;
    if (e.target && e.target.closest) {
      node = e.target.closest(MSG) || e.target.closest('[class*="ds-message"]');
    }
    if (node && node.querySelector(MD)) {
      if (node !== current) {
        current = node;
        place(node);
      }
      return;
    }
    if (current) hide();
  }, true);

  window.addEventListener('scroll', sync, true);
  window.addEventListener('resize', sync);

  function clip(element, options, cb) {
    var note;
    try {
      note = DSC.build(element || null, options || opts);
    } catch (e) {
      note = null;
    }
    if (!note) {
      cb(false);
      return;
    }
    DSCClip.copyRich(note.html, note.text).then(function (how) {
      cb(!!how, note);
    });
  }

  fab.addEventListener('click', function () {
    var target = current;
    fab.style.display = 'none';

    var sel = window.getSelection();
    var selMode = false;
    if (sel && !sel.isCollapsed && sel.rangeCount) {
      var n = sel.anchorNode;
      var el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
      var holder = el && el.closest ? el.closest(MSG) : null;
      selMode = !!holder && (!target || holder === target);
    }

    clip(target, selMode ? { mode: 'selection' } : null, function (ok, note) {
      if (!ok) {
        toast('复制失败，先点一下页面再试');
        return;
      }
      toast('已复制「' + note.title + '」，去印象笔记 Ctrl+V', true);
      if (opts.autoOpen) chrome.runtime.sendMessage({ type: 'OPEN_YINXIANG' });
    });
  });

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;

    if (msg.type === 'DSC_INFO') {
      readOptions(function () { sendResponse(DSC.info()); });
      return true;
    }

    if (msg.type === 'DSC_GET_NOTE') {
      var note = null;
      try {
        note = DSC.build(null, msg.options || opts);
      } catch (e) {
        note = null;
      }
      if (note) {
        sendResponse({ ok: true, note: note });
      } else {
        var isSel = msg.options && msg.options.mode === 'selection';
        sendResponse({ ok: false, error: isSel ? '先在页面上选中要剪藏的文字' : '没抓到可剪藏的回答，等生成结束再试' });
      }
      return;
    }

    if (msg.type === 'DSC_CLIP_LAST') {
      clip(null, null, function (ok, note) {
        toast(ok ? '已复制「' + note.title + '」，去印象笔记 Ctrl+V' : '复制失败', ok);
      });
      sendResponse({ ok: true });
      return;
    }
  });
})();
