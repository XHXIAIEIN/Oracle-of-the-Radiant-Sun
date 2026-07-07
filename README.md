# Oracle of the Radiant Sun

《The Oracle of the Radiant Sun》（Caroline Smith & John Astrop）的数字化项目：将原书 84 张占星神谕卡与书中占法做成可以在浏览器里直接使用的网页应用。

**在线使用：<https://xhxiaiein.github.io/Oracle-of-the-Radiant-Sun/>**

## 占法

以太阳圆环为基础的四种占法，外加单张指引与全牌库浏览：

- **太阳年（Sun Year）** — 十二宫逐月描绘来年十二个月
- **时占（Horary）** — 回应一个可用"是 / 否"作答的具体问题
- **大三合（Grand Trine）** — 三张牌的简短综合占问
- **本位十字（Cardinal Cross）** — 四张牌的简短综合占问
- **单张指引** — 洗牌后取顶牌一张，作当下处境或一日一牌
- **卡片库** — 浏览全副七个星曜套牌共 84 张

## 目录结构

- `web/` — 网页应用（纯静态，无构建步骤），部署到 GitHub Pages
- `data/` — 数字化数据：卡牌 JSON（`cards/`）与全书章节文本（`chapters/`）
- `scanner/` — 书页扫描上传服务（`server.py`）及扫描图裁切、图形生成等处理脚本（`scripts/`）

## 本地运行

```sh
python -m http.server -d web 8000
```

然后访问 <http://localhost:8000>。

## 致谢

原书与卡牌 © Caroline Smith（绘）& John Astrop（文），本仓库为个人研习用途的数字化整理。
