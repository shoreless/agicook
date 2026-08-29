/* agicook — quiz tally.
   Public endpoint, no credentials client-side: the D1 binding lives here, and
   the browser can only append a valid response or read aggregate counts.
   Defence is proportionate to the stakes (a quiz tally): reject anything that
   isn't one of the eight known results with nine in-range answers, and lock
   CORS to the site. Cloudflare rate limiting handles volume. */

const KEYS = ["cop", "mw", "pw", "rqm", "qb", "grw", "sd", "cc"];
const N_QUESTIONS = 10;
const VERSIONS = ["v2"];   // add a version here when one ships
// Answers arrive as stable option ids ("q2-mw"), not positions — so a future
// edit to option order can never reinterpret data already collected.
const OPTION_ID = /^q(?:[1-9]|10)-(?:cop|mw|pw|rqm|qb|grw|sd|cc)$/;
const ALLOWED = ["https://agicook.com", "https://www.agicook.com"];

const headersFor = (origin) => ({
  "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
});

const json = (body, h, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: h });

function validAnswers(a) {
  return Array.isArray(a) &&
    a.length === N_QUESTIONS &&
    a.every((v) => typeof v === "string" && OPTION_ID.test(v)) &&
    new Set(a.map((v) => v.split("-")[0])).size === N_QUESTIONS;  // one per question
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const h = headersFor(request.headers.get("Origin"));

    if (request.method === "OPTIONS") return new Response(null, { headers: h });

    // GET /tally — aggregate counts, safe to show publicly
    if (url.pathname === "/tally" && request.method === "GET") {
      // always scoped to one version — v1 and v2 asked different questions
      const version = url.searchParams.get("v");
      if (!VERSIONS.includes(version)) return json({ error: "unknown version" }, h, 400);
      const { results } = await env.DB
        .prepare("SELECT result, COUNT(*) AS n FROM responses WHERE version = ? GROUP BY result")
        .bind(version)
        .all();
      const counts = Object.fromEntries(KEYS.map((k) => [k, 0]));
      let total = 0;
      for (const row of results) {
        if (row.result in counts) { counts[row.result] = row.n; total += row.n; }
      }
      return json({ total, counts }, h);
    }

    // POST /result — one completed quiz
    if (url.pathname === "/result" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "malformed json" }, h, 400); }

      if (!VERSIONS.includes(body?.version)) return json({ error: "unknown version" }, h, 400);
      if (!KEYS.includes(body?.result)) return json({ error: "unknown result" }, h, 400);
      if (!validAnswers(body?.answers)) return json({ error: "bad answers" }, h, 400);

      await env.DB
        .prepare("INSERT INTO responses (version, result, answers) VALUES (?, ?, ?)")
        .bind(body.version, body.result, JSON.stringify(body.answers))
        .run();

      return json({ ok: true }, h, 201);
    }

    return json({ error: "not found" }, h, 404);
  },
};
