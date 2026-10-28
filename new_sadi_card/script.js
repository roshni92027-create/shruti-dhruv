// Wedding: Sunday 15th Nov 2026, Damoh (IST)
const WEDDING = new Date("2026-11-15T00:00:00+05:30").getTime();

const intro = document.getElementById("intro");
const card = document.getElementById("card");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.body.classList.add("locked");

// ---------- Music ----------
// Phones only allow sound after a tap, so the "tap to open" unlocks the
// audio (a silent play + pause) and the song starts when the card appears.
const music = document.getElementById("music");
const musicBtn = document.getElementById("musicBtn");

function unlockMusic() {
  music.muted = true;
  music.play().then(() => {
    if (!revealed) { music.pause(); music.currentTime = 0; }
    music.muted = false;
  }).catch(() => { music.muted = false; });
}

function startMusic() {
  musicBtn.hidden = false;
  music.play().then(setMusicUi).catch(setMusicUi);
}

function setMusicUi() {
  const on = !music.paused;
  musicBtn.classList.toggle("playing", on);
  musicBtn.setAttribute("aria-label", on ? "Pause music" : "Play music");
}

music.addEventListener("playing", setMusicUi);
music.addEventListener("pause", setMusicUi);

musicBtn.addEventListener("click", () => {
  if (music.paused) music.play().then(setMusicUi).catch(setMusicUi);
  else { music.pause(); setMusicUi(); }
});

// pause when the guest leaves the tab, resume when they come back
let pausedByHide = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !music.paused) { music.pause(); pausedByHide = true; }
  else if (!document.hidden && pausedByHide) { pausedByHide = false; music.play().catch(() => {}); }
});

// ---------- Screen 1 → Screen 2 ----------
const video = document.getElementById("introVideo");
const PLAY_SECONDS = 3; // how much of the intro video plays before the card fades in

let opened = false;
let revealed = false;

function revealCard() {
  if (revealed) return;
  revealed = true;
  card.classList.add("show");
  card.setAttribute("aria-hidden", "false");
  intro.classList.add("done");
  document.body.classList.remove("locked");
  window.scrollTo(0, 0);
  startMusic();
  setTimeout(() => intro.remove(), 1100);
}

function openInvite() {
  if (opened) return;
  opened = true;
  intro.classList.add("open");
  unlockMusic();

  if (reduced) return revealCard();

  video.addEventListener("playing", () => setTimeout(revealCard, PLAY_SECONDS * 1000), { once: true });
  video.addEventListener("ended", revealCard);
  video.play().catch(revealCard);  // if the video can't play, go straight to the card
  setTimeout(revealCard, 9000);    // safety net on very slow connections
}

intro.addEventListener("click", openInvite);
intro.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openInvite(); }
});

// ---------- Scroll reveal ----------
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting || !card.classList.contains("show")) continue;
    const el = entry.target;
    el.classList.add("in");
    if (el.classList.contains("flowers")) {
      setTimeout(setupScratch, 1200); // once the flowers have popped in
    }
    io.unobserve(el);
  }
}, { threshold: 0.4 });

// observe only once the card is visible, so reveals play when seen
const startReveal = new MutationObserver(() => {
  if (!card.classList.contains("show")) return;
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  startReveal.disconnect();
});
startReveal.observe(card, { attributes: true, attributeFilter: ["class"] });

// ---------- Scratch the flowers to reveal the date ----------
// Each flower becomes a canvas painted with its patch of the card background
// plus the flower, so the date underneath stays hidden until it's scratched off.
const flowers = document.getElementById("flowers");
const dateImg = document.getElementById("date");
const scratchHint = document.getElementById("scratchHint");

// flower spans in design pixels (see .flowers in style.css)
const FLOWER_BOX = { x: 285, y: 2170, w: 170, h: 134 };
const SCALE = 2;            // canvas pixels per design pixel
const BRUSH = 34 * SCALE;   // scratch radius
const GRID_X = 8, GRID_Y = 6;
const CLEAR_AT = 0.5;       // share of a flower scratched before it falls away

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

let scratchReady = false;
const pads = [];

async function setupScratch() {
  if (scratchReady) return;
  scratchReady = true;

  let bg, sprite;
  try {
    [bg, sprite] = await Promise.all([loadImage("assets/card-bg.webp"), loadImage("assets/flowers.webp")]);
  } catch {
    dateImg.classList.add("show", "revealed"); // images failed: just show the date
    return;
  }
  const sw = sprite.naturalWidth / 3;

  flowers.querySelectorAll("span").forEach((span, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = FLOWER_BOX.w * SCALE;
    canvas.height = FLOWER_BOX.h * SCALE;
    const ctx = canvas.getContext("2d");
    const x = FLOWER_BOX.x + i * FLOWER_BOX.w;
    ctx.drawImage(bg, x, FLOWER_BOX.y, FLOWER_BOX.w, FLOWER_BOX.h, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(sprite, i * sw, 0, sw, sprite.naturalHeight, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH * 2;
    span.appendChild(canvas);
    pads.push({ span, canvas, ctx, cells: new Set(), done: false });
  });

  flowers.classList.add("scratchable");
  dateImg.classList.add("show");
  scratchHint.classList.add("show");
}

function markCells(pad, x, y) {
  const cw = pad.canvas.width / GRID_X, ch = pad.canvas.height / GRID_Y;
  for (let gx = 0; gx < GRID_X; gx++) {
    for (let gy = 0; gy < GRID_Y; gy++) {
      const cx = (gx + 0.5) * cw, cy = (gy + 0.5) * ch;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= BRUSH * BRUSH) pad.cells.add(gx + "," + gy);
    }
  }
}

function scratch(pad, from, to) {
  const r = pad.canvas.getBoundingClientRect();
  const k = pad.canvas.width / r.width;
  const a = { x: (from.x - r.left) * k, y: (from.y - r.top) * k };
  const b = { x: (to.x - r.left) * k, y: (to.y - r.top) * k };
  const outside = (p) => p.x < -BRUSH || p.y < -BRUSH || p.x > pad.canvas.width + BRUSH || p.y > pad.canvas.height + BRUSH;
  if (outside(a) && outside(b)) return;

  pad.ctx.beginPath();
  pad.ctx.moveTo(a.x, a.y);
  pad.ctx.lineTo(b.x + 0.01, b.y);
  pad.ctx.stroke();

  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (BRUSH / 2)));
  for (let s = 0; s <= steps; s++) {
    markCells(pad, a.x + (b.x - a.x) * s / steps, a.y + (b.y - a.y) * s / steps);
  }

  if (pad.cells.size / (GRID_X * GRID_Y) >= CLEAR_AT) clearPad(pad);
}

function clearPad(pad) {
  pad.done = true;
  pad.span.classList.add("gone");
  if (pads.every((p) => p.done)) {
    flowers.classList.remove("scratchable");
    scratchHint.classList.remove("show");
    dateImg.classList.add("revealed");
    petalBurst();
  }
}

let last = null;
flowers.addEventListener("pointerdown", (e) => {
  if (!flowers.classList.contains("scratchable")) return;
  last = { x: e.clientX, y: e.clientY };
  flowers.setPointerCapture(e.pointerId);
  pads.forEach((p) => !p.done && scratch(p, last, last));
});
flowers.addEventListener("pointermove", (e) => {
  if (!last) return;
  const now = { x: e.clientX, y: e.clientY };
  pads.forEach((p) => !p.done && scratch(p, last, now));
  last = now;
});
["pointerup", "pointercancel"].forEach((t) => flowers.addEventListener(t, () => (last = null)));

// a little shower of petals once the date is out
function petalBurst() {
  if (reduced) return;
  const u = card.clientWidth / 1080;
  const colors = ["#f07a5a", "#f6a07e", "#ffd2b8", "#f4b942", "#ee8fa6"];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.className = "petal";
    p.style.left = 540 * u + "px";
    p.style.top = 2237 * u + "px";
    p.style.background = colors[i % colors.length];
    card.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = (180 + Math.random() * 320) * u;
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist * 0.7;
    p.animate([
      { transform: "translate(-50%,-50%) scale(.4) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 120 * u}px)) scale(1) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

// ---------- Countdown ----------
const cells = {};
document.querySelectorAll("#countdown [data-unit]").forEach((el) => (cells[el.dataset.unit] = el));

function pad(n) { return String(n).padStart(2, "0"); }

function tick() {
  let diff = Math.max(0, WEDDING - Date.now());
  const s = Math.floor(diff / 1000);
  const values = {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
  for (const unit in values) {
    const text = pad(values[unit]);
    const el = cells[unit];
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.remove("tick");
      void el.offsetWidth; // restart animation
      el.classList.add("tick");
    }
  }
}
tick();
setInterval(tick, 1000);
