# agicook.com

Explorations. Static site, built with [Eleventy](https://11ty.dev), deployed to
GitHub Pages on push to `main`.

## Writing a log entry

**There are no log entries yet, so the log is switched off.** No `/log/` page is
built and no nav link points at it. Write one file and the whole thing turns
itself back on — the index gains a "The log" section, `/log/` starts building,
and the footer link reappears. Nothing to un-comment.

Create `src/log/YYYY-MM-DD-some-slug.md`:

```markdown
---
title: The parser finally eats scenes.json
date: 2026-09-04
topic: Mindshadow
---

Body text, in Markdown. Paragraphs, *emphasis*, [links](https://example.com),
lists, `code`, > blockquotes — all of it works.

Length doesn't matter. Three lines is a log entry.
```

### The fields

| Field   | Required | Notes |
|---------|----------|-------|
| `title` | yes      | Shown on the map and at the top of the entry. |
| `date`  | yes      | `YYYY-MM-DD`, unquoted. Newest entries sort first. |
| `topic` | no       | See below. |

**The URL comes from the filename, not the title** — `2026-09-04-parser-eats-scenes.md`
becomes `/log/parser-eats-scenes/`. The date prefix is stripped automatically. This
is deliberate: retitling a post later won't break a link someone has shared.

### `topic:`

Optional. If it names an experiment on the index, the entry gets drawn to that
experiment with a line across the map, and the label becomes a link to it.

Matching ignores case, punctuation and a leading "The", so `ship of theseus`,
`Ship Of Theseus` and `The Ship of Theseus` all find the same node. Current
experiment keys:

```
which-quantum-interpretation-are-you
a-letter-to-trace
prism
ship-of-theseus
ai-slop-kitchen
```

A topic that matches nothing is just a label — no line, no link, no error. That
is the right thing to use for work that isn't on the index yet (Mindshadow,
Timeshadow), so a run of entries about it still reads as one thread.

### After the first entry

Two one-off things, because both live outside the templating:

1. **Restart `npm run dev`.** The log switch is read once when Eleventy starts,
   so the running server won't notice the very first file. Every entry after
   that appears on save as normal.
2. **Put the log link back in the quiz nav** if you want it — the quiz is a
   vendored standalone file that can't see the site's data. In
   `src/which-quantum-interpretation-are-you/index.html`, inside `<nav class="site-nav">`:
   `<a href="/log/">log</a>` before the email link.

## Adding an experiment

Edit the `experiments:` block at the top of `src/index.njk`. Order in the
file doesn't matter — they sort themselves by `date:`, newest first. A date may
be a full day (`2026-02-04`) or a quoted month (`"2025-10"`) when you only know
the month. An entry without a
`url:` renders dimmed and unclickable — in-progress work generally belongs in the
log instead.

## Running it

```sh
nvm use            # node 22, per .nvmrc
npm install
npm run dev        # http://localhost:8099, rebuilds on save
```

## Layout

```
src/index.njk          the index — experiments + log, drawn as maps
src/log.njk            /log/
src/log/*.md           log entries
src/letter-to-trace.md the essay
src/which-quantum-interpretation-are-you/
                       index.html — vendored from the Claude artifact.
                       Its top nav hardcodes the email: if site.json's
                       address changes, change it here too — DO NOT let Eleventy
                       template it; it is passthrough-copied and ignored on purpose
src/css/style.css      the whole design system
src/js/field.js        two-slit interference field behind the wordmark
src/js/map.js          draws the connections between nodes
src/_data/site.json    title, byline, tagline, meta description
```