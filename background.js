const MENU_COMMANDS = {
  "accounting-helper-sum": "start-sum",
  "accounting-helper-auto-sum": "start-auto-sum",
  "accounting-helper-fill-zero": "start-fill-zero",
};

function installContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "accounting-helper-sum",
      title: "Sum inputs",
      contexts: ["editable"],
    });

    chrome.contextMenus.create({
      id: "accounting-helper-auto-sum",
      title: "Auto sum",
      contexts: ["editable"],
    });

    chrome.contextMenus.create({
      id: "accounting-helper-fill-zero",
      title: "Fill 0s",
      contexts: ["editable"],
    });
  });
}

chrome.runtime.onInstalled.addListener(installContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const command = MENU_COMMANDS[info.menuItemId];

  if (!command || typeof tab?.id !== "number") {
    return;
  }

  chrome.tabs
    .sendMessage(
      tab.id,
      { command },
      { frameId: typeof info.frameId === "number" ? info.frameId : 0 },
    )
    .catch(() => {
    });
});
