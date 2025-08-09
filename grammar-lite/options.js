// options.js
const DEFAULTS = {
  serverUrl: "https://api.languagetool.org/v2/check",
  apiKey: "",
  timeoutMs: 10000
};

function load() {
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    document.getElementById("serverUrl").value = cfg.serverUrl || DEFAULTS.serverUrl;
    document.getElementById("apiKey").value = cfg.apiKey || "";
    document.getElementById("timeoutMs").value = cfg.timeoutMs || 10000;
  });
}

function save() {
  const serverUrl = document.getElementById("serverUrl").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const timeoutMs = Number(document.getElementById("timeoutMs").value) || 10000;
  chrome.storage.sync.set({ serverUrl, apiKey, timeoutMs }, () => {
    const status = document.getElementById("status");
    status.textContent = "Saved.";
    setTimeout(() => status.textContent = "", 1200);
  });
}

document.getElementById("saveBtn").addEventListener("click", save);
load();

