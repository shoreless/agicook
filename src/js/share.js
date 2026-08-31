/* Sharing a result.

   Two problems, two mechanisms.

   1. Networks that unfurl a link (X, Facebook, LinkedIn, WhatsApp, Telegram,
      Bluesky) read the page's OG tags, so every result has its own real URL —
      /which-quantum-interpretation-are-you/r/<key>/ — with its own og:title,
      og:description and og:image. A query string could not do that.
   2. Instagram accepts no URL at all from a share sheet, but it will accept an
      image. So the primary action draws a PNG card and hands it to
      navigator.share({ files }).

   Everything degrades: no file share -> share the link; no share sheet at all
   -> save the image and copy the text. Every path names the quiz, because a
   post on Instagram or Threads never unfurls and the title is otherwise lost. */
window.Share = (function () {
  "use strict";

  function meta() {
    var el = document.getElementById("q-meta");
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
  }
  var CFG = meta().share || {};
  var TITLE = CFG.title || document.title;
  var SITE = (CFG.site || location.origin).replace(/\/$/, "");
  var REVEAL = CFG.reveal || "r/";

  // the quiz root this page belongs to, so a pinned version keeps its own links
  function base() {
    return (document.body.getAttribute("data-quiz-base") || location.pathname)
      .replace(/[^/]*$/, "");
  }

  var W = 1080, H = 1350;

  /* ---------------- the words ---------------- */

  function hook(result) {
    return result.hook || ("I got " + result.name + ".");
  }

  function url(key) { return SITE + base() + REVEAL + key + "/"; }

  // for a sheet or a field that shows the link separately
  function text(result) { return hook(result) + "\n\n" + TITLE; }

  // for a field that shows nothing but what you paste
  function full(result, key) { return text(result) + "\n" + url(key); }

  /* ---------------- the networks ----------------

     Facebook and LinkedIn discard any text you send them and render the OG
     tags instead; they get the URL alone on purpose. Bluesky has no url
     parameter, so the link has to ride inside the text. Instagram has no web
     intent of any kind — it is handled as an image, not a link. */

  var NETWORKS = [
    { id: "x", label: "X", href: function (r, k) {
        return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text(r)) +
               "&url=" + encodeURIComponent(url(k)); } },
    { id: "bluesky", label: "Bluesky", href: function (r, k) {
        return "https://bsky.app/intent/compose?text=" + encodeURIComponent(full(r, k)); } },
    { id: "threads", label: "Threads", href: function (r, k) {
        return "https://www.threads.net/intent/post?text=" + encodeURIComponent(text(r)) +
               "&url=" + encodeURIComponent(url(k)); } },
    { id: "instagram", label: "Instagram", image: true },
    { id: "whatsapp", label: "WhatsApp", href: function (r, k) {
        return "https://wa.me/?text=" + encodeURIComponent(full(r, k)); } },
    { id: "telegram", label: "Telegram", href: function (r, k) {
        return "https://t.me/share/url?url=" + encodeURIComponent(url(k)) +
               "&text=" + encodeURIComponent(text(r)); } },
    { id: "facebook", label: "Facebook", href: function (r, k) {
        return "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url(k)); } },
    { id: "reddit", label: "Reddit", href: function (r, k) {
        return "https://www.reddit.com/submit?url=" + encodeURIComponent(url(k)) +
               "&title=" + encodeURIComponent(hook(r)); } },
    { id: "linkedin", label: "LinkedIn", href: function (r, k) {
        return "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url(k)); } },
    { id: "email", label: "Email", href: function (r, k) {
        return "mailto:?subject=" + encodeURIComponent(TITLE) +
               "&body=" + encodeURIComponent(full(r, k)); } }
  ];

  function open_(href) {
    if (href.indexOf("mailto:") === 0) { location.href = href; return; }
    var w = window.open(href, "_blank", "noopener,noreferrer,width=620,height=680");
    if (!w) location.href = href;   // popup blocked: go there in this tab
  }

  /* ---------------- the picture ---------------- */

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

        /* The title, said properly. A card posted to Instagram is the only
           thing anyone sees — there is no unfurl to carry the name. */
        if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
        ctx.fillStyle = ink;
        ctx.font = '500 34px "IBM Plex Mono", monospace';
        var titleLines = wrap(ctx, TITLE.toUpperCase(), W - M * 2);
        var ty = M + 40;
        titleLines.forEach(function (l) { ctx.fillText(l, M, ty); ty += 46; });
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

        ctx.strokeStyle = muted;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(M, ty - 6); ctx.lineTo(W - M, ty - 6); ctx.stroke();

        peak(ctx, Math.max(0, keys.indexOf(key)), keys.length, M, W - M, 600, 260, hue);

        ctx.fillStyle = hue;
        ctx.font = '800 96px "Bricolage Grotesque", sans-serif';
        var y = 760;
        wrap(ctx, result.name, W - M * 2).forEach(function (l) { ctx.fillText(l, M, y); y += 100; });

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

  function file(result, key, keys) {
    return card(result, key, keys).then(function (blob) {
      return new File([blob], "quantum-" + key + ".png", { type: "image/png" });
    });
  }

  function save(f) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* The image path, used by the primary button and by Instagram. Instagram is
     reached only through the OS sheet — so on a desktop, where there is no
     sheet, the honest outcome is the file plus the caption on the clipboard. */
  function shareImage(result, key, keys, onState) {
    var t = full(result, key);
    return file(result, key, keys).then(function (f) {
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], text: text(result), url: url(key) });
      }
      save(f);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).catch(function () {});
      }
      onState && onState("saved");
    }).catch(function (e) {
      if (e && e.name === "AbortError") return;      // they dismissed the sheet
      onState && onState("failed");
    });
  }

  function shareTo(id, result, key, keys, onState) {
    for (var i = 0; i < NETWORKS.length; i++) {
      if (NETWORKS[i].id !== id) continue;
      if (NETWORKS[i].image) return shareImage(result, key, keys, onState);
      open_(NETWORKS[i].href(result, key));
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  /* ---------------- clipboard ---------------- */

  function copy(payload, onState) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(
        function () { onState && onState("copied"); },
        function () { onState && onState("failed"); });
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = payload; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); onState && onState("copied"); }
    catch (e) { onState && onState("failed"); }
    document.body.removeChild(ta);
  }

  function copyLink(key, onState) { copy(url(key), onState); }
  function copyText(result, key, onState) { copy(full(result, key), onState); }

  return {
    networks: NETWORKS,
    shareTo: shareTo,
    shareImage: shareImage,
    copyLink: copyLink,
    copyText: copyText,
    card: card,
    url: url,
    text: text,
    full: full,
    hook: hook,
    title: TITLE
  };
})();
