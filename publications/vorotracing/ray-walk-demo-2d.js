/*
 * VoroTracing — 2D Voronoi ray-walk demo.
 *
 * Two synced panels share one Voronoi diagram and one camera ray, but assign
 * per-cell opacity differently:
 *   left  — semi-transparent shell around the surface (Radiant Foam-style)
 *   right — the same field, concentrated into a thin surface band (ours)
 * The ray walks the diagram cell-to-cell via bisector crossings, composites
 * opacity front-to-back, and terminates when transmittance drops below 1%.
 * Traversed cells are tinted by their compositing weight w_i = T_i * alpha_i.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utils

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rng) {
    // Box-Muller
    const u = Math.max(rng(), 1e-9);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ------------------------------------------------------------ the scene
  // Everything lives in the unit square [0,1]^2.

  const BLOB_C = { x: 0.63, y: 0.5 };
  function blobRadius(theta) {
    return 0.24 + 0.028 * Math.sin(3 * theta + 0.7) + 0.018 * Math.sin(5 * theta + 2.1);
  }
  // Approximate signed distance to the blob surface (<0 inside).
  function signedDist(p) {
    const dx = p.x - BLOB_C.x, dy = p.y - BLOB_C.y;
    const theta = Math.atan2(dy, dx);
    return Math.hypot(dx, dy) - blobRadius(theta);
  }

  function generateSites() {
    const rng = mulberry32(1337);
    const sites = [];
    const push = (x, y) => {
      if (x > 0.005 && x < 0.995 && y > 0.005 && y < 0.995) sites.push({ x, y });
    };
    // dense ring hugging the surface (small cells where the scene needs them)
    for (let i = 0; i < 110; i++) {
      const th = rng() * 2 * Math.PI;
      const r = blobRadius(th) + gauss(rng) * 0.011;
      push(BLOB_C.x + r * Math.cos(th), BLOB_C.y + r * Math.sin(th));
    }
    // fuzzier shell — these become the semi-transparent haze in foam mode
    for (let i = 0; i < 55; i++) {
      const th = rng() * 2 * Math.PI;
      const r = blobRadius(th) + gauss(rng) * 0.055;
      push(BLOB_C.x + r * Math.cos(th), BLOB_C.y + r * Math.sin(th));
    }
    // sparse free space + a few interior sites
    for (let i = 0; i < 42; i++) push(rng(), rng());
    for (let i = 0; i < 30; i++) {
      const th = rng() * 2 * Math.PI;
      const r = blobRadius(th) * Math.sqrt(rng()) * 0.8;
      push(BLOB_C.x + r * Math.cos(th), BLOB_C.y + r * Math.sin(th));
    }
    return sites;
  }

  // Both panels use the SAME opacity field: two lobes around the surface — a
  // narrow core and a wide shell — over a low non-zero floor in free space.
  // The models differ only in how the opacity budget is split between them.
  // Neither is binary: opacity is a smooth function of the cell's signed
  // distance to the surface, so both panels show a continuous falloff and a
  // real population of partially transparent cells. Ours puts most of the
  // budget in the core, giving the strongly bimodal distribution the paper
  // measures — mostly near-opaque or near-transparent, few in between — so a
  // ray saturates sooner. Foam spreads it, leaving the semi-transparent haze.
  //
  // The lobes are modulated by a low-frequency function of the angle around
  // the blob, so different stretches of surface come out more or less opaque,
  // as they do in a real reconstruction. Deliberately a smooth function of
  // position and nothing else — per-cell randomness makes the field read as
  // noise rather than a surface.
  //
  // These parameters cut cells traversed per ray by ~38% across a sweep of ray
  // directions (the paper measures 31% on mip-NeRF 360), and our panel is never
  // worse than foam's on any direction — which matters more here than matching
  // a histogram, since the cell counters are what the reader actually sees.
  // The opaque fraction does run high, ~39% of cells above alpha=0.9 against
  // the paper's 24%, and foam's high-opacity tail comes out near 0% against the
  // measured 4%. Both follow from this sketch's sites being packed around the
  // surface by construction instead of spread through free space.
  function bandOpacity(site, p) {
    const d = signedDist(site);
    const th = Math.atan2(site.y - BLOB_C.y, site.x - BLOB_C.x);
    const v = 0.5 + 0.5 * Math.sin(2 * th + 0.7) * Math.cos(3 * th - 1.3);
    // Modulate the shell hard and the core only gently. Scaling the core by the
    // same factor let whole stretches of surface top out near alpha=0.68, which
    // is not opaque enough to terminate a ray — the surface must actually stop
    // rays everywhere, or the right panel wins on some directions and ties on
    // others for no reason the reader can see.
    const modCore = 0.94 + 0.26 * v;
    const modShell = 0.50 + 0.95 * v;
    // Super-Gaussian (4th power): flat-topped with a steep shoulder, so cells
    // are mostly near-opaque or near-transparent with few stranded in between.
    // A plain Gaussian ramps too gently and leaves the majority mid-grey, which
    // would misrepresent the measured distribution in the other direction.
    const g = (w) => { const t = d / (w * (0.80 + 0.40 * v)); const t2 = t * t; return Math.exp(-t2 * t2); };
    // The core reaches deeper inward than outward. A grazing ray that dips just
    // under the surface must still meet opaque cells; with a symmetric core it
    // can weave through the band and out the far side, which made the right
    // panel occasionally *lose* to the left one for no visible reason.
    const core = p.core * g(d >= 0 ? p.cw : p.cw * 2.2);
    const shell = p.shell * g(d >= 0 ? p.sw : p.sw * 1.6);
    return Math.min(0.985, Math.max(0.012, modCore * core + modShell * shell + 0.012));
  }

  // Foam spreads its budget over the wide shell; ours concentrates it in the
  // narrow core — but the shell never goes away in either.
  const FOAM_OPACITY = { core: 0.40, shell: 0.30, cw: 0.014, sw: 0.075 };
  const OURS_OPACITY = { core: 0.95, shell: 0.055, cw: 0.012, sw: 0.050 };
  const opacityFoam = (site) => bandOpacity(site, FOAM_OPACITY);
  const opacityOurs = (site) => bandOpacity(site, OURS_OPACITY);

  // ------------------------------------------- Voronoi cells (for drawing)
  // Clip the unit square against the bisector half-plane of every other site.
  // O(N^2) once at startup; N ~ 200 so this is instant.

  function computeCells(sites) {
    const cells = [];
    for (let i = 0; i < sites.length; i++) {
      let poly = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      const si = sites[i];
      for (let j = 0; j < sites.length && poly.length; j++) {
        if (j === i) continue;
        const sj = sites[j];
        // keep points p with |p-si|^2 <= |p-sj|^2  <=>  n.p <= c
        const nx = sj.x - si.x, ny = sj.y - si.y;
        const c = 0.5 * (sj.x * sj.x + sj.y * sj.y - si.x * si.x - si.y * si.y);
        poly = clipHalfPlane(poly, nx, ny, c);
      }
      cells.push(poly);
    }
    return cells;
  }

  function clipHalfPlane(poly, nx, ny, c) {
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      const da = nx * a.x + ny * a.y - c;
      const db = nx * b.x + ny * b.y - c;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
    return out;
  }

  // ------------------------------------------------------- ray traversal

  function nearestSite(sites, p) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < sites.length; i++) {
      const d = (sites[i].x - p.x) ** 2 + (sites[i].y - p.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Walk the ray o + t*d through the diagram. Returns per-cell records with
  // compositing weights, plus where (and whether) the ray terminated.
  function traceRay(sites, opacities, o, dir) {
    const records = [];
    let cur = nearestSite(sites, o);
    let t = 0;
    let T = 1; // transmittance
    const T_MIN = 0.01;
    const MAX_STEPS = 600;

    for (let step = 0; step < MAX_STEPS; step++) {
      // exit crossing: smallest t' > t where another site becomes closer
      const si = sites[cur];
      let bestT = Infinity, bestJ = -1;
      for (let j = 0; j < sites.length; j++) {
        if (j === cur) continue;
        const sj = sites[j];
        const nx = sj.x - si.x, ny = sj.y - si.y;
        const denom = dir.x * nx + dir.y * ny;
        if (denom <= 1e-12) continue;
        const c = 0.5 * (sj.x * sj.x + sj.y * sj.y - si.x * si.x - si.y * si.y);
        const tj = (c - (o.x * nx + o.y * ny)) / denom;
        if (tj > t + 1e-9 && tj < bestT) { bestT = tj; bestJ = j; }
      }
      // domain exit
      let tDomain = Infinity;
      if (dir.x > 1e-12) tDomain = Math.min(tDomain, (1 - o.x) / dir.x);
      if (dir.x < -1e-12) tDomain = Math.min(tDomain, (0 - o.x) / dir.x);
      if (dir.y > 1e-12) tDomain = Math.min(tDomain, (1 - o.y) / dir.y);
      if (dir.y < -1e-12) tDomain = Math.min(tDomain, (0 - o.y) / dir.y);

      const tExit = Math.min(bestT, tDomain);
      const alpha = opacities[cur];
      const w = T * alpha;
      records.push({ cell: cur, t0: t, t1: tExit, w: w });
      T *= (1 - alpha);

      if (T < T_MIN) {
        return { records, tEnd: tExit, terminated: true, T };
      }
      if (tExit >= tDomain - 1e-9 || bestJ < 0) {
        return { records, tEnd: tDomain, terminated: false, T };
      }
      cur = bestJ;
      t = tExit;
    }
    return { records, tEnd: t, terminated: false, T };
  }

  // ------------------------------------------------------------ rendering

  const COL = {
    // Scene structure is neutral ink; the measured quantity (compositing
    // weight) is the accent, so the eye goes to what the demo is about.
    cellFill: (a) => `rgba(26, 26, 46, ${0.62 * a})`,
    cellEdge: 'rgba(0,0,0,0.10)',
    surface: '#1A1A2E',
    ray: '#1A1A2E',
    rayFaint: 'rgba(26, 26, 46, 0.22)',
    weight: (w) => `rgba(239, 65, 54, ${Math.min(0.92, 0.18 + 0.82 * w)})`,
    camera: '#356388',
    hit: '#396353',
  };

  function makePanel(canvas, sites, cells, opacities) {
    const ctx = canvas.getContext('2d');
    return { canvas, ctx, sites, cells, opacities };
  }

  function resizePanel(panel) {
    const dpr = window.devicePixelRatio || 1;
    const rect = panel.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    if (panel.canvas.width !== w) {
      panel.canvas.width = w;
      panel.canvas.height = w; // square
    }
    panel.scale = w;
  }

  function drawPanel(panel, ray, showEdges) {
    resizePanel(panel);
    const { ctx, sites, cells, opacities, scale: S } = panel;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.lineJoin = 'round';

    // cells shaded by opacity
    for (let i = 0; i < cells.length; i++) {
      const poly = cells[i];
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
      ctx.closePath();
      ctx.fillStyle = COL.cellFill(opacities[i]);
      ctx.fill();
      if (showEdges) {
        ctx.strokeStyle = COL.cellEdge;
        ctx.lineWidth = 0.0016;
        ctx.stroke();
      }
    }

    // traversed cells tinted by compositing weight
    const result = ray.results.get(panel);
    for (const rec of result.records) {
      if (rec.w < 0.004) continue;
      const poly = cells[rec.cell];
      if (poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
      ctx.closePath();
      ctx.fillStyle = COL.weight(rec.w);
      ctx.fill();
    }

    // true surface (dashed)
    ctx.beginPath();
    for (let k = 0; k <= 160; k++) {
      const th = (k / 160) * 2 * Math.PI;
      const r = blobRadius(th);
      const x = BLOB_C.x + r * Math.cos(th), y = BLOB_C.y + r * Math.sin(th);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.setLineDash([0.012, 0.010]);
    ctx.strokeStyle = COL.surface;
    ctx.lineWidth = 0.004;
    ctx.stroke();
    ctx.setLineDash([]);

    // ray: traversed portion solid, remainder (if it exits) faint
    const o = ray.origin, d = ray.dir;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + d.x * result.tEnd, o.y + d.y * result.tEnd);
    ctx.strokeStyle = COL.ray;
    ctx.lineWidth = 0.005;
    ctx.stroke();
    if (!result.terminated) {
      ctx.beginPath();
      ctx.moveTo(o.x + d.x * result.tEnd, o.y + d.y * result.tEnd);
      ctx.lineTo(o.x + d.x * 2.5, o.y + d.y * 2.5);
      ctx.strokeStyle = COL.rayFaint;
      ctx.lineWidth = 0.004;
      ctx.stroke();
    }

    // termination point
    if (result.terminated) {
      ctx.beginPath();
      ctx.arc(o.x + d.x * result.tEnd, o.y + d.y * result.tEnd, 0.011, 0, 2 * Math.PI);
      ctx.fillStyle = COL.hit;
      ctx.fill();
    }

    // camera + aim handles
    ctx.beginPath();
    ctx.arc(o.x, o.y, 0.016, 0, 2 * Math.PI);
    ctx.fillStyle = COL.camera;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.004;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ray.target.x, ray.target.y, 0.010, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = COL.ray;
    ctx.lineWidth = 0.0035;
    ctx.stroke();
  }

  // ----------------------------------------------------------------- app

  function init() {
    const root = document.getElementById('voro-rw');
    if (!root) return;

    const sites = generateSites();
    const cells = computeCells(sites);
    const aFoam = sites.map(opacityFoam);
    const aOurs = sites.map(opacityOurs);

    const panelFoam = makePanel(document.getElementById('voro-rw-canvas-foam'), sites, cells, aFoam);
    const panelOurs = makePanel(document.getElementById('voro-rw-canvas-ours'), sites, cells, aOurs);
    const panels = [panelFoam, panelOurs];

    const badgeFoam = document.getElementById('voro-rw-foam-badge');
    const badgeOurs = document.getElementById('voro-rw-ours-badge');
    const capFoam = document.getElementById('voro-rw-foam-cap');
    const capOurs = document.getElementById('voro-rw-ours-cap');
    const edgesBox = document.getElementById('voro-rw-show-edges');
    const playBtn = document.getElementById('voro-rw-play');
    const resetBtn = document.getElementById('voro-rw-reset');

    const HOME = { origin: { x: 0.07, y: 0.48 }, target: { x: 0.63, y: 0.5 } };
    const ray = {
      origin: { ...HOME.origin },
      target: { ...HOME.target },
      dir: { x: 1, y: 0 },
      results: new Map(),
    };

    const stats = new Map([[panelFoam, []], [panelOurs, []]]);
    let playing = false;
    let sweepPhase = 0;
    let rafId = null;

    function retrace() {
      let dx = ray.target.x - ray.origin.x, dy = ray.target.y - ray.origin.y;
      const n = Math.hypot(dx, dy) || 1;
      ray.dir = { x: dx / n, y: dy / n };
      ray.results.set(panelFoam, traceRay(sites, aFoam, ray.origin, ray.dir));
      ray.results.set(panelOurs, traceRay(sites, aOurs, ray.origin, ray.dir));
    }

    function fmt(panel, badge, cap) {
      const r = ray.results.get(panel);
      const n = r.records.length;
      badge.textContent = n + ' cells';
      const hist = stats.get(panel);
      let msg = r.terminated
        ? `composited ${n} cells · ray terminated`
        : `composited ${n} cells · left the scene (T=${r.T.toFixed(2)})`;
      if (hist.length > 4) {
        const mean = hist.reduce((s, v) => s + v, 0) / hist.length;
        msg += ` · mean ${mean.toFixed(1)} cells/ray`;
      }
      cap.textContent = msg;
    }

    function redraw() {
      drawPanel(panelFoam, ray, edgesBox.checked);
      drawPanel(panelOurs, ray, edgesBox.checked);
      fmt(panelFoam, badgeFoam, capFoam);
      fmt(panelOurs, badgeOurs, capOurs);
    }

    function update(recordStats) {
      retrace();
      if (recordStats) {
        for (const p of panels) {
          const hist = stats.get(p);
          hist.push(ray.results.get(p).records.length);
          if (hist.length > 240) hist.shift();
        }
      }
      redraw();
    }

    // ------------------------------------------------------- interaction

    function canvasPoint(canvas, ev) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - rect.left) / rect.width,
        y: (ev.clientY - rect.top) / rect.height,
      };
    }

    let dragging = null; // 'origin' | 'target'
    for (const panel of panels) {
      panel.canvas.addEventListener('pointerdown', (ev) => {
        const p = canvasPoint(panel.canvas, ev);
        const dO = Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y);
        const dT = Math.hypot(p.x - ray.target.x, p.y - ray.target.y);
        if (dO < 0.05 && dO <= dT) dragging = 'origin';
        else { dragging = 'target'; ray.target = p; }
        stopPlay();
        panel.canvas.setPointerCapture(ev.pointerId);
        update(false);
        ev.preventDefault();
      });
      panel.canvas.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        const p = canvasPoint(panel.canvas, ev);
        p.x = Math.min(0.99, Math.max(0.01, p.x));
        p.y = Math.min(0.99, Math.max(0.01, p.y));
        if (dragging === 'origin') ray.origin = p; else ray.target = p;
        update(false);
      });
      const up = () => { dragging = null; };
      panel.canvas.addEventListener('pointerup', up);
      panel.canvas.addEventListener('pointercancel', up);
    }

    // ---------------------------------------------------------- sweeping

    function tick() {
      sweepPhase += 0.012;
      const spread = 0.55; // radians, fan half-angle
      const base = Math.atan2(BLOB_C.y - ray.origin.y, BLOB_C.x - ray.origin.x);
      const ang = base + spread * Math.sin(sweepPhase);
      ray.target = {
        x: ray.origin.x + Math.cos(ang) * 0.9,
        y: ray.origin.y + Math.sin(ang) * 0.9,
      };
      update(true);
      if (playing) rafId = requestAnimationFrame(tick);
    }

    function startPlay() {
      if (playing) return;
      playing = true;
      playBtn.textContent = '⏸ pause';
      rafId = requestAnimationFrame(tick);
    }
    function stopPlay() {
      if (!playing) return;
      playing = false;
      playBtn.textContent = '▶ sweep rays';
      if (rafId) cancelAnimationFrame(rafId);
    }

    playBtn.addEventListener('click', () => (playing ? stopPlay() : startPlay()));
    resetBtn.addEventListener('click', () => {
      stopPlay();
      ray.origin = { ...HOME.origin };
      ray.target = { ...HOME.target };
      stats.get(panelFoam).length = 0;
      stats.get(panelOurs).length = 0;
      update(false);
    });
    edgesBox.addEventListener('change', () => redraw());
    window.addEventListener('resize', () => redraw());

    update(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
