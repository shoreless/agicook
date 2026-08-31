/* The ritual after every change to the kitchen.
 *
 * Same lesson as tools/check.mjs, applied to a different page: the search is
 * client JS, so a green `node --check` and an HTTP 200 prove nothing about it.
 * This builds the site, serves it, and asks a real browser what happened —
 * including driving the search itself, which works because a query in ?q= is
 * applied on load (src/js/kitchen.js).
 *
 * Run:  node tools/check-kitchen.mjs        (needs Chrome on PATH)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8232;
let failures = 0;

function ok(pass, label, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "  ok  " : "FAIL  "}${label}${detail ? "   " + detail : ""}`);
}

const chrome = ["google-chrome", "chromium-browser", "chromium"].find((c) => {
  try { execFileSync("which", [c], { stdio: "pipe" }); return true; } catch { return false; }
});
if (!chrome) { console.error("no chrome on PATH"); process.exit(1); }

const dishes = fs.existsSync(path.join(ROOT, "src/kitchen"))
  ? fs.readdirSync(path.join(ROOT, "src/kitchen")).filter((f) => f.endsWith(".md"))
  : [];
if (!dishes.length) { console.log("  --  no dishes written yet; /kitchen/ is correctly absent"); process.exit(0); }

execFileSync(process.execPath, ["--check", path.join(ROOT, "src/js/kitchen.js")], { stdio: "pipe" });
ok(true, "parses  src/js/kitchen.js");

execFileSync("npx", ["eleventy"], { cwd: ROOT, stdio: "pipe" });
ok(true, "eleventy build");

const site = path.join(ROOT, "_site");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
                ".webp": "image/webp", ".json": "application/json" };
const server = http.createServer((req, res) => {
  /* A probe page, same-origin with the site, so it can read getComputedStyle out
     of an iframe. This exists because the first version of this file asserted the
     hidden ATTRIBUTE and passed while the page visibly did nothing: .k-tile sets
     display:block, which beats the UA's [hidden]{display:none}. Assert paint. */
  /* Drives the share row on a dish page: reveals-on-JS, then taps the story
     button and intercepts toBlob to see whether a card was actually drawn.
     Canvas code is the definition of something that looks fine and paints
     nothing, and navigator.share cannot run here anyway (not a secure context),
     so the download branch is what gets exercised. */
  if (req.url.startsWith("/__share")) {
    const target = new URL(req.url, "http://x").searchParams.get("u") || "/kitchen/";
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><meta charset="utf-8">
<iframe id="f" src="${target}" style="width:1200px;height:900px;border:0"></iframe>
<pre id="out">PENDING</pre>
<script>
var f = document.getElementById("f"), tries = 0, clicked = false, iv;
function done(o) { clearInterval(iv); document.getElementById("out").textContent = JSON.stringify(o); }
iv = setInterval(function () {
  tries++;
  var d = null; try { d = f.contentDocument; } catch (e) {}
  if (!d || d.readyState !== "complete" || !d.querySelector(".k-share")) {
    if (tries > 200) done({ error: "dish page never loaded" });
    return;
  }
  var w = d.defaultView, row = d.querySelector(".k-share");
  if (!clicked) {
    clicked = true;
    var orig = w.HTMLCanvasElement.prototype.toBlob;
    w.HTMLCanvasElement.prototype.toBlob = function (cb, type) {
      var self = this;
      return orig.call(self, function (b) {
        w.__card = { w: self.width, h: self.height, bytes: b ? b.size : 0 };
        cb(b);
      }, type);
    };
    d.getElementById("k-story").click();
    return;
  }
  if (w.__card || tries > 300) {
    done({
      shareVisible: w.getComputedStyle(row).display !== "none",
      storyMsg: d.querySelector("#k-story small").textContent,
      card: w.__card || null
    });
  }
}, 50);
</script>`);
    return;
  }
  if (req.url.startsWith("/__probe")) {
    const target = new URL(req.url, "http://x").searchParams.get("u") || "/kitchen/";
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><meta charset="utf-8">
<iframe id="f" src="${target}" style="width:1200px;height:1000px;border:0"></iframe>
<pre id="out">PENDING</pre>
<script>
var f = document.getElementById("f"), tries = 0;
var iv = setInterval(function () {
  tries++;
  var d = null;
  try { d = f.contentDocument; } catch (e) {}
  if (d && d.readyState === "complete" && d.getElementById("k-wall")) {
    var w = d.defaultView, tiles = [];
    [].forEach.call(d.querySelectorAll(".k-tile"), function (el) {
      var h3 = el.querySelector("h3");
      tiles.push({ title: h3 ? h3.textContent.trim() : "",
                   href: el.getAttribute("href"),
                   display: w.getComputedStyle(el).display,
                   painted: el.offsetParent !== null });
    });
    var c = d.getElementById("k-count"), e = d.getElementById("k-empty");
    document.getElementById("out").textContent = JSON.stringify({
      tiles: tiles,
      count: c ? c.textContent.replace(/\\s+/g, " ").trim() : "",
      emptyPainted: e ? w.getComputedStyle(e).display !== "none" : false });
    clearInterval(iv);
  } else if (tries > 80) {
    document.getElementById("out").textContent = JSON.stringify({ error: "timeout" });
    clearInterval(iv);
  }
}, 50);
</script>`);
    return;
  }
  let f = path.join(site, decodeURIComponent(req.url.split("?")[0]));
  if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

/* spawn, not execFileSync — see the note in tools/check.mjs. A blocking call
   stalls the server that lives in this same process. */
function dom(url) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "kcheck-"));
    const p = spawn(chrome, [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
      "--user-data-dir=" + profile, "--virtual-time-budget=5000",
      "--dump-dom", `http://127.0.0.1:${PORT}${url}`,
    ], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 60000);
    p.stdout.on("data", (b) => { out += b; });
    p.on("error", reject);
    p.on("close", () => {
      clearTimeout(kill);
      fs.rmSync(profile, { recursive: true, force: true });
      resolve(out);
    });
  });
}

/* a tile is <a class="k-tile" href=… data-search=…>, hidden when filtered out */
function tiles(d) {
  return [...d.matchAll(/<a class="k-tile[^"]*"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    hidden: /\shidden(?:=|\s|>)/.test(m[1]),
    href: (/href="([^"]+)"/.exec(m[1]) || [])[1],
    search: (/data-search="([^"]*)"/.exec(m[1]) || [, ""])[1],
    title: (/<h3>([\s\S]*?)<\/h3>/.exec(m[2]) || [, ""])[1].trim(),
  }));
}
const shown = (d) => tiles(d).filter((t) => !t.hidden);

/* What the browser actually painted. `tiles()` above reads the served markup;
   this reads the rendered box. Only this one can catch a CSS rule that stops
   `hidden` from hiding anything. */
async function paint(url) {
  const d = await dom("/__probe?u=" + encodeURIComponent(url));
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(d);
  if (!m) return { error: "no probe output" };
  const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
  if (raw.trim() === "PENDING") return { error: "probe never resolved" };
  try { return JSON.parse(raw); } catch (e) { return { error: "unparseable probe: " + raw.slice(0, 80) }; }
}
const visible = (p) => (p.tiles || []).filter((t) => t.painted);

/* ---- the index ---- */
const idx = await dom("/kitchen/");
const all = tiles(idx);
ok(all.length === dishes.length, "index    every dish on the wall", `${all.length} of ${dishes.length}`);
ok(shown(idx).length === all.length, "index    nothing hidden before a search");
ok(idx.includes("/css/kitchen.css"), "index    kitchen stylesheet linked");
ok(/id="k-q"/.test(idx) && !/class="k-search"[^>]*\shidden/.test(idx),
   "index    search field revealed by JS");
ok(all.every((t) => t.search.length > 40), "index    every tile carries its recipe text",
   `shortest ${Math.min(...all.map((t) => t.search.length))} chars`);

/* ---- search, driven for real: a word unique to one dish must find that dish ---- */
const words = (s) => new Set(s.split(/[^a-z0-9]+/).filter((w) => w.length > 4));
for (const t of all) {
  /* The search matches substrings deliberately — "caramel" should find
     "caramelization". So a probe has to be a word that appears in no other
     dish's text as a substring either, or the assertion below is wrong about
     what a correct search would return. */
  const probe = [...words(t.search)]
    .find((w) => all.every((o) => o === t || o.search.indexOf(w) === -1));
  if (!probe) { ok(true, `search   ${t.title}`, "no unique word — skipped"); continue; }
  const p = await paint("/kitchen/?q=" + encodeURIComponent(probe));
  const hits = visible(p);
  ok(!p.error && hits.length === 1 && hits[0].href === t.href, `search   "${probe}"`,
     p.error || hits.map((h) => h.title).join(", ") || "nothing left on screen");
}

const base = await paint("/kitchen/");
ok(!base.error && visible(base).length === all.length,
   "paint    all dishes visible before a search", base.error || `${visible(base).length} painted`);

const miss = await paint("/kitchen/?q=" + encodeURIComponent("zzzz notathing"));
ok(!miss.error && visible(miss).length === 0, "paint    a miss really hides them",
   miss.error || `${visible(miss).length} still painted`);
ok(!miss.error && miss.emptyPainted, "paint    the 86'd notice shows", miss.error || "");
ok(!miss.error && /0 of \d+/.test(miss.count), "paint    the counter narrows", miss.error || miss.count);

/* ---- every dish page ---- */
for (const t of all) {
  const d = await dom(t.href);
  const h1 = (/<h1>([\s\S]*?)<\/h1>/.exec(d) || [, ""])[1].trim();
  ok(h1.length > 0 && h1 === t.title, `dish     ${t.href}`, h1 || "no title rendered");
  /* A dish can be cooked before it is imaged — that is a real state, and it has
     no OG image to offer. Only a dish that renders a picture must have one. */
  const hasImage = /class="k-ai"/.test(d);
  const og = (/property="og:image" content="([^"]+)"/.exec(d) || [])[1];
  ok(hasImage
       ? !!og && og.startsWith("https://agicook.com/img/kitchen/")
       : !og,
     `og:image ${t.href}`,
     hasImage ? (og || "MISSING") : "none yet — dish is still working");
  const recipe = (/<div class="k-recipe">([\s\S]*?)<\/div>/.exec(d) || [, ""])[1];
  ok(recipe.replace(/<[^>]+>/g, "").trim().length > 80, `recipe   ${t.href}`, "body rendered");
}

/* ---- the share row, driven ---- */
for (const t of all) {
  const d = await dom("/__share?u=" + encodeURIComponent(t.href));
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(d);
  let r = {};
  try { r = JSON.parse((m ? m[1] : "").replace(/&quot;/g, '"').replace(/&amp;/g, "&")); } catch (e) {}
  ok(r.shareVisible === true, `share    ${t.href} buttons revealed`, r.error || "");
  const card = r.card;
  ok(!!card && card.w === 1080 && card.h === 1920 && card.bytes > 20000,
     `story    ${t.href}`,
     card ? `${card.w}x${card.h}, ${Math.round(card.bytes / 1024)}KB` : (r.storyMsg || "no card drawn"));
}

/* ---- the experiment node on the front page ---- */
const home = await dom("/");
ok(/<h3><a href="\/kitchen\/">AI Slop Kitchen<\/a><\/h3>/.test(home), "node     points at /kitchen/");
ok(/href="https:\/\/www\.instagram\.com\/ai\.slop\.kitchen\/"[^>]*>v1</.test(home),
   "node     v1 still goes to Instagram");
ok(/href="\/kitchen\/">kitchen</.test(home), "footer   kitchen link present");

server.close();
console.log(failures ? `\n${failures} broken` : "\nall good");
process.exit(failures ? 1 : 0);
