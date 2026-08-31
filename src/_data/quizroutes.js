/* Every URL quiz-v2.njk renders.

   Two version routes — the pinned /v2/ and the bare path that always serves
   latest — and, under each, one real page per result. The result pages exist
   because a shared link is unfurled by reading the page's og: tags, and a
   query string like ?r=cop cannot carry its own. Those old links still work;
   they just cannot show a picture. */
import fs from "node:fs";

const results = JSON.parse(fs.readFileSync("src/_data/quiz/results.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("src/_data/quiz/meta.json", "utf8"));
const reveal = (meta.share && meta.share.reveal) || "r/";

export default function () {
  const routes = [];
  for (const base of ["v2/", ""]) {
    routes.push({ path: base, base, reveal: null });
    for (const key of Object.keys(results)) {
      routes.push({ path: base + reveal + key + "/", base, reveal: key });
    }
  }
  return routes;
}
