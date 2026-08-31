// The log's equivalent is log.json. This one is JS because a dish needs two
// computed values the log does not:
//   ogImage    — the dish's own AI image, so a shared link unfurls as the picture
//   searchText — title + model + the whole recipe + the table notes, flattened,
//                so the index can be searched for "miso" or "pecorino" and find
//                the dish by what is actually in it. This is what makes the
//                kitchen a book you cook from twice.
const flatten = (s) =>
  String(s || "")
    .replace(/^---[\s\S]*?\n---\n/, "")   // frontmatter, if rawInput carries it
    .replace(/[*_`#>\[\]()]/g, " ")        // markdown punctuation
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export default {
  layout: "dish.njk",
  tags: "kitchen",
  permalink: "/kitchen/{{ page.fileSlug }}/index.html",
  eleventyComputed: {
    ogImage: (data) =>
      data.ai_image ? `/img/kitchen/${data.page.fileSlug}/${data.ai_image}` : undefined,
    searchText: (data) =>
      flatten([data.title, data.model, data.page.rawInput, data.notes].join(" ")),
  },
};
