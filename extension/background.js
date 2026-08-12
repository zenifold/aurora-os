// Aura extension service worker.
// Change this to your deployed app origin before publishing the extension.
const APP_ORIGIN = "http://localhost:8080";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "aura-add",
    title: "Add to Aura",
    contexts: ["selection", "page", "link"],
  });
  chrome.contextMenus.create({
    id: "aura-agent",
    title: "Send to Aura Agent…",
    contexts: ["selection"],
  });
});

function openAuraPopup(params, opts = {}) {
  chrome.windows.create({
    url: `${APP_ORIGIN}/extension-entry?${params.toString()}`,
    type: "popup",
    width: opts.width ?? 460,
    height: opts.height ?? 720,
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url || "";

  if (info.menuItemId === "aura-agent" && info.selectionText) {
    const params = new URLSearchParams({ mode: "agent" });
    if (url) params.set("url", url);
    if (tab?.title) params.set("title", tab.title);
    params.set("text", info.selectionText.slice(0, 16000));
    openAuraPopup(params, { width: 480, height: 760 });
    return;
  }

  const params = new URLSearchParams({ mode: "popup" });
  if (url) params.set("url", url);
  if (tab?.title) params.set("title", tab.title);
  if (info.selectionText) params.set("text", info.selectionText.slice(0, 4000));
  openAuraPopup(params);
});

// Keyboard command → tell content script in active tab to toggle sidebar.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-sidebar") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggle-sidebar" });
  } catch {
    // Content script not loaded on this page (e.g. chrome:// URL) — ignore.
  }
});

// Content scripts can ask us to open the meeting recorder for the current tab.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.action !== "open-recorder") return;
  const tab = sender.tab;
  const params = new URLSearchParams({
    autostart: "1",
    source: msg.platform || "meeting",
  });
  if (tab?.url) params.set("source_url", tab.url);
  if (tab?.title) params.set("source_title", tab.title);
  chrome.windows.create({
    url: `${APP_ORIGIN}/app/meetings?${params.toString()}`,
    type: "popup",
    width: 480,
    height: 640,
  });
});

// --- Omnibox: type "aura <query>" in the URL bar ---
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const raw = text.trim();
  let target = suggestCache.get(raw);
  if (!target) {
    // user typed free text and hit enter — default to search
    target = raw
      ? `${APP_ORIGIN}/app/search?q=${encodeURIComponent(raw)}`
      : `${APP_ORIGIN}/app`;
  }
  if (disposition === "newForegroundTab") {
    chrome.tabs.create({ url: target });
  } else if (disposition === "newBackgroundTab") {
    chrome.tabs.create({ url: target, active: false });
  } else {
    chrome.tabs.update({ url: target });
  }
});

// Cache last suggestions so onInputEntered can resolve a chosen item to a URL.
const suggestCache = new Map(); // content -> url
let suggestSeq = 0;

function escapeXml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

async function fetchAuraSuggestions(q) {
  try {
    const { auraToken } = await chrome.storage.local.get("auraToken");
    const res = await fetch(
      `${APP_ORIGIN}/api/public/extension/suggest?q=${encodeURIComponent(q)}&limit=6`,
      {
        headers: auraToken ? { authorization: `Bearer ${auraToken}` } : {},
      },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.suggestions) ? json.suggestions : [];
  } catch {
    return [];
  }
}

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim();
  if (!q) return;
  const seq = ++suggestSeq;
  suggestCache.clear();

  const fallback = [
    {
      content: `__search__::${q}`,
      description: `Search Aura for <match>${escapeXml(q)}</match>`,
    },
    {
      content: `__newtask__::${q}`,
      description: `Quick add task: <dim>${escapeXml(q)}</dim>`,
    },
  ];
  suggestCache.set(`__search__::${q}`, `${APP_ORIGIN}/app/search?q=${encodeURIComponent(q)}`);
  suggestCache.set(
    `__newtask__::${q}`,
    `${APP_ORIGIN}/app/my-tasks?new=${encodeURIComponent(q)}`,
  );

  const items = await fetchAuraSuggestions(q);
  if (seq !== suggestSeq) return; // a newer query started

  const typed = items.map((s) => {
    const key = `${s.type}::${s.id}`;
    suggestCache.set(key, `${APP_ORIGIN}${s.url}`);
    const tag = s.type === "task" ? "📋" : s.type === "project" ? "📁" : "🎙";
    const sub = s.subtitle ? ` <dim>— ${escapeXml(s.subtitle)}</dim>` : "";
    return {
      content: key,
      description: `${tag} ${escapeXml(s.title)}${sub}`,
    };
  });

  suggest([...typed, ...fallback]);
});

// Allow content scripts to open the agent popup with current textarea content.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  if (msg.action === "compose-assist") {
    const tab = sender.tab;
    const params = new URLSearchParams({ mode: "agent" });
    if (tab?.url) params.set("url", tab.url);
    if (tab?.title) params.set("title", tab.title);
    params.set("text", String(msg.text || "").slice(0, 16000));
    openAuraPopup(params, { width: 480, height: 760 });
  }
});

// --- Screenshot to task ---
chrome.contextMenus.create({
  id: "aura-screenshot",
  title: "Screenshot → Aura task",
  contexts: ["page", "selection"],
});

async function captureAndOpen(tab) {
  if (!tab) return;
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await chrome.storage.local.set({ [`shot:${token}`]: dataUrl });
    const params = new URLSearchParams({ mode: "screenshot", token });
    if (tab.url) params.set("url", tab.url);
    if (tab.title) params.set("title", tab.title);
    openAuraPopup(params, { width: 540, height: 760 });
  } catch (e) {
    console.error("Screenshot failed", e);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "aura-screenshot") captureAndOpen(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.action === "screenshot-task") {
    captureAndOpen(sender.tab);
    return;
  }
  if (msg.action === "get-screenshot" && msg.token) {
    chrome.storage.local.get(`shot:${msg.token}`, (res) => {
      sendResponse({ dataUrl: res[`shot:${msg.token}`] || null });
      chrome.storage.local.remove(`shot:${msg.token}`);
    });
    return true;
  }
});
