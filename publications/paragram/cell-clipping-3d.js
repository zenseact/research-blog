import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const wrap = document.getElementById('paragram-3d-wrap');
if (wrap) {
  bootstrap();
}

function bootstrap() {
  const statusEl = document.getElementById('paragram-3d-status');
  const warnEl = document.getElementById('paragram-3d-warn');
  const playBtn = document.getElementById('paragram-3d-play');
  const stepSlider = document.getElementById('paragram-3d-step');
  const stepLabel = document.getElementById('paragram-3d-step-val');
  const cameraBtn = document.getElementById('paragram-3d-camera');

  // ----- scene -----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const initialCam = new THREE.Vector3(6, 4.5, 7.5);
  camera.position.copy(initialCam);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 6, 5);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xc0d8ff, 0.35);
  fill.position.set(-4, -2, -5);
  scene.add(fill);

  // grid + axes for spatial reference (subtle)
  const grid = new THREE.GridHelper(8, 8, 0xbbbbbb, 0xdddddd);
  grid.position.y = -3.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  // cell mesh + edges
  const cellMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa84a,
    transparent: true,
    opacity: 0.55,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const cellMesh = new THREE.Mesh(new THREE.BufferGeometry(), cellMaterial);
  scene.add(cellMesh);

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x803a00, linewidth: 2 });
  const cellEdges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMaterial);
  scene.add(cellEdges);

  // cutting plane (preview of next clip)
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0x33b5c8,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), planeMaterial);
  planeMesh.visible = false;
  scene.add(planeMesh);

  const planeEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x1a7a8a, transparent: true, opacity: 0.7 });
  const planeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(planeMesh.geometry), planeEdgeMaterial);
  planeEdges.visible = false;
  scene.add(planeEdges);

  // site sphere
  const siteMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xd57000, emissive: 0x442200, roughness: 0.4 })
  );
  scene.add(siteMesh);

  // neighbor instanced meshes — split into "clipped" (active in current cell construction)
  // and "remaining" so we can color them differently.
  const neighborGroup = new THREE.Group();
  scene.add(neighborGroup);

  // ----- state -----
  const NUM_NEIGHBORS = 32;
  const CUBE_HALF = 3;

  function seededRand(seed) {
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 1000000) / 1000000;
    };
  }
  function defaultNeighbors() {
    const rand = seededRand(0xC0FFEE);
    const out = [];
    for (let k = 0; k < NUM_NEIGHBORS; k++) {
      // sample on a shell with varying radius for visual interest
      const r = 1.6 + rand() * 2.4;
      const theta = rand() * 2 * Math.PI;
      const phi = Math.acos(2 * rand() - 1);
      out.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi) * 0.85,  // slightly squashed in y
        z: r * Math.sin(phi) * Math.sin(theta),
      });
    }
    // sort by distance to origin so step order = nearest-first
    out.sort((a, b) => (a.x * a.x + a.y * a.y + a.z * a.z) - (b.x * b.x + b.y * b.y + b.z * b.z));
    return out;
  }

  let state;
  function defaultState() {
    return {
      site: { x: 0, y: 0, z: 0 },
      neighbors: defaultNeighbors(),
      step: 0,
      cell: initialCube(CUBE_HALF),
      cellEmpty: false,
      binding: [],            // [bool] per neighbor; computed once after neighbors are fixed
      // animation
      planeAnim: null,        // { t0, duration, plane }
      playing: false,
      lastStepTime: 0,
    };
  }

  // ----- polyhedron + clipping -----
  function initialCube(L) {
    const v = [
      { x: -L, y: -L, z: -L },
      { x:  L, y: -L, z: -L },
      { x:  L, y:  L, z: -L },
      { x: -L, y:  L, z: -L },
      { x: -L, y: -L, z:  L },
      { x:  L, y: -L, z:  L },
      { x:  L, y:  L, z:  L },
      { x: -L, y:  L, z:  L },
    ];
    // CCW from outside
    const f = [
      [0, 3, 2, 1], // -z
      [4, 5, 6, 7], // +z
      [0, 1, 5, 4], // -y
      [3, 7, 6, 2], // +y
      [0, 4, 7, 3], // -x
      [1, 2, 6, 5], // +x
    ];
    // -1 = bounding cube, otherwise the index of the neighbor that produced it.
    return { vertices: v, faces: f, faceLabels: f.map(() => -1) };
  }

  function bisectorPlane(pi, pj) {
    const dx = pj.x - pi.x, dy = pj.y - pi.y, dz = pj.z - pi.z;
    const L2 = dx * dx + dy * dy + dz * dz;
    if (L2 < 1e-12) return null;
    const L = Math.sqrt(L2);
    const d = L * 0.5; // unweighted: bisector is the perpendicular at the midpoint
    return {
      px: pi.x + d * dx / L,
      py: pi.y + d * dy / L,
      pz: pi.z + d * dz / L,
      nx: dx / L, ny: dy / L, nz: dz / L,
    };
  }

  function clipPolyhedron(poly, plane, newLabel) {
    const eps = 1e-6;
    const dist = poly.vertices.map(v =>
      (v.x - plane.px) * plane.nx +
      (v.y - plane.py) * plane.ny +
      (v.z - plane.pz) * plane.nz
    );
    // We keep vertices where dist <= 0 (the side of pi).

    const newVerts = [];
    const vmap = new Map();
    function addVert(v) {
      // snap to 6 decimals to weld near-duplicates
      const k = `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.z.toFixed(6)}`;
      let i = vmap.get(k);
      if (i === undefined) { i = newVerts.length; newVerts.push(v); vmap.set(k, i); }
      return i;
    }

    const newFaces = [];
    const newLabels = [];
    const capVerts = new Set();

    for (let f = 0; f < poly.faces.length; f++) {
      const face = poly.faces[f];
      const label = poly.faceLabels[f];
      const allOut = face.every(i => dist[i] >= -eps);
      if (allOut && !face.every(i => Math.abs(dist[i]) < eps)) continue;
      const allIn = face.every(i => dist[i] <= eps);
      if (allIn) {
        newFaces.push(face.map(i => addVert(poly.vertices[i])));
        newLabels.push(label);
        continue;
      }
      const ring = [];
      const n = face.length;
      for (let k = 0; k < n; k++) {
        const i0 = face[k], i1 = face[(k + 1) % n];
        const d0 = dist[i0], d1 = dist[i1];
        const in0 = d0 <= eps, in1 = d1 <= eps;
        if (in0) ring.push(addVert(poly.vertices[i0]));
        if (in0 !== in1) {
          const a = poly.vertices[i0], b = poly.vertices[i1];
          const t = d0 / (d0 - d1);
          const idx = addVert({
            x: a.x + t * (b.x - a.x),
            y: a.y + t * (b.y - a.y),
            z: a.z + t * (b.z - a.z),
          });
          ring.push(idx);
          capVerts.add(idx);
        }
      }
      if (ring.length >= 3) {
        newFaces.push(ring);
        newLabels.push(label);
      }
    }

    if (capVerts.size >= 3) {
      const idxs = [...capVerts];
      const pts = idxs.map(i => newVerts[i]);
      const c = { x: 0, y: 0, z: 0 };
      for (const p of pts) { c.x += p.x; c.y += p.y; c.z += p.z; }
      c.x /= pts.length; c.y /= pts.length; c.z /= pts.length;
      // basis on plane
      const n = { x: plane.nx, y: plane.ny, z: plane.nz };
      let u = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const dotUN = u.x * n.x + u.y * n.y + u.z * n.z;
      u = { x: u.x - dotUN * n.x, y: u.y - dotUN * n.y, z: u.z - dotUN * n.z };
      const ulen = Math.hypot(u.x, u.y, u.z);
      u = { x: u.x / ulen, y: u.y / ulen, z: u.z / ulen };
      const v = {
        x: n.y * u.z - n.z * u.y,
        y: n.z * u.x - n.x * u.z,
        z: n.x * u.y - n.y * u.x,
      };
      // (u,v,n) is right-handed (v = n × u), so ascending atan2(v,u) traces
      // the cap CCW when viewed from +n — the polyhedron's outward direction at
      // the cap, since we kept the side dist <= 0.
      const angles = idxs.map((idx, k) => {
        const p = pts[k];
        return {
          idx,
          a: Math.atan2(
            (p.x - c.x) * v.x + (p.y - c.y) * v.y + (p.z - c.z) * v.z,
            (p.x - c.x) * u.x + (p.y - c.y) * u.y + (p.z - c.z) * u.z
          ),
        };
      });
      angles.sort((p, q) => p.a - q.a);
      const capFace = angles.map(x => x.idx);
      if (capFace.length >= 3) {
        newFaces.push(capFace);
        newLabels.push(newLabel);
      }
    }

    return { vertices: newVerts, faces: newFaces, faceLabels: newLabels };
  }

  function polyhedronToGeometry(poly) {
    const positions = [];
    const indices = [];
    let base = 0;
    for (const face of poly.faces) {
      // re-emit face vertices for flat shading (no normal averaging across faces)
      const startIdx = base;
      for (const vi of face) {
        const v = poly.vertices[vi];
        positions.push(v.x, v.y, v.z);
        base++;
      }
      // fan triangulation
      for (let i = 1; i < face.length - 1; i++) {
        indices.push(startIdx, startIdx + i, startIdx + i + 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  // Build edges directly from face boundaries (skips the EdgesGeometry threshold logic
  // which doesn't always handle co-planar fan diagonals cleanly).
  function polyhedronEdgesGeometry(poly) {
    const positions = [];
    const seen = new Set();
    for (const face of poly.faces) {
      const n = face.length;
      for (let k = 0; k < n; k++) {
        const a = face[k], b = face[(k + 1) % n];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const va = poly.vertices[a], vb = poly.vertices[b];
        positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }

  // ----- neighbor visualization -----
  // Shared geometries / materials — built once, reused across rebuildNeighbors.
  const SPHERE_PENDING = new THREE.SphereGeometry(0.06, 12, 8);
  const SPHERE_CURRENT = new THREE.SphereGeometry(0.11, 16, 12);
  const SPHERE_BINDING = new THREE.SphereGeometry(0.07, 12, 8);
  const SPHERE_NONBINDING = new THREE.SphereGeometry(0.045, 10, 6);
  // Unlit so the colors render at full saturation regardless of scene lighting.
  const MAT_PENDING = new THREE.MeshBasicMaterial({ color: 0xab47bc });
  const MAT_CURRENT = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
  const MAT_BINDING = new THREE.MeshBasicMaterial({ color: 0x4caf50 });
  const MAT_NONBINDING = new THREE.MeshBasicMaterial({ color: 0xb0b0b0, transparent: true, opacity: 0.55 });

  function rebuildNeighbors() {
    neighborGroup.clear();
    for (let k = 0; k < state.neighbors.length; k++) {
      const p = state.neighbors[k];
      let geom, mat;
      if (k === state.step - 1 && state.step > 0) {
        // The clip that just happened.
        geom = SPHERE_CURRENT;
        mat = MAT_CURRENT;
      } else if (k < state.step) {
        // Past clip — color by whether it ended up contributing a face.
        if (state.binding[k]) { geom = SPHERE_BINDING; mat = MAT_BINDING; }
        else { geom = SPHERE_NONBINDING; mat = MAT_NONBINDING; }
      } else {
        // Pending.
        geom = SPHERE_PENDING;
        mat = MAT_PENDING;
      }
      const m = new THREE.Mesh(geom, mat);
      m.position.set(p.x, p.y, p.z);
      neighborGroup.add(m);
    }
  }

  // ----- core operations -----
  // Run the full clip sequence and read the final face labels — that tells us
  // which neighbors actually contributed a face. This is a static property of
  // the configuration, recomputed only when neighbors/site change.
  function recomputeBinding() {
    let poly = initialCube(CUBE_HALF);
    const N = state.neighbors.length;
    for (let k = 0; k < N; k++) {
      const plane = bisectorPlane(state.site, state.neighbors[k]);
      if (!plane) continue;
      poly = clipPolyhedron(poly, plane, k);
      if (poly.vertices.length === 0 || poly.faces.length === 0) break;
    }
    const binding = new Array(N).fill(false);
    for (const lbl of poly.faceLabels) if (lbl >= 0) binding[lbl] = true;
    state.binding = binding;
  }

  function rebuildCell() {
    let poly = initialCube(CUBE_HALF);
    for (let k = 0; k < state.step; k++) {
      const plane = bisectorPlane(state.site, state.neighbors[k]);
      if (!plane) continue;
      poly = clipPolyhedron(poly, plane, k);
      if (poly.vertices.length === 0 || poly.faces.length === 0) {
        poly = { vertices: [], faces: [], faceLabels: [] };
        break;
      }
    }
    state.cell = poly;
    state.cellEmpty = poly.faces.length === 0;
    refreshCellMeshes();
    refreshOverlay();
  }

  function refreshCellMeshes() {
    cellMesh.geometry.dispose();
    cellEdges.geometry.dispose();
    if (state.cell.faces.length === 0) {
      cellMesh.visible = false;
      cellEdges.visible = false;
      warnEl.style.display = 'block';
      return;
    }
    cellMesh.geometry = polyhedronToGeometry(state.cell);
    cellEdges.geometry = polyhedronEdgesGeometry(state.cell);
    cellMesh.visible = true;
    cellEdges.visible = true;
    warnEl.style.display = 'none';
  }

  function refreshOverlay() {
    statusEl.textContent = `step ${state.step} / ${state.neighbors.length}` +
      (state.cellEmpty ? ' (empty)' : '');
  }

  function showCuttingPlane(plane) {
    // Position quad at plane with normal aligned to plane.n
    const normal = new THREE.Vector3(plane.nx, plane.ny, plane.nz);
    const pos = new THREE.Vector3(plane.px, plane.py, plane.pz);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    [planeMesh, planeEdges].forEach(o => {
      o.position.copy(pos);
      o.quaternion.copy(q);
      o.visible = true;
    });
    state.planeAnim = { t0: performance.now(), duration: 450, plane };
  }

  function updatePlaneAnimation(now) {
    if (!state.planeAnim) return;
    const t = (now - state.planeAnim.t0) / state.planeAnim.duration;
    if (t >= 1) {
      planeMesh.visible = false;
      planeEdges.visible = false;
      state.planeAnim = null;
      return;
    }
    const easeOut = 1 - Math.pow(1 - t, 2);
    const fade = 1 - easeOut;
    planeMaterial.opacity = 0.32 * fade + 0.04;
    planeEdgeMaterial.opacity = 0.85 * fade + 0.1;
  }

  function setStep(s, options) {
    const N = state.neighbors.length;
    const next = Math.max(0, Math.min(N, s));
    state.step = next;
    rebuildCell();
    rebuildNeighbors();
    if (!options || !options.fromSlider) {
      stepSlider.value = String(next);
    }
    stepLabel.textContent = `step ${next} / ${N}`;
  }

  // Advance one step and trigger the cutting-plane preview animation. Used by
  // the play loop only; slider scrubbing skips the per-clip animation.
  function doStep() {
    if (state.step >= state.neighbors.length) return;
    const plane = bisectorPlane(state.site, state.neighbors[state.step]);
    if (plane) showCuttingPlane(plane);
    setStep(state.step + 1);
  }

  function setPlaying(p) {
    state.playing = p;
    playBtn.textContent = p ? '⏸ pause' : '▶ play';
    if (p) state.lastStepTime = performance.now();
  }

  function refreshStepSlider() {
    const N = state.neighbors.length;
    stepSlider.max = String(N);
    stepSlider.value = String(state.step);
    stepLabel.textContent = `step ${state.step} / ${N}`;
  }

  // ----- UI -----
  stepSlider.addEventListener('input', () => {
    setPlaying(false);
    setStep(parseInt(stepSlider.value, 10), { fromSlider: true });
  });
  playBtn.addEventListener('click', () => {
    if (state.playing) { setPlaying(false); return; }
    if (state.step >= state.neighbors.length) setStep(0);
    setPlaying(true);
  });
  cameraBtn.addEventListener('click', () => {
    camera.position.copy(initialCam);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  // ----- resize -----
  function fitCanvas() {
    const r = wrap.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(fitCanvas);
  ro.observe(wrap);
  window.addEventListener('resize', fitCanvas);

  // ----- init -----
  state = defaultState();
  recomputeBinding();
  state.step = state.neighbors.length; // default: final cell, like the 2D viz
  rebuildCell();
  rebuildNeighbors();
  refreshStepSlider();
  fitCanvas();

  // ----- render loop -----
  const STEP_INTERVAL_MS = 700;
  function tick(now) {
    requestAnimationFrame(tick);
    controls.update();
    siteMesh.position.set(state.site.x, state.site.y, state.site.z);
    updatePlaneAnimation(now);
    if (state.playing && now - state.lastStepTime > STEP_INTERVAL_MS) {
      state.lastStepTime = now;
      if (state.step < state.neighbors.length) doStep();
      else setPlaying(false);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
