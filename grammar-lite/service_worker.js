const DEFAULT_SETTINGS = {
  serverUrl: "https://api.languagetool.org/v2/check",
  apiKey: "",     // not needed for public LT, used if you self-host or use a key
  language: "en-US",
  timeoutMs: 10000
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (cfg) => resolve({ ...DEFAULT_SETTINGS, ...cfg }));
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "LT_CHECK") {
    (async () => {
      try {
        const { serverUrl, apiKey, language, timeoutMs } = await getSettings();
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);

        const params = new URLSearchParams();
        params.set("text", msg.text);
        params.set("language", msg.language || language);

        // Optional: premium/self-hosted key header
        const headers = { "Content-Type": "application/x-www-form-urlencoded" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const res = await fetch(serverUrl, { method: "POST", headers, body: params, signal: controller.signal });
        clearTimeout(t);

        if (!res.ok) {
          const body = await res.text();
          sendResponse({ ok: false, error: `HTTP ${res.status} ${res.statusText}: ${body}` });
          return;
        }

        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // keep message channel open (async)
  }
});

