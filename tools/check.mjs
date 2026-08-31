/* The ritual after every change to the quiz.

   `node --check` is not enough and today proved it twice: it passed a routing
   block that an unterminated comment had swallowed whole, and it passed a
   `var BASE` that collided with the amplitude graph's baseline eighty lines
   down, so every share link pointed at "110r/cop/". Neither is a syntax error.
   Both were plain to see in a rendered DOM.

   So this builds the site, serves it, and looks at what a browser actually
   produced. Run:  node tools/check.mjs        (needs Chrome on PATH) */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8231;
let failures = 0;

function ok(pass, label, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "  ok  " : "FAIL  "}${label}${detail ? "   " + detail : ""}`);
}

const chrome = ["google-chrome", "chromium-browser", "chromium"].find((c) => {
  try { execFileSync("which", [c], { stdio: "pipe" }); return true; } catch { return false; }
});
if (!chrome) { console.error("no chrome on PATH"); process.exit(1); }

/* ---- 1. every script parses ---- */
for (const f of fs.readdirSync(path.join(ROOT, "src/js"))) {
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, "src/js", f)], { stdio: "pipe" });
    ok(true, `parses  src/js/${f}`);
  } catch (e) { ok(false, `parses  src/js/${f}`, String(e.stderr).split("\n")[2] || ""); }
}

/* ---- 2. build ---- */
execFileSync("npx", ["eleventy"], { cwd: ROOT, stdio: "pipe" });
ok(true, "eleventy build");

/* ---- 3. an OG card for every result, and the quiz's own ---- */
const results = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/quiz/results.json"), "utf8"));
for (const name of ["quiz", ...Object.keys(results)]) {
  const p = path.join(ROOT, "_site/img/og", name + ".png");
  ok(fs.existsSync(p) && fs.statSync(p).size > 5000, `og card  /img/og/${name}.png`);
}

/* ---- 4. serve _site and read what a browser makes of it ---- */
const site = path.join(ROOT, "_site");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(site, decodeURIComponent(req.url.split("?")[0]));
  if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

/* spawn, not execFileSync: the server above lives in this process, and a
   blocking call stalls the event loop, so Chrome waits forever for a page this
   script is too busy to serve. That deadlock reads exactly like a broken page —
   an empty DOM and every check failing at once. */
function dom(url) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "check-"));
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

const QUIZ = "/which-quantum-interpretation-are-you/";
const cases = [
  [QUIZ + "r/mw/", "Many-Worlds", QUIZ + "r/cop/"],
  [QUIZ + "v2/r/cc/", "Consciousness Causes Collapse", QUIZ + "v2/r/cop/"],
  [QUIZ + "?r=qb", "QBism", QUIZ + "r/cop/"],            // the links the first shares used
];

for (const [url, name, firstRoster] of cases) {
  const d = await dom(url);
  const got = /class="result-name">([^<]*)</.exec(d);
  ok(got && got[1] === name, `reveal   ${url}`, got ? got[1] : "no result rendered");

  const roster = [...d.matchAll(/class="roster-link[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  ok(roster.length === 8 && roster[0] === firstRoster, `links    ${url}`, roster[0] || "none");

  const nets = (d.match(/class="share-net"/g) || []).length;
  ok(nets === 10 && d.includes("share-net--copy"), `share    ${url}`, nets + " networks");

  const text = d.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  const stray = text.includes("*");
  ok(!stray, `markup   ${url}`, stray ? "literal *asterisks* left in the copy" : "");
}

/* the og: tags a network reads when someone posts the link */
for (const [url, key] of [[QUIZ + "r/sd/", "sd"], [QUIZ, "quiz"]]) {
  const d = fs.readFileSync(path.join(site, url.replace(/^\//, ""), "index.html"), "utf8");
  const img = /property="og:image" content="([^"]+)"/.exec(d);
  ok(img && img[1].endsWith(`/img/og/${key}.png`), `og:image ${url}`, img ? img[1] : "missing");
  ok(/property="og:title"/.test(d) && /property="og:description"/.test(d), `og:tags  ${url}`);
}

server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall good");
process.exit(failures ? 1 : 0);
