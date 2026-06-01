Zotero.AIAssistant = new class {
    constructor() {
        this.menuID = null;
        this.PREF_BRANCH = "extensions.aiassistant.";
        this.rootURI = null;
    }

    getPref(pref) {
        return Zotero.Prefs.get(this.PREF_BRANCH + pref, true);
    }

    async startup(ctx, reason) {
        this.rootURI = ctx.rootURI;
        await Zotero.uiReadyPromise;
        this.registerMenus(ctx.id);
    }

    async onMainWindowLoad(window) {
        try {
            let ftlPath = Zotero.locale === 'zh-CN' ? 'locale/zh-CN/ai-assistant.ftl' : 'locale/en-US/ai-assistant.ftl';
            window.MozXULElement.insertFTLIfNeeded(this.rootURI + ftlPath);
        } catch (e) {}
    }

    onMainWindowUnload(window) {}

    registerMenus(pluginID) {
        if (typeof Zotero.MenuManager === "undefined") return;

        const onCommand = () => {
            Zotero.Promise.resolve().then(async () => {
                try {
                    let items = Zotero.getActiveZoteroPane().getSelectedItems();
                    if (items.length === 0) return;
                    let item = items[0];
                    if (item.isAttachment()) item = Zotero.Items.get(item.parentItemID);
                    if (item && item.isRegularItem()) {
                        await this.analyzeItem(item);
                    }
                } catch (e) {
                    Zotero.logError(e);
                }
            });
        };

        // 回归一级标题，确保按钮能看见
        this.menuID = Zotero.MenuManager.registerMenu({
            menuID: "ai-assistant-main-v6",
            pluginID: pluginID,
            target: "main/library/item",
            menus: [{
                id: "ai-assistant-analyze-direct",
                menuType: "menuitem",
                label: "✨ AI Assistant: Generate Summary", 
                icon: "chrome://aiassistant/content/icons/logo.png",
                onCommand: onCommand
            }]
        });
    }

    async analyzeItem(item) {
        let pw = new Zotero.ProgressWindow();
        pw.changeHeadline("AI Assistant");
        pw.addDescription("Preparing analysis...");
        pw.show();

        try {
            const apiKey = this.getPref("apiKey");
            const modelName = this.getPref("modelName") || "deepseek-chat";

            if (!apiKey) {
                pw.addDescription("❌ Error: API Key missing.");
                return;
            }

            let attachment = await item.getBestAttachment();
            if (!attachment) {
                pw.addDescription("❌ Error: No PDF attachment.");
                return;
            }

            pw.addDescription("Extracting text...");
            let text = "";

            // --- 终极稳健提取逻辑 ---
            
            // 1. 确保已索引
            const indexedState = await Zotero.Fulltext.getIndexedState(attachment);
            if (indexedState !== Zotero.Fulltext.INDEX_STATE_INDEXED) {
                pw.addDescription("Indexing PDF...");
                await Zotero.Fulltext.indexItems([attachment.id], { complete: true });
            }

            // 2. 尝试官方 getText (传入 Item 对象)
            try {
                text = await Zotero.Fulltext.getText(attachment);
            } catch (e) {
                Zotero.debug("Zotero.Fulltext.getText failed: " + e);
            }

            // 3. 尝试读取物理缓存文件 (Butler 核心逻辑)
            if (!text) {
                try {
                    const cacheFile = Zotero.Fulltext.getItemCacheFile(attachment);
                    if (cacheFile && await IOUtils.exists(cacheFile.path)) {
                        text = await Zotero.File.getContentsAsync(cacheFile.path);
                    }
                } catch (e) {
                    Zotero.debug("Cache file read failed: " + e);
                }
            }

            // 4. 最后兜底：手动 PDF.js 解析
            if (!text || text.length < 50) {
                pw.addDescription("Fallback: Manual parsing...");
                const filePath = await attachment.getFilePathAsync();
                const { pdfjsLib } = ChromeUtils.importESModule("resource://zotero/reader/pdf/build/pdf.mjs");
                const data = await IOUtils.read(filePath);
                const loadingTask = pdfjsLib.getDocument({ data });
                const pdf = await loadingTask.promise;
                for (let i = 1; i <= Math.min(5, pdf.numPages); i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(t => t.str).join(" ") + "\n";
                }
                await pdf.destroy();
            }

            if (!text || text.trim().length < 20) {
                throw new Error("Unable to extract text. PDF might be empty or protected.");
            }

            pw.addDescription("DeepSeek is thinking...");
            const result = await this.callAI(text, apiKey, modelName);
            await this.saveNote(item, result);

            pw.addDescription("✅ Note saved!");
            pw.startCloseTimer(3000);
        } catch (e) {
            Zotero.logError(e);
            pw.addDescription("❌ Error: " + (e.message || e));
            pw.startCloseTimer(8000);
        }
    }

    async callAI(text, apiKey, model) {
        const sysPrompt = `你是一个顶级的学术助理。请阅读我提供的论文前几页文本，提取关键信息。
你必须严格按照以下 JSON 格式输出，不要包含任何 markdown 标记或其他多余文字：
{
    "Title": "论文标题（英文原文）",
    "Title_CN": "论文标题（中文翻译）",
    "Authors": "主要作者",
    "Journal_Conference": "发表期刊或会议名称（如果找不到请填 'Unknown'）",
    "Publication_Date": "期刊或会议刊登这篇论文的时间（如果找不到请填 'Unknown'）",
    "Pages": "论文页码范围或总页数（如果找不到请填 'Unknown'）",
    "DOI": "数字对象唯一标识符 DOI（如果找不到请填 'None'）",
    "URL": "对应的期刊或者会议的链接URL（如果找不到请填 'None'）",
    "ISSN": "国际标准连续出版物号 ISSN（如果找不到请填 'None'）",
    "Language": "论文的语言（如 English, Chinese 等）",
    "Funding": "项目资助信息（如果找不到请填 'None'）",
    "OpenSource_Link": "开源代码或数据链接（如果没有请填 'None'）",
    "Abstract_Summary": "将学术性的摘要浓缩为3-5个要点（中文），说明背景、方法和结果。",
    "Layman_Summary": "通俗化摘要：用一段200字左右的中文，向非专业人士解释这篇论文解决了什么核心痛点。",
    "Category": "宏观学科分类，如：Computer_Vision, NLP, Hardware_Security 等"
}`;
        let res = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text.substring(0, 10000) }],
                response_format: { type: "json_object" }
            })
        });
        if (!res.ok) throw new Error("API Error: " + res.status);
        let data = await res.json();
        return JSON.parse(data.choices[0].message.content);
    }

    async saveNote(item, data) {
        let htmlContent = `
            <h1>${data.Title || "Untitled"}</h1>
            <p><b>中文标题</b>: ${data.Title_CN || "暂无翻译"}</p>
            <blockquote>
                <p><b>💡 通俗化导读 (Layman Summary)</b></p>
                <p>${data.Layman_Summary || "暂无摘要"}</p>
            </blockquote>
            <hr/>
            <h2>📌 基本信息 (Metadata)</h2>
            <ul>
                <li><b>👥 作者</b>: ${data.Authors || "Unknown"}</li>
                <li><b>📚 期刊/会议</b>: ${data.Journal_Conference || "Unknown"}</li>
                <li><b>📅 发表时间</b>: ${data.Publication_Date || "Unknown"}</li>
                <li><b>📑 页数/页码</b>: ${data.Pages || "Unknown"}</li>
                <li><b>🪪 DOI</b>: ${data.DOI || "None"}</li>
                <li><b>🌐 来源链接</b>: ${data.URL || "None"}</li>
                <li><b>🪪 ISSN</b>: ${data.ISSN || "None"}</li>
                <li><b>🗣️ 语言</b>: ${data.Language || "Unknown"}</li>
                <li><b>💰 资助信息</b>: ${data.Funding || "None"}</li>
                <li><b>🔗 开源资源</b>: ${data.OpenSource_Link || "None"}</li>
                <li><b>🏷️ 领域分类</b>: <code>${data.Category || "Uncategorized"}</code></li>
            </ul>
            <h2>🎯 核心意图 (Abstract & Core Idea)</h2>
            <p>${(data.Abstract_Summary || "暂无内容").replace(/\n/g, '<br>')}</p>
        `;

        let note = new Zotero.Item('note');
        note.setNote(`<div>${htmlContent}</div>`);
        note.parentID = item.id;
        await note.saveTx();

        // 处理 Tag 保存，支持多种分隔符，确保在左下角标签选择器可见
        if (data.Category && data.Category !== "Uncategorized") {
            let tags = data.Category.split(/[，,;；\s]+/).filter(t => t.trim().length > 0);
            for (let tag of tags) {
                item.addTag(tag.trim());
            }
            await item.saveTx();
        }
    }

    shutdown() {
        if (this.menuID) Zotero.MenuManager.unregisterMenu(this.menuID);
    }
};
