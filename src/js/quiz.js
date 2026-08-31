/* Which Quantum Interpretation Are You? — v2
   Scoring is ported verbatim from v1: same weights, same unlock thresholds,
   same tie-break order. Only the presentation is new. */
(function () {
  "use strict";

  var read = function (id) { return JSON.parse(document.getElementById(id).textContent); };
  var QUESTIONS = read("q-questions");
  var RESULTS   = read("q-results");
  var META      = read("q-meta");
  var LINKS     = read("q-links");

  var KEYS = META.keys;               // the six scored interpretations
  var TIEBREAK = META.tiebreak;
  var TRACE = META.trace;

  var picks = [];

  /* Routing. Each result has a real page — QUIZ_ROOT + "r/<key>/" — because the
     networks that unfurl a link read og: tags, and a query string cannot carry
     its own. QUIZ_ROOT is this page's own quiz root, so a visitor pinned to /v2/
     keeps every link inside /v2/; ?r=<key> still works, being what the first
     shares used. Not named BASE: that is already the amplitude graph's baseline
     eighty lines down, and the second `var` quietly won. */
  var QUIZ_ROOT = document.body.getAttribute("data-quiz-base") ||
                  location.pathname.replace(/[^/]*$/, "");
  var REVEAL = (META.share && META.share.reveal) || "r/";

  function revealHref(key) { return QUIZ_ROOT + REVEAL + key + "/"; }

  function keyFromLocation() {
    var m = /[?&]r=([a-z]+)/.exec(location.search);
    if (m) return m[1];
    m = /\/r\/([a-z]+)\/?$/.exec(location.pathname);
    return m ? m[1] : null;
  }

  /* The slots the share card's collapsed peak is drawn across. The card uses
     all eight results, not the six scored ones: the old six-slot version had
     no slot for Superdeterminism or Consciousness Causes Collapse, so both
     peaked on slot zero — which is Copenhagen's. */
  var CARD_SLOTS = Object.keys(RESULTS);

  var el = function (id) { return document.getElementById(id); };
  var elQuiz = el("quiz"), elIntro = el("intro"), elResult = el("result");
  var elQuestion = el("question"), elOptions = el("options");
  var elCounter = el("counter"), elPct = el("collapse-pct"), elFill = el("collapse-fill");
  var elBack = el("back");

  /* glossary + tooltips live in gloss.js, shared with the theory pages */
  var expand = window.Gloss.expand;

  /* ---------------- scoring (ported from v1, unchanged) ---------------- */

  function tally() {
    var t = { cop: 0, mw: 0, pw: 0, rqm: 0, qb: 0, grw: 0, sd: 0, cc: 0 };
    var sdPicks = 0, ccPicks = 0;
    picks.forEach(function (optIdx, qIdx) {
      var w = QUESTIONS[qIdx].opts[optIdx].w;
      for (var k in w) t[k] += w[k];
      if (w.sd) sdPicks++;
      if (w.cc) ccPicks++;
    });
    return { totals: t, sdPicks: sdPicks, ccPicks: ccPicks };
  }

  function verdict() {
    var s = tally();
    // Both secrets gate at >= 3 consistent picks and both are reachable, so
    // precedence is explicit rather than an accident of check order.
    var gates = META.gates || { cc: 3, sd: 3, precedence: ["cc", "sd"] };
    var counts = { cc: s.ccPicks, sd: s.sdPicks };
    for (var g = 0; g < gates.precedence.length; g++) {
      var key = gates.precedence[g];
      if (counts[key] >= gates[key]) return { key: key, tally: s };
    }
    var best = null;
    KEYS.forEach(function (k) {
      if (best === null || s.totals[k] > s.totals[best]) best = k;
      else if (s.totals[k] === s.totals[best] &&
               TIEBREAK.indexOf(k) < TIEBREAK.indexOf(best)) best = k;
    });
    return { key: best, tally: s };
  }

  function runnerUp(winnerKey, totals) {
    var best = null;
    KEYS.forEach(function (k) {
      if (k === winnerKey) return;
      if (best === null || totals[k] > totals[best]) best = k;
    });
    return (best && totals[best] > 0) ? best : null;
  }

  /* ---------------- live amplitudes ----------------
     A thin curve over six unlabelled slots. It shifts as you answer, but gives
     away nothing about which slot is which — the whole point being that you
     cannot read amplitudes off a state without collapsing it. */

  var W = 600, H = 120, PAD_X = 0, TOP = 14, BASE = H - 10;
  var elLine = el("wave-line"), elFill = el("wave-fill");
  var cur = KEYS.map(function () { return 0; });
  var target = cur.slice();
  var raf = null;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  function points(vals, base, top) {
    var span = W - PAD_X * 2;
    var pts = [{ x: 0, y: base }];                       // settle at the edges,
    vals.forEach(function (v, i) {                       // so it reads as a packet
      pts.push({
        x: PAD_X + (span * (i + 0.5)) / vals.length,
        y: base - v * (base - top)
      });
    });
    pts.push({ x: W, y: base });
    return pts;
  }

  // Catmull-Rom through the points, expressed as cubic beziers
  function smooth(pts) {
    var d = "M" + pts[0].x.toFixed(2) + "," + pts[0].y.toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i];
      var p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var t = 0.2;
      d += " C" + (p1.x + (p2.x - p0.x) * t).toFixed(2) + "," + (p1.y + (p2.y - p0.y) * t).toFixed(2) +
           " " + (p2.x - (p3.x - p1.x) * t).toFixed(2) + "," + (p2.y - (p3.y - p1.y) * t).toFixed(2) +
           " " + p2.x.toFixed(2) + "," + p2.y.toFixed(2);
    }
    return d;
  }

  function draw(vals) {
    var d = smooth(points(vals, BASE, TOP));
    elLine.setAttribute("d", d);
    elFill.setAttribute("d", d + " L" + W + "," + BASE + " L0," + BASE + " Z");
  }

  function step() {
    var moving = false;
    for (var i = 0; i < cur.length; i++) {
      cur[i] += (target[i] - cur[i]) * 0.16;
      if (Math.abs(target[i] - cur[i]) > 0.0015) moving = true;
      else cur[i] = target[i];
    }
    draw(cur);
    raf = moving ? requestAnimationFrame(step) : null;
  }

  function updateAmps() {
    var t = tally().totals;
    var max = Math.max.apply(null, KEYS.map(function (k) { return t[k]; }));
    target = KEYS.map(function (k) { return max > 0 ? t[k] / max : 0; });
    if (reduce.matches) { cur = target.slice(); draw(cur); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }

  /* ---------------- superposition field ----------------
     Every possible state at once, drifting and interfering. It is the same
     curve machinery as the quiz — before measurement there are simply many of
     them, and none is yours. */

  var GHOSTS = 14, SUP_H = 700;
  var elSup = el("superpose");

  for (var g = 0; g < GHOSTS; g++) {
    elSup.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
  }
  var ghosts = elSup.querySelectorAll("path");

  // a stack of states filling the page, each drifting on its own phase
  function drawSuperposition(t) {
    var step = SUP_H / (GHOSTS - 1);
    for (var g = 0; g < GHOSTS; g++) {
      var base = g * step;
      var vals = KEYS.map(function (_, i) {
        return 0.5 + 0.44 * Math.sin(t * 0.5 + g * 1.13 + i * 0.92) *
                     Math.cos(t * 0.19 + i * 0.4 + g * 0.3);
      });
      ghosts[g].setAttribute("d", smooth(points(vals, base, base - step * 1.25)));
    }
  }

  var supT = 0, supRaf = null;
  function supLoop() {
    supT += 0.012;
    drawSuperposition(supT);
    supRaf = elIntro.hidden ? null : requestAnimationFrame(supLoop);
  }

  drawSuperposition(0);
  if (!reduce.matches) supRaf = requestAnimationFrame(supLoop);

  function collapseField() {
    elSup.classList.add("collapsed");
    if (supRaf) { cancelAnimationFrame(supRaf); supRaf = null; }
  }

  // the collapsed state: one peak, drawn in the result's own colour
  function resultWave(key) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "result-wave");
    svg.setAttribute("viewBox", "0 0 600 144");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    var idx = KEYS.indexOf(key);
    var vals = KEYS.map(function (_, i) { return i === idx ? 1 : 0.02; });
    path.setAttribute("d", smooth(points(vals, 132, 10)));
    svg.appendChild(path);
    return svg;
  }

  /* ---------------- flow ---------------- */

  function show(section) {
    [elIntro, elQuiz, elResult].forEach(function (s) { s.hidden = s !== section; });
  }

  function renderQuestion() {
    if (picks.length >= QUESTIONS.length) return renderResult();
    var q = QUESTIONS[picks.length];

    elCounter.textContent = "Question " + (picks.length + 1) + " of " + QUESTIONS.length;
    var pct = Math.round((picks.length / QUESTIONS.length) * 100);
    elPct.textContent = "Collapse: " + pct + "%";
    elFill.style.width = pct + "%";

    elQuestion.textContent = "";
    elQuestion.appendChild(expand(q.stem));

    elOptions.innerHTML = "";
    q.opts.forEach(function (o, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "opt";
      b.appendChild(expand(o.t));
      b.addEventListener("click", function () {
        picks.push(i); updateAmps(); renderQuestion();
      });
      elOptions.appendChild(b);
    });

    elBack.textContent = picks.length ? "Back" : "\u2190 Back to the start";
    updateAmps();
    show(elQuiz);
    window.scrollTo({ top: 0 });
  }

  function section(label, text) {
    var d = document.createElement("div");
    d.className = "result-section";
    var h = document.createElement("h3"); h.textContent = label; d.appendChild(h);
    var p = document.createElement("p"); p.appendChild(expand(text)); d.appendChild(p);
    return d;
  }

  // Answers are recorded as stable option ids. Storing the displayed index
  // would tie the data to the option order, and any future edit to that order
  // would silently reinterpret every response already collected.
  function answerIds() {
    return picks.map(function (optIdx, qIdx) { return QUESTIONS[qIdx].opts[optIdx].id; });
  }

  // *Title* -> <em>, linked where that book has its own article
  function rich(text) {
    return String(text == null ? "" : text).replace(/\*([^*]+)\*/g, function (_, title) {
      var url = LINKS.books[title.trim()];
      return url
        ? '<a href="' + url + '" rel="noopener"><em>' + title + "</em></a>"
        : "<em>" + title + "</em>";
    });
  }

  /* ---------------- the reveal ----------------
     Broad to detailed: the screenshot-able verdict first, theory last. Every
     depth is a valid place to stop, and each section renders only if its copy
     exists — so unwritten sections are simply absent, never half-drawn. */

  // the answers that actually drove the result, most diagnostic first
  function diagnosticPicks(key, limit) {
    return picks
      .map(function (optIdx, qIdx) {
        var o = QUESTIONS[qIdx].opts[optIdx];
        return { q: QUESTIONS[qIdx], o: o, weight: (o.w && o.w[key]) || 0 };
      })
      .filter(function (x) { return x.weight > 0 && x.o.unmask; })
      .sort(function (a, b) { return b.weight - a.weight; })
      .slice(0, limit || 3);
  }

  function heading(text) {
    var h = document.createElement("h3");
    h.className = "reveal-head";
    h.textContent = text;
    return h;
  }

  function para(text, cls) {
    var p = document.createElement("p");
    if (cls) p.className = cls;
    p.appendChild(expand(text));
    return p;
  }

  var browsedKey = null;   // set when arriving at ?r=<key> without playing

  function renderResult() {
    var v = browsedKey ? { key: browsedKey, tally: null } : verdict();
    var r = RESULTS[v.key];
    var scored = KEYS.indexOf(v.key) !== -1;
    var near = (scored && v.tally) ? runnerUp(v.key, v.tally.totals) : null;

    elResult.innerHTML = "";
    if (scored) elResult.style.setProperty("--c", "var(--" + v.key + ")");
    else elResult.style.removeProperty("--c");

    /* 1 — the verdict */
    if (scored) elResult.appendChild(resultWave(v.key));

    var eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow result-eyebrow";
    eyebrow.textContent = v.key === "sd" ? "Measurement was never necessary"
                        : v.key === "cc" ? "Measurement complete, unfortunately"
                        : "Measurement complete";
    elResult.appendChild(eyebrow);

    var h1 = document.createElement("h1");
    h1.className = "result-name";
    h1.textContent = r.name;
    elResult.appendChild(h1);

    var tag = document.createElement("p");
    tag.className = "result-tagline";
    tag.innerHTML = r.tagline;
    elResult.appendChild(tag);

    /* sharing sits with the verdict — the screenshot-able part, before the read */
    elResult.appendChild(shareRow(r, v.key));

    elResult.appendChild(para(r.you, "result-you"));

    /* 2 — how we caught you */
    var caught = browsedKey ? [] : diagnosticPicks(v.key, 3);
    if (caught.length) {
      elResult.appendChild(heading("How we caught you"));
      caught.forEach(function (c) {
        var block = document.createElement("div");
        block.className = "caught";
        var said = document.createElement("p");
        said.className = "caught-said";
        said.textContent = "\u201C" + c.o.t + "\u201D";
        block.appendChild(said);
        block.appendChild(para(c.o.unmask, "caught-unmask"));
        elResult.appendChild(block);
      });
    }

    /* 3 — the actual theory, one labelled panel each */
    var LABELS = v.key === "cc"
      ? ["What actually happens", "And to be clear about the rest", "The kind part, said plainly"]
      : ["The idea", "What it fixes", "What it costs"];
    (r.theory || []).forEach(function (t, i) {
      if (!t) return;
      elResult.appendChild(heading(LABELS[i] || ""));
      elResult.appendChild(para(t));
    });

    /* the (???) button through to the full theory page */
    if (r.ctaTarget) {
      var cta = document.createElement("a");
      cta.className = "cta";
      cta.href = (META.theoriesBase || "/theories/") + r.ctaTarget + "/";
      cta.innerHTML = '<span class="cta-q">(???)</span> ' + r.ctaLabel +
                      ' <span class="cta-q">(???)</span>';
      elResult.appendChild(cta);
    }

    /* the motif fills the page behind the reveal — the same experiment,
       drawn the way this interpretation sees it */
    showMotifBackground(v.key);

    /* 4 — the experiment */
    var ex = r.experiment;
    if (ex && ex.name) {
      elResult.appendChild(heading("The experiment"));
      var exh = document.createElement("p");
      exh.className = "exp-name";
      var label = ex.name + (ex.year && ex.year !== "-" ? " \u00B7 " + ex.year : "");
      if (ex.wiki) {
        var a = document.createElement("a");
        a.href = ex.wiki; a.rel = "noopener"; a.textContent = label;
        exh.appendChild(a);
      } else { exh.textContent = label; }
      elResult.appendChild(exh);
      if (ex.body) elResult.appendChild(para(ex.body));
      var fig = document.querySelector('.motif[data-motif="' + v.key + '"]');
      if (fig) {
        var f = fig.cloneNode(true);
        f.setAttribute("class", "motif exp-motif");
        elResult.appendChild(f);
      }
      if (ex.ref) elResult.appendChild(para(ex.ref, "exp-ref"));
    }

    /* 5 — near miss (the tally joins this line once the worker is live) */
    if (near) {
      elResult.appendChild(heading("You were one answer from " + RESULTS[near].name));
      var pair = (META.nearmiss || {})[[v.key, near].sort().join("|")];
      if (pair) elResult.appendChild(para(pair));
      else if (TRACE[near]) elResult.appendChild(para(
        "Your state was not pure: the measurement also detected " + TRACE[near] + "."));
      var visit = document.createElement("a");
      visit.className = "cta cta-quiet";
      visit.href = (META.theoriesBase || "/theories/") + near + "/";
      visit.textContent = "visit your neighbour \u2192";
      elResult.appendChild(visit);
    }

    /* 5b — the rest of the roster */
    elResult.appendChild(heading(browsedKey ? "The others" : "Everyone else"));
    var roster = document.createElement("div");
    roster.className = "roster";
    Object.keys(RESULTS).forEach(function (k) {
      var a = document.createElement("a");
      a.className = "roster-link" + (k === v.key ? " is-self" : "");
      a.href = revealHref(k);
      a.style.setProperty("--c", "var(--" + k + ")");
      a.innerHTML = '<span class="roster-name">' + RESULTS[k].name + "</span>";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        history.pushState(null, "", revealHref(k));
        browseTo(k);
      });
      roster.appendChild(a);
    });
    elResult.appendChild(roster);

    /* 6 — the book */
    if (r.book) {
      elResult.appendChild(heading(v.key === "cc" ? "Required reading" : "Start here"));
      var bp = document.createElement("p");
      bp.innerHTML = rich(r.books || r.book);
      elResult.appendChild(bp);
    }

    recordAndTally(v.key);

    show(elResult);
    window.scrollTo({ top: 0 });
  }

  /* ---------------- motif background ---------------- */

  function showMotifBackground(key) {
    var existing = document.querySelector(".motif-bg");
    if (existing) existing.remove();
    var src = document.querySelector('.motif[data-motif="' + key + '"]');
    if (!src) return;
    var bg = src.cloneNode(true);
    bg.removeAttribute("data-motif");
    bg.setAttribute("class", "motif-bg");
    bg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (KEYS.indexOf(key) !== -1) bg.style.setProperty("--c", "var(--" + key + ")");
    document.body.insertBefore(bg, document.body.firstChild);
  }

  function clearMotifBackground() {
    var b = document.querySelector(".motif-bg");
    if (b) b.remove();
  }

  /* ---------------- tally ----------------
     Off until META.tally is set to the deployed Worker. While it is empty
     nothing is sent, nothing is fetched and no line appears. Browsed reveals
     never record — only a real playthrough counts. */

  var COUNTED = "agicook.quiz.counted.v2";

  function recordAndTally(key) {
    var base = META.tally;
    if (!base) return;

    var counted = false;
    try { counted = localStorage.getItem(COUNTED) === "1"; } catch (e) {}

    var post = (browsedKey || counted) ? Promise.resolve() :
      fetch(base + "/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: META.version, result: key, answers: answerIds() })
      }).then(function () {
        try { localStorage.setItem(COUNTED, "1"); } catch (e) {}
      }).catch(function () {});

    post.then(function () {
      return fetch(base + "/tally?v=" + encodeURIComponent(META.version))
        .then(function (r) { return r.json(); });
    }).then(function (data) {
      if (!data || !data.total || !data.counts) return;
      var n = data.counts[key] || 0;
      var line = document.createElement("p");
      line.className = "tally-line";
      line.innerHTML = "Since launch, <b>" + Math.round((n / data.total) * 100) +
        "%</b> of " + data.total.toLocaleString() + " measurements collapsed here.";
      var anchor = elResult.querySelector(".roster");
      if (anchor) anchor.parentNode.insertBefore(line, anchor);
      else elResult.appendChild(line);
    }).catch(function () { /* the tally is decoration; never break the reveal */ });
  }

  /* ---------------- back to the start ---------------- */

  function resetToStart(pushUrl) {
    if (pushUrl) history.pushState(null, "", QUIZ_ROOT);
    browsedKey = null;
    picks = [];
    clearMotifBackground();
    elSup.classList.remove("collapsed");
    if (!reduce.matches && !supRaf) supRaf = requestAnimationFrame(supLoop);
    show(elIntro);
    window.scrollTo({ top: 0 });
  }

  /* ---------------- sharing ---------------- */

  function shareRow(result, key) {
    var wrap = document.createElement("div");
    wrap.className = "share";

    var flash = function (btn, label, revert) {
      btn.textContent = label;
      btn.setAttribute("data-done", "1");
      setTimeout(function () { btn.textContent = revert; btn.removeAttribute("data-done"); }, 2200);
    };

    var row = document.createElement("div");
    row.className = "share-row";

    /* the picture path: the OS sheet on a phone, a saved PNG anywhere else.
       This is the only route to Instagram, which accepts no link at all. */
    var primary = document.createElement("button");
    primary.type = "button";
    primary.className = "share-btn share-btn--primary";
    primary.textContent = navigator.share ? "Share result" : "Save image";
    primary.addEventListener("click", function () {
      primary.disabled = true;
      var was = primary.textContent;
      primary.textContent = "Drawing…";
      window.Share.shareImage(result, key, CARD_SLOTS, function (state) {
        if (state === "saved") flash(primary, "Saved ✓", was);
        if (state === "failed") flash(primary, "Couldn't share", was);
      }).then(function () {
        primary.disabled = false;
        if (primary.textContent === "Drawing…") primary.textContent = was;
      });
    });
    row.appendChild(primary);

    var link = document.createElement("button");
    link.type = "button";
    link.className = "share-btn";
    link.textContent = "Copy link";
    link.addEventListener("click", function () {
      window.Share.copyLink(key, function (state) {
        flash(link, state === "copied" ? "Copied ✓" : "Couldn't copy", "Copy link");
      });
    });
    row.appendChild(link);

    var again = document.createElement("button");
    again.type = "button";
    again.className = "share-btn";
    again.textContent = browsedKey ? "Take the quiz" : "Measure again";
    again.addEventListener("click", function () { resetToStart(true); });
    row.appendChild(again);

    wrap.appendChild(row);

    /* the link path, one target per network. Labels rather than logos: ten
       brand marks would fight the page, and the page wins. */
    var nets = document.createElement("div");
    nets.className = "share-nets";

    var label = document.createElement("span");
    label.className = "share-nets-label mono";
    label.textContent = "post it to";
    nets.appendChild(label);

    window.Share.networks.forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "share-net";
      b.textContent = n.label;
      b.addEventListener("click", function () {
        window.Share.shareTo(n.id, result, key, CARD_SLOTS, function (state) {
          if (state === "saved") flash(b, "Saved ✓", n.label);
          if (state === "failed") flash(b, "Failed", n.label);
        });
      });
      nets.appendChild(b);
    });

    /* the escape hatch for everything with no intent URL — Mastodon, Discord,
       Slack, a text message, a friend who only uses email attachments */
    var cap = document.createElement("button");
    cap.type = "button";
    cap.className = "share-net share-net--copy";
    cap.textContent = "Copy caption";
    cap.title = window.Share.full(result, key);
    cap.addEventListener("click", function () {
      window.Share.copyText(result, key, function (state) {
        flash(cap, state === "copied" ? "Copied ✓" : "Failed", "Copy caption");
      });
    });
    nets.appendChild(cap);

    wrap.appendChild(nets);
    return wrap;
  }

  /* ---------------- browsing a reveal directly ---------------- */

  function browseTo(key) {
    if (!RESULTS[key]) return;
    browsedKey = key;
    collapseField();
    renderResult();
  }

  addEventListener("popstate", function () {
    var k = keyFromLocation();
    if (k && RESULTS[k]) browseTo(k);
    else resetToStart(false);
  });

  /* ---------------- debug ----------------
     Visible on localhost or with ?debug. Never on the live domain, so this
     cannot survive to production by being forgotten. */

  function isLocal() {
    return /^(localhost|127\.|0\.0\.0\.0|\[::1\]|172\.|192\.168\.)/.test(location.hostname) ||
           location.protocol === "file:" ||
           /(^|[?&])debug([=&]|$)/.test(location.search);
  }


  function isLocal() {
    return /^(localhost|127\.|0\.0\.0\.0|\[::1\]|172\.|192\.168\.)/.test(location.hostname) ||
           location.protocol === "file:" ||
           /(^|[?&])debug([=&]|$)/.test(location.search);
  }

  // A synthesised playthrough, not a browse — this exercises the scoring and
  // fills the sections that need real answers.
  function debugPlay(key) {
    browsedKey = null;
    picks = QUESTIONS.map(function (q) {
      var i = q.opts.findIndex(function (o) { return o.w && o.w[key]; });
      return i < 0 ? 0 : i;
    });
    collapseField();
    renderResult();
  }

  function setupDebug() {
    if (!isLocal()) return;
    var box = el("debug"), links = el("debug-links");
    if (!box || !links) return;
    box.hidden = false;
    Object.keys(RESULTS).forEach(function (key) {
      var a = document.createElement("a");
      a.href = "#play-" + key;
      a.textContent = RESULTS[key].name;
      a.style.setProperty("--c", "var(--" + key + ")");
      a.addEventListener("click", function (e) { e.preventDefault(); debugPlay(key); });
      links.appendChild(a);
    });
  }

  function setupDeepLink() {
    var k = keyFromLocation();
    if (k && RESULTS[k]) browseTo(k);
  }

  /* ---------------- wiring ---------------- */

  window.Gloss.expandIn(elIntro);
  draw(cur);

  el("begin").addEventListener("click", function () { collapseField(); renderQuestion(); });
  setupDebug();
  setupDeepLink();
  elBack.addEventListener("click", function () {
    // on question one there is no previous answer — leave the quiz instead
    if (picks.length) { picks.pop(); renderQuestion(); }
    else resetToStart(false);
  });
})();
