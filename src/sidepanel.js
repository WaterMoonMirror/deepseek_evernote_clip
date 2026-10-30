(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    sub: $('sub'),
    clip: $('clip'),
    status: $('status'),
    fix: $('fix'),
    retry: $('retry'),
    reload: $('reload'),
    thinking: $('opt-thinking'),
    links: $('opt-links'),
    autoOpen: $('opt-autoopen'),
    openYn: $('open-yn')
  };

  var options = {
    mode: 'qa',
    includeThinking: false,
    includeLinks: true,
    includeMeta: true,
    autoOpen: false
  };

  var tabId = null;
  var ready = false;
  var detecting = false;

  function setStatus(text, kind) {
    els.status.textContent = text || '';
    els.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function activeTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function send(tab, msg) {
    return new Promise(function (resolve) {
      if (!tab || !tab.id) return resolve(null);
      chrome.tabs.sendMessage(tab.id, msg, function (res) {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(res || null);
      });
    });
  }

  function paint() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.checked = r.value === options.mode;
    });
    els.thinking.checked = !!options.includeThinking;
    els.links.checked = !!options.includeLinks;
    els.autoOpen.checked = !!options.autoOpen;
  }

  function save() {
    chrome.storage.sync.set({ dscOptions: options });
  }

  function showFix(withReload) {
    els.fix.hidden = false;
    els.reload.hidden = !withReload;
  }

  function notReady(text, withReload) {
    ready = false;
    els.clip.disabled = true;
    els.sub.textContent = text;
    setStatus('');
    showFix(withReload);
  }

  // 页面刚加载、或扩展刚重载时内容脚本可能还没就绪，轮询几次再判定失败
  function detect(attempt) {
    if (detecting && attempt === 0) return Promise.resolve(null);
    detecting = true;

    return activeTab().then(function (tab) {
      if (!tab) {
        detecting = false;
        notReady('没有找到活动标签页', false);
        return null;
      }
      tabId = tab.id;

      if (!/^https:\/\/chat\.deepseek\.com\//.test(tab.url || '')) {
        detecting = false;
        notReady('当前不是 DeepSeek 对话页', false);
        return null;
      }

      return send(tab, { type: 'DSC_INFO' }).then(function (info) {
        detecting = false;

        if (!info || !info.ok) {
          if (attempt < 6) {
            setTimeout(function () { detect(attempt + 1); }, 600);
            return null;
          }
          notReady('连不上页面脚本：刷新 DeepSeek 页面即可', true);
          return null;
        }

        ready = true;
        els.fix.hidden = true;
        els.clip.disabled = info.answers === 0 && options.mode !== 'selection';
        els.sub.textContent = info.question || ('本页 ' + info.answers + ' 条回答');
        els.sub.title = info.question || '';
        if (!info.answers) {
          setStatus('本页还没有回答');
          els.clip.disabled = true;
        } else {
          setStatus('');
        }
        return info;
      });
    });
  }

  function runClip() {
    if (!ready) {
      setStatus('还没连上页面，正在重新检测…');
      detect(0).then(function (info) {
        if (info) runClip();
      });
      return;
    }
    els.clip.disabled = true;
    setStatus('正在整理…');
    send({ id: tabId }, { type: 'DSC_GET_NOTE', options: options }).then(function (res) {
      els.clip.disabled = false;
      if (!res || !res.ok) {
        setStatus(res && res.error ? res.error : '当前页面没有可剪藏的回答', 'err');
        return;
      }
      var note = res.note;
      DSCClip.copyRich(note.html, note.text).then(function (how) {
        if (!how) {
          setStatus('复制失败：点一下页面再试，或改用回答旁的剪藏按钮', 'err');
          return;
        }
        setStatus('已复制「' + note.title + '」（' + note.text.length + ' 字），去印象笔记 Ctrl+V', 'ok');
        if (options.autoOpen) {
          chrome.tabs.create({ url: 'https://www.yinxiang.com/' });
        }
      });
    });
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        options.mode = r.value;
        save();
        setStatus(options.mode === 'selection' ? '记得先在页面上选中要剪藏的文字' : '');
      });
    });
    els.thinking.addEventListener('change', function () {
      options.includeThinking = els.thinking.checked;
      save();
    });
    els.links.addEventListener('change', function () {
      options.includeLinks = els.links.checked;
      save();
    });
    els.autoOpen.addEventListener('change', function () {
      options.autoOpen = els.autoOpen.checked;
      save();
    });
    els.openYn.addEventListener('click', function () {
      chrome.tabs.create({ url: 'https://www.yinxiang.com/' });
    });
    els.clip.addEventListener('click', runClip);
    els.retry.addEventListener('click', function () {
      setStatus('正在重新检测…');
      detect(0);
    });
    els.reload.addEventListener('click', function () {
      if (!tabId) return;
      setStatus('正在刷新页面…');
      chrome.tabs.reload(tabId);
      setTimeout(function () { detect(0); }, 1200);
    });

    chrome.tabs.onActivated.addListener(function () { detect(0); });
    chrome.tabs.onUpdated.addListener(function (id, change) {
      if (id === tabId && change.status === 'complete') detect(0);
    });
  }

  function init() {
    chrome.storage.sync.get('dscOptions', function (res) {
      var saved = res && res.dscOptions;
      if (saved) {
        Object.keys(options).forEach(function (k) {
          if (saved[k] !== undefined) options[k] = saved[k];
        });
      }
      paint();
    });

    bind();
    detect(0);
  }

  init();
})();
