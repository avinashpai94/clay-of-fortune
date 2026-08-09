/* Clay of Fortune — lightweight canvas confetti (no external library).
   Exposes a global `Confetti` with burst(x, y) and an enabled flag
   persisted to localStorage. */

const Confetti = (() => {
  const KEY = "cof-confetti";
  const COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d",
                  "#e9c46a", "#ff8fab", "#4cc9f0", "#ffd23f"];
  const GRAVITY = 0.22;

  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let raf = null;
  let enabled = localStorage.getItem(KEY) !== "off";

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function makeParticle(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6, // bias upward for a burst feel
      size: 6 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      life: 1,
    };
  }

  function burst(x, y, count = 140) {
    if (!enabled) return;
    for (let i = 0; i < count; i++) particles.push(makeParticle(x, y));
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 60);
    for (const p of particles) {
      p.vy += GRAVITY;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.life -= 0.008;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (particles.length > 0) {
      raf = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raf = null;
    }
  }

  return {
    burst,
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      localStorage.setItem(KEY, v ? "on" : "off");
      if (!v) { particles = []; }
    },
  };
})();
