(function () {
  const root = document.getElementById('paragram-2d');
  if (!root) return;

  const panelDefs = [
    { mode: 'knn', canvas: 'paragram-2d-canvas-knn', cap: 'paragram-2d-knn-cap', badge: 'paragram-2d-knn-badge' },
    { mode: 'iso', canvas: 'paragram-2d-canvas-iso', cap: 'paragram-2d-iso-cap', badge: 'paragram-2d-iso-badge' },
    { mode: 'dir', canvas: 'paragram-2d-canvas-dir', cap: 'paragram-2d-dir-cap', badge: 'paragram-2d-dir-badge' },
  ];
  const panels = panelDefs.map(d => ({
    mode: d.mode,
    canvas: document.getElementById(d.canvas),
    cap: document.getElementById(d.cap),
    badge: d.badge ? document.getElementById(d.badge) : null,
  }));
  if (panels.some(p => !p.canvas)) return;
  panels.forEach(p => { p.ctx = p.canvas.getContext('2d'); });

  const kSlider = document.getElementById('paragram-2d-k');
  const kVal = document.getElementById('paragram-2d-k-val');
  const showBisEl = document.getElementById('paragram-2d-show-bisectors');
  const resetBtn = document.getElementById('paragram-2d-reset');
  const tabEls = root.querySelectorAll('.paragram-2d__tab');
  const playBtn = document.getElementById('paragram-2d-play');
  const stepSlider = document.getElementById('paragram-2d-step');
  const stepLabel = document.getElementById('paragram-2d-step-val');

  // Animation state.
  let animStep = 0;          // number of clips applied so far
  let animPlaying = false;
  let animLastTime = 0;
  const ANIM_STEP_MS = 280;

  // Square world to match square panels.
  const WORLD_HALF = 8;
  const BOUND_HALF = 7.6;

  // ---------- curated point sets (site at origin for all) ----------
  // Each set is engineered so the cell is asymmetric — the regime where
  // directional culling beats isotropic. The directional bound is tight in the
  // octants where the cell barely extends and loose in the octants where it
  // stretches far; isotropic uses the loosest direction's bound everywhere.
  const distributions = {
    // Cell is a kite with the site at the lower-left corner: tight in --,
    // loose in ++. Dir admit collapses in the -- octant while iso stays loose
    // — every -- filler reads as iso-admit / dir-reject. Hand-tuned positions.
    anisotropic: [
      { x: -0.50, y:  0.00 },
      { x:  0.22, y: -1.23 },
      { x:  6.56, y:  2.64 },
      { x:  1.97, y:  4.34 },
      { x: -1.64, y: -0.87 },
      { x: -0.46, y: -1.69 },
      { x: -1.12, y: -1.33 },
      { x: -1.17, y: -2.15 },
      { x: -2.15, y: -0.50 },
      { x: -0.67, y: -2.52 },
      { x: -2.00, y: -2.00 },
      { x: -3.97, y: -1.28 },
      { x: -0.77, y: -3.49 },
      { x: -2.27, y: -4.11 },
      { x: -5.15, y: -0.92 },
      { x: -6.08, y: -7.05 },
      { x: -3.50, y: -3.50 },
      { x: -6.19, y: -2.88 },
      { x: -3.30, y: -5.71 },
      { x: -2.63, y: -1.07 },
      { x:  1.00, y: -4.00 },
      { x:  7.54, y: -3.34 },
      { x: -4.00, y:  1.00 },
      { x: -0.66, y:  1.66 },
    ],
    // Elongated cell — site sits at the edge of a sparse region; the cell
    // stretches into the gap. Hand-tuned positions.
    elongated: [
      { x:  4.90, y: -5.12 },
      { x:  2.58, y: -2.59 },
      { x:  1.96, y:  2.15 },
      { x:  6.75, y: -0.79 },
      { x:  1.03, y: -1.82 },
      { x:  1.55, y:  3.90 },
      { x:  0.05, y: -4.14 },
      { x:  5.62, y:  4.73 },
      { x:  3.56, y: -1.05 },
      { x:  1.34, y: -3.78 },
      { x:  2.11, y: -6.36 },
      { x: -7.32, y: -4.91 },
      { x:  2.27, y:  0.04 },
      { x:  3.40, y: -3.42 },
      { x: -1.34, y:  2.30 },
      { x:  3.35, y:  2.97 },
      { x: -1.03, y:  3.64 },
      { x:  4.23, y:  3.44 },
      { x: -7.22, y: -7.28 },
      { x: -6.19, y:  5.96 },
      { x: -2.06, y:  5.76 },
      { x: -4.12, y:  5.40 },
      { x: -5.41, y:  3.70 },
      { x: -3.35, y:  3.64 },
    ],
    // Surface — points form a thick band of "matter" with empty space on one
    // side. The site sits inside the band; its cell stretches outward into the
    // void. Models a typical neural-rendering case where a site lies near a
    // surface in the scene. Hand-tuned positions.
    surface: [
      { x: -1.29, y:  0.17 },
      { x: -0.05, y: -0.87 },
      { x: -0.57, y:  1.40 },
      { x:  5.10, y:  0.37 },
      { x: -0.87, y: -1.87 },
      { x: -1.91, y: -0.97 },
      { x: -0.67, y: -3.34 },
      { x: -3.45, y: -1.38 },
      { x: -0.62, y: -4.89 },
      { x: -1.75, y: -2.93 },
      { x: -2.16, y: -4.63 },
      { x: -4.74, y: -1.17 },
      { x: -3.61, y: -3.13 },
      { x:  3.04, y: -4.68 },
      { x: -2.16, y:  1.40 },
      { x: -3.14, y:  2.59 },
      { x: -0.77, y:  2.64 },
      { x: -3.66, y:  0.42 },
      { x: -2.22, y:  4.96 },
      { x: -0.82, y:  4.50 },
      { x: -5.00, y:  4.86 },
      { x: -4.18, y:  2.64 },
      { x: -0.88, y: -6.85 },
      { x: -2.32, y:  3.57 },
    ],
  };

  let currentDist = 'anisotropic';

  function loadDistribution(name) {
    currentDist = name;
    state.site = { x: 0, y: 0 };
    // Deep-copy so dragging mutates a fresh array, not the source-of-truth above.
    state.neighbors = distributions[name].map(p => ({ x: p.x, y: p.y }));
    tabEls.forEach(t => t.classList.toggle('is-active', t.dataset.dist === name));
    setPlaying(false);
    animStep = state.neighbors.length; // start at the final state
    refreshKSlider();
    refreshStepSlider();
  }

  let state = { site: { x: 0, y: 0 }, neighbors: [] };
  let dragging = null; // { kind, idx, panel }

  // ---------- math ----------
  function bisectorPlane(pi, pj) {
    const dx = pj.x - pi.x, dy = pj.y - pi.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) return null;
    const L = Math.sqrt(L2);
    const d = L * 0.5; // unweighted: bisector is the perpendicular at the midpoint
    const nx = dx / L, ny = dy / L;
    return { px: pi.x + d * nx, py: pi.y + d * ny, nx, ny };
  }

  // Sutherland–Hodgman clip with per-edge labels. labels[i] is the label of the edge
  // from poly[i] to poly[i+1]. Edges introduced by this clip get `newLabel`; kept
  // portions of original edges retain their existing label. Keeps half-plane (v-p)·n >= 0.
  const BB_LABEL = -1;
  function clipHalfPlaneLabeled(verts, labels, px, py, nx, ny, newLabel) {
    const n = verts.length;
    if (n === 0) return { verts: [], labels: [] };
    const outV = [];
    const outL = [];
    const sd = verts.map(v => (v.x - px) * nx + (v.y - py) * ny);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = verts[i], b = verts[j];
      const aIn = sd[i] >= -1e-9;
      const bIn = sd[j] >= -1e-9;
      if (aIn && bIn) {
        outV.push(a); outL.push(labels[i]);
      } else if (aIn && !bIn) {
        // Exiting: emit a (start of original edge i, kept portion → labels[i]),
        // then the exit-intersection (next edge will be the new cut → newLabel).
        outV.push(a); outL.push(labels[i]);
        const t = sd[i] / (sd[i] - sd[j]);
        outV.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        outL.push(newLabel);
      } else if (!aIn && bIn) {
        // Entering: emit only the entry-intersection. The edge from this point to
        // the next emitted vertex is the kept portion of original edge i.
        const t = sd[i] / (sd[i] - sd[j]);
        outV.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        outL.push(labels[i]);
      }
      // (!aIn && !bIn): edge entirely outside — skip.
    }
    return { verts: outV, labels: outL };
  }

  function initialSquare() {
    return {
      verts: [
        { x: -BOUND_HALF, y: -BOUND_HALF },
        { x: BOUND_HALF, y: -BOUND_HALF },
        { x: BOUND_HALF, y: BOUND_HALF },
        { x: -BOUND_HALF, y: BOUND_HALF },
      ],
      labels: [BB_LABEL, BB_LABEL, BB_LABEL, BB_LABEL],
    };
  }

  function buildCellFromIndices(site, neighbors, indices) {
    let { verts, labels } = initialSquare();
    for (const k of indices) {
      const plane = bisectorPlane(site, neighbors[k]);
      if (!plane) continue;
      ({ verts, labels } = clipHalfPlaneLabeled(
        verts, labels, plane.px, plane.py, -plane.nx, -plane.ny, k
      ));
      if (verts.length === 0) break;
    }
    const binding = new Array(neighbors.length).fill(false);
    for (const lbl of labels) if (lbl >= 0) binding[lbl] = true;
    return { poly: verts, binding };
  }

  function buildCell(site, neighbors) {
    const all = neighbors.map((_, i) => i);
    return buildCellFromIndices(site, neighbors, all);
  }

  function aabbOf(poly) {
    if (poly.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function isotropicRadius(poly, site) {
    let r = 0;
    for (const v of poly) {
      const d = Math.hypot(v.x - site.x, v.y - site.y);
      if (d > r) r = d;
    }
    return r;
  }

  function quadrantOf(vx, vy) {
    if (vx >= 0) return vy >= 0 ? 0 : 3;
    return vy >= 0 ? 1 : 2;
  }

  function directionalRadii(aabb, site) {
    if (!aabb) return [0, 0, 0, 0];
    const corners = [
      { x: aabb.maxX, y: aabb.maxY }, // ++
      { x: aabb.minX, y: aabb.maxY }, // -+
      { x: aabb.minX, y: aabb.minY }, // --
      { x: aabb.maxX, y: aabb.minY }, // +-
    ];
    return corners.map(c => Math.hypot(c.x - site.x, c.y - site.y));
  }

  function nearestKIndices(site, neighbors, k) {
    const ranked = neighbors.map((p, i) => ({
      i,
      d: (p.x - site.x) * (p.x - site.x) + (p.y - site.y) * (p.y - site.y),
    }));
    ranked.sort((a, b) => a.d - b.d);
    return ranked.slice(0, Math.min(k, ranked.length)).map(r => r.i);
  }

  // ---------- coordinates ----------
  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return dpr;
  }

  function w2s(canvas, x, y) {
    return {
      x: (x + WORLD_HALF) / (2 * WORLD_HALF) * canvas.width,
      y: (1 - (y + WORLD_HALF) / (2 * WORLD_HALF)) * canvas.height,
    };
  }
  function s2w(canvas, sx, sy) {
    return {
      x: sx / canvas.width * 2 * WORLD_HALF - WORLD_HALF,
      y: (1 - sy / canvas.height) * 2 * WORLD_HALF - WORLD_HALF,
    };
  }
  function wPx(canvas, d) {
    return d / (2 * WORLD_HALF) * canvas.width;
  }

  // ---------- color palette ----------
  const COLOR_BG_AXIS = '#e8e8e8';
  const COLOR_CELL_FILL = 'rgba(255, 165, 60, 0.50)';
  const COLOR_CELL_STROKE = 'rgba(200, 110, 20, 1)';
  const COLOR_KNN_FILL = 'rgba(255, 165, 60, 0.50)';
  const COLOR_TRUE_OUTLINE = 'rgba(60, 140, 70, 0.95)';
  const COLOR_ISO_FILL = 'rgba(220, 70, 70, 0.10)';
  const COLOR_ISO_STROKE = 'rgba(220, 70, 70, 0.80)';
  const COLOR_BISECTOR = 'rgba(60, 140, 70, 0.42)';
  const COLOR_AABB = 'rgba(120, 120, 120, 0.55)';
  const COLOR_SITE = '#d57000';
  const COLOR_BINDING = '#2e7036';   // green: a true contributing neighbor
  const COLOR_ADMITTED = '#c87030';  // orange: admitted by the bound but not contributing
  const COLOR_MISSED = '#cc3030';    // red: a true neighbor that the bound failed to admit
  const COLOR_DISCARDED = '#b8b8b8'; // gray: not admitted by the bound
  const COLOR_HIGHLIGHT = '#00bcd4'; // cyan: current step (candidate being evaluated)

  const QUADRANT_FILL = [
    'rgba(220,130,40,0.18)',
    'rgba(40,140,200,0.18)',
    'rgba(140,90,180,0.18)',
    'rgba(60,170,90,0.18)',
  ];
  const QUADRANT_STROKE = [
    'rgba(220,130,40,0.65)',
    'rgba(40,140,200,0.65)',
    'rgba(140,90,180,0.65)',
    'rgba(60,170,90,0.65)',
  ];

  // ---------- drawing primitives (panel-local) ----------
  function drawAxes(ctx, canvas, dpr) {
    ctx.strokeStyle = COLOR_BG_AXIS;
    ctx.lineWidth = 1 * dpr;
    const o = w2s(canvas, 0, 0);
    ctx.beginPath();
    ctx.moveTo(0, o.y); ctx.lineTo(canvas.width, o.y);
    ctx.moveTo(o.x, 0); ctx.lineTo(o.x, canvas.height);
    ctx.stroke();
  }

  function drawPolygon(ctx, canvas, poly, fill, stroke, lineWidth) {
    if (poly.length < 3) return;
    ctx.beginPath();
    const s0 = w2s(canvas, poly[0].x, poly[0].y);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < poly.length; i++) {
      const s = w2s(canvas, poly[i].x, poly[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawDashedPolygonOutline(ctx, canvas, poly, stroke, dpr) {
    if (poly.length < 3) return;
    ctx.beginPath();
    const s0 = w2s(canvas, poly[0].x, poly[0].y);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < poly.length; i++) {
      const s = w2s(canvas, poly[i].x, poly[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCircle(ctx, canvas, cx, cy, rWorld, fill, stroke, dpr, dashed) {
    const c = w2s(canvas, cx, cy);
    ctx.beginPath();
    ctx.arc(c.x, c.y, wPx(canvas, rWorld), 0, 2 * Math.PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5 * dpr;
      if (dashed) ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawQuadrantWedge(ctx, canvas, site, radius, qIdx, dpr) {
    if (radius < 1e-6) return;
    const angles = [
      [0, Math.PI / 2],
      [Math.PI / 2, Math.PI],
      [Math.PI, 3 * Math.PI / 2],
      [3 * Math.PI / 2, 2 * Math.PI],
    ][qIdx];
    const N = 28;
    ctx.beginPath();
    const sCenter = w2s(canvas, site.x, site.y);
    ctx.moveTo(sCenter.x, sCenter.y);
    for (let i = 0; i <= N; i++) {
      const a = angles[0] + (angles[1] - angles[0]) * i / N;
      const wx = site.x + radius * Math.cos(a);
      const wy = site.y + radius * Math.sin(a);
      const s = w2s(canvas, wx, wy);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = QUADRANT_FILL[qIdx];
    ctx.fill();
    ctx.strokeStyle = QUADRANT_STROKE[qIdx];
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
  }

  function drawAabbBox(ctx, canvas, aabb, dpr) {
    const a = w2s(canvas, aabb.minX, aabb.minY);
    const b = w2s(canvas, aabb.maxX, aabb.maxY);
    ctx.strokeStyle = COLOR_AABB;
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.setLineDash([]);
  }

  function drawBisectorLine(ctx, canvas, plane, dpr) {
    const tx = -plane.ny, ty = plane.nx;
    const T = 30;
    const a = w2s(canvas, plane.px - T * tx, plane.py - T * ty);
    const b = w2s(canvas, plane.px + T * tx, plane.py + T * ty);
    ctx.strokeStyle = COLOR_BISECTOR;
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawNeighbor(ctx, canvas, p, color, dpr, ringStroke) {
    const s = w2s(canvas, p.x, p.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = ringStroke || '#fff';
    ctx.lineWidth = 1.4 * dpr;
    ctx.stroke();
  }

  function drawHighlightBisector(ctx, canvas, plane, dpr) {
    const tx = -plane.ny, ty = plane.nx;
    const T = 30;
    const a = w2s(canvas, plane.px - T * tx, plane.py - T * ty);
    const b = w2s(canvas, plane.px + T * tx, plane.py + T * ty);
    ctx.strokeStyle = COLOR_HIGHLIGHT;
    ctx.lineWidth = 2.2 * dpr;
    ctx.setLineDash([7 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHighlightNeighbor(ctx, canvas, p, dpr) {
    const s = w2s(canvas, p.x, p.y);
    // Outer glow halo.
    ctx.beginPath();
    ctx.arc(s.x, s.y, 12 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 188, 212, 0.28)';
    ctx.fill();
    // Solid cyan core.
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR_HIGHLIGHT;
    ctx.fill();
    ctx.strokeStyle = '#003e4a';
    ctx.lineWidth = 1.6 * dpr;
    ctx.stroke();
  }

  // Updates a panel's "done" badge: shows it green/red when the algorithm has
  // terminated, hides it while still in progress.
  function setBadge(badge, done, ok, text) {
    if (!badge) return;
    if (!done) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = '';
    badge.textContent = text;
    badge.className = 'paragram-2d__badge paragram-2d__badge--' + (ok ? 'ok' : 'bad');
  }

  function drawSite(ctx, canvas, site, dpr) {
    const s = w2s(canvas, site.x, site.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR_SITE;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  }

  // ---------- per-panel draw ----------
  function drawKnn(panel, ctx, info, truth) {
    const dpr = resizeCanvas(panel.canvas);
    ctx.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
    drawAxes(ctx, panel.canvas, dpr);

    const N = state.neighbors.length;
    const { order, doneStep } = info;
    const knnSet = new Set(order);
    const k = Math.min(animStep, doneStep);
    const partialKnnIdx = order.slice(0, k);
    const knnRes = buildCellFromIndices(state.site, state.neighbors, partialKnnIdx);

    // KNN is correct iff every truly binding neighbor is in the K-nearest set.
    const missedBinding = [];
    for (let i = 0; i < N; i++) {
      if (truth.binding[i] && !knnSet.has(i)) missedBinding.push(i);
    }
    const correct = missedBinding.length === 0;

    drawPolygon(ctx, panel.canvas, knnRes.poly, COLOR_KNN_FILL, COLOR_CELL_STROKE, 2 * dpr);
    if (!correct && k >= doneStep) {
      drawDashedPolygonOutline(ctx, panel.canvas, truth.poly, COLOR_TRUE_OUTLINE, dpr);
    }

    if (showBisEl.checked) {
      for (let i = 0; i < N; i++) {
        if (!truth.binding[i]) continue;
        const plane = bisectorPlane(state.site, state.neighbors[i]);
        if (plane) drawBisectorLine(ctx, panel.canvas, plane, dpr);
      }
    }

    for (let i = 0; i < N; i++) {
      const inK = knnSet.has(i);
      const isBind = truth.binding[i];
      let color;
      if (isBind && !inK) color = COLOR_MISSED;
      else if (isBind) color = COLOR_BINDING;
      else if (inK) color = COLOR_ADMITTED;
      else color = COLOR_DISCARDED;
      drawNeighbor(ctx, panel.canvas, state.neighbors[i], color, dpr);
    }

    // Highlight the candidate just evaluated (and its bisector). Effective step
    // is capped at doneStep so the highlight stays on the last clip even when
    // the global slider scrubs further.
    const effective = Math.min(animStep, doneStep);
    if (effective > 0) {
      const currentIdx = order[effective - 1];
      const cp = state.neighbors[currentIdx];
      const cplane = bisectorPlane(state.site, cp);
      if (cplane) drawHighlightBisector(ctx, panel.canvas, cplane, dpr);
      drawHighlightNeighbor(ctx, panel.canvas, cp, dpr);
    }

    drawSite(ctx, panel.canvas, state.site, dpr);

    const done = animStep >= doneStep;
    setBadge(panel.badge, done, correct,
      correct
        ? `✓ done in ${doneStep} steps`
        : `✗ ${doneStep} steps · missed ${missedBinding.length}`);
    panel.cap.textContent = '';
  }

  function drawIso(panel, ctx, info, truth) {
    const dpr = resizeCanvas(panel.canvas);
    ctx.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
    drawAxes(ctx, panel.canvas, dpr);

    const N = state.neighbors.length;
    const { order, doneStep } = info;
    const k = Math.min(animStep, doneStep);
    const partialIdx = order.slice(0, k);
    const partial = buildCellFromIndices(state.site, state.neighbors, partialIdx);
    const isoR = isotropicRadius(partial.poly, state.site);
    // Admit test from the paper: discard if d_ij = ||p_j - p_i||/2 > r_i, so the
    // admit region is the disk of radius 2·r_i in unweighted Voronoi.
    const isoAdmit = 2 * isoR;

    drawCircle(ctx, panel.canvas, state.site.x, state.site.y, isoAdmit,
      COLOR_ISO_FILL, COLOR_ISO_STROKE, dpr, true);

    drawPolygon(ctx, panel.canvas, partial.poly, COLOR_CELL_FILL, COLOR_CELL_STROKE, 2 * dpr);

    if (showBisEl.checked) {
      for (let i = 0; i < N; i++) {
        if (!truth.binding[i]) continue;
        const plane = bisectorPlane(state.site, state.neighbors[i]);
        if (plane) drawBisectorLine(ctx, panel.canvas, plane, dpr);
      }
    }

    // Classify by the *current* (partial) bound. Binding determination uses the
    // final truth so already-clipped binders stay green throughout the animation.
    for (let i = 0; i < N; i++) {
      const p = state.neighbors[i];
      const dist = Math.hypot(p.x - state.site.x, p.y - state.site.y);
      const inIso = dist <= isoAdmit + 1e-6;
      const isBind = truth.binding[i];
      let color;
      if (isBind) color = COLOR_BINDING;
      else if (inIso) color = COLOR_ADMITTED;
      else color = COLOR_DISCARDED;
      drawNeighbor(ctx, panel.canvas, p, color, dpr);
    }

    const effectiveIso = Math.min(animStep, doneStep);
    if (effectiveIso > 0) {
      const currentIdx = order[effectiveIso - 1];
      const cp = state.neighbors[currentIdx];
      const cplane = bisectorPlane(state.site, cp);
      if (cplane) drawHighlightBisector(ctx, panel.canvas, cplane, dpr);
      drawHighlightNeighbor(ctx, panel.canvas, cp, dpr);
    }

    drawSite(ctx, panel.canvas, state.site, dpr);

    setBadge(panel.badge, animStep >= doneStep, true, `✓ done in ${doneStep} steps`);
    panel.cap.textContent = '';
  }

  function drawDir(panel, ctx, info, truth) {
    const dpr = resizeCanvas(panel.canvas);
    ctx.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
    drawAxes(ctx, panel.canvas, dpr);

    const N = state.neighbors.length;
    const { order, doneStep } = info;
    const k = Math.min(animStep, doneStep);
    const partialIdx = order.slice(0, k);
    const partial = buildCellFromIndices(state.site, state.neighbors, partialIdx);
    const aabb = aabbOf(partial.poly);
    const dirR = directionalRadii(aabb, state.site);
    const dirAdmit = dirR.map(r => 2 * r);

    for (let q = 0; q < 4; q++) drawQuadrantWedge(ctx, panel.canvas, state.site, dirAdmit[q], q, dpr);
    if (aabb) drawAabbBox(ctx, panel.canvas, aabb, dpr);

    drawPolygon(ctx, panel.canvas, partial.poly, COLOR_CELL_FILL, COLOR_CELL_STROKE, 2 * dpr);

    if (showBisEl.checked) {
      for (let i = 0; i < N; i++) {
        if (!truth.binding[i]) continue;
        const plane = bisectorPlane(state.site, state.neighbors[i]);
        if (plane) drawBisectorLine(ctx, panel.canvas, plane, dpr);
      }
    }

    for (let i = 0; i < N; i++) {
      const p = state.neighbors[i];
      const dx = p.x - state.site.x, dy = p.y - state.site.y;
      const dist = Math.hypot(dx, dy);
      const q = quadrantOf(dx, dy);
      const inDir = dist <= dirAdmit[q] + 1e-6;
      const isBind = truth.binding[i];
      let color;
      if (isBind) color = COLOR_BINDING;
      else if (inDir) color = COLOR_ADMITTED;
      else color = COLOR_DISCARDED;
      drawNeighbor(ctx, panel.canvas, p, color, dpr);
    }

    const effectiveDir = Math.min(animStep, doneStep);
    if (effectiveDir > 0) {
      const currentIdx = order[effectiveDir - 1];
      const cp = state.neighbors[currentIdx];
      const cplane = bisectorPlane(state.site, cp);
      if (cplane) drawHighlightBisector(ctx, panel.canvas, cplane, dpr);
      drawHighlightNeighbor(ctx, panel.canvas, cp, dpr);
    }

    drawSite(ctx, panel.canvas, state.site, dpr);

    setBadge(panel.badge, animStep >= doneStep, true, `✓ done in ${doneStep} steps`);
    panel.cap.textContent = '';
  }

  function nearestSortedIndices(site, neighbors) {
    return neighbors
      .map((p, i) => ({ i, d: (p.x - site.x) * (p.x - site.x) + (p.y - site.y) * (p.y - site.y) }))
      .sort((a, b) => a.d - b.d)
      .map(r => r.i);
  }

  // Returns { order, doneStep } — the actual sequence of clips this strategy
  // would perform, plus the step at which it terminates.
  //
  //   'iso'  — clip nearest-first (Euclidean distance from site). Stop when the
  //            next candidate fails the iso admit test on the current cell.
  //   'dir'  — best-first by signed distance to directional bound: priority =
  //            d_ij - r_dir[Q(p_j)]; the most-negative priority comes first
  //            (bisector deepest inside the cell). Recomputed every step as the
  //            cell shrinks. Stop when no candidate has priority < 0.
  //   'knn'  — fixed budget of K nearest, in nearest-first order. Always K steps.
  function processOrder(kind, sortedIdx) {
    const N = sortedIdx.length;

    if (kind === 'iso') {
      let cell = initialSquare();
      const order = [];
      for (let k = 0; k < N; k++) {
        const idx = sortedIdx[k];
        const p = state.neighbors[idx];
        const dx = p.x - state.site.x, dy = p.y - state.site.y;
        const dist = Math.hypot(dx, dy);
        const admit = 2 * isotropicRadius(cell.verts, state.site);
        if (dist > admit + 1e-6) return { order, doneStep: order.length };
        order.push(idx);
        const plane = bisectorPlane(state.site, p);
        if (plane) {
          cell = clipHalfPlaneLabeled(
            cell.verts, cell.labels, plane.px, plane.py, -plane.nx, -plane.ny, idx
          );
        }
        if (cell.verts.length === 0) return { order, doneStep: order.length };
      }
      return { order, doneStep: order.length };
    }

    if (kind === 'dir') {
      let cell = initialSquare();
      const remaining = new Set(sortedIdx);
      const order = [];
      while (remaining.size > 0) {
        const aabb = aabbOf(cell.verts);
        const dirR = directionalRadii(aabb, state.site);
        let bestIdx = -1, bestPrio = Infinity;
        for (const idx of remaining) {
          const p = state.neighbors[idx];
          const dx = p.x - state.site.x, dy = p.y - state.site.y;
          const dij = Math.hypot(dx, dy) / 2;             // bisector distance from site
          const r = dirR[quadrantOf(dx, dy)];             // directional radius for that octant
          const prio = dij - r;                           // < 0 ⇒ admitted; smaller ⇒ deeper inside
          if (prio < bestPrio) { bestPrio = prio; bestIdx = idx; }
        }
        if (bestIdx < 0 || bestPrio > 1e-6) break;        // none admitted ⇒ terminate
        order.push(bestIdx);
        remaining.delete(bestIdx);
        const p = state.neighbors[bestIdx];
        const plane = bisectorPlane(state.site, p);
        if (plane) {
          cell = clipHalfPlaneLabeled(
            cell.verts, cell.labels, plane.px, plane.py, -plane.nx, -plane.ny, bestIdx
          );
        }
        if (cell.verts.length === 0) break;
      }
      return { order, doneStep: order.length };
    }

    // 'knn'
    const K = Math.min(parseInt(kSlider.value, 10), N);
    return { order: sortedIdx.slice(0, K), doneStep: K };
  }

  function drawAll() {
    const sortedIdx = nearestSortedIndices(state.site, state.neighbors);
    const truth = buildCell(state.site, state.neighbors);
    const isoInfo = processOrder('iso', sortedIdx);
    const dirInfo = processOrder('dir', sortedIdx);
    const knnInfo = processOrder('knn', sortedIdx);
    panels.forEach(p => {
      switch (p.mode) {
        case 'knn': drawKnn(p, p.ctx, knnInfo, truth); break;
        case 'iso': drawIso(p, p.ctx, isoInfo, truth); break;
        case 'dir': drawDir(p, p.ctx, dirInfo, truth); break;
      }
    });
  }

  // ---------- interaction ----------
  function eventToCanvas(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    return {
      sx: cx * (canvas.width / rect.width),
      sy: cy * (canvas.height / rect.height),
      cssRectWidth: rect.width,
    };
  }

  function pickAt(canvas, sx, sy, cssRectWidth) {
    const w = s2w(canvas, sx, sy);
    const hitR = 18 * (2 * WORLD_HALF) / Math.max(1, cssRectWidth);
    let best = null, bestDist = hitR;
    const sd = Math.hypot(w.x - state.site.x, w.y - state.site.y);
    if (sd < bestDist) { best = { kind: 'site' }; bestDist = sd; }
    for (let k = 0; k < state.neighbors.length; k++) {
      const p = state.neighbors[k];
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      if (d < bestDist) { best = { kind: 'neighbor', idx: k }; bestDist = d; }
    }
    return best;
  }

  function startDrag(panel, ev) {
    const { sx, sy, cssRectWidth } = eventToCanvas(panel.canvas, ev);
    const hit = pickAt(panel.canvas, sx, sy, cssRectWidth);
    if (!hit) return;
    ev.preventDefault();
    dragging = { ...hit, panel };
  }
  function moveDrag(ev) {
    if (!dragging) return;
    ev.preventDefault();
    const { sx, sy } = eventToCanvas(dragging.panel.canvas, ev);
    const w = s2w(dragging.panel.canvas, sx, sy);
    const cx = Math.max(-WORLD_HALF + 0.2, Math.min(WORLD_HALF - 0.2, w.x));
    const cy = Math.max(-WORLD_HALF + 0.2, Math.min(WORLD_HALF - 0.2, w.y));
    if (dragging.kind === 'site') {
      state.site.x = cx; state.site.y = cy;
    } else {
      state.neighbors[dragging.idx].x = cx;
      state.neighbors[dragging.idx].y = cy;
    }
    drawAll();
  }
  function endDrag() { dragging = null; }

  panels.forEach(panel => {
    panel.canvas.addEventListener('mousedown', (ev) => startDrag(panel, ev));
    panel.canvas.addEventListener('touchstart', (ev) => startDrag(panel, ev), { passive: false });
  });
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchmove', (ev) => {
    if (!dragging) return;
    moveDrag(ev);
  }, { passive: false });
  window.addEventListener('touchend', endDrag);

  // ---------- controls ----------
  function refreshKSlider() {
    const N = state.neighbors.length;
    kSlider.max = String(N);
    if (parseInt(kSlider.value, 10) > N) kSlider.value = String(N);
    kVal.textContent = kSlider.value;
  }

  function refreshStepSlider() {
    const N = state.neighbors.length;
    stepSlider.max = String(N);
    if (animStep > N) animStep = N;
    if (animStep < 0) animStep = 0;
    stepSlider.value = String(animStep);
    stepLabel.textContent = `step ${animStep} / ${N}`;
  }

  function setPlaying(p) {
    animPlaying = p;
    playBtn.textContent = p ? '⏸ pause' : '▶ play';
    animLastTime = performance.now();
  }

  kSlider.addEventListener('input', () => {
    kVal.textContent = kSlider.value;
    drawAll();
  });
  showBisEl.addEventListener('change', drawAll);

  stepSlider.addEventListener('input', () => {
    setPlaying(false);
    animStep = parseInt(stepSlider.value, 10);
    stepLabel.textContent = `step ${animStep} / ${state.neighbors.length}`;
    drawAll();
  });

  playBtn.addEventListener('click', () => {
    if (animPlaying) { setPlaying(false); return; }
    // If we're already at the end, restart from 0 so play feels like a "play again".
    if (animStep >= state.neighbors.length) animStep = 0;
    setPlaying(true);
  });

  tabEls.forEach(tab => {
    tab.addEventListener('click', () => {
      loadDistribution(tab.dataset.dist);
      drawAll();
    });
  });
  resetBtn.addEventListener('click', () => {
    // Re-load the current distribution to undo any dragging.
    loadDistribution(currentDist);
    drawAll();
  });

  // rAF loop drives the animation. We always rAF (not conditional) so that
  // performance.now() based timing stays accurate across pauses.
  function tick(now) {
    requestAnimationFrame(tick);
    if (!animPlaying) return;
    if (now - animLastTime < ANIM_STEP_MS) return;
    animLastTime = now;
    const N = state.neighbors.length;
    animStep += 1;
    if (animStep >= N) {
      animStep = N;
      setPlaying(false);
    }
    stepSlider.value = String(animStep);
    stepLabel.textContent = `step ${animStep} / ${N}`;
    drawAll();
  }
  requestAnimationFrame(tick);

  // ---------- init ----------
  loadDistribution('anisotropic');
  const ro = new ResizeObserver(() => drawAll());
  panels.forEach(p => ro.observe(p.canvas));
  window.addEventListener('resize', drawAll);
  drawAll();
})();
