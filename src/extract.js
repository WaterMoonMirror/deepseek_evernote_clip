/* DeepSeek -> 印象笔记：把网页版回答转换成粘贴后仍保持排版的干净 HTML */
(function (root) {
  'use strict';

  var MSG = '.ds-message';
  var MD = '.ds-markdown';
  var THINK = '.ds-think-content';

  var DEFAULTS = {
    mode: 'qa',              // 'answer' | 'qa' | 'all' | 'selection'
    includeThinking: false,
    includeLinks: true,
    includeMeta: true,
    autoOpen: false
  };

  var ST = {
    p: 'margin:0 0 12px;line-height:1.8;font-size:15px;color:#1f2329;',
    h1: 'margin:22px 0 12px;font-size:22px;font-weight:700;line-height:1.4;color:#1f2329;',
    h2: 'margin:20px 0 10px;font-size:19px;font-weight:700;line-height:1.45;color:#1f2329;',
    h3: 'margin:18px 0 8px;font-size:17px;font-weight:700;line-height:1.5;color:#1f2329;',
    h4: 'margin:16px 0 8px;font-size:15px;font-weight:700;line-height:1.5;color:#1f2329;',
    ul: 'margin:0 0 12px;padding-left:24px;',
    ol: 'margin:0 0 12px;padding-left:24px;',
    li: 'margin:4px 0;line-height:1.8;font-size:15px;color:#1f2329;',
    quote: 'margin:12px 0;padding:4px 14px;border-left:3px solid #d9d9d9;color:#5c6470;',
    pre: 'margin:0;padding:10px 14px;white-space:pre-wrap;word-break:break-word;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#24292f;',
    code: 'font-family:Menlo,Consolas,monospace;font-size:13px;background:#f2f3f5;border-radius:3px;padding:1px 4px;color:#c7254e;',
    table: 'border-collapse:collapse;margin:12px 0;width:100%;font-size:14px;',
    th: 'border:1px solid #d0d7de;padding:6px 10px;background:#f6f8fa;text-align:left;font-weight:600;color:#1f2329;',
    td: 'border:1px solid #d0d7de;padding:6px 10px;vertical-align:top;color:#1f2329;',
    hr: 'border:none;border-top:1px solid #e5e7eb;margin:18px 0;',
    a: 'color:#2f6fdd;text-decoration:none;',
    math: 'font-family:Cambria Math,Times New Roman,serif;font-size:15px;',
    mathBlock: 'margin:12px 0;text-align:center;font-family:Cambria Math,Times New Roman,serif;font-size:15px;',
    meta: 'margin-top:20px;padding-top:8px;border-top:1px solid #eceef1;color:#8f959e;font-size:12px;line-height:1.7;',
    lang: 'margin:0;padding:5px 12px;color:#6b7280;font-size:12px;font-family:Menlo,Consolas,monospace;border-bottom:1px solid #e5e7eb;',
    codeWrap: 'margin:12px 0;border:1px solid #e5e7eb;border-radius:6px;background:#f6f8fa;overflow:hidden;',
    block: 'margin:0 0 12px;line-height:1.8;font-size:15px;color:#1f2329;'
  };

  var BLOCK = {
    p: 1, div: 1, section: 1, article: 1, header: 1, footer: 1, main: 1, aside: 1,
    h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, ul: 1, ol: 1, li: 1, dl: 1, dt: 1, dd: 1,
    pre: 1, blockquote: 1, table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, td: 1, th: 1,
    hr: 1, figure: 1, figcaption: 1
  };

  var DROP = [
    'script', 'style', 'noscript', 'button', 'textarea', 'svg', 'img', 'video', 'audio',
    'canvas', 'iframe', 'input', 'select', '[aria-hidden="true"]',
    '[class*="icon"]', '[class*="Icon"]', '[class*="copy"]', '[class*="Copy"]'
  ].join(',');

  function norm(s) {
    return (s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function allMessages() {
    var list = Array.prototype.slice.call(document.querySelectorAll(MSG));
    if (!list.length) list = Array.prototype.slice.call(document.querySelectorAll('[class*="ds-message"]'));
    return list;
  }

  function isAnswer(el) {
    return !!el.querySelector(MD);
  }

  function answers() {
    return allMessages().filter(isAnswer);
  }

  function lastAnswer() {
    var list = answers();
    return list.length ? list[list.length - 1] : null;
  }

  function questionOf(el) {
    var list = allMessages();
    var i = list.indexOf(el);
    for (var j = i - 1; j >= 0; j--) {
      if (!isAnswer(list[j])) {
        var t = norm(list[j].innerText || list[j].textContent);
        if (t) return t;
      }
    }
    return '';
  }

  function texOf(node) {
    var ann = node.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && norm(ann.textContent)) return norm(ann.textContent);
    return norm(node.textContent);
  }

  function prepCode(block, doc) {
    var pre = block.querySelector('pre') || block;
    var head = block.querySelector('[class*="header"]');
    var lang = head ? norm(head.textContent).replace(/复制|copy/gi, '').trim() : '';
    var marker = doc.createElement('dsc-code');
    if (lang && lang.length <= 24) marker.setAttribute('data-lang', lang);
    marker.textContent = (pre.textContent || '').replace(/\n+$/, '');
    return marker;
  }

  function prepare(node) {
    var clone = node.cloneNode(true);
    var doc = node.ownerDocument;

    Array.prototype.forEach.call(clone.querySelectorAll('.katex-display'), function (k) {
      var span = doc.createElement('dsc-math');
      span.setAttribute('data-display', '1');
      span.textContent = texOf(k);
      k.replaceWith(span);
    });

    Array.prototype.forEach.call(clone.querySelectorAll('.katex'), function (k) {
      var tex = texOf(k);
      k.replaceWith(doc.createTextNode(tex ? '\\( ' + tex + ' \\)' : ''));
    });

    Array.prototype.forEach.call(clone.querySelectorAll('.md-code-block'), function (block) {
      block.replaceWith(prepCode(block, doc));
    });

    Array.prototype.forEach.call(clone.querySelectorAll('pre'), function (pre) {
      var marker = doc.createElement('dsc-code');
      marker.textContent = (pre.textContent || '').replace(/\n+$/, '');
      pre.replaceWith(marker);
    });

    Array.prototype.forEach.call(clone.querySelectorAll(DROP), function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    // 搜索来源药丸（"40 个网页"）属于界面装饰，链接已在参考链接里
    Array.prototype.forEach.call(clone.querySelectorAll('div,span,a'), function (n) {
      if (n.childElementCount > 3) return;
      if (/^\d+\s*个?\s*(网页|来源|引用)$/.test(norm(n.textContent))) {
        if (n.parentNode) n.parentNode.removeChild(n);
      }
    });

    return clone;
  }

  function kids(node) {
    var out = [];
    Array.prototype.forEach.call(node.childNodes, function (c) {
      out.push(serialize(c));
    });
    return out.join('');
  }

  function style(tag) {
    return ' style="' + ST[tag] + '"';
  }

  function serialize(node) {
    if (node.nodeType === 3) return esc(node.nodeValue);
    if (node.nodeType !== 1) return '';

    var tag = node.tagName.toLowerCase();

    if (tag === 'dsc-code') {
      var lang = node.getAttribute('data-lang');
      var head = lang ? '<div' + style('lang') + '>' + esc(lang) + '</div>' : '';
      return '<div' + style('codeWrap') + '>' + head + '<pre' + style('pre') + '><code style="font-family:Menlo,Consolas,monospace;font-size:13px;">' +
        esc(node.textContent) + '</code></pre></div>';
    }

    if (tag === 'dsc-math') {
      var tex = esc(node.textContent);
      if (node.getAttribute('data-display')) {
        return '<div' + style('mathBlock') + '>\\[ ' + tex + ' \\]</div>';
      }
      return '<span' + style('math') + '>\\( ' + tex + ' \\)</span>';
    }

    if (tag === 'br') return '<br>';
    if (tag === 'hr') return '<hr' + style('hr') + '>';

    if (/^h[1-6]$/.test(tag)) {
      var level = Math.min(parseInt(tag.slice(1), 10), 4);
      var body = kids(node);
      if (!body) return '';
      return '<h' + level + style('h' + level) + '>' + body + '</h' + level + '>';
    }

    if (tag === 'p') {
      var pInner = kids(node);
      if (!pInner.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) return '';
      return '<p' + style('p') + '>' + pInner + '</p>';
    }

    if (tag === 'div' || tag === 'section' || tag === 'article' ||
        tag === 'header' || tag === 'footer' || tag === 'main' || tag === 'aside' ||
        tag === 'figure' || tag === 'figcaption' || tag === 'details' || tag === 'summary') {
      var inner = kids(node);
      if (!inner.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) return '';
      return '<div' + style('block') + '>' + inner + '</div>';
    }

    if (tag === 'ul' || tag === 'ol' || tag === 'dl') {
      var listInner = kids(node);
      if (!listInner.trim()) return '';
      var listTag = tag === 'dl' ? 'div' : tag;
      return '<' + listTag + style(tag === 'dl' ? 'p' : tag) + '>' + listInner + '</' + listTag + '>';
    }

    if (tag === 'li' || tag === 'dt' || tag === 'dd') {
      var liInner = kids(node);
      if (!liInner.trim()) return '';
      return '<li' + style('li') + '>' + liInner + '</li>';
    }

    if (tag === 'blockquote') {
      var q = kids(node);
      if (!q.trim()) return '';
      return '<blockquote' + style('quote') + '>' + q + '</blockquote>';
    }

    if (tag === 'table') return '<table' + style('table') + '>' + kids(node) + '</table>';
    if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') return '<' + tag + '>' + kids(node) + '</' + tag + '>';
    if (tag === 'tr') return '<tr>' + kids(node) + '</tr>';
    if (tag === 'th') return '<th' + style('th') + '>' + kids(node) + '</th>';
    if (tag === 'td') return '<td' + style('td') + '>' + kids(node) + '</td>';

    if (tag === 'a') {
      var href = node.getAttribute('href') || '';
      var txt = kids(node);
      if (!txt.trim()) return '';
      if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return txt;
      return '<a href="' + escAttr(href) + '"' + style('a') + '>' + txt + '</a>';
    }

    if (tag === 'strong' || tag === 'b') return '<strong>' + kids(node) + '</strong>';
    if (tag === 'em' || tag === 'i') return '<em>' + kids(node) + '</em>';
    if (tag === 'del' || tag === 's' || tag === 'strike') return '<del>' + kids(node) + '</del>';
    if (tag === 'u') return '<u>' + kids(node) + '</u>';
    if (tag === 'code') return '<code' + style('code') + '>' + kids(node) + '</code>';
    if (tag === 'sub' || tag === 'sup') return '<' + tag + '>' + kids(node) + '</' + tag + '>';

    var plain = kids(node);
    if (BLOCK[tag]) {
      if (!plain.trim()) return '';
      return '<div' + style('block') + '>' + plain + '</div>';
    }
    return plain;
  }

  var BLOCK_RE = /^<(p|h[1-6]|ul|ol|li|div|table|pre|blockquote|hr|thead|tbody|tr|td|th)\b/i;

  function joinBlocks(nodeList) {
    var out = [];
    var inline = [];
    function flush() {
      var s = inline.join('');
      if (s.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) {
        out.push('<p' + style('p') + '>' + s + '</p>');
      }
      inline = [];
    }
    Array.prototype.forEach.call(nodeList, function (c) {
      var html = serialize(c);
      if (!html) return;
      if (BLOCK_RE.test(html)) {
        flush();
        out.push(html);
      } else {
        inline.push(html);
      }
    });
    flush();
    return out.join('\n').trim();
  }

  function renderMarkdown(node) {
    var clean = prepare(node);
    return joinBlocks(clean.childNodes);
  }

  function renderAnswer(el, opts) {
    var out = [];
    if (opts.includeThinking) {
      Array.prototype.forEach.call(el.querySelectorAll(THINK), function (t) {
        var html = serialize(prepare(t));
        if (html.trim()) {
          out.push('<blockquote' + style('quote') + '><div style="font-size:12px;color:#8f959e;margin-bottom:4px;">思考过程</div>' + html + '</blockquote>');
        }
      });
    }
    Array.prototype.forEach.call(el.querySelectorAll(MD), function (md) {
      if (md.closest(THINK)) return;
      var html = renderMarkdown(md);
      if (html.trim()) out.push(html);
    });
    return out.join('\n');
  }

  function collectLinks(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var seen = {};
    var list = [];
    Array.prototype.forEach.call(wrap.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href');
      if (!/^https?:/i.test(href)) return;
      if (seen[href]) return;
      seen[href] = 1;
      var label = norm(a.textContent) || href;
      if (label.length > 60) label = label.slice(0, 60) + '…';
      list.push('<li' + style('li') + '><a href="' + escAttr(href) + '"' + style('a') + '>' + esc(label) + '</a></li>');
    });
    if (list.length < 2) return '';
    return '<h3' + style('h3') + '>参考链接</h3><ol' + style('ol') + '>' + list.slice(0, 30).join('') + '</ol>';
  }

  function firstLineTitle(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var nodes = wrap.querySelectorAll('h1,h2,h3,h4,p,li');
    for (var i = 0; i < nodes.length; i++) {
      var t = norm(nodes[i].textContent);
      if (t) return makeTitle(t, '');
    }
    return '';
  }

  // 印象笔记把正文第一行据为笔记标题，所以这一行要直接是问题本身
  function titleLine(q) {
    return '<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#5c6470;">' + esc(q) + '</p>' +
      '<hr' + style('hr') + '>';
  }

  function makeTitle(text, fallback) {
    var t = norm(text)
      .replace(/^[#>\-\*\s]+/, '')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ');
    if (!t) return fallback;
    return t.length > 48 ? t.slice(0, 48) + '…' : t;
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function metaBlock(extra) {
    var url = escAttr(location.href);
    var bits = ['来源：DeepSeek 网页版', '<a href="' + url + '"' + style('a') + '>原对话</a>', stamp()];
    if (extra) bits.push(extra);
    return '<p' + style('meta') + '>' + bits.join(' · ') + '</p>';
  }

  function selectionRange() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    if (!norm(range.toString())) return null;
    return range;
  }

  function renderSelection() {
    var range = selectionRange();
    if (!range) return null;
    var holder = document.createElement('div');
    holder.appendChild(range.cloneContents());
    var clean = prepare(holder);
    return joinBlocks(clean.childNodes) || null;
  }

  function questionOfSelection() {
    var range = selectionRange();
    if (!range) return '';
    var node = range.commonAncestorContainer;
    var el = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
    var msg = el && el.closest ? el.closest(MSG) : null;
    return msg ? questionOf(msg) : '';
  }

  function htmlToText(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:640px;';
    (document.body || document.documentElement).appendChild(wrap);
    var t = wrap.innerText || wrap.textContent || '';
    wrap.remove();
    return t.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function build(anchor, opts) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = opts && opts[k] !== undefined ? opts[k] : DEFAULTS[k]; });

    var parts = [];
    var title = '';
    var used = [];

    if (o.mode === 'all') {
      var list = allMessages();
      var blocks = [];
      var firstQ = true;
      list.forEach(function (m) {
        var q = norm(m.innerText || m.textContent);
        if (isAnswer(m)) {
          var ans = renderAnswer(m, o);
          if (ans.trim()) blocks.push(ans);
          used.push(m);
        } else if (q) {
          // 第一行会成为笔记标题，所以放问题本身，而不是“问”这种标签
          if (firstQ) {
            blocks.push(titleLine(q));
            title = makeTitle(q, '');
            firstQ = false;
          } else {
            blocks.push('<h3' + style('h3') + '>问：' + esc(q) + '</h3>');
          }
        }
      });
      parts.push(blocks.join('\n'));
    } else if (o.mode === 'selection') {
      var picked = renderSelection();
      if (!picked) return null;
      var qSel = questionOfSelection();
      if (qSel) {
        parts.push(titleLine(qSel));
        title = makeTitle(qSel, '');
      }
      parts.push(picked);
      used.push(null);
    } else {
      var target = anchor || lastAnswer();
      if (!target) return null;
      var q2 = questionOf(target);
      if (o.mode === 'qa' && q2) {
        parts.push(titleLine(q2));
        title = makeTitle(q2, '');
      }
      parts.push(renderAnswer(target, o));
      used.push(target);
    }

    var body = parts.join('\n').trim();
    if (!body) return null;

    if (o.includeLinks) {
      var links = collectLinks(body);
      if (links) body += '\n' + links;
    }
    if (o.includeMeta) body += '\n' + metaBlock();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;font-size:15px;line-height:1.8;color:#1f2329;">' +
      body + '</div>';

    return {
      title: title || firstLineTitle(body) || ('DeepSeek 回答 ' + stamp()),
      html: html,
      text: htmlToText(html),
      count: used.length
    };
  }

  function info() {
    var q = '';
    var last = lastAnswer();
    if (last) q = questionOf(last);
    var sel = window.getSelection();
    var selText = sel && !sel.isCollapsed ? norm(sel.toString()) : '';
    return {
      ok: true,
      answers: answers().length,
      question: makeTitle(q, ''),
      selection: !!selText,
      selectionLen: selText.length,
      title: document.title,
      url: location.href
    };
  }

  root.DSC = {
    DEFAULTS: DEFAULTS,
    info: info,
    build: build,
    lastAnswer: lastAnswer,
    answers: answers,
    hasSelection: function () { return !!selectionRange(); },
    hasMessages: function () { return allMessages().length > 0; }
  };
})(typeof window !== 'undefined' ? window : this);
