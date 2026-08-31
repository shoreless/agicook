import fs from "node:fs";

export default function (eleventyConfig) {
  // Nothing written yet? Don't build /log/ at all — an empty log page reads as
  // broken. Drop a .md in src/log/ and the page, the index section and the nav
  // link all come back. (Config is read once, so restart `npm run dev` after
  // adding the very first entry.)
  const hasLog = fs.existsSync("src/log") &&
    fs.readdirSync("src/log").some((f) => f.endsWith(".md"));
  if (!hasLog) eleventyConfig.ignores.add("src/log.njk");

  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  // The quiz is vendored, hand-written HTML. Copy it byte-for-byte —
  // never let Nunjucks near it, or a future `{{` in its JS dies silently.
  // Versioned experiments: every version keeps a permanent pinned URL, and the
  // bare path always serves LATEST. Bump LATEST when a new version ships.
  const QUIZ = "which-quantum-interpretation-are-you";
  // v1 is a frozen static page, copied byte-for-byte and never templated.
  // v2 is built, and renders to BOTH /v2/ and the bare path (see quiz-v2.njk's
  // pagination) — the bare URL always serves the latest version.
  eleventyConfig.addPassthroughCopy({ [`src/${QUIZ}`]: QUIZ });
  eleventyConfig.ignores.add(`src/${QUIZ}/**`);
  eleventyConfig.addPassthroughCopy({ "src/media": "media" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  // OG cards, rendered by tools/og.mjs and committed — Pages has no image step
  eleventyConfig.addPassthroughCopy({ "src/img": "img" });
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // Dates are Tokyo. Never toISOString() — that files nine hours early.
  const TZ = "Asia/Tokyo";
  const fmt = (opts) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: TZ });

  eleventyConfig.addFilter("logdate", (d) =>
    fmt({ year: "numeric", month: "short", day: "2-digit" }).format(d));

  eleventyConfig.addFilter("isodate", (d) =>
    fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
      .format(d).split("/").reverse().join("-"));

  // Counts written out in prose. The theories headline said "Eight ways" over
  // nine cards for two days; a headline that counts its own list cannot.
  const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
                   "eight", "nine", "ten", "eleven", "twelve"];
  eleventyConfig.addFilter("spell", (n) => NUMBERS[n] ?? String(n));

  // Splitting one list into a page's main run and its exception. Nunjucks has
  // rejectattr, but its `equalto` test quietly matched nothing here and the
  // headline rendered "Zero ways" — so this is explicit instead.
  eleventyConfig.addFilter("without", (list, key, value) =>
    (list || []).filter((x) => x[key] !== value));
  eleventyConfig.addFilter("only", (list, key, value) =>
    (list || []).find((x) => x[key] === value) || null);

  // plain URLs in the reference list should be links
  eleventyConfig.amendLibrary("md", (md) => md.set({ linkify: true }));

  // "The Ship of Theseus" and "Ship Of Theseus" must land on the same key
  // Safe JSON for embedding in <script type="application/json">
  eleventyConfig.addFilter("jsonscript", (v) =>
    JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, ""));

  // *Title* -> <em>, and a link where that book has its own article.
  // Titles without a page stay italic and unlinked — pointing a book title at
  // its author's page would be a link that lies about where it goes.
  const BOOK_LINKS = JSON.parse(
    fs.readFileSync("src/_data/quiz/links.json", "utf8")).books;

  eleventyConfig.addFilter("rich", (v) =>
    String(v == null ? "" : v).replace(/\*([^*]+)\*/g, (_, title) => {
      const url = BOOK_LINKS[title.trim()];
      return url
        ? `<a href="${url}" rel="noopener"><em>${title}</em></a>`
        : `<em>${title}</em>`;
    }));

  eleventyConfig.addFilter("nodekey", (v) => String(v).toLowerCase()
    .replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));

  // Experiment dates come from YAML, which turns `2026-02-06` into a Date but
  // leaves `"2025-10"` a string. Handle both, and allow month-only precision
  // for things whose exact day we don't know.
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthOnly = (v) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

  eleventyConfig.addFilter("expdate", (v) => {
    if (monthOnly(v)) return MONTHS[+v.slice(5, 7) - 1] + " " + v.slice(0, 4);
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? String(v) : fmt({ year: "numeric", month: "short", day: "2-digit" }).format(d);
  });

  eleventyConfig.addFilter("expiso", (v) => {
    if (monthOnly(v)) return v;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? String(v)
      : fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("/").reverse().join("-");
  });

  // Experiments sort themselves, newest first — add one anywhere in the list
  // and it lands in the right place.
  const sortKey = (v) => {
    if (monthOnly(v)) return new Date(v + "-01").getTime();
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? 0 : d.getTime();
  };
  eleventyConfig.addFilter("bydate", (a) => [...a].sort((x, y) => sortKey(y.date) - sortKey(x.date)));

  eleventyConfig.addCollection("log", (c) =>
    c.getFilteredByGlob("src/log/*.md").reverse());

  return {
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
  };
}
