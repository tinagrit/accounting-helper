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

async function sendCommandToClickedFrame(info, tab) {
  const command = MENU_COMMANDS[info.menuItemId];

  if (!command || typeof tab?.id !== "number") {
    return;
  }

  const frameId = typeof info.frameId === "number" ? info.frameId : 0;
  const message = { command };

  try {
    await chrome.tabs.sendMessage(tab.id, message, { frameId });
    return;
  } catch {
  }

  const target = { tabId: tab.id, frameIds: [frameId] };

  try {
    await chrome.scripting.insertCSS({
      target,
      files: ["content.css"],
    });
    await chrome.scripting.executeScript({
      target,
      files: ["decimal.js"],
    });
    await chrome.scripting.executeScript({
      target,
      files: ["content.js"],
    });
    await chrome.tabs.sendMessage(
      tab.id,
      message,
      { frameId },
    );
  } catch {
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void sendCommandToClickedFrame(info, tab);
});
