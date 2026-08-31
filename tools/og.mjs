/* Renders the Open Graph cards into src/img/og/.

   One card per result plus one for the quiz itself. These are committed: the
   Pages workflow runs Eleventy and nothing else, so there is no image step in
   CI, and a missing og:image is invisible until someone shares a link and gets
   a grey box.

   Run:  node tools/og.mjs        (needs Chrome on PATH; ~20s)

   Chrome fetches the same Google Fonts the site does, so the cards are set in
   the real faces rather than a fallback that only looks close on this box. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/img/og");
const W = 1200, H = 630;

const results = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/quiz/results.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/quiz/meta.json"), "utf8"));
const TITLE = meta.share.title;
const KEYS = Object.keys(results);

// the light palette, lifted from css/quiz.css — the cards do not follow a
// viewer's theme, so they are always the paper version
const HUE = {
  cop: "#5B7C99", mw: "#7A56D6", pw: "#0E8E80", rqm: "#BE7723",
  qb: "#C42A78", grw: "#4A9636", sd: "#1A1F27", cc: "#B4256E",
};
const PAPER = "#F4F5F1", INK = "#1A1F27", MUTED = "#5B6470", LINE = "#D9DDD4";

const chrome = ["google-chrome", "chromium-browser", "chromium"].find((c) => {
  try { execFileSync("which", [c], { stdio: "pipe" }); return true; } catch { return false; }
});
if (!chrome) { console.error("no chrome on PATH"); process.exit(1); }

/* The amplitude line, the same shape the page draws: one peak where the
   measurement landed, near-zero everywhere else. The generic card gets no
   peak — it is the superposition, before anyone looked. */
function wave(peakIndex) {
  const slots = KEYS.length, x0 = 0, x1 = W, base = 300, top = 128;
  const amps = KEYS.map((_, i) =>
    peakIndex === null ? 0.30 + 0.62 * Math.abs(Math.sin(i * 1.9 + 0.7))
                       : (i === peakIndex ? 1 : 0.03));
  const pts = [{ x: x0, y: base }];
  amps.forEach((v, i) => pts.push({ x: x0 + ((x1 - x0) * (i + 0.5)) / slots, y: base - v * (base - top) }));
  pts.push({ x: x1, y: base });

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let j = 0; j < pts.length - 1; j++) {
    const p0 = pts[j - 1] || pts[j], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2] || p2, t = 0.2;
    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}` +
         ` ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t} ${p2.x} ${p2.y}`;
  }
  return d;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unquote = (s) => String(s).replace(/[“”"]/g, "");

/* The cards that are not a result: the quiz's own, and the theories index.
   Both show the superposition — no peak, because nothing has been measured. */
const PAGES = {
  quiz: {
    title: TITLE,
    h1: 'Which Quantum<br>Interpretation Are You<span style="color:#B4256E">?</span>',
    tagline: "Ten questions. Weirdness is conserved &mdash;<br>you only get to choose where it goes.",
  },
  theories: {
    title: "The theories &middot; agicook",
    h1: "Eight ways of reading<br>the same experiment",
    tagline: "They agree with every measurement ever taken.<br>They disagree completely about what is happening.",
  },
};

function page(key) {
  const r = results[key] || null;
  const fixed = PAGES[key];
  const hue = r ? HUE[key] : "#B4256E";
  const d = wave(r ? KEYS.indexOf(key) : null);

  // the same eyebrow the reveal page uses — both secret endings earned their own
  const eyebrow = key === "sd" ? "Measurement was never necessary"
                : key === "cc" ? "Measurement complete, unfortunately"
                : "Measurement complete";

  const headline = r
    ? `<p class="eyebrow">${eyebrow}</p>
       <h1 class="fit" style="color:${hue}">${esc(r.name)}</h1>
       <p class="tagline">${esc(unquote(r.tagline))}</p>`
    : `<h1 class="big">${fixed.h1}</h1>
       <p class="tagline">${fixed.tagline}</p>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: ${PAPER}; color: ${INK}; position: relative;
         font-family: "Newsreader", Georgia, serif; }
  .wave { position: absolute; inset: 0 0 auto 0; height: 300px; width: ${W}px; }
  .wave path { fill: none; stroke: ${hue}; stroke-width: 3.5; vector-effect: non-scaling-stroke; }
  .pad { position: absolute; inset: 0; padding: 62px 72px; display: flex; flex-direction: column; }
  .title { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 22px;
           letter-spacing: 0.19em; text-transform: uppercase; color: ${INK};
           padding-bottom: 16px; border-bottom: 1px solid ${LINE}; }
  .body { margin-top: auto; }
  .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 17px; letter-spacing: 0.16em;
             text-transform: uppercase; color: ${MUTED}; margin-bottom: 14px; }
  h1 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; font-size: 92px;
       line-height: 0.98; letter-spacing: -0.02em; }
  h1.big { font-size: 76px; color: ${INK}; }
  h1.fit { white-space: nowrap; }
  .tagline { font-size: 34px; font-style: italic; line-height: 1.32; color: ${INK}; margin-top: 20px; }
  .foot { font-family: "IBM Plex Mono", monospace; font-weight: 500; font-size: 20px;
          letter-spacing: 0.09em; color: ${MUTED}; margin-top: 34px; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 9px; background: ${hue}; }
</style></head><body>
<svg class="wave" viewBox="0 0 ${W} 300" preserveAspectRatio="none"><path d="${d}"/></svg>
<div class="pad">
  <div class="title">${r ? esc(TITLE) : fixed.title}</div>
  <div class="body">${headline}<p class="foot">agicook.com</p></div>
</div>
<div class="bar"></div>
<script>
/* Shrink a long name until it is one line. Consciousness Causes Collapse is
   29 characters; at the display size it wrapped, and the second line ran
   straight through the amplitude curve. Waits for the real faces to load,
   because the fallback measures differently and would fit the wrong text. */
(document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
  var h = document.querySelector("h1.fit");
  if (!h) return;
  var box = h.parentNode.clientWidth, size = 92;
  while (size > 40 && h.scrollWidth > box) { size -= 2; h.style.fontSize = size + "px"; }
});
</script>
</body></html>`;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
fs.mkdirSync(OUT, { recursive: true });

for (const name of [...Object.keys(PAGES), ...KEYS]) {
  const html = path.join(tmp, name + ".html");
  fs.writeFileSync(html, page(name));
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--force-device-scale-factor=1", `--window-size=${W},${H}`,
    "--virtual-time-budget=6000",
    `--screenshot=${path.join(OUT, name + ".png")}`, "file://" + html,
  ], { stdio: "pipe" });
  const { size } = fs.statSync(path.join(OUT, name + ".png"));
  console.log(`${name.padEnd(6)} ${(size / 1024).toFixed(0)}K`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log("wrote " + (KEYS.length + Object.keys(PAGES).length) + " cards to src/img/og/");
