// Builds the iframe URL with the active tab's context, then loads the Aura app.
// Change this to your deployed app origin before publishing the extension.
const APP_ORIGIN = "http://localhost:8080";

(async () => {
  const iframe = document.getElementById("app");
  const params = new URLSearchParams({ mode: "popup" });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) params.set("url", tab.url);
    if (tab?.title) params.set("title", tab.title);

    // Try to grab the user's selected text from the page.
    if (tab?.id) {
      try {
        const [{ result } = {}] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() ?? "",
        });
        if (result) params.set("text", result.slice(0, 4000));
      } catch {
        // chrome:// pages, store, etc. — silently ignore.
      }
    }
  } catch (e) {
    console.warn("Aura: could not read tab context", e);
  }

  iframe.src = `${APP_ORIGIN}/extension-entry?${params.toString()}`;
})();
