// Aura Context Lens — content script.
// Injects a floating toggle button + sidebar iframe on every page,
// and a meeting-record banner on Meet/Zoom/Teams.
// Change this to your deployed app origin before publishing the extension.
const APP_ORIGIN = "http://localhost:8080";
const TOGGLE_ID = "aura-ctx-toggle";
const SIDEBAR_ID = "aura-ctx-sidebar";
const BANNER_ID = "aura-meeting-banner";
const BANNER_DISMISS_KEY = "aura-meeting-banner-dismissed-until";

function detectPlatform() {
  const h = window.location.hostname;
  if (h.includes("mail.google.com")) return "gmail";
  if (h.includes("notion.so") || h.includes("notion.site")) return "notion";
  if (h.includes("atlassian.net")) return "jira";
  if (h.includes("github.com")) return "github";
  if (h.includes("linear.app")) return "linear";
  return "generic";
}

function detectMeetingPlatform() {
  const h = window.location.hostname;
  const p = window.location.pathname;
  if (h.includes("meet.google.com") && /^\/[a-z0-9-]{5,}/i.test(p)) return "google-meet";
  if (h.includes("zoom.us") && (p.includes("/j/") || p.includes("/wc/") || p.includes("/my/"))) return "zoom";
  if (h.includes("teams.microsoft.com") || h.includes("teams.live.com")) return "ms-teams";
  return null;
}

function buildContext() {
  const platform = detectPlatform();
  return {
    platform,
    url: window.location.href,
    title: document.title || "",
    text: (window.getSelection()?.toString() || "").slice(0, 4000),
  };
}

function buildSidebarUrl() {
  const ctx = buildContext();
  const params = new URLSearchParams({
    mode: "sidebar",
    platform: ctx.platform,
    url: ctx.url,
    title: ctx.title,
    text: ctx.text,
  });
  return `${APP_ORIGIN}/extension-entry?${params.toString()}`;
}

function ensureToggle() {
  if (document.getElementById(TOGGLE_ID)) return;
  const btn = document.createElement("button");
  btn.id = TOGGLE_ID;
  btn.title = "Open Aura (Cmd/Ctrl+Shift+L)";
  btn.setAttribute("aria-label", "Open Aura sidebar");
  btn.innerHTML = "✦";
  btn.addEventListener("click", toggleSidebar);
  document.documentElement.appendChild(btn);
}

function toggleSidebar() {
  const existing = document.getElementById(SIDEBAR_ID);
  if (existing) {
    existing.remove();
    document.documentElement.classList.remove("aura-ctx-open");
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.id = SIDEBAR_ID;
  iframe.src = buildSidebarUrl();
  iframe.allow = "clipboard-write";
  document.documentElement.appendChild(iframe);
  document.documentElement.classList.add("aura-ctx-open");
}

function ensureMeetingBanner(platform) {
  if (document.getElementById(BANNER_ID)) return;

  // Respect dismiss-for-this-meeting (1 hour).
  try {
    const until = Number(sessionStorage.getItem(BANNER_DISMISS_KEY) || "0");
    if (until && Date.now() < until) return;
  } catch (_) {
    /* ignore */
  }

  const wrap = document.createElement("div");
  wrap.id = BANNER_ID;
  wrap.innerHTML = `
    <div class="aura-mb-inner">
      <div class="aura-mb-dot"></div>
      <span class="aura-mb-text">Record this meeting with Aura?</span>
      <button class="aura-mb-go" type="button">Record</button>
      <button class="aura-mb-x" type="button" aria-label="Dismiss">✕</button>
    </div>
  `;
  document.documentElement.appendChild(wrap);

  wrap.querySelector(".aura-mb-go").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "open-recorder", platform });
    wrap.remove();
  });
  wrap.querySelector(".aura-mb-x").addEventListener("click", () => {
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
    } catch (_) {
      /* ignore */
    }
    wrap.remove();
  });
}

function init() {
  // Don't inject inside our own iframe or in obvious edge cases.
  if (window.top !== window.self) return;
  if (window.location.protocol === "chrome-extension:") return;
  // Defer to avoid blocking page paint.
  setTimeout(ensureToggle, 1500);

  // Meeting banner — check on load and on SPA URL changes.
  const checkMeeting = () => {
    const p = detectMeetingPlatform();
    if (p) ensureMeetingBanner(p);
  };
  setTimeout(checkMeeting, 2500);

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const banner = document.getElementById(BANNER_ID);
      if (banner) banner.remove();
      setTimeout(checkMeeting, 1500);
    }
  }, 2000);
}

init();

// Background can ask us to toggle.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === "toggle-sidebar") toggleSidebar();
});

// --- Compose assist: floating button on focused textareas / contenteditable ---
const COMPOSE_BTN_ID = "aura-compose-btn";

function getEditableText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
  if (el.isContentEditable) return el.innerText || "";
  return "";
}

function isEligibleField(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  if (el.tagName === "INPUT" && el.type === "text") {
    // Only show on long inputs, not search bars.
    return el.offsetWidth > 320;
  }
  return false;
}

function placeComposeButton(el) {
  let btn = document.getElementById(COMPOSE_BTN_ID);
  if (!btn) {
    btn = document.createElement("button");
    btn.id = COMPOSE_BTN_ID;
    btn.type = "button";
    btn.title = "Aura compose assist";
    btn.innerHTML = "✦";
    btn.addEventListener("mousedown", (e) => {
      // prevent stealing focus
      e.preventDefault();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn._target;
      const text = getEditableText(target);
      if (!text.trim()) return;
      chrome.runtime.sendMessage({ action: "compose-assist", text });
    });
    document.documentElement.appendChild(btn);
  }
  btn._target = el;
  const r = el.getBoundingClientRect();
  if (r.width < 200 || r.height < 28) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "flex";
  btn.style.top = `${window.scrollY + r.bottom - 30}px`;
  btn.style.left = `${window.scrollX + r.right - 32}px`;
}

function hideComposeButton() {
  const btn = document.getElementById(COMPOSE_BTN_ID);
  if (btn) btn.style.display = "none";
}

document.addEventListener("focusin", (e) => {
  const t = e.target;
  if (isEligibleField(t)) placeComposeButton(t);
  else hideComposeButton();
});
document.addEventListener("focusout", (e) => {
  // Hide unless user is clicking the button itself.
  setTimeout(() => {
    const active = document.activeElement;
    if (!isEligibleField(active)) hideComposeButton();
  }, 80);
});
window.addEventListener("scroll", () => {
  const btn = document.getElementById(COMPOSE_BTN_ID);
  if (btn && btn._target && btn.style.display !== "none") placeComposeButton(btn._target);
}, { passive: true });

// Bridge: page asks for screenshot dataUrl via window.postMessage.
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (!d || d.source !== "aura-page" || d.action !== "get-screenshot" || !d.token) return;
  chrome.runtime.sendMessage({ action: "get-screenshot", token: d.token }, (resp) => {
    window.postMessage(
      { source: "aura-ext", action: "screenshot-result", token: d.token, dataUrl: resp?.dataUrl || null },
      "*",
    );
  });
});

// --- Auth token sync: when running on the Aura web app, forward the
// Supabase access token to the extension so background.js can call
// authenticated APIs (omnibox suggestions, etc.).
function syncAuraToken() {
  try {
    // Only lift the auth token on origins that actually serve this app.
    if (window.location.origin !== APP_ORIGIN) {
      return;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token;
        if (token) {
          chrome.storage.local.set({ auraToken: token });
          return;
        }
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
}
syncAuraToken();
setInterval(syncAuraToken, 60_000);
