var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  
  if (!rootURI.endsWith("/")) rootURI += "/";
  
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "aiassistant", rootURI + "content/"],
  ]);

  const ctx = { rootURI, id, version };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    rootURI + "content/scripts/ai-assistant.js",
    ctx,
  );
  
  if (Zotero.AIAssistant && Zotero.AIAssistant.startup) {
      await Zotero.AIAssistant.startup(ctx, reason);
  }
}

async function onMainWindowLoad({ window }, reason) {
  if (Zotero.AIAssistant && Zotero.AIAssistant.onMainWindowLoad) {
    await Zotero.AIAssistant.onMainWindowLoad(window);
  }
}

async function onMainWindowUnload({ window }, reason) {
  if (Zotero.AIAssistant && Zotero.AIAssistant.onMainWindowUnload) {
    await Zotero.AIAssistant.onMainWindowUnload(window);
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) return;
  if (Zotero.AIAssistant && Zotero.AIAssistant.shutdown) {
      await Zotero.AIAssistant.shutdown();
  }
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
