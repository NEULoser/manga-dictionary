# 第三方资源与数据归属

| 组件／数据 | 发布者与来源 | 许可 |
| --- | --- | --- |
| Tesseract.js 6.0.1 | https://github.com/naptha/tesseract.js | Apache-2.0，见 licenses/LICENSE.md 及库 dist 版权声明 |
| Tesseract.js-core 6.0.0 | https://github.com/naptha/tesseract.js-core | Apache-2.0，见 licenses/tesseract-core-LICENSE.txt |
| tessdata_fast 4.1.0 | https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0 | Apache-2.0，见 licenses/tessdata-LICENSE.txt |
| Kuromoji.js 0.1.2 | https://github.com/takuyaa/kuromoji.js | Apache-2.0，见 licenses/kuromoji-LICENSE.txt |
| IPADIC 分词词典 | https://github.com/taku910/mecab/tree/master/mecab-ipadic | IPADIC 版权及许可，见 licenses/IPADIC-COPYING.txt |
| 日语释义 | 中文维基词典贡献者，https://zh.wiktionary.org；由 Tatu Ylonen 的 Kaikki / wiktextract 提取，https://kaikki.org/zhwiktionary/日语/ 与 https://kaikki.org/zhwiktionary/日語/ | CC BY-SA 4.0，https://creativecommons.org/licenses/by-sa/4.0/ |
| ECDICT | skywind3000 / Lin Wei，https://github.com/skywind3000/ECDICT | MIT，见 licenses/ECDICT-LICENSE.txt；保留上游数据来源的不确定性，非自行校订字典 |
| OpenCC.js 1.0.5 | https://github.com/nk2028/opencc-js | MIT，见 licenses/opencc-LICENSE.txt |

日语释义的修改：筛选词头、释义、词性、读音；合并条目；由 OpenCC 转换中文释义和词性为简体；生成查找索引与假名关联。日语词头保持原字形。`data/ja.json` 是上述 CC BY-SA 4.0 数据的派生作品，继续以 CC BY-SA 4.0 分发。对某一词条的原页面可访问 `https://zh.wiktionary.org/wiki/` 加词头；Kaikki 提取说明见原下载页面。数据使用的是 2026-10-01 中文维基词典转储（Kaikki 页面标注 2026-10-02 提取），于 2026-10-13 下载。

ECDICT 修改：筛选常用词、转简体释义、从 exchange 字段生成词形关联，生成 JSON。读音沿用上游音标记法，并非保证严格 IPA。

许可证文件随包保留；自有代码使用项目根目录 MIT LICENSE。下载与构建不需要 API Key。安装后的引擎路径固定指向扩展本地，不使用 CDN。
