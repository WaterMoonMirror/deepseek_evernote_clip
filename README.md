# DeepSeek 剪藏到印象笔记

Chrome 扩展。在 DeepSeek 网页版里点一下，把回答转成**保留排版的富文本**放进剪贴板，
到印象笔记里 `Ctrl+V` 即可 —— 标题、加粗、有序/无序列表、表格、代码块、引用、链接、
公式（TeX 源文本）都会跟着走。

## 装

1. 打开 `chrome://extensions/`
2. 右上角打开「开发者模式」
3. 「加载已解压的扩展程序」→ 选这个目录（含 `manifest.json` 的那一层）
4. 打开 <https://chat.deepseek.com> 的任意对话，没生效就刷新一次

Edge 也是 Chromium，同样加载方式。

## 用

**方式一：单条剪藏（最快）**

鼠标移到任意一条回答上，右上角出现「剪藏到印象笔记」→ 点它 → 状态条提示「已复制」→
到印象笔记里 `Ctrl+V`。如果先在回答里选中了一段文字，点按钮只剪选中的那段。

**方式二：侧边栏（能选格式）**

点工具栏的扩展图标，右侧打开面板：

- 剪藏格式：回答 + 提问 / 只要回答 / 整个对话 / 选中片段
- 细节：包含思考过程、附参考链接、复制后打开印象笔记
- 「开始剪藏」

**方式三：快捷键** `Alt+Shift+D` 剪藏最近一条回答。

粘贴后如果格式变成纯文本，检查印象笔记是否用了「粘贴为纯文本」，改用普通 `Ctrl+V`。

## 面板连不上页面时

改了代码在 `chrome://extensions/` 点了「重新加载」以后，已经打开的 DeepSeek 页面里
还是旧的内容脚本，面板会显示「连不上页面脚本」。面板上有两个按钮：

- 重新检测：轮询几次，页面刚加载完时用
- 刷新 DeepSeek 页面：最省事，刷新后自动重新连上

面板打开时会自动轮询 6 次（约 3.6 秒），切换标签页、页面加载完成时也会自动重连。

## 为什么是剪贴板

印象笔记没有对个人开放的「写入笔记」HTTP 接口：官方 API 走 Thrift，
要先去 <https://app.yinxiang.com/api/DeveloperToken.action> 申请开发者 Token
（印象笔记经常需要联系客服手动开通）。所以第一版做的是零配置路径：
扩展生成干净 HTML 写进剪贴板，任意印象笔记客户端/网页版粘贴都能保格式。
以后要真·一键入库，可以在 `src/` 里加一个 Token 模式，复用 `DSC.build()` 生成的 HTML 转 ENML。

## 剪藏内容怎么处理

- 只取回答正文，去掉按钮、图标、复制按钮、搜索来源药丸这类界面元素
- 代码块还原成带语言标签的 `<pre>`，保留缩进
- KaTeX 公式还原成 `\( ... \)` 的 TeX 源文本（印象笔记不渲染 LaTeX，但内容不丢）
- 第一行直接是这一轮的问题：印象笔记把正文首行当作笔记标题，这样标题就是问题本身，而不是“问”之类的标签
- 标题过长会在 48 字处截断
- 末尾可选附「参考链接」和来源信息
- 思考过程默认不收，需要时在面板里勾上

## 文件结构

```
manifest.json          MV3 清单
src/extract.js         抽取 + HTML 排版（核心，纯 DOM 逻辑）
src/clipboard.js       富文本写剪贴板（Clipboard API，失败回退 execCommand）
src/deepseek.js        内容脚本：悬停按钮、提示条、响应侧边栏指令
src/sidepanel.html/css/js  侧边栏面板
src/background.js      打开面板、快捷键、打开印象笔记
tools/make-icons.js    生成图标（node tools/make-icons.js）
test/fixture.html      模拟 DeepSeek DOM，验抽取结果用
test/harness.html      带 chrome API 桩的交互测试页
```

## 改完自测

浏览器直接打开 `test/fixture.html`，控制台：

```js
DSC.build(null, { mode: 'qa' }).html        // 看生成的富文本
DSC.build(null, { mode: 'all', includeThinking: true }).text
```

## 已知限制

- 只匹配 `https://chat.deepseek.com/*`，其它 AI 站点没接
- 目标是富文本编辑器；纯文本输入框会丢格式
- DeepSeek 改版换了类名（`.ds-message` / `.ds-markdown`）就需要跟着改
- 图片/图表不搬运，只保留文字与链接
