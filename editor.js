/* Clay of Fortune — in-page options editor with lightweight JSON validation.
   Hidden by default; toggled by the "Edit options" button. Applying saves the
   options for this browser only (localStorage); publishing for everyone still
   means pasting the JSON into options.json and committing. */

(() => {
  const KEY = "cof-custom-options";
  const toggleBtn = document.getElementById("toggle-editor");
  const panel = document.getElementById("editor-panel");
  const textarea = document.getElementById("editor-text");
  const statusEl = document.getElementById("editor-status");
  const applyBtn = document.getElementById("editor-apply");
  const copyBtn = document.getElementById("editor-copy");
  const linkBtn = document.getElementById("editor-link");
  const revertBtn = document.getElementById("editor-revert");

  const pretty = (data) => JSON.stringify(data, null, 2);

  /** Turn a byte offset into a 1-based line/column for friendly messages. */
  function lineCol(text, pos) {
    let line = 1, col = 1;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === "\n") { line++; col = 1; } else { col++; }
    }
    return { line, col };
  }

  /** Make JSON.parse errors readable, adding line/column when we can find it. */
  function friendlyError(err, text) {
    const msg = String(err.message || err);
    if (/\(line \d+ column \d+/.test(msg)) return msg; // some engines already include it
    const m = msg.match(/position (\d+)/);
    if (m) {
      const { line, col } = lineCol(text, Number(m[1]));
      return `${msg.replace(/ in JSON.*$/, "")} (line ${line}, column ${col})`;
    }
    return msg;
  }

  /** Lightweight schema check beyond raw JSON validity. Returns error or null. */
  function checkSchema(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return 'Top level must be an object, e.g. { "options": [ ... ] }';
    }
    if (!Array.isArray(data.options)) return '"options" must be an array';
    if (data.options.length < 2) return "Need at least 2 options";
    if (data.title !== undefined && typeof data.title !== "string") {
      return '"title" must be a string';
    }
    if (data.sizeByWeight !== undefined && typeof data.sizeByWeight !== "boolean") {
      return '"sizeByWeight" must be true or false';
    }
    for (let i = 0; i < data.options.length; i++) {
      const o = data.options[i];
      const n = i + 1;
      if (typeof o !== "object" || o === null || Array.isArray(o)) {
        return `Option ${n} must be an object`;
      }
      if (typeof o.label !== "string" || !o.label.trim()) {
        return `Option ${n} needs a non-empty "label"`;
      }
      if (o.weight !== undefined && (typeof o.weight !== "number" || !(o.weight > 0))) {
        return `Option ${n} ("${o.label}") "weight" must be a positive number`;
      }
      if (o.color !== undefined && typeof o.color !== "string") {
        return `Option ${n} ("${o.label}") "color" must be a string`;
      }
      if (o.image !== undefined && (typeof o.image !== "string" || !o.image.trim())) {
        return `Option ${n} ("${o.label}") "image" must be a non-empty string (URL or path)`;
      }
    }
    return null;
  }

  function setStatus(ok, msg) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("ok", ok);
    statusEl.classList.toggle("err", !ok);
    applyBtn.disabled = !ok;
  }

  /** Validate the textarea; returns parsed data when valid, else null. */
  function validate() {
    const text = textarea.value;
    if (!text.trim()) { setStatus(false, "Editor is empty"); return null; }
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      setStatus(false, "⚠ " + friendlyError(err, text));
      return null;
    }
    const schemaErr = checkSchema(data);
    if (schemaErr) { setStatus(false, "⚠ " + schemaErr); return null; }
    setStatus(true, `✓ Valid — ${data.options.length} options`);
    return data;
  }

  function seedFromCurrent() {
    const data = window.WheelApp ? window.WheelApp.currentData() : { options: [] };
    textarea.value = pretty(data);
    validate();
  }

  function open() {
    panel.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    seedFromCurrent();
    textarea.focus();
  }
  function close() {
    panel.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  function flash(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = original; }, 1200);
  }

  /** Copy text with a fallback for non-secure contexts / older browsers. */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through to execCommand */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  toggleBtn.addEventListener("click", () => (panel.hidden ? open() : close()));
  textarea.addEventListener("input", validate);

  applyBtn.addEventListener("click", () => {
    const data = validate();
    if (!data) return;
    window.WheelApp.applyData(data);
    localStorage.setItem(KEY, JSON.stringify(data));
    setStatus(true, "✓ Applied & saved for this browser");
  });

  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(textarea.value);
    flash(copyBtn, ok ? "Copied!" : "Copy failed");
  });

  linkBtn.addEventListener("click", async () => {
    const data = validate();
    if (!data) { setStatus(false, "⚠ Fix the JSON before making a link"); return; }
    if (!window.WheelApp || typeof window.WheelApp.shareURL !== "function") {
      setStatus(false, "⚠ Share not loaded — hard-refresh the page (Cmd+Shift+R)");
      return;
    }
    let url;
    try {
      url = window.WheelApp.shareURL(data);
    } catch (err) {
      setStatus(false, "⚠ Couldn't build link: " + err.message);
      return;
    }
    const ok = await copyText(url);
    if (ok) flash(linkBtn, "Link copied!");
    else setStatus(true, "Copy this link manually: " + url);
  });

  revertBtn.addEventListener("click", async () => {
    localStorage.removeItem(KEY);
    try {
      await window.WheelApp.reloadFromFile();
      seedFromCurrent();
      setStatus(true, "✓ Reverted to options.json");
    } catch (err) {
      setStatus(false, "⚠ " + err.message);
    }
  });
})();
