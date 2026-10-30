/* 富文本剪贴板：优先异步 Clipboard API，失败回退 execCommand */
(function (root) {
  'use strict';

  function legacy(html) {
    var host = document.createElement('div');
    host.setAttribute('contenteditable', 'true');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden;opacity:0;';
    host.innerHTML = html;
    document.body.appendChild(host);
    var range = document.createRange();
    range.selectNodeContents(host);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    sel.removeAllRanges();
    host.remove();
    return ok;
  }

  function copyRich(html, text) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      }

      if (navigator.clipboard && typeof window.ClipboardItem === 'function') {
        var item;
        try {
          item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text || ''], { type: 'text/plain' })
          });
        } catch (e) {
          item = null;
        }
        if (item) {
          navigator.clipboard.write([item]).then(function () {
            done('async');
          }).catch(function () {
            done(legacy(html) ? 'legacy' : false);
          });
          return;
        }
      }
      done(legacy(html) ? 'legacy' : false);
    });
  }

  root.DSCClip = { copyRich: copyRich };
})(typeof window !== 'undefined' ? window : this);
