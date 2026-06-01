# Zotero AI Assistant

Zotero AI Assistant 是一款专为 Zotero 7+ 设计的强大 AI 辅助阅读插件，利用大语言模型（默认集成 DeepSeek）帮助研究人员快速分析、翻译和总结学术论文，显著提升文献阅读效率。

## ✨ 核心功能
- **一键提取与总结**：直接在 Zotero 中右键点击文献，选择“✨ AI Assistant: Generate Summary”，即可自动提取 PDF 全文并交由 AI 分析。
- **结构化笔记生成**：AI 会自动生成包含论文元数据、中文标题翻译、通俗化导读、核心内容提炼以及学科分类的结构化 Markdown 笔记，并附加在文献下方。
- **智能标签管理**：根据 AI 分析的学科分类，自动为 Zotero 文献条目打上相关标签，方便后续检索与归档。
- **本地+服务端双重保障**：支持本地 Python 服务端提取 PDF 文本，应对复杂或大体积的学术论文，提取更稳健。

## 📥 安装指南

1. **下载插件**：
   前往 GitHub [Releases](https://github.com/1654842532/zotero-ai-assistant/releases) 页面，下载最新的 `zotero-ai-assistant-vX.X.X.xpi` 文件。
2. **在 Zotero 中安装**：
   打开 Zotero，点击菜单栏 `工具 (Tools)` -> `附加组件 (Add-ons)`。点击右上角的齿轮 ⚙️ 图标，选择 `Install Add-on From File...`，选择刚才下载的 `.xpi` 文件进行安装。

## ⚙️ 配置说明

在使用本插件前，您需要配置大模型的 API Key。

1. 打开 Zotero 菜单栏 `编辑 (Edit)` -> `设置 (Settings)`。
2. 导航到 `高级 (Advanced)` -> `配置编辑器 (Config Editor)`。
3. 搜索并双击修改以下配置项（如果尚未存在，可以不用手动添加，确保您已成功安装插件）：
   - `extensions.aiassistant.apiKey`: 填入您的 DeepSeek API Key (例如：`sk-...`)。
   - `extensions.aiassistant.modelName`: 填入您使用的模型名称 (默认：`deepseek-chat`)。

*注：未来的版本将提供更加直观的图形化设置界面。*

## 🚀 使用方法

1. **配置本地服务 (可选但推荐)**：如果您需要更稳健的全文提取能力，请确保本地已运行 `server.py`（详见项目说明或联系开发者获取）。目前插件内置了 fallback 机制，无需服务端也可基本运行。
2. **分析文献**：
   - 选中包含 PDF 附件的文献条目。
   - 右键点击该条目，选择 `✨ AI Assistant: Generate Summary`。
   - 等待进度条完成，系统会自动为您生成一份详尽的笔记。

## 🛠️ 本地开发与构建

如果您希望参与开发或自行打包：

```bash
git clone https://github.com/1654842532/zotero-ai-assistant.git
cd zotero-ai-assistant
# 将所有文件（不包含最外层文件夹）压缩为 zip，并将后缀改为 .xpi
```

正确的仓库文件结构如下：
```text
zotero-ai-assistant/
├── content/
│   ├── icons/
│   └── scripts/
├── locale/
│   ├── en-US/
│   └── zh-CN/
├── bootstrap.js
├── manifest.json
├── prefs.js
├── updates.json
└── README.md
```

## 📄 许可证
MIT License
