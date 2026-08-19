/*
 * VoroTracing — interactive octahedral appearance lookup.
 *
 * Left panel: the sphere of directions with the unit octahedron inscribed.
 * A draggable arrow picks the direction d from the cell site to the ray hit
 * point; its l1-normalisation q lands on one octahedron face.
 * Right panel: the octahedron unfolded into the square texture domain. The
 * same direction appears as a (u,v) point; the 2x2 bilinear footprint and the
 * sampled colour update live. Both panels are draggable and stay in sync.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------ vec utils

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a) => {
    const n = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / n, a[1] / n, a[2] / n];
  };
  const sgn = (x) => (x >= 0 ? 1 : -1);

  // ------------------------------------------------- octahedral mapping

  // forward: unit direction -> (u,v) in [-1,1]^2  (paper eq. in sec. 5.1)
  function octEncode(d) {
    const l1 = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]);
    const qx = d[0] / l1, qy = d[1] / l1;
    if (d[2] >= 0) return [qx, qy];
    return [(1 - Math.abs(qy)) * sgn(qx), (1 - Math.abs(qx)) * sgn(qy)];
  }

  // inverse: (u,v) -> unit direction
  function octDecode(u, v) {
    const z = 1 - Math.abs(u) - Math.abs(v);
    let x = u, y = v;
    if (z < 0) {
      x = (1 - Math.abs(v)) * sgn(u);
      y = (1 - Math.abs(u)) * sgn(v);
    }
    return norm([x, y, z]);
  }

  // l1-normalisation onto the octahedron surface
  function l1Project(d) {
    const l1 = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) || 1;
    return [d[0] / l1, d[1] / l1, d[2] / l1];
  }

  // ------------------------------------------------------------- palette
  // One colour per octant, indexed by (sx, sy, sz) signs. Matches the paper
  // figure's colour-coding of the eight faces.

  const OCT_COLORS = {
    '+++': [214, 96, 77],   // red        (the paper's highlighted octant)
    '-++': [244, 165, 130],
    '+-+': [146, 197, 222],
    '--+': [67, 147, 195],
    '++-': [178, 148, 202],
    '-+-': [216, 179, 101],
    '+--': [127, 191, 123],
    '---': [175, 141, 120],
  };
  function octantKey(d) {
    return (d[0] >= 0 ? '+' : '-') + (d[1] >= 0 ? '+' : '-') + (d[2] >= 0 ? '+' : '-');
  }
  function octantColor(d, alpha) {
    const c = OCT_COLORS[octantKey(d)];
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  // ------------------------------------------------------------- texture

  function texelColor(dir, mode, ix, iy) {
    if (mode === 'octant') return OCT_COLORS[octantKey(dir)].slice();
    if (mode === 'checker') return (ix + iy) % 2 ? [235, 235, 235] : [90, 100, 115];
    // smooth gradient over the sphere — shows seam-free continuity
    return [
      Math.round(128 + 110 * dir[0]),
      Math.round(128 + 110 * dir[1]),
      Math.round(128 + 110 * dir[2]),
    ];
  }

  function buildTexture(R, mode) {
    // texels[iy*R+ix], iy from v=-1 upward, ix from u=-1 rightward
    const texels = new Array(R * R);
    for (let iy = 0; iy < R; iy++) {
      for (let ix = 0; ix < R; ix++) {
        const u = -1 + (2 * (ix + 0.5)) / R;
        const v = -1 + (2 * (iy + 0.5)) / R;
        texels[iy * R + ix] = texelColor(octDecode(u, v), mode, ix, iy);
      }
    }
    return texels;
  }

  function bilinearSample(texels, R, u, v) {
    const sx = ((u + 1) / 2) * R - 0.5;
    const sy = ((v + 1) / 2) * R - 0.5;
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const fx = sx - x0, fy = sy - y0;
    const cl = (i) => Math.min(R - 1, Math.max(0, i));
    const taps = [
      { ix: cl(x0), iy: cl(y0), w: (1 - fx) * (1 - fy) },
      { ix: cl(x0 + 1), iy: cl(y0), w: fx * (1 - fy) },
      { ix: cl(x0), iy: cl(y0 + 1), w: (1 - fx) * fy },
      { ix: cl(x0 + 1), iy: cl(y0 + 1), w: fx * fy },
    ];
    const rgb = [0, 0, 0];
    for (const t of taps) {
      const c = texels[t.iy * R + t.ix];
      rgb[0] += c[0] * t.w; rgb[1] += c[1] * t.w; rgb[2] += c[2] * t.w;
    }
    return { rgb: rgb.map(Math.round), taps };
  }

  // ------------------------------------------------------------ 3D panel

  // 8 faces as vertex triples, one per octant
  const OCT_FACES = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    OCT_FACES.push({
      verts: [[sx, 0, 0], [0, sy, 0], [0, 0, sz]],
      center: [sx / 3, sy / 3, sz / 3],
    });
  }

  function makeCamera() {
    return { az: -0.55, el: 0.42 };
  }
  function cameraBasis(cam) {
    const ca = Math.cos(cam.az), sa = Math.sin(cam.az);
    const ce = Math.cos(cam.el), se = Math.sin(cam.el);
    const f = [ce * ca, ce * sa, se];          // toward the camera
    const r = [-sa, ca, 0];                    // screen right
    const u = [-se * ca, -se * sa, ce];        // screen up
    return { f, r, u };
  }

  function drawSpherePanel(panel, cam, dir, trail) {
    const { canvas, ctx } = panel;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width * dpr));
    if (canvas.width !== W) { canvas.width = W; canvas.height = W; }
    const S = W * 0.40;               // world unit -> px
    const cx = W / 2, cy = W / 2;
    const { f, r, u } = cameraBasis(cam);
    const proj = (p) => [cx + S * dot(p, r), cy - S * dot(p, u), dot(p, f)];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.lineJoin = 'round';

    // sphere disc + rim
    const grad = ctx.createRadialGradient(cx - S * 0.3, cy - S * 0.3, S * 0.1, cx, cy, S);
    grad.addColorStop(0, 'rgba(247, 246, 243, 0.95)');
    grad.addColorStop(1, 'rgba(228, 224, 217, 0.95)');
    ctx.beginPath();
    ctx.arc(cx, cy, S, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();

    // axes
    ctx.font = `${11 * dpr}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (const [axis, label] of [[[1.28, 0, 0], 'x'], [[0, 1.28, 0], 'y'], [[0, 0, 1.28], 'z']]) {
      const o = proj([0, 0, 0]);
      const a = proj(axis);
      ctx.beginPath();
      ctx.moveTo(o[0], o[1]);
      ctx.lineTo(a[0], a[1]);
      ctx.strokeStyle = 'rgba(0,0,0,0.13)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      ctx.fillText(label, a[0] + 3 * dpr, a[1] - 3 * dpr);
    }

    // octahedron faces, far to near
    const faces = OCT_FACES.map((face) => ({
      face,
      depth: dot(face.center, f),
      pts: face.verts.map(proj),
    })).sort((a, b) => a.depth - b.depth);
    for (const { face, depth, pts } of faces) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = octantColor(face.center, depth > 0 ? 0.60 : 0.16);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${depth > 0 ? 0.9 : 0.35})`;
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
    }

    // equator (z = 0)
    ctx.beginPath();
    for (let k = 0; k <= 72; k++) {
      const t = (k / 72) * 2 * Math.PI;
      const p = proj([Math.cos(t), Math.sin(t), 0]);
      if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
    ctx.setLineDash([]);

    // direction trail on the sphere
    for (let i = 0; i < trail.length; i++) {
      const p = proj(trail[i]);
      const fade = (i + 1) / trail.length;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.6 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(239, 65, 54, ${0.35 * fade * (p[2] > 0 ? 1 : 0.25)})`;
      ctx.fill();
    }

    // l1 projection q on the octahedron + connector
    const q = l1Project(dir);
    const pd = proj(dir), pq = proj(q);
    const behind = pd[2] < 0;
    ctx.beginPath();
    ctx.moveTo(pd[0], pd[1]);
    ctx.lineTo(pq[0], pq[1]);
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.strokeStyle = `rgba(0,0,0,${behind ? 0.2 : 0.45})`;
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pq[0], pq[1], 4 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = octantColor(dir, behind ? 0.5 : 1);
    ctx.fill();
    ctx.strokeStyle = `rgba(0,0,0,${behind ? 0.25 : 0.6})`;
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // arrow from the site (center) to d on the sphere
    const o = proj([0, 0, 0]);
    ctx.beginPath();
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(pd[0], pd[1]);
    ctx.strokeStyle = `rgba(239, 65, 54, ${behind ? 0.45 : 1})`;
    ctx.lineWidth = 2.2 * dpr;
    ctx.stroke();
    // arrowhead
    const ang = Math.atan2(pd[1] - o[1], pd[0] - o[0]);
    ctx.beginPath();
    ctx.moveTo(pd[0], pd[1]);
    ctx.lineTo(pd[0] - 9 * dpr * Math.cos(ang - 0.42), pd[1] - 9 * dpr * Math.sin(ang - 0.42));
    ctx.lineTo(pd[0] - 9 * dpr * Math.cos(ang + 0.42), pd[1] - 9 * dpr * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fillStyle = `rgba(239, 65, 54, ${behind ? 0.45 : 1})`;
    ctx.fill();
    // draggable handle
    ctx.beginPath();
    ctx.arc(pd[0], pd[1], 6 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#EF4136';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    panel.S = S; panel.cx = cx; panel.cy = cy; panel.dpr = dpr;
  }

  // -------------------------------------------------------- texture panel

  function drawTexturePanel(panel, state, trail) {
    const { canvas, ctx } = panel;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width * dpr));
    if (canvas.width !== W) { canvas.width = W; canvas.height = W; }
    const pad = Math.round(W * 0.05);
    const T = W - 2 * pad;            // texture square in px
    const R = state.R;
    const toPx = (u, v) => [pad + ((u + 1) / 2) * T, pad + ((1 - v) / 2) * T];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);

    // texels via offscreen canvas (browser filtering approximates bilinear)
    if (!panel.off || panel.offR !== R) {
      panel.off = document.createElement('canvas');
      panel.off.width = R; panel.off.height = R;
      panel.offR = R;
    }
    const octx = panel.off.getContext('2d');
    const img = octx.createImageData(R, R);
    for (let row = 0; row < R; row++) {
      const iy = R - 1 - row;
      for (let ix = 0; ix < R; ix++) {
        const c = state.texels[iy * R + ix];
        const k = (row * R + ix) * 4;
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    // Nearest-neighbour, so the 8x8 texels stay legible as texels. The
    // renderer's actual fetch is bilinear, which the footprint below shows.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(panel.off, pad, pad, T, T);

    // texel grid
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1 * dpr;
    for (let k = 1; k < R; k++) {
      const t = pad + (k / R) * T;
      ctx.beginPath(); ctx.moveTo(t, pad); ctx.lineTo(t, pad + T); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, t); ctx.lineTo(pad + T, t); ctx.stroke();
    }

    // octant overlay: central diamond = upper hemisphere, corners = lower
    {
      const corners = { pp: toPx(1, 1), pm: toPx(1, -1), mp: toPx(-1, 1), mm: toPx(-1, -1) };
      const mid = { e: toPx(1, 0), w: toPx(-1, 0), n: toPx(0, 1), s: toPx(0, -1) };
      const c0 = toPx(0, 0);
      const tint = (pts, d) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = octantColor(d, 0.20);
        ctx.fill();
      };
      // upper octants (diamond quadrants)
      tint([c0, mid.e, mid.n], [1, 1, 1]);
      tint([c0, mid.n, mid.w], [-1, 1, 1]);
      tint([c0, mid.w, mid.s], [-1, -1, 1]);
      tint([c0, mid.s, mid.e], [1, -1, 1]);
      // lower octants (corner triangles)
      tint([mid.e, corners.pp, mid.n], [1, 1, -1]);
      tint([mid.n, corners.mp, mid.w], [-1, 1, -1]);
      tint([mid.w, corners.mm, mid.s], [-1, -1, -1]);
      tint([mid.s, corners.pm, mid.e], [1, -1, -1]);
      // seams
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.4 * dpr;
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(mid.e[0], mid.e[1]); ctx.lineTo(mid.n[0], mid.n[1]);
      ctx.lineTo(mid.w[0], mid.w[1]); ctx.lineTo(mid.s[0], mid.s[1]);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.moveTo(mid.w[0], mid.w[1]); ctx.lineTo(mid.e[0], mid.e[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mid.n[0], mid.n[1]); ctx.lineTo(mid.s[0], mid.s[1]); ctx.stroke();
    }

    // border
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.strokeRect(pad, pad, T, T);

    // uv trail
    for (let i = 0; i < trail.length; i++) {
      const [u, v] = octEncode(trail[i]);
      const p = toPx(u, v);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.6 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(239, 65, 54, ${0.35 * ((i + 1) / trail.length)})`;
      ctx.fill();
    }

    // bilinear footprint
    const [u, v] = octEncode(state.dir);
    const { taps, rgb } = bilinearSample(state.texels, R, u, v);
    for (const t of taps) {
      const x = pad + (t.ix / R) * T;
      const y = pad + ((R - 1 - t.iy) / R) * T;
      ctx.strokeStyle = `rgba(239, 65, 54, ${0.2 + 0.8 * t.w})`;
      ctx.lineWidth = (1 + 2 * t.w) * dpr;
      ctx.strokeRect(x, y, T / R, T / R);
    }

    // marker — filled with the colour it samples, so the lookup result is
    // readable straight off the texture rather than only in the swatch below
    const p = toPx(u, v);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 11 * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3 * dpr;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p[0], p[1], 12.5 * dpr, 0, 2 * Math.PI);
    ctx.strokeStyle = '#EF4136';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    panel.pad = pad; panel.T = T; panel.dpr = dpr;
  }

  // ----------------------------------------------------------------- app

  function init() {
    const root = document.getElementById('voro-oct');
    if (!root) return;

    const spherePanel = {
      canvas: document.getElementById('voro-oct-canvas-sphere'),
      ctx: document.getElementById('voro-oct-canvas-sphere').getContext('2d'),
    };
    const texPanel = {
      canvas: document.getElementById('voro-oct-canvas-tex'),
      ctx: document.getElementById('voro-oct-canvas-tex').getContext('2d'),
    };
    const capSphere = document.getElementById('voro-oct-sphere-cap');
    const capTex = document.getElementById('voro-oct-tex-cap');
    const swatch = document.getElementById('voro-oct-swatch');
    const texSel = document.getElementById('voro-oct-texmode');
    const playBtn = document.getElementById('voro-oct-play');
    const resetBtn = document.getElementById('voro-oct-reset');

    const HOME_DIR = norm([0.55, 0.45, 0.65]);
    const state = {
      dir: HOME_DIR.slice(),
      R: 8,            // fixed: the paper's texture size
      mode: 'octant',
      texels: null,
    };
    state.texels = buildTexture(state.R, state.mode);
    const cam = makeCamera();
    const trail = [];
    let playing = false;
    let phase = 0;
    let rafId = null;

    function pushTrail() {
      trail.push(state.dir.slice());
      if (trail.length > 130) trail.shift();
    }

    function redraw() {
      drawSpherePanel(spherePanel, cam, state.dir, trail);
      drawTexturePanel(texPanel, state, trail);
      const d = state.dir;
      const [u, v] = octEncode(d);
      const { rgb } = bilinearSample(state.texels, state.R, u, v);
      capSphere.textContent =
        `d = (${d[0].toFixed(2)}, ${d[1].toFixed(2)}, ${d[2].toFixed(2)}) · octant ${octantKey(d)}`;
      capTex.textContent =
        `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) at (u, v) = (${u.toFixed(2)}, ${v.toFixed(2)})`;
      swatch.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }

    // ------------------------------------------------ sphere interaction

    function spherePointFromEvent(ev) {
      const rect = spherePanel.canvas.getBoundingClientRect();
      const dpr = spherePanel.dpr || 1;
      const px = (ev.clientX - rect.left) * dpr;
      const py = (ev.clientY - rect.top) * dpr;
      let sx = (px - spherePanel.cx) / spherePanel.S;
      let sy = (spherePanel.cy - py) / spherePanel.S;
      const rr = sx * sx + sy * sy;
      const { f, r, u } = cameraBasis(cam);
      if (rr > 1) { const n = Math.sqrt(rr); sx /= n; sy /= n; }
      const depth = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
      return norm([
        sx * r[0] + sy * u[0] + depth * f[0],
        sx * r[1] + sy * u[1] + depth * f[1],
        sx * r[2] + sy * u[2] + depth * f[2],
      ]);
    }

    let sphereDrag = null; // 'dir' | 'orbit'
    let lastPointer = null;
    spherePanel.canvas.addEventListener('pointerdown', (ev) => {
      stopPlay();
      const rect = spherePanel.canvas.getBoundingClientRect();
      const dpr = spherePanel.dpr || 1;
      const px = (ev.clientX - rect.left) * dpr;
      const py = (ev.clientY - rect.top) * dpr;
      const { f, r, u } = cameraBasis(cam);
      const hx = spherePanel.cx + spherePanel.S * dot(state.dir, r);
      const hy = spherePanel.cy - spherePanel.S * dot(state.dir, u);
      const nearHandle = Math.hypot(px - hx, py - hy) < 18 * dpr && dot(state.dir, f) > -0.2;
      sphereDrag = nearHandle ? 'dir' : 'orbit';
      lastPointer = { x: ev.clientX, y: ev.clientY };
      if (sphereDrag === 'dir') { state.dir = spherePointFromEvent(ev); pushTrail(); }
      spherePanel.canvas.setPointerCapture(ev.pointerId);
      redraw();
      ev.preventDefault();
    });
    spherePanel.canvas.addEventListener('pointermove', (ev) => {
      if (!sphereDrag) return;
      if (sphereDrag === 'dir') {
        state.dir = spherePointFromEvent(ev);
        pushTrail();
      } else {
        cam.az -= (ev.clientX - lastPointer.x) * 0.008;
        cam.el += (ev.clientY - lastPointer.y) * 0.008;
        cam.el = Math.max(-1.35, Math.min(1.35, cam.el));
        lastPointer = { x: ev.clientX, y: ev.clientY };
      }
      redraw();
    });
    const sphereUp = () => { sphereDrag = null; };
    spherePanel.canvas.addEventListener('pointerup', sphereUp);
    spherePanel.canvas.addEventListener('pointercancel', sphereUp);

    // ----------------------------------------------- texture interaction

    let texDrag = false;
    function uvFromEvent(ev) {
      const rect = texPanel.canvas.getBoundingClientRect();
      const dpr = texPanel.dpr || 1;
      const px = (ev.clientX - rect.left) * dpr;
      const py = (ev.clientY - rect.top) * dpr;
      const u = ((px - texPanel.pad) / texPanel.T) * 2 - 1;
      const v = 1 - ((py - texPanel.pad) / texPanel.T) * 2;
      return [Math.max(-1, Math.min(1, u)), Math.max(-1, Math.min(1, v))];
    }
    texPanel.canvas.addEventListener('pointerdown', (ev) => {
      stopPlay();
      texDrag = true;
      const [u, v] = uvFromEvent(ev);
      state.dir = octDecode(u, v);
      pushTrail();
      texPanel.canvas.setPointerCapture(ev.pointerId);
      redraw();
      ev.preventDefault();
    });
    texPanel.canvas.addEventListener('pointermove', (ev) => {
      if (!texDrag) return;
      const [u, v] = uvFromEvent(ev);
      state.dir = octDecode(u, v);
      pushTrail();
      redraw();
    });
    const texUp = () => { texDrag = false; };
    texPanel.canvas.addEventListener('pointerup', texUp);
    texPanel.canvas.addEventListener('pointercancel', texUp);

    // ------------------------------------------------------------ orbit
    // d follows a tilted great circle, crossing the equator twice per lap —
    // watch the uv point slide out of the diamond into a corner and back.

    const PATH_N = norm([0.45, 0.25, 0.86]);
    const PATH_A = norm(cross(PATH_N, [0, 0, 1]));
    const PATH_B = cross(PATH_N, PATH_A);

    function tick() {
      phase += 0.010;
      state.dir = norm([
        PATH_A[0] * Math.cos(phase) + PATH_B[0] * Math.sin(phase),
        PATH_A[1] * Math.cos(phase) + PATH_B[1] * Math.sin(phase),
        PATH_A[2] * Math.cos(phase) + PATH_B[2] * Math.sin(phase),
      ]);
      pushTrail();
      redraw();
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
      playBtn.textContent = '▶ orbit direction';
      if (rafId) cancelAnimationFrame(rafId);
    }

    // --- autoplay ---------------------------------------------------
    // The orbit is the point of this demo, so it runs on its own as soon as
    // it scrolls into view (and pauses when it scrolls out, to stop burning
    // rAF off-screen). Any direct interaction hands control to the reader
    // for good: `userTookOver` disables the observer from then on.
    let userTookOver = false;
    function takeOver() { userTookOver = true; }

    playBtn.addEventListener('click', () => {
      takeOver();
      playing ? stopPlay() : startPlay();
    });
    spherePanel.canvas.addEventListener('pointerdown', takeOver);
    texPanel.canvas.addEventListener('pointerdown', takeOver);

    resetBtn.addEventListener('click', () => {
      stopPlay();
      state.dir = HOME_DIR.slice();
      cam.az = -0.55; cam.el = 0.42;
      trail.length = 0;
      redraw();
    });
    texSel.addEventListener('change', () => {
      state.mode = texSel.value;
      state.texels = buildTexture(state.R, state.mode);
      redraw();
    });
    window.addEventListener('resize', redraw);

    redraw();

    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (userTookOver) { io.disconnect(); return; }
          if (entries[0].isIntersecting) { startPlay(); } else { stopPlay(); }
        },
        { threshold: 0.35 }
      );
      io.observe(root);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
