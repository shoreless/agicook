/* Shared glossary: [[term]] markers, tap-to-open tooltips, and the anchor
   handling that forces a collapsed <details> open. Used by the quiz and by
   every theory page, so there is one implementation, not two. */
window.Gloss = (function () {
  "use strict";

  var node = document.getElementById("q-glossary");
  var GLOSSARY = node ? JSON.parse(node.textContent) : {};
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  /* Two markers live in the copy: [[term]] opens a tooltip, *emphasis* is an
     <em>. One tokenizer handles both, because two passes would let each eat
     the other's markers. Pass { terms: false } where a tooltip button would be
     nonsense — inside another tooltip, for one. */
  var MARK = "\\[\\[([a-z0-9-]+)\\]\\]|\\*([^*\\n]+)\\*";

  function expand(text, opts) {
    var terms = !(opts && opts.terms === false);
    var frag = document.createDocumentFragment();
    var re = new RegExp(MARK, "gi"), last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      last = re.lastIndex;

      if (m[2] !== undefined) {
        var em = document.createElement("em");
        em.textContent = m[2];
        frag.appendChild(em);
        continue;
      }

      var key = m[1], term = GLOSSARY[key];
      if (!term) { frag.appendChild(document.createTextNode(m[0])); continue; }
      if (!terms) { frag.appendChild(document.createTextNode(term.label)); continue; }

      var b = document.createElement("button");
      b.type = "button";
      b.className = "gloss";
      b.textContent = term.label;
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("data-term", key);
      frag.appendChild(b);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function expandIn(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf("[[") !== -1 || /\*[^*\n]+\*/.test(n.nodeValue)) nodes.push(n);
    }
    nodes.forEach(function (t) { t.parentNode.replaceChild(expand(t.nodeValue), t); });
  }

  var openTip = null, openBtn = null;

  function close() {
    if (openTip) { openTip.remove(); openTip = null; }
    if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn = null; }
  }

  function show(btn) {
    var term = GLOSSARY[btn.getAttribute("data-term")];
    if (!term) return;
    close();

    var tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("role", "tooltip");
    tip.id = "tip-live";

    var h = document.createElement("h4"); h.textContent = term.label; tip.appendChild(h);
    var p = document.createElement("p"); p.appendChild(expand(term.short, { terms: false })); tip.appendChild(p);
    if (term.long) {
      var p2 = document.createElement("p");
      p2.appendChild(expand(term.long, { terms: false }));
      tip.appendChild(p2);
    }

    if (document.getElementById("gloss-" + btn.getAttribute("data-term"))) {
      var more = document.createElement("p");
      more.className = "tip-more";
      var a = document.createElement("a");
      a.href = "#gloss-" + btn.getAttribute("data-term");
      a.textContent = "In the glossary →";
      more.appendChild(a); tip.appendChild(more);
    }

    document.body.appendChild(tip);

    var r = btn.getBoundingClientRect(), t = tip.getBoundingClientRect(), pad = 8;
    var left = Math.min(Math.max(pad, r.left), window.innerWidth - t.width - pad);
    var top = r.bottom + 8;
    if (top + t.height > window.innerHeight - pad && r.top - t.height - 8 > pad) top = r.top - t.height - 8;
    tip.style.left = (left + window.scrollX) + "px";
    tip.style.top = (top + window.scrollY) + "px";

    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-describedby", "tip-live");
    openTip = tip; openBtn = btn;
  }

  function revealTarget() {
    if (location.hash.indexOf("#gloss-") !== 0) return;
    var block = document.getElementById("glossary-block");
    var target = document.querySelector(location.hash);
    if (!target) return;
    if (block) block.open = true;
    target.scrollIntoView({ block: "start", behavior: reduce.matches ? "auto" : "smooth" });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".gloss") : null;
    if (btn) { e.preventDefault(); if (openBtn === btn) close(); else show(btn); return; }
    if (openTip && !e.target.closest(".tip")) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  addEventListener("resize", close);
  addEventListener("scroll", close, { passive: true });
  addEventListener("hashchange", revealTarget);
  revealTarget();
  expandIn(document.querySelector("main"));

  return { expand: expand, expandIn: expandIn, terms: GLOSSARY, close: close };
})();
