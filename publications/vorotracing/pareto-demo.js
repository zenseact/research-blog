(function () {
  "use strict";

  const root = document.getElementById("voro-pareto");
  if (!root) return;

  const svg = document.getElementById("voro-pareto-svg");
  const caption = document.getElementById("voro-pareto-caption");
  const buttons = Array.from(root.querySelectorAll("[data-metric]"));

  const data = [
    { name: "3DGS", family: "raster", fps: 220, psnr: 29.11, ssim: 0.872, lpips: 0.223 },
    { name: "3DGUT", family: "raster", fps: 254, psnr: 28.98, ssim: 0.870, lpips: 0.225 },
    { name: "PowerFoam", family: "raster", fps: 295, psnr: 28.78, ssim: 0.835, lpips: 0.257 },
    { name: "Radiance Meshes", family: "raster", fps: 53, psnr: 28.43, ssim: 0.861, lpips: 0.244 },
    { name: "Radiance Meshes (Vulkan)", family: "raster", fps: 333, psnr: 26.32, ssim: 0.762, lpips: 0.293, offCluster: true },
    { name: "Triangle Splatting", family: "raster", fps: 151, psnr: 28.78, ssim: 0.869, lpips: 0.201 },
    { name: "3DGRT", family: "ray", fps: 88, psnr: 28.20, ssim: 0.859, lpips: 0.231 },
    { name: "Radiant Foam", family: "ray", fps: 194, psnr: 28.44, ssim: 0.829, lpips: 0.277 },
    { name: "PowerFoam (ray)", family: "ray", fps: 131, psnr: 28.78, ssim: 0.835, lpips: 0.257 },
    { name: "VoroTracing", family: "ours", fps: 623, psnr: 28.98, ssim: 0.848, lpips: 0.235 },
  ];

  const metricInfo = {
    psnr: { label: "PSNR (dB)", value: (d) => d.psnr.toFixed(2), minPad: 0.12, maxPad: 0.12, flip: false },
    ssim: { label: "SSIM", value: (d) => d.ssim.toFixed(3), minPad: 0.012, maxPad: 0.012, flip: false },
    lpips: { label: "LPIPS", value: (d) => d.lpips.toFixed(3), minPad: 0.012, maxPad: 0.012, flip: true },
  };

  const colors = {
    raster: "#6D8BA7",
    ray: "#356388",
    ours: "#EF4136",
    ink: "#1A1A2E",
    muted: "#6B7280",
    grid: "rgba(0,0,0,0.08)",
    soft: "rgba(239,65,54,0.15)",
  };

  let metric = "psnr";
  let selected = data[data.length - 1];

  function el(name, attrs, parent) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, value, x, y, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = value;
    return t;
  }

  function starPath(cx, cy, outer, inner, points) {
    const parts = [];
    for (let i = 0; i < points * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return `${parts.join(" ")} Z`;
  }

  function trianglePath(cx, cy, r) {
    const h = r * 1.55;
    return `M${cx},${cy - h * 0.62} L${cx - r},${cy + h * 0.52} L${cx + r},${cy + h * 0.52} Z`;
  }

  function draw() {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(320, rect.width || 900);
    const height = Math.max(300, rect.height || 420);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = "";

    const small = width < 620;
    const margin = {
      top: small ? 38 : 34,
      right: small ? 24 : 36,
      bottom: small ? 58 : 54,
      left: small ? 58 : 66,
    };
    const plot = {
      x0: margin.left,
      y0: margin.top,
      x1: width - margin.right,
      y1: height - margin.bottom,
    };
    plot.w = plot.x1 - plot.x0;
    plot.h = plot.y1 - plot.y0;

    const xs = data.map((d) => d.fps);
    const ys = data.map((d) => d[metric]);
    const xMin = 0;
    const xMax = Math.max(...xs) + 44;
    const info = metricInfo[metric];
    const yMin = Math.min(...ys) - info.minPad;
    const yMax = Math.max(...ys) + info.maxPad;
    const xScale = (x) => plot.x0 + ((x - xMin) / (xMax - xMin)) * plot.w;
    const yScaleRaw = (y) => plot.y1 - ((y - yMin) / (yMax - yMin)) * plot.h;
    const yScale = info.flip
      ? (y) => plot.y0 + ((y - yMin) / (yMax - yMin)) * plot.h
      : yScaleRaw;

    const title = el("title", { id: "voro-pareto-title" }, svg);
    title.textContent = `Rendering speed versus ${info.label}`;
    const desc = el("desc", { id: "voro-pareto-desc" }, svg);
    desc.textContent = "Scatter plot comparing VoroTracing to rasterized and ray-traced baselines.";

    el("rect", { x: 0, y: 0, width, height, fill: "#F7F6F3" }, svg);

    const grid = el("g", {}, svg);
    const xTicks = [0, 100, 200, 300, 400, 500, 600];
    const yTicks = makeTicks(yMin, yMax, metric);

    yTicks.forEach((tick) => {
      const y = yScale(tick);
      el("line", { x1: plot.x0, y1: y, x2: plot.x1, y2: y, stroke: colors.grid, "stroke-width": 1 }, grid);
      text(grid, formatTick(tick, metric), plot.x0 - 10, y + 4, {
        "text-anchor": "end",
        "font-size": small ? 11 : 12,
        fill: colors.muted,
      });
    });

    xTicks.forEach((tick) => {
      const x = xScale(tick);
      el("line", { x1: x, y1: plot.y0, x2: x, y2: plot.y1, stroke: colors.grid, "stroke-width": 1 }, grid);
      text(grid, String(tick), x, plot.y1 + 22, {
        "text-anchor": "middle",
        "font-size": small ? 11 : 12,
        fill: colors.muted,
      });
    });

    el("line", { x1: plot.x0, y1: plot.y1, x2: plot.x1, y2: plot.y1, stroke: "#CFC9BE", "stroke-width": 1 }, svg);
    el("line", { x1: plot.x0, y1: plot.y0, x2: plot.x0, y2: plot.y1, stroke: "#CFC9BE", "stroke-width": 1 }, svg);

    text(svg, "Rendering speed (FPS)", (plot.x0 + plot.x1) / 2, height - 16, {
      "text-anchor": "middle",
      "font-size": small ? 12 : 13,
      fill: colors.ink,
      "font-weight": 600,
    });
    const axisLabel = metric === "lpips" ? "LPIPS (lower is better)" : `${info.label} (higher is better)`;
    const yLabel = text(svg, axisLabel, 18, (plot.y0 + plot.y1) / 2, {
      "text-anchor": "middle",
      "font-size": small ? 12 : 13,
      fill: colors.ink,
      "font-weight": 600,
      transform: `rotate(-90 18 ${(plot.y0 + plot.y1) / 2})`,
    });
    yLabel.setAttribute("dominant-baseline", "middle");

    // The bracket measures against the fastest prior method that actually
    // reproduces its own training quality. Radiance Meshes' Vulkan renderer is
    // faster than PowerFoam's rasterizer but lands 2.7 dB below the cluster, so
    // the paper reports it separately and excludes it here; bracketing against
    // it would understate the result and contradict the paper's Fig. 2.
    const fastestPrior = data
      .filter((d) => d.family !== "ours" && !d.offCluster)
      .reduce((a, b) => (a.fps > b.fps ? a : b));
    const ours = data.find((d) => d.family === "ours");
    const bracketY = small ? plot.y1 - plot.h * 0.16 : plot.y1 - plot.h * 0.24;
    const xA = xScale(fastestPrior.fps);
    const xB = xScale(ours.fps);
    el("line", { x1: xA, y1: bracketY, x2: xB, y2: bracketY, stroke: colors.muted, "stroke-width": 1.2 }, svg);
    el("line", { x1: xA, y1: bracketY - 5, x2: xA, y2: bracketY + 5, stroke: colors.muted, "stroke-width": 1.2 }, svg);
    el("line", { x1: xB, y1: bracketY - 5, x2: xB, y2: bracketY + 5, stroke: colors.muted, "stroke-width": 1.2 }, svg);
    const priorLabel = fastestPrior.name.replace("Radiance Meshes", "Rad. Meshes");
    const bracketLabel = small
      ? `${(ours.fps / fastestPrior.fps).toFixed(1)}× faster`
      : `${(ours.fps / fastestPrior.fps).toFixed(1)}× faster than ${priorLabel}`;
    text(svg, bracketLabel, (xA + xB) / 2, bracketY - 9, {
      "text-anchor": "middle",
      "font-size": small ? 11 : 12,
      fill: colors.ink,
      "font-weight": 600,
    });

    const pointLayer = el("g", {}, svg);
    data.forEach((d) => {
      const cx = xScale(d.fps);
      const cy = yScale(d[metric]);
      const group = el("g", {
        role: "button",
        "aria-label": `${d.name}: ${d.fps} FPS, ${info.label} ${info.value(d)}`,
        "data-name": d.name,
      }, pointLayer);

      if (d.family === "ours") {
        el("circle", { cx, cy, r: selected === d ? 34 : 29, fill: colors.soft }, group);
        el("path", { d: starPath(cx, cy, 17, 7, 5), fill: colors.ours }, group);
      } else if (d.family === "ray") {
        el("path", { d: trianglePath(cx, cy, selected === d ? 11 : 9), fill: colors.ray }, group);
      } else {
        const s = selected === d ? 17 : 14;
        const box = { x: cx - s / 2, y: cy - s / 2, width: s, height: s, rx: 2 };
        if (d.offCluster) {
          el("rect", { ...box, fill: "none", stroke: colors.raster, "stroke-width": 2 }, group);
        } else {
          el("rect", { ...box, fill: colors.raster }, group);
        }
      }

      const label = labelText(d.name, small);
      const placement = labelOffset(d.name, small);
      text(group, label, cx + placement.dx, cy + placement.dy, {
        "text-anchor": placement.anchor,
        "font-size": small ? 10.5 : 12,
        fill: d.family === "ours" ? colors.ours : colors.ink,
        "font-weight": d.family === "ours" ? 600 : 500,
        "pointer-events": "none",
      });

      const hit = el("circle", { cx, cy, r: 20, fill: "transparent" }, group);
      hit.addEventListener("mouseenter", () => select(d));
      hit.addEventListener("click", () => select(d));
      hit.addEventListener("touchstart", (event) => {
        event.preventDefault();
        select(d);
      }, { passive: false });
    });

    updateCaption();
  }

  function select(d) {
    selected = d;
    draw();
  }

  function updateCaption() {
    const info = metricInfo[metric];
    const methodType = selected.family === "ours"
      ? "VoroTracing"
      : selected.family === "ray"
        ? "ray-traced baseline"
        : "rasterized baseline";
    const speed = selected.family === "ours"
      ? "fastest method shown"
      : `${(data.find((d) => d.family === "ours").fps / selected.fps).toFixed(1)}× slower than VoroTracing`;
    const note = selected.offCluster
      ? " This renderer did not reproduce its own training pipeline's quality in our tests, so it is reported but excluded from the speedup comparison."
      : "";
    caption.textContent =
      `${selected.name}: ${selected.fps} FPS, ${info.label} ${info.value(selected)} — ${methodType}, ${speed}.${note}`;
  }

  function labelText(name, small) {
    if (!small) return name;
    return {
      "Radiance Meshes": "Rad. Mesh",
      "Radiance Meshes (Vulkan)": "RM Vulkan",
      "Triangle Splatting": "Tri. Splat",
      "Radiant Foam": "RadFoam",
      "PowerFoam (ray)": "PowerFoam ray",
    }[name] || name;
  }

  function labelOffset(name, small) {
    const wide = {
      "3DGS": { dx: -9, dy: -14, anchor: "end" },
      "3DGUT": { dx: 10, dy: 6, anchor: "start" },
      "PowerFoam": { dx: 10, dy: 6, anchor: "start" },
      "Radiance Meshes": { dx: 10, dy: 15, anchor: "start" },
      "Radiance Meshes (Vulkan)": { dx: -9, dy: 16, anchor: "end" },
      "Triangle Splatting": { dx: -10, dy: -12, anchor: "end" },
      "3DGRT": { dx: 10, dy: 5, anchor: "start" },
      "Radiant Foam": { dx: 10, dy: -12, anchor: "start" },
      "PowerFoam (ray)": { dx: -10, dy: 16, anchor: "end" },
      "VoroTracing": { dx: -5, dy: -25, anchor: "middle" },
    };
    const narrow = {
      "3DGS": { dx: -8, dy: -13, anchor: "end" },
      "3DGUT": { dx: 7, dy: 18, anchor: "start" },
      "PowerFoam": { dx: 9, dy: -12, anchor: "start" },
      "Radiance Meshes": { dx: 9, dy: 15, anchor: "start" },
      "Radiance Meshes (Vulkan)": { dx: -8, dy: 16, anchor: "end" },
      "Triangle Splatting": { dx: -9, dy: -12, anchor: "end" },
      "3DGRT": { dx: 9, dy: 6, anchor: "start" },
      "Radiant Foam": { dx: 8, dy: -12, anchor: "start" },
      "PowerFoam (ray)": { dx: -9, dy: 18, anchor: "end" },
      "VoroTracing": { dx: -4, dy: -25, anchor: "middle" },
    };
    return (small ? narrow : wide)[name] || { dx: 9, dy: -9, anchor: "start" };
  }

  function makeTicks(min, max, m) {
    if (m === "psnr") return [26.4, 27.0, 27.6, 28.2, 28.8, 29.4].filter((v) => v >= min && v <= max);
    if (m === "ssim") return [0.76, 0.79, 0.82, 0.85, 0.88].filter((v) => v >= min && v <= max);
    return [0.20, 0.22, 0.24, 0.26, 0.28, 0.30].filter((v) => v >= min && v <= max);
  }

  function formatTick(v, m) {
    if (m === "psnr") return v.toFixed(1);
    return v.toFixed(2);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      metric = button.dataset.metric;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      draw();
    });
  });

  window.addEventListener("resize", draw);
  draw();
}());
