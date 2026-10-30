chrome.runtime.onInstalled.addListener(function () {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
});

chrome.commands.onCommand.addListener(function (cmd) {
  if (cmd !== 'clip-last') return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !/^https:\/\/chat\.deepseek\.com\//.test(tab.url || '')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'DSC_CLIP_LAST' }, function () {
      void chrome.runtime.lastError;
    });
  });
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'OPEN_YINXIANG') {
    chrome.tabs.create({ url: 'https://www.yinxiang.com/' });
    sendResponse({ ok: true });
  }
});
