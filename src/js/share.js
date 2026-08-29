/* Sharing a result.

   Instagram will not accept a URL from a web share sheet, but it will accept
   an image — so the primary action produces a PNG card and hands it to
   navigator.share({ files }). Everything degrades: no file share -> share the
   link; no share sheet at all -> save the image and copy the text. */
window.Share = (function () {
  "use strict";

  var SITE = "https://agicook.com/which-quantum-interpretation-are-you/";
  var W = 1080, H = 1350;

  function css(name, fallback) {
    for (var i = 0, els = [document.body, document.documentElement]; i < 2; i++) {
      var v = getComputedStyle(els[i]).getPropertyValue(name).trim();
      if (v) return v;
    }
    return fallback;
  }

  function wrap(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // the collapsed state, drawn the same way the page draws it
  function peak(ctx, slotIndex, slots, x0, x1, baseY, topY, colour) {
    var pts = [{ x: x0, y: baseY }];
    for (var i = 0; i < slots; i++) {
      var v = i === slotIndex ? 1 : 0.02;
      pts.push({ x: x0 + ((x1 - x0) * (i + 0.5)) / slots, y: baseY - v * (baseY - topY) });
    }
    pts.push({ x: x1, y: baseY });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 0; j < pts.length - 1; j++) {
      var p0 = pts[j - 1] || pts[j], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2] || p2, t = 0.2;
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t,
                        p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t, p2.x, p2.y);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function card(result, key, keys) {
    return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(function () {
        var c = document.createElement("canvas");
        c.width = W; c.height = H;
        var ctx = c.getContext("2d");

        var paper = css("--paper", "#f4f5f1");
        var ink = css("--ink", "#1a1f27");
        var muted = css("--muted", "#5b6470");
        var hue = css("--" + key, css("--accent", "#b4256e"));

        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, W, H);

        var M = 92;

        ctx.fillStyle = muted;
        ctx.font = '500 26px "IBM Plex Mono", monospace';
        ctx.fillText("WHICH QUANTUM INTERPRETATION ARE YOU?", M, M + 26);

        peak(ctx, Math.max(0, keys.indexOf(key)), keys.length, M, W - M, 560, 210, hue);

        ctx.fillStyle = hue;
        ctx.font = '800 96px "Bricolage Grotesque", sans-serif';
        var nameLines = wrap(ctx, result.name, W - M * 2);
        var y = 720;
        nameLines.forEach(function (l) { ctx.fillText(l, M, y); y += 100; });

        ctx.fillStyle = ink;
        ctx.font = 'italic 42px "Newsreader", Georgia, serif';
        var tag = String(result.tagline).replace(/[“”"]/g, "");
        y += 24;
        wrap(ctx, tag, W - M * 2).slice(0, 4).forEach(function (l) { ctx.fillText(l, M, y); y += 58; });

        ctx.fillStyle = muted;
        ctx.font = '500 30px "IBM Plex Mono", monospace';
        ctx.fillText("agicook.com", M, H - M);

        ctx.strokeStyle = hue;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(0, H - 5); ctx.lineTo(W, H - 5); ctx.stroke();

        return new Promise(function (res) { c.toBlob(res, "image/png"); });
      });
  }

  function text(result) {
    return "I'm " + result.name + ". Which quantum interpretation are you?";
  }

  function url(key) { return SITE + "?r=" + key; }

  function share(result, key, keys, onState) {
    var t = text(result), u = url(key);
    return card(result, key, keys).then(function (blob) {
      var file = new File([blob], "quantum-" + key + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: t, url: u });
      }
      if (navigator.share) return navigator.share({ text: t, url: u });
      // no share sheet: hand them the image and the text
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
      if (navigator.clipboard) navigator.clipboard.writeText(t + " " + u).catch(function () {});
      onState && onState("saved");
    }).catch(function (e) {
      if (e && e.name === "AbortError") return;      // they dismissed the sheet
      onState && onState("failed");
    });
  }

  function copyLink(key, onState) {
    var payload = url(key);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(function () { onState && onState("copied"); },
                                                  function () { onState && onState("failed"); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = payload; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); onState && onState("copied"); } catch (e) { onState && onState("failed"); }
      document.body.removeChild(ta);
    }
  }

  return { share: share, copyLink: copyLink, card: card, url: url, text: text };
})();
