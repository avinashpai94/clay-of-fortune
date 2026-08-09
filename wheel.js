/* Clay of Fortune — Phase 1: load options + draw the wheel */

const SIZE = 500; // logical drawing size in CSS pixels
const PALETTE = [
  "#e63946", "#f4a261", "#2a9d8f", "#457b9d",
  "#e9c46a", "#8ab17d", "#bc6c25", "#6d597a",
  "#ff8fab", "#4cc9f0", "#b5179e", "#43aa8b",
];

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const spinBtn = document.getElementById("spin");
const titleEl = document.getElementById("title");

let slices = []; // { label, weight, color, start, end } angles in radians
let currentRotation = 0; // accumulated wheel rotation in radians
let isSpinning = false;
let winnerIndex = -1; // index of the highlighted winning slice, or -1

let rawOptions = []; // full option list (from options.json or the editor)
let sizeByWeight = false;
let currentTitle = "Clay of Fortune";

// Per-browser state (localStorage). Removed winners and history never leave
// this browser, so one machine's removals don't affect anyone else's wheel.
const LS = {
  removed: "cof-removed",
  history: "cof-history",
  removeAfter: "cof-remove-after",
  custom: "cof-custom-options", // options edited in-page (this browser only)
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

let removed = new Set(loadJSON(LS.removed, [])); // labels removed from the wheel
let history = loadJSON(LS.history, []); // [{ label, at }] most recent last
let removeAfterSpin = localStorage.getItem(LS.removeAfter) !== "off"; // on by default

const saveRemoved = () => localStorage.setItem(LS.removed, JSON.stringify([...removed]));
const saveHistory = () => localStorage.setItem(LS.history, JSON.stringify(history));

/** Options still on the wheel (not removed in this browser). */
const activeOptions = () => rawOptions.filter((o) => !removed.has(o.label));

/** Set up the canvas backing store for crisp rendering on high-DPI screens. */
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Convert raw options into slices with computed angles.
 * `weight` controls landing probability. Visual slice width is equal by
 * default, or proportional to weight when `sizeByWeight` is true.
 */
function buildSlices(options, sizeByWeight = false) {
  const totalWeight = options.reduce((sum, o) => sum + (o.weight > 0 ? o.weight : 1), 0);
  let angle = -Math.PI / 2; // start at the top (under the pointer)
  return options.map((o, i) => {
    const weight = o.weight > 0 ? o.weight : 1;
    const sizeShare = sizeByWeight ? weight / totalWeight : 1 / options.length;
    const sweep = sizeShare * Math.PI * 2;
    const slice = {
      label: o.label,
      weight, // landing probability weight (independent of visual sweep)
      color: o.color || PALETTE[i % PALETTE.length],
      start: angle,
      end: angle + sweep,
    };
    angle += sweep;
    return slice;
  });
}

/** Draw the full wheel from the current slices. */
function drawWheel(rotation = 0, highlightIndex = -1) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = SIZE / 2 - 6;

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  slices.forEach((slice, i) => {
    const isWinner = i === highlightIndex;

    // Slice wedge
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, slice.start, slice.end);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    if (isWinner) {
      // Brighten the winning wedge with a translucent overlay + gold edge.
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#ffd23f";
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
    }
    ctx.stroke();

    // Label
    const mid = (slice.start + slice.end) / 2;
    ctx.save();
    ctx.rotate(mid);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
    ctx.fillText(truncate(slice.label), radius - 18, 0);
    ctx.restore();
  });

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  ctx.restore();
}

/** Keep long labels from overflowing the slice (code-point aware for emoji). */
function truncate(text, max = 14) {
  const chars = Array.from(text); // splits by code point, not UTF-16 unit
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
}

/** Rebuild slices from the currently-active options and redraw. */
function rebuild() {
  slices = buildSlices(activeOptions(), sizeByWeight);
  drawWheel(currentRotation, winnerIndex);
  updateSpinAvailability();
}

/** Enable/disable spinning based on how many options remain. */
function updateSpinAvailability() {
  const active = activeOptions();
  const canSpin = !isSpinning && active.length >= 2;
  spinBtn.disabled = !canSpin;
  if (active.length < 2) {
    statusEl.textContent = active.length === 1
      ? `Last one standing: ${active[0].label}. Reset to spin again.`
      : "No options left — reset to spin again.";
  }
}

/** Apply a full options payload (from file or the in-page editor) to the wheel. */
function applyData(data) {
  currentTitle = data.title || "Clay of Fortune";
  titleEl.textContent = currentTitle;
  document.title = currentTitle;
  rawOptions = Array.isArray(data.options) ? data.options : [];
  sizeByWeight = data.sizeByWeight === true;
  winnerIndex = -1;
  rebuild();
  if (activeOptions().length >= 2) {
    statusEl.textContent = `${activeOptions().length} options ready. Spin!`;
  }
}

async function loadFromFile() {
  const res = await fetch("options.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  setupCanvas();
  renderHistory();
  try {
    const custom = loadJSON(LS.custom, null);
    const usingCustom = custom && Array.isArray(custom.options) && custom.options.length >= 2;
    const data = usingCustom ? custom : await loadFromFile();
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new Error("Need at least 2 options");
    }
    applyData(data);
    if (usingCustom && activeOptions().length >= 2) {
      statusEl.textContent += " · using saved edits";
    }
  } catch (err) {
    statusEl.textContent = `Couldn't load options: ${err.message}`;
    console.error(err);
  }
}

// Small API the in-page editor uses to read/apply/reset options.
window.WheelApp = {
  applyData,
  currentData: () => ({ title: currentTitle, sizeByWeight, options: rawOptions }),
  async reloadFromFile() {
    const data = await loadFromFile();
    applyData(data);
    return data;
  },
};

const TAU = Math.PI * 2;
const SPIN_DURATION = 4200; // ms
const SPIN_TURNS = 5; // full rotations before landing

/** Pick a winning slice index using weight as probability. */
function pickWeightedIndex() {
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < slices.length; i++) {
    r -= slices[i].weight;
    if (r < 0) return i;
  }
  return slices.length - 1;
}

/** Rotation (>= current) that lands the given slice under the top pointer. */
function rotationForSlice(index) {
  const slice = slices[index];
  const sweep = slice.end - slice.start;
  const mid = (slice.start + slice.end) / 2;
  // Jitter within the slice so it doesn't always stop dead-center.
  const jitter = (Math.random() - 0.5) * sweep * 0.7;
  // Want (mid + jitter + rotation) to sit at the pointer (top = -PI/2).
  const desired = -Math.PI / 2 - mid - jitter;
  const currentNorm = ((currentRotation % TAU) + TAU) % TAU;
  let delta = (((desired % TAU) + TAU) % TAU) - currentNorm;
  if (delta < 0) delta += TAU;
  return currentRotation + SPIN_TURNS * TAU + delta;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Which slice index currently sits under the top pointer. */
function sliceUnderPointer(rotation) {
  const a = ((-Math.PI / 2 - rotation) % TAU + TAU) % TAU; // pointer angle in wheel-local space
  for (let i = 0; i < slices.length; i++) {
    const start = ((slices[i].start % TAU) + TAU) % TAU;
    let rel = (a - start) % TAU;
    if (rel < 0) rel += TAU;
    if (rel < slices[i].end - slices[i].start) return i;
  }
  return 0;
}

/** Wheel center in viewport coordinates (for the confetti burst). */
function wheelCenter() {
  const r = canvas.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function spin() {
  if (isSpinning || slices.length < 2) return;
  isSpinning = true;
  winnerIndex = -1;
  spinBtn.disabled = true;
  statusEl.textContent = "Spinning…";
  Sound.resume();

  const index = pickWeightedIndex();
  const startRotation = currentRotation;
  const target = rotationForSlice(index);
  const startTime = performance.now();
  let lastTickIndex = sliceUnderPointer(currentRotation);

  function frame(now) {
    const t = Math.min((now - startTime) / SPIN_DURATION, 1);
    currentRotation = startRotation + (target - startRotation) * easeOutCubic(t);
    drawWheel(currentRotation);

    const idx = sliceUnderPointer(currentRotation);
    if (idx !== lastTickIndex) {
      lastTickIndex = idx;
      Sound.tick();
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      onSpinEnd(index);
    }
  }
  requestAnimationFrame(frame);
}

function onSpinEnd(index) {
  isSpinning = false;
  winnerIndex = index;
  const label = slices[index].label;
  drawWheel(currentRotation, winnerIndex);
  statusEl.textContent = `Winner: ${label}!`;
  Sound.fanfare();
  const { x, y } = wheelCenter();
  Confetti.burst(x, y);
  addHistory(label);

  if (removeAfterSpin) {
    // Let the highlight + confetti land before the slice disappears.
    setTimeout(() => removeOption(label), 1000);
  } else {
    updateSpinAvailability();
  }
}

/** Remove an option from this browser's wheel and persist the change. */
function removeOption(label) {
  removed.add(label);
  saveRemoved();
  winnerIndex = -1;
  rebuild();
}

/** Restore every option removed in this browser. */
function resetWheel() {
  removed.clear();
  saveRemoved();
  winnerIndex = -1;
  rebuild();
  if (activeOptions().length >= 2) {
    statusEl.textContent = `${activeOptions().length} options ready. Spin!`;
  }
}

function addHistory(label) {
  history.push({ label, at: Date.now() });
  if (history.length > 100) history.shift();
  saveHistory();
  renderHistory();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

/** Render the past-winners list (most recent first). */
function renderHistory() {
  const section = document.getElementById("history");
  const list = document.getElementById("history-list");
  if (!list) return;
  list.innerHTML = "";
  for (let i = history.length - 1; i >= 0; i--) {
    const { label, at } = history[i];
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "hist-label";
    name.textContent = label;
    const time = document.createElement("span");
    time.className = "hist-time";
    time.textContent = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    li.append(name, time);
    list.appendChild(li);
  }
  section.hidden = history.length === 0;
}

/** Wire up the Sound / Confetti toggle buttons and reflect saved state. */
function setupControls() {
  const soundBtn = document.getElementById("toggle-sound");
  const confettiBtn = document.getElementById("toggle-confetti");

  const reflect = (btn, on) => btn.setAttribute("aria-pressed", on ? "true" : "false");
  reflect(soundBtn, Sound.enabled);
  reflect(confettiBtn, Confetti.enabled);

  soundBtn.addEventListener("click", () => {
    Sound.setEnabled(!Sound.enabled);
    reflect(soundBtn, Sound.enabled);
    if (Sound.enabled) Sound.resume();
  });
  confettiBtn.addEventListener("click", () => {
    Confetti.setEnabled(!Confetti.enabled);
    reflect(confettiBtn, Confetti.enabled);
  });

  const removeBtn = document.getElementById("toggle-remove");
  reflect(removeBtn, removeAfterSpin);
  removeBtn.addEventListener("click", () => {
    removeAfterSpin = !removeAfterSpin;
    localStorage.setItem(LS.removeAfter, removeAfterSpin ? "on" : "off");
    reflect(removeBtn, removeAfterSpin);
  });

  document.getElementById("reset").addEventListener("click", resetWheel);
  document.getElementById("clear-history").addEventListener("click", clearHistory);

  setupMenu();
}

/** Slide-out options menu on the right. */
function setupMenu() {
  const menu = document.getElementById("menu");
  const scrim = document.getElementById("menu-scrim");
  const openBtn = document.getElementById("menu-toggle");
  const closeBtn = document.getElementById("menu-close");

  const open = () => {
    menu.classList.add("open");
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add("open"));
    openBtn.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    menu.classList.remove("open");
    scrim.classList.remove("open");
    openBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { scrim.hidden = true; }, 250);
  };

  openBtn.addEventListener("click", () => (menu.classList.contains("open") ? close() : open()));
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) close();
  });
}

spinBtn.addEventListener("click", spin);
setupControls();

init();
