/* The kitchen index, made searchable.
 *
 * Every tile carries a data-search string built at build time (see
 * src/kitchen/kitchen.11tydata.js): title, model, the whole recipe body and the
 * table notes, flattened and lowercased. So "miso" finds the dish whose caramel
 * has miso in it, not just the one with miso in the title — which is the point,
 * because this is meant to be cooked from twice.
 *
 * Progressive enhancement: the field is hidden in the markup and revealed here.
 * With JS off, every dish is simply listed.
 */
(function () {
  var wall = document.getElementById("k-wall");
  var input = document.getElementById("k-q");
  var count = document.getElementById("k-count");
  var empty = document.getElementById("k-empty");
  var emptyQ = document.getElementById("k-empty-q");
  if (!wall || !input) return;

  var tiles = Array.prototype.slice.call(wall.querySelectorAll(".k-tile"));
  var total = tiles.length;
  var label = input.closest(".k-search");
  if (label) label.hidden = false;

  function plural(n) { return n === 1 ? "dish" : "dishes"; }

  function apply(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;

    tiles.forEach(function (t) {
      var hay = t.getAttribute("data-search") || "";
      // every term must appear — narrowing, so "miso chicken" means both
      var hit = terms.every(function (term) { return hay.indexOf(term) !== -1; });
      t.hidden = !hit;
      if (hit) shown++;
    });

    count.innerHTML = terms.length
      ? "<b>" + shown + "</b> of " + total + " " + plural(total) + " on the pass"
      : "<b>" + total + "</b> " + plural(total) + " on the pass";
    if (empty) {
      empty.hidden = !(terms.length && shown === 0);
      if (emptyQ) emptyQ.textContent = "“" + q.trim() + "”";
    }
  }

  var t = null;
  input.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      apply(input.value);
      // keep the search in the URL, so a search worth keeping can be bookmarked
      var url = input.value.trim()
        ? location.pathname + "?q=" + encodeURIComponent(input.value.trim())
        : location.pathname;
      history.replaceState(null, "", url);
    }, 90);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      apply("");
      history.replaceState(null, "", location.pathname);
      input.blur();
    }
  });

  // a shared or bookmarked search arrives pre-filled
  var q = new URLSearchParams(location.search).get("q");
  if (q) { input.value = q; apply(q); }
})();
