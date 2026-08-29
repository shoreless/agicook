/* Two-slit interference, computed per pixel on a small buffer and upscaled by
   CSS. The softness is the low resolution, not a blur filter. */
(function () {
  var c = document.getElementById("field");
  if (!c || !c.getContext) return;
  var ctx = c.getContext("2d", { alpha: false });

  var W = 240, H = 150;
  c.width = W; c.height = H;
  var img = ctx.createImageData(W, H);
  var px = img.data;
  for (var p = 3; p < px.length; p += 4) px[p] = 255;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  var t = 0;

  function draw() {
    var d = isDark();
    var A  = d ? [255, 92, 178] : [206, 0, 103];   // magenta
    var B  = d ? [69, 194, 171] : [10, 122, 108];  // teal
    var BG = d ? [15, 14, 19]   : [250, 248, 245];

    var sep = 30 + Math.sin(t * 0.11) * 12;
    var k   = 0.52 + Math.sin(t * 0.06) * 0.07;
    var y1  = H / 2 - sep / 2, y2 = H / 2 + sep / 2;

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = x + 10;
        var a = Math.cos(k * Math.hypot(dx, y - y1) - t)
              + Math.cos(k * Math.hypot(dx, y - y2) - t);
        a = a * a / 4;                                  // intensity
        var v = Math.pow(a * (1 - (x / W) * 0.5), 1.5);
        var m = x / W;
        var i = (y * W + x) * 4;
        px[i]     = BG[0] + ((A[0] + (B[0] - A[0]) * m) - BG[0]) * v;
        px[i + 1] = BG[1] + ((A[1] + (B[1] - A[1]) * m) - BG[1]) * v;
        px[i + 2] = BG[2] + ((A[2] + (B[2] - A[2]) * m) - BG[2]) * v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop() {
    t += 0.06;
    draw();
    requestAnimationFrame(loop);
  }

  draw();
  if (!reduce.matches) requestAnimationFrame(loop);
  reduce.addEventListener("change", function (e) { if (!e.matches) requestAnimationFrame(loop); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
