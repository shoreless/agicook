/* Connective tissue for the maps.

   Nodes flow in normal document order and are only nudged sideways by CSS, so
   nothing here positions anything — we measure where things landed and join the
   dots. Two kinds of link:
     within a map  — dashed grey, node to node, just showing it's one cluster
     across maps   — magenta, a log entry to the experiment its `topic:` names  */
(function () {
  var SVGNS = "http://www.w3.org/2000/svg";

  function dot(node, box) {
    var d = node.querySelector(".dot");
    if (!d) return null;
    var r = d.getBoundingClientRect();
    return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
  }

  function chain(map) {
    var path = map.querySelector(".links path");
    if (!path) return;
    var box = map.getBoundingClientRect();
    var pts = Array.prototype.map.call(map.querySelectorAll(".node"), function (n) {
      return dot(n, box);
    }).filter(Boolean);

    var d = "";
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      d += "M" + a.x + "," + a.y +
           " Q" + (mx + (b.y - a.y) * 0.22) + "," + (my - (b.x - a.x) * 0.22) +
           " " + b.x + "," + b.y + " ";
    }
    path.setAttribute("d", d);
  }

  function cross() {
    var svg = document.querySelector(".crosslinks");
    if (!svg) return;
    var g = svg.querySelector("g");
    var box = svg.parentNode.getBoundingClientRect();
    while (g.firstChild) g.removeChild(g.firstChild);

    Array.prototype.forEach.call(document.querySelectorAll(".node[data-topic]"), function (src) {
      var key = src.getAttribute("data-topic");
      var tgt = document.querySelector('.node[data-key="' + key + '"]');
      if (!tgt) return;                       // topic naming nothing: label only
      var a = dot(src, box), b = dot(tgt, box);
      if (!a || !b) return;

      var k = 70 + Math.abs(a.y - b.y) * 0.16;   // swing out to the left
      var p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", "M" + a.x + "," + a.y +
                          " C" + (a.x - k) + "," + a.y +
                          " " + (b.x - k) + "," + b.y +
                          " " + b.x + "," + b.y);
      g.appendChild(p);

      var on = function () { p.classList.add("is-active"); tgt.classList.add("is-linked"); };
      var off = function () { p.classList.remove("is-active"); tgt.classList.remove("is-linked"); };
      src.addEventListener("mouseenter", on);
      src.addEventListener("mouseleave", off);
      src.addEventListener("focusin", on);
      src.addEventListener("focusout", off);
    });
  }

  function drawAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".map"), chain);
    cross();
  }

  drawAll();
  addEventListener("resize", drawAll);
  addEventListener("load", drawAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
})();
