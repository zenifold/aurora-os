// New tab dashboard: greeting, clock, search, and live workspace cards.
// Change this to your deployed app origin before publishing the extension.
const APP_ORIGIN = "http://localhost:8080";

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function updateClock() {
  const d = new Date();
  const h = d.getHours();
  document.getElementById("clock").textContent =
    `${pad(h)}:${pad(d.getMinutes())}`;
  const g =
    h < 5 ? "Still up" :
    h < 12 ? "Good morning" :
    h < 18 ? "Good afternoon" :
    "Good evening";
  document.getElementById("greeting").textContent = g;
}
updateClock();
setInterval(updateClock, 30_000);

// --- Search box: route to omnibox-style search in the app ---
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("q").value.trim();
  if (!q) return;
  window.location.href = `${APP_ORIGIN}/app/search?q=${encodeURIComponent(q)}`;
});

// --- Live data: pull from the same suggest endpoint background.js uses ---
async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get("auraToken", (r) => resolve(r.auraToken || ""));
  });
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

function row({ href, title, meta, tag }) {
  const a = document.createElement("a");
  a.className = "item";
  a.href = href;
  a.innerHTML =
    (tag ? `<span class="tag">${escapeHtml(tag)}</span>` : "") +
    `<span>${escapeHtml(title)}</span>` +
    (meta ? `<span class="meta">${escapeHtml(meta)}</span>` : "");
  return a;
}

function renderEmpty(el, msg, ctaHref, ctaLabel) {
  el.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "empty";
  wrap.innerHTML = escapeHtml(msg) +
    (ctaHref ? ` · <a style="color:#d8b4fe;text-decoration:none" href="${ctaHref}">${escapeHtml(ctaLabel)}</a>` : "");
  el.appendChild(wrap);
}

async function fetchSuggestions(q) {
  const token = await getToken();
  if (!token) return null; // signed out
  try {
    const res = await fetch(
      `${APP_ORIGIN}/api/public/extension/suggest?q=${encodeURIComponent(q)}&limit=8`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.suggestions) ? json.suggestions : [];
  } catch {
    return null;
  }
}

async function loadCards() {
  const inboxEl = document.getElementById("inbox");
  const meetingsEl = document.getElementById("meetings");
  const tasksEl = document.getElementById("tasks");

  // Pull a small slice of recent items per type using bland queries.
  // The suggest endpoint filters by ilike — empty space matches a wide set.
  const [tasks, meetings] = await Promise.all([
    fetchSuggestions(" "),
    fetchSuggestions(" "),
  ]);

  if (tasks === null) {
    const signedOut = `${APP_ORIGIN}/login`;
    renderEmpty(inboxEl, "Sign in to Aura to see your inbox.", signedOut, "Sign in");
    renderEmpty(meetingsEl, "Sign in to see today's meetings.", signedOut, "Sign in");
    renderEmpty(tasksEl, "Sign in to see what's due.", signedOut, "Sign in");
    return;
  }

  // Tasks card
  const taskItems = (tasks || []).filter((s) => s.type === "task").slice(0, 5);
  tasksEl.innerHTML = "";
  if (taskItems.length === 0) {
    renderEmpty(tasksEl, "Nothing due — you're clear.", `${APP_ORIGIN}/app/my-tasks`, "Open tasks");
  } else {
    taskItems.forEach((t) =>
      tasksEl.appendChild(
        row({
          href: `${APP_ORIGIN}${t.url}`,
          title: t.title,
          meta: t.subtitle || "",
          tag: "Task",
        }),
      ),
    );
  }

  // Meetings card
  const meetingItems = (meetings || []).filter((s) => s.type === "meeting").slice(0, 5);
  meetingsEl.innerHTML = "";
  if (meetingItems.length === 0) {
    renderEmpty(meetingsEl, "No meetings scheduled.", `${APP_ORIGIN}/app/meetings`, "Open calendar");
  } else {
    meetingItems.forEach((m) =>
      meetingsEl.appendChild(
        row({
          href: `${APP_ORIGIN}${m.url}`,
          title: m.title,
          meta: m.subtitle || "",
          tag: "Meet",
        }),
      ),
    );
  }

  // Inbox card — show projects as "active workstreams" proxy until inbox API ships.
  const projectItems = (tasks || []).filter((s) => s.type === "project").slice(0, 5);
  inboxEl.innerHTML = "";
  if (projectItems.length === 0) {
    renderEmpty(inboxEl, "Inbox empty.", `${APP_ORIGIN}/app/inbox`, "Open inbox");
  } else {
    projectItems.forEach((p) =>
      inboxEl.appendChild(
        row({
          href: `${APP_ORIGIN}${p.url}`,
          title: p.title,
          meta: "Active",
          tag: "Project",
        }),
      ),
    );
  }
}

loadCards();
