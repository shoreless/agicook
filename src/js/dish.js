/* Sharing a dish.
 *
 * Two buttons, revealed by this script so they never appear without JS.
 *
 *   Copy link — clipboard, with a textarea fallback because navigator.clipboard
 *               only exists in a secure context (so: works on agicook.com,
 *               missing on the plain-http dev server).
 *
 *   Story card — draws a 1080x1920 card and hands it to the OS share sheet as a
 *               FILE, which is what puts it in front of Instagram Stories.
 *               navigator.share with files is likewise HTTPS-only and needs a
 *               real tap, so on desktop or the dev server this downloads the PNG
 *               instead of sharing it. Same card either way.
 *
 * The card carries BOTH pictures — the model's idea above, the real plate below.
 * One of them alone is just a food photo; the pair is the joke, and the joke is
 * the reason anyone follows this.
 */
(function () {
  var root = document.querySelector(".k-dish");
  var row = document.querySelector(".k-share");
  if (!root || !row) return;
  row.hidden = false;

  var TITLE = root.getAttribute("data-title") || document.title;
  var MODEL = root.getAttribute("data-model") || "";
  var SLUG = root.getAttribute("data-slug") || "";
  var SITE = (root.getAttribute("data-site") || "").replace(/\/$/, "");
  var LINK = SITE ? SITE + "/kitchen/" + SLUG + "/" : location.href;

  function flash(btn, msg) {
    var small = btn.querySelector("small");
    var was = small.textContent;
    small.textContent = msg;
    btn.classList.add("is-done");
    setTimeout(function () { small.textContent = was; btn.classList.remove("is-done"); }, 2200);
  }

  /* ---- copy link ---- */
  document.getElementById("k-copy").addEventListener("click", function () {
    var btn = this;
    function fallback() {
      var t = document.createElement("textarea");
      t.value = LINK;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(t);
      flash(btn, ok ? "copied" : LINK);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(LINK).then(function () { flash(btn, "copied"); }, fallback);
    } else {
      fallback();
    }
  });

  /* ---- the story card ---- */
  var W = 1080, H = 1920;

  function load(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  // draw an image cropped to fill a box, centred — same behaviour as the wall
  function cover(ctx, im, x, y, w, h) {
    var s = Math.max(w / im.width, h / im.height);
    var dw = im.width * s, dh = im.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }

  function chip(ctx, text, x, y) {
    ctx.font = "500 22px 'IBM Plex Mono', ui-monospace, monospace";
    var pad = 14, w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = "rgba(10,8,7,0.88)";
    ctx.fillRect(x, y, w, 40);
    ctx.fillStyle = "#00e6c3";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + pad, y + 21);
  }

  // wrap the title to at most two lines, shrinking rather than overflowing
  function title(ctx, text, x, y, maxw) {
    var size = 76;
    var lines;
    for (;;) {
      ctx.font = "800 " + size + "px 'Bricolage Grotesque', system-ui, sans-serif";
      lines = [];
      var line = "";
      text.split(/\s+/).forEach(function (word) {
        var test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxw && line) { lines.push(line); line = word; }
        else { line = test; }
      });
      if (line) lines.push(line);
      if (lines.length <= 2 || size <= 44) break;
      size -= 6;
    }
    ctx.fillStyle = "#f7f0e2";
    ctx.textBaseline = "top";
    lines.slice(0, 2).forEach(function (l, i) { ctx.fillText(l, x, y + i * (size + 6)); });
    return y + Math.min(lines.length, 2) * (size + 6);
  }

  function build() {
    var aiEl = document.querySelector(".k-ai img");
    var realEl = document.querySelector(".k-plates img");
    var srcs = [aiEl && aiEl.currentSrc || aiEl && aiEl.src, realEl && realEl.currentSrc || realEl && realEl.src]
      .filter(Boolean);
    if (!srcs.length) return Promise.reject(new Error("no pictures on this dish yet"));

    return Promise.all(srcs.map(load)).then(function (ims) {
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var ctx = c.getContext("2d");

      ctx.fillStyle = "#0d0c0a";
      ctx.fillRect(0, 0, W, H);

      var M = 56;
      ctx.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = "#ff4d1f";
      ctx.textBaseline = "top";
      ctx.fillText("AI SLOP KITCHEN", M, 70);

      var afterTitle = title(ctx, TITLE, M, 120, W - M * 2);

      // two panels, splitting whatever is left between them
      var top = afterTitle + 40;
      var foot = 130;
      var gap = 18;
      var panel = Math.floor((H - top - foot - gap) / (ims.length === 2 ? 2 : 1));

      cover(ctx, ims[0], M, top, W - M * 2, ims.length === 2 ? panel : panel);
      chip(ctx, ims.length === 2 ? "HOW " + (MODEL || "THE MODEL").toUpperCase() + " SAW IT" : "THE DISH", M + 16, top + 16);

      if (ims.length === 2) {
        var y2 = top + panel + gap;
        cover(ctx, ims[1], M, y2, W - M * 2, panel);
        chip(ctx, "WHAT CAME OUT", M + 16, y2 + 16);
      }

      ctx.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = "#9b8f7c";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(LINK.replace(/^https?:\/\//, ""), M, H - 60);

      return new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.92); });
    });
  }

  document.getElementById("k-story").addEventListener("click", function () {
    var btn = this;
    flash(btn, "drawing…");
    var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(build).then(function (blob) {
      var file = new File([blob], "slop-" + SLUG + ".jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: TITLE + " — " + LINK })
          .then(function () { flash(btn, "shared"); },
                function () { flash(btn, "cancelled"); });
      }
      // no share sheet here (desktop, or plain http): hand over the file itself
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      flash(btn, "saved as jpg");
    }, function (e) {
      flash(btn, e && e.message ? e.message : "could not draw it");
    });
  });
})();
