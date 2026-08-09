/* Clay of Fortune — synthesized sound via the Web Audio API (no audio files).
   Exposes a global `Sound` with tick(), fanfare(), resume(), and an
   enabled flag persisted to localStorage. */

const Sound = (() => {
  const KEY = "cof-sound";
  let ctx = null;
  let master = null;
  let enabled = localStorage.getItem(KEY) !== "off";

  // AudioContext must be created/resumed after a user gesture (autoplay policy).
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function resume() {
    ensure();
    if (ctx.state === "suspended") ctx.resume();
  }

  // Cached white-noise buffer reused for every click (the "peg strike").
  let noise = null;
  function noiseBuffer() {
    if (noise) return noise;
    const len = Math.floor(ctx.sampleRate * 0.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  /**
   * Ratchety mechanical click — a very short burst of band-passed noise with
   * a snappy envelope, like a flapper hitting a peg. Slight pitch/level
   * randomness keeps repeated clicks from sounding identical.
   */
  function tick() {
    if (!enabled) return;
    ensure();
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    src.playbackRate.value = 0.9 + Math.random() * 0.3;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700 + Math.random() * 900;
    bp.Q.value = 7;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 500;

    const g = ctx.createGain();
    const peak = 0.5 + Math.random() * 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.001); // near-instant attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); // fast wooden decay

    src.connect(hp).connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.05);
  }

  /** Rising arpeggio played when a winner is chosen. */
  function fanfare() {
    if (!enabled) return;
    ensure();
    const base = ctx.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      note(freq, base + i * 0.11, 0.22);
    });
  }

  function note(freq, start, dur) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  return {
    tick,
    fanfare,
    resume,
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      localStorage.setItem(KEY, v ? "on" : "off");
    },
  };
})();
