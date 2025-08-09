(function() {
  const BTN_ID = "gramma-lite-check-btn";
  const PANEL_ID = "gramma-lite-panel";

  let currentField = null;
  let lastCheckedValue = "";

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel"].includes(t);
    }
    // contentEditable support could be added later
    return false;
  }

  // Floating button
  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.textContent = "Check";
  btn.title = "Check grammar";
  btn.style.display = "none";
  document.documentElement.appendChild(btn);

  // Results panel
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="gl-header">
      <span>Gramma-Lite</span>
      <div class="gl-spacer"></div>
      <button class="gl-close" title="Close">✕</button>
    </div>
    <div class="gl-body">
      <div class="gl-summary">No issues found.</div>
      <ul class="gl-issues"></ul>
    </div>
    <div class="gl-footer">
      <button class="gl-apply-all">Apply all</button>
    </div>
  `;
  panel.style.display = "none";
  document.documentElement.appendChild(panel);

  const panelClose = panel.querySelector(".gl-close");
  const issuesList = panel.querySelector(".gl-issues");
  const summaryEl = panel.querySelector(".gl-summary");
  const applyAllBtn = panel.querySelector(".gl-apply-all");

  function positionButtonNear(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.right - 60 + window.scrollX;
    const y = rect.bottom + 6 + window.scrollY;
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.style.display = "inline-block";
  }

  function hideButton() {
    btn.style.display = "none";
  }

  function showPanel() {
    panel.style.display = "block";
  }

  function hidePanel() {
    panel.style.display = "none";
  }

  function getFieldText() {
    if (!currentField) return "";
    return currentField.value ?? "";
  }

  function setFieldText(newText) {
    if (!currentField) return;
    const start = currentField.selectionStart;
    const end = currentField.selectionEnd;
    currentField.value = newText;
    // try to keep caret somewhat stable
    const newPos = Math.min(newText.length, (start ?? newText.length));
    currentField.setSelectionRange(newPos, newPos);
    currentField.dispatchEvent(new Event("input", { bubbles: true }));
    currentField.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function runCheck() {
    if (!currentField) return;
    const text = getFieldText();
    lastCheckedValue = text;

    issuesList.innerHTML = "";
    summaryEl.textContent = "Checking…";
    showPanel();

    const resp = await chrome.runtime.sendMessage({
      type: "LT_CHECK",
      text,
      language: detectLang(text)
    });

    if (!resp?.ok) {
      summaryEl.textContent = `Error: ${resp?.error ?? "Unknown"}`;
      return;
    }

    const matches = (resp.data && resp.data.matches) || [];
    if (matches.length === 0) {
      summaryEl.textContent = "No issues found. Nice.";
      return;
    }

    summaryEl.textContent = `${matches.length} potential issue${matches.length > 1 ? "s" : ""} found.`;

    // Build list items
    matches.forEach((m, idx) => {
      const from = m.offset;
      const len = m.length;
      const bad = text.substring(from, from + len);
      const best = (m.replacements && m.replacements[0]?.value) || null;

      const li = document.createElement("li");
      li.className = "gl-issue";
      li.innerHTML = `
        <div class="gl-issue-main">
          <div class="gl-issue-bad"><code>${escapeHtml(bad || "(empty)")}</code></div>
          <div class="gl-issue-msg">${escapeHtml(m.message || "Issue")}</div>
        </div>
        <div class="gl-issue-actions">
          <select class="gl-sel"></select>
          <button class="gl-apply-one">Apply</button>
        </div>
      `;

      const sel = li.querySelector(".gl-sel");
      // First option: keep original
      const keep = document.createElement("option");
      keep.value = "__KEEP__";
      keep.textContent = `Keep: "${bad}"`;
      sel.appendChild(keep);

      (m.replacements || []).slice(0, 5).forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.value;
        opt.textContent = r.value;
        sel.appendChild(opt);
      });

      const applyBtn = li.querySelector(".gl-apply-one");
      applyBtn.addEventListener("click", () => {
        const choice = sel.value;
        if (choice === "__KEEP__") return;
        // Apply a single replacement safely: recompute against current field text by offset
        const current = getFieldText();
        // If text changed since check, offsets may be stale; bail with a gentle warning
        if (current !== lastCheckedValue) {
          alert("Text changed since last check. Run Check again to apply safely.");
          return;
        }
        const before = current.slice(0, from);
        const after = current.slice(from + len);
        setFieldText(before + choice + after);
        // Update our snapshot
        lastCheckedValue = getFieldText();
      });

      issuesList.appendChild(li);
    });

    applyAllBtn.onclick = () => {
      // Build corrected text by walking non-overlapping matches in ascending offset,
      // choosing each match’s first replacement unless user selected a custom one in the UI.
      const current = getFieldText();
      if (current !== lastCheckedValue) {
        alert("Text changed since last check. Run Check again to apply safely.");
        return;
      }
      const items = [...issuesList.querySelectorAll(".gl-issue")];
      let corrected = "";
      let cursor = 0;

      matches.forEach((m, i) => {
        const from = m.offset;
        const len = m.length;
        if (from < cursor) return; // overlapping; skip

        const sel = items[i].querySelector(".gl-sel");
        let replacement = (sel && sel.value && sel.value !== "__KEEP__") ? sel.value
          : (m.replacements && m.replacements[0]?.value) || current.substr(from, len);

        corrected += current.slice(cursor, from) + replacement;
        cursor = from + len;
      });

      corrected += current.slice(cursor);
      setFieldText(corrected);
      lastCheckedValue = corrected;
    };
  }

  function detectLang(text) {
    // Simple heuristic; you can expand this or expose in options
    return /[áéíóúñü]/i.test(text) ? "es" : "en-US";
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch])
    );
  }

  // Events
  document.addEventListener("focusin", (e) => {
    if (isEditable(e.target)) {
      currentField = e.target;
      positionButtonNear(currentField);
    } else {
      currentField = null;
      hideButton();
    }
  });

  window.addEventListener("scroll", () => {
    if (currentField && btn.style.display !== "none") {
      positionButtonNear(currentField);
    }
  });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    runCheck();
  });

  panelClose.addEventListener("click", hidePanel);
})();

