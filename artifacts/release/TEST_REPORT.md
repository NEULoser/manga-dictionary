# 测试结果

2026-10-13，Windows，隔离的 Chrome for Testing 155.0.8059.39。使用原始交付 manifest（仅 activeTab、scripting、storage、offscreen），未为测试增加全站权限。

## 已通过

- 静态 JavaScript 语法、英语断行／连字符正规化、日语空格正规化、假名转换。
- 高 DPI 选区映射、越界／零视口／过小选区验证。
- 真实离线词典覆盖、食べる 的中文义项、beautiful 的中文义项、went → go 词形关联。
- 通过 DevTools `Extensions.triggerAction` 模拟真实工具栏动作并取得 activeTab 授权，执行实际 content script → background → captureVisibleTab → offscreen → Tesseract／Kuromoji → 查词 → 面板完整流程。未绕过页面权限。
- 英语图片两行识别结果：`| found a beautiful book. We went to school yesterday.`。成功合并断行；beautiful 显示“美丽的”、音标和“形容词”；went 查到 go。
- 日语竖排图片识别结果：`昨日学校で食べました`，顺序正确。点击“食べ”显示原形“食べる”，词典读音“たべる”，词性“动词”，释义包含“吃”。
- 断网前关闭整个 offscreen 文档、清除其内存中的 OCR worker 与分词词典；在浏览器离线模式下重新框选并加载全部本地资源，日语 OCR、分词、查词仍通过。
- 编辑原文后旧词块失效；人工输入的日语句子重新分词正确。
- 英语行末 `beau-` 与下一行 `tiful` 合并成 beautiful。
- 未收录词提示没有中文释义；结果未沿用旧查询。
- 展示方式切换、偏好保存后切换、侧边栏、过小选区提示、Esc 取消框选与关闭面板、重新打开、清空。
- 持久化存储中仅 `preferences`，包含 language、vertical、sidebar，无截图、原文、词汇或查询记录。
- 测试页面无 JavaScript 未捕获异常。扩展的资源请求限制为 CSP `connect-src 'self'`；所有模型路径明确指定本地。

结构化结果见 `artifacts/integration-result.json`；合成验收图的展示截图见 `artifacts/english-lookup.png` 和 `artifacts/japanese-lookup.png`。这些截图只包含本项目的测试文本。

## 实际限制与尚未验证

- 英语大写 I 在本次合成测试中被识别为竖线 `|`；没有用词典猜测覆盖 OCR 输出，用户可以人工更正。
- koob.one 的公开访问返回 403；kox.moe 公开访问重定向，阅读器入口需登录。未使用用户账号，未验证站点登录后的实际漫画内容。
- 合成测试用清晰、无注音的 Canvas 字体，不代表复杂漫画、艺术字、注音、黑底对话框的识别准确率。
- 物理键盘触发 Chrome 扩展快捷键需人工验收；自动测试实际触发工具栏授权。Esc 在自动测试中通过。
- 页面滚动／窗口变化的防错逻辑已实现；动态画面恰好在截图时变化、手机触屏、系统显示缩放的全部组合尚未逐一实测。
- 首期没有整句翻译、本机程序、PDF 文件解析、词典导入、收藏或历史记录。安装后首次运行不需要网络。

## 复现

安装成品无需 Node。开发者可在 Node.js 20+ 下运行 `npm test`。浏览器测试依赖 playwright-core 和新版 Chrome for Testing（支持 Extensions.triggerAction），按 README 配置 CHROME_PATH 后运行 `node tests/integration.mjs`。脚本会创建项目内的独立 profile，只访问本地验收页。
