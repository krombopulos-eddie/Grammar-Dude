// popup.js
const DEFAULTS = { language: "en-US" };

function load() {
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    document.getElementById("lang").value = cfg.language || "en-US";
  });
}
function save() {
  const language = document.getElementById("lang").value;
  chrome.storage.sync.set({ language });
}
document.getElementById("lang").addEventListener("change", save);
document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
load();

