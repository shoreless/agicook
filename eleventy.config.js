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
  eleventyConfig.addPassthroughCopy({ "src/which-quantum-interpretation-are-you": "which-quantum-interpretation-are-you" });
  eleventyConfig.ignores.add("src/which-quantum-interpretation-are-you/**");
  eleventyConfig.addPassthroughCopy({ "src/media": "media" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // Dates are Tokyo. Never toISOString() — that files nine hours early.
  const TZ = "Asia/Tokyo";
  const fmt = (opts) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: TZ });

  eleventyConfig.addFilter("logdate", (d) =>
    fmt({ year: "numeric", month: "short", day: "2-digit" }).format(d));

  eleventyConfig.addFilter("isodate", (d) =>
    fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
      .format(d).split("/").reverse().join("-"));

  // plain URLs in the reference list should be links
  eleventyConfig.amendLibrary("md", (md) => md.set({ linkify: true }));

  // "The Ship of Theseus" and "Ship Of Theseus" must land on the same key
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
