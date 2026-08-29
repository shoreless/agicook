/* The rig — one double-slit scene, eight lenses.
   Every theory page opens on the same experiment: an emitter, a barrier with
   two slits, a screen that accumulates hits. What changes per page is the
   lens: the one interaction that is that theory's crux. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function css(name, fallback) {
  // --c is set per page on <body>; the palette lives on :root
  for (const el of [document.body, document.documentElement]) {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if (v) return v;
  }
  return fallback;
}

function boot(host, lens) {
  const DARK = matchMedia("(prefers-color-scheme: dark)").matches;
  const INK = new THREE.Color(css("--ink", DARK ? "#e8eae4" : "#1a1f27"));
  const HUE = new THREE.Color(css("--c", css("--accent", "#b4256e")));
  const PAPER = new THREE.Color(css("--paper", DARK ? "#101319" : "#f4f5f1"));

  const scene = new THREE.Scene();
  scene.background = PAPER;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(-9, 5.5, 13);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  // The rig runs edge to edge inside a page you scroll, so it must never
  // capture the gestures used to get past it:
  //   wheel  — OrbitControls dollies on wheel; give it back to the page.
  //   touch  — it also sets touch-action:none, which strands you on mobile.
  // One finger scrolls, two fingers orbit; dragging with a mouse is unaffected
  // because a held button never conflicts with scrolling.
  controls.enableZoom = false;
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = "pan-y";

  /* ---- geometry shared by every lens ---- */
  const SLIT = 1.15, GAP = 2.6, SCREEN_X = 7, BARRIER_X = 0, EMIT_X = -7, H = 7;

  const line = (pts, colour, opacity = 1) => new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity })
  );

  // barrier: three segments, two gaps
  const bar = new THREE.Group();
  [[H, GAP / 2 + SLIT / 2], [GAP / 2 - SLIT / 2, -(GAP / 2 - SLIT / 2)], [-(GAP / 2 + SLIT / 2), -H]]
    .forEach(([a, b]) => {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, a - b, 4),
        new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.55 })
      );
      g.position.set(BARRIER_X, (a + b) / 2, 0);
      bar.add(g);
    });
  scene.add(bar);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2, 4),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.07, side: THREE.DoubleSide })
  );
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(SCREEN_X, 0, 0);
  scene.add(screen);

  const emitter = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshBasicMaterial({ color: HUE })
  );
  emitter.position.set(EMIT_X, 0, 0);
  scene.add(emitter);

  /* ---- the pattern: hits accumulate on the screen ---- */
  const MAX = 4000;
  const hitGeo = new THREE.BufferGeometry();
  const hitPos = new Float32Array(MAX * 3);
  hitGeo.setAttribute("position", new THREE.BufferAttribute(hitPos, 3));
  hitGeo.setDrawRange(0, 0);
  const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: HUE, size: 0.09 }));
  scene.add(hits);
  let nHits = 0;

  const state = { k: 2.2, bothSlits: true, coherence: 1, paused: false };

  // |cos|^2 fringes when both slits are open and coherence survives;
  // a single broad bump when either is not true
  function sampleY() {
    for (let i = 0; i < 60; i++) {
      const y = (Math.random() * 2 - 1) * H;
      const envelope = Math.exp(-(y * y) / (2 * 3.4 * 3.4));
      const fringe = Math.cos(state.k * y * GAP / 2) ** 2;
      const p = envelope * (state.bothSlits ? (1 - state.coherence) + state.coherence * fringe : 1);
      if (Math.random() < p) return y;
    }
    return (Math.random() * 2 - 1) * H;
  }

  function addHit(y) {
    const i = (nHits % MAX) * 3;
    hitPos[i] = SCREEN_X; hitPos[i + 1] = y; hitPos[i + 2] = (Math.random() * 2 - 1) * 1.8;
    nHits++;
    hitGeo.setDrawRange(0, Math.min(nHits, MAX));
    hitGeo.attributes.position.needsUpdate = true;
  }

  /* ---- flight: one particle at a time — deliberately non-committal.
     The flyer fades out on approach to the barrier and is next seen as a hit
     on the screen. The base rig never draws a path through a slit: drawing
     the middle would take sides, and the middle belongs to the lenses.
     (shot.slitY is still computed for lenses that claim a path.) ---- */
  const flyer = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    new THREE.MeshBasicMaterial({ color: HUE, transparent: true })
  );
  scene.add(flyer);

  const trails = new THREE.Group();
  scene.add(trails);

  let shot = null;
  function launch() {
    const y = sampleY();
    const slit = state.bothSlits ? (Math.random() < 0.5 ? 1 : -1) : 1;
    shot = { t: 0, y, slitY: slit * GAP / 2 };
  }
  launch();

  const lensApi = { scene, THREE, state, HUE, INK, SLIT, GAP, SCREEN_X, BARRIER_X, EMIT_X, H, line, trails, camera, controls };
  const view = (LENSES[lens] || LENSES.cop)(lensApi);

  /* ---- loop ---- */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight || Math.round(w * 0.56);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!state.paused && shot) {
      shot.t += dt * 1.5;
      if (shot.t < 1) {
        flyer.visible = true;
        flyer.material.opacity = Math.max(0, 1 - shot.t * 1.15);
        flyer.position.set(EMIT_X + (BARRIER_X - EMIT_X) * shot.t, 0, 0);
      } else if (shot.t < 2) {
        flyer.visible = false;
      } else {
        addHit(shot.y);
        view.onHit && view.onHit(shot);
        launch();
      }
    }
    view.update && view.update(dt, now);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  if (reduce.matches) { for (let i = 0; i < 900; i++) addHit(sampleY()); renderer.render(scene, camera); }
  else requestAnimationFrame(frame);

  host.classList.add("rig-ready");
}

/* ---- the lenses: one control each, and the control IS the crux ---- */
const LENSES = {};

// Copenhagen — the middle of the scene is fog the camera refuses to enter
LENSES.cop = (a) => {
  a.scene.fog = new a.THREE.Fog(a.scene.background, 9, 26);
  const veil = new a.THREE.Mesh(
    new a.THREE.BoxGeometry(a.SCREEN_X - 0.6, a.H * 2, 3.6),
    new a.THREE.MeshBasicMaterial({ color: a.scene.background, transparent: true, opacity: 0.93 })
  );
  veil.position.set(a.SCREEN_X / 2, 0, 0);
  a.scene.add(veil);
  return { update() { a.controls.minDistance = 12; } };
};

// Many-Worlds — the track does not choose; both branches are drawn, and stay
LENSES.mw = (a) => ({
  onHit(shot) {
    const other = -shot.slitY;
    const l = a.line([[a.BARRIER_X, other, 0], [a.SCREEN_X, shot.y, 0]], a.HUE, 0.13);
    a.trails.add(l);
    if (a.trails.children.length > 120) { const g = a.trails.children.shift(); a.trails.remove(g); }
  },
});

// Pilot Wave — every trajectory is real and drawn; close a slit and lanes reroute
LENSES.pw = (a) => ({
  onHit(shot) {
    const l = a.line([[a.EMIT_X, 0, 0], [a.BARRIER_X, shot.slitY, 0], [a.SCREEN_X, shot.y, 0]], a.HUE, 0.16);
    a.trails.add(l);
    if (a.trails.children.length > 90) { const g = a.trails.children.shift(); a.trails.remove(g); }
  },
});

// Relational — several observers, each with their own record of the same event
LENSES.rqm = (a) => {
  const eyes = [[3, 4.5, 3], [4.5, -3.5, -2.5], [1.5, 0.5, 4]].map((p) => {
    const m = new a.THREE.Mesh(
      new a.THREE.RingGeometry(0.34, 0.46, 20),
      new a.THREE.MeshBasicMaterial({ color: a.HUE, side: a.THREE.DoubleSide })
    );
    m.position.set(...p); a.scene.add(m); return m;
  });
  return { update(dt, now) { eyes.forEach((e, i) => e.lookAt(Math.sin(now / 900 + i) * 2, 0, 0)); } };
};

// QBism — the wave is the agent's, drawn only on their side of the room
LENSES.qb = (a) => {
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const y = -a.H + (i / 80) * a.H * 2;
    pts.push([a.BARRIER_X + 2.2, y, Math.cos(y * 2.2) * 0.9]);
  }
  const wave = a.line(pts, a.HUE, 0.6);
  a.scene.add(wave);
  return { update(dt, now) { wave.rotation.x = Math.sin(now / 1400) * 0.25; } };
};

// Spontaneous collapse — localisation events, visible, at random
LENSES.grw = (a) => ({
  onHit(shot) {
    if (Math.random() > 0.22) return;
    const x = a.BARRIER_X + Math.random() * (a.SCREEN_X - a.BARRIER_X);
    const spike = a.line([[x, shot.y - 1.4, 0], [x, shot.y + 1.4, 0]], a.HUE, 0.9);
    a.trails.add(spike);
    setTimeout(() => a.trails.remove(spike), 900);
  },
});

// Superdeterminism — everything fans back to one point at t=0
LENSES.sd = (a) => {
  const origin = new a.THREE.Mesh(
    new a.THREE.SphereGeometry(0.28, 16, 12),
    new a.THREE.MeshBasicMaterial({ color: a.HUE })
  );
  origin.position.set(a.EMIT_X - 3.5, 0, 0);
  a.scene.add(origin);
  return {
    onHit(shot) {
      const l = a.line([[a.EMIT_X - 3.5, 0, 0], [a.BARRIER_X, shot.slitY, 0], [a.SCREEN_X, shot.y, 0]], a.HUE, 0.1);
      a.trails.add(l);
      if (a.trails.children.length > 140) a.trails.remove(a.trails.children.shift());
    },
  };
};

// Decoherence — the toggle that changes nothing, and the slider that changes everything
LENSES.decoherence = (a) => ({});
LENSES.cc = LENSES.decoherence;

/* Mount last: every lens above must exist before boot() reads the table.
   Calling this at the top of the module throws a temporal-dead-zone error on
   `LENSES` and the canvas stays empty with no visible clue. */
const host = document.getElementById("rig");
if (host) {
  try {
    boot(host, host.dataset.lens || "cop");
  } catch (err) {
    // leave the static poster showing rather than an empty box
    console.error("rig failed to start:", err);
    host.remove();
  }
}
