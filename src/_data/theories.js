import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const results = read("./quiz/results.json");
const glossary = read("./quiz/glossary.json");
// deep-dive copy (cold opens, stories, arguments, neighbors) — per page key
const deep = read("./quiz/theories.json");

const ORDER = ["cop", "mw", "pw", "rqm", "qb", "grw", "sd", "cc"];
const LABELS = {
  cc: ["What actually happens", "And to be clear about the rest", "The kind part, said plainly"],
  _:  ["The idea", "What it fixes", "What it costs"],
};

const pages = ORDER.map((key) => ({
  key,
  slug: key,
  name: results[key].name,
  tagline: results[key].tagline,
  motif: key,
  scored: !["sd", "cc"].includes(key),
  labels: LABELS[key] || LABELS._,
  theory: results[key].theory,
  experiment: results[key].experiment,
  books: results[key].books,
  ...(deep[key] || {}),
}));

// The trap's redemption arc points here, so it needs a page of its own.
// Its explanation already exists — it is what the trap's own copy argues.
pages.push({
  key: "decoherence",
  slug: "decoherence",
  name: "Decoherence",
  tagline: "“The universe was already bumping into itself.”",
  motif: "cc",
  scored: false,
  labels: LABELS.cc,
  theory: results.cc.theory,
  experiment: { name: "", year: "", ref: "", body: "" },
  books: results.cc.books,
  gloss: glossary.decoherence,
  ...(deep.decoherence || {}),
});

export default pages;
