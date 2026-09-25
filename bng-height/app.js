// BNG die topography -- supplementary page.
// Reads meta.json + two int16 grids written by ../reduce.py; everything shown comes from them.
"use strict";

const state = { meta: null, layers: {}, layer: "levelled", exag: 20, row: 0, col: 0 };
const $ = (id) => document.getElementById(id);

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function load() {
  const [meta, grids] = await Promise.all(["meta.json", "grids.json"].map(async (f) => {
    const res = await fetch(f);
    if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
    return res.json();
  }));
  state.meta = meta;
  state.layers = { raw: decode(grids.raw, meta.grid), levelled: decode(grids.levelled, meta.grid) };
  state.row = Math.floor(meta.grid.rows / 2);
  state.col = Math.floor(meta.grid.cols / 2);
}

// base64 of int16 little-endian, row-major, top row first; `masked` -> null (a gap in every plot).
function decode(b64, g) {
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  if (bytes.length !== 2 * g.rows * g.cols) throw new Error("grid size does not match meta.json");
  const out = [];
  for (let r = 0; r < g.rows; r++) {
    const row = new Array(g.cols);
    for (let c = 0; c < g.cols; c++) {
      const v = view.getInt16(2 * (r * g.cols + c), true);
      row[c] = v === g.masked ? null : v * g.step_um;
    }
    out.push(row);
  }
  return out;
}

const axisUm = (n, dx) => Array.from({ length: n }, (_, i) => i * dx);

function colourScale(layer) {
  const m = state.meta;
  return layer === "levelled"
    ? { colorscale: "RdBu", cmin: -m.levelled_limit_um, cmax: m.levelled_limit_um }
    : { colorscale: "Viridis", cmin: m.raw_limits_um[0], cmax: m.raw_limits_um[1] };
}

function baseLayout() {
  const ink = css("--ink"), soft = css("--ink-soft"), grid = css("--plot-grid");
  return {
    paper_bgcolor: css("--panel"),
    plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: ink, size: 12 },
    margin: { l: 56, r: 16, t: 12, b: 44 },
    xaxis: { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft },
    yaxis: { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft },
  };
}

const config = { displaylogo: false, responsive: true,
  modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "lasso2d", "select2d"] };

function drawSurface(keepCamera) {
  const m = state.meta, g = m.grid, z = state.layers[state.layer];
  const x = axisUm(g.cols, g.dx_um), y = axisUm(g.rows, g.dx_um);
  const W = x[x.length - 1], H = y[y.length - 1];
  const span = state.layer === "levelled" ? 2 * m.levelled_limit_um : m.raw_limits_um[1] - m.raw_limits_um[0];
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const ax = (title) => ({ title: { text: title }, color: soft, gridcolor: grid, backgroundcolor: css("--panel"),
    showbackground: false, zerolinecolor: grid });
  const el = $("surface");
  const camera = keepCamera && el.layout ? el.layout.scene.camera : { eye: { x: -0.9, y: -1.5, z: 0.9 } };
  const trace = {
    type: "surface", x, y, z, ...colourScale(state.layer),
    colorbar: { title: { text: "µm", side: "right" }, thickness: 12, len: 0.7, tickfont: { color: soft } },
    contours: { z: { show: false } },
    lighting: { ambient: 0.55, diffuse: 0.8, specular: 0.15, roughness: 0.6 },
    hovertemplate: "x %{x:.0f} µm<br>y %{y:.0f} µm<br>z %{z:.2f} µm<extra></extra>",
  };
  const layout = {
    ...baseLayout(),
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      xaxis: ax("x (µm)"), yaxis: { ...ax("y (µm)"), autorange: "reversed" }, zaxis: { ...ax("z (µm)"), nticks: 5 },
      aspectmode: "manual",
      aspectratio: { x: 1, y: H / W, z: Math.min(1.2, (span * state.exag) / W) },
      camera,
    },
  };
  Plotly.react(el, [trace], layout, config);
}

function drawPlan() {
  const m = state.meta, g = m.grid, z = state.layers[state.layer];
  const x = axisUm(g.cols, g.dx_um), y = axisUm(g.rows, g.dx_um);
  const gold = css("--gold");
  const el = $("plan");
  el.style.aspectRatio = `${g.cols} / ${g.rows}`;
  const layout = {
    ...baseLayout(),
    margin: { l: 0, r: 0, t: 0, b: 0 },
    xaxis: { visible: false, range: [0, x[x.length - 1]], fixedrange: true },
    yaxis: { visible: false, range: [y[y.length - 1], 0], fixedrange: true, scaleanchor: "x" },
    shapes: [
      { type: "line", x0: 0, x1: x[x.length - 1], y0: y[state.row], y1: y[state.row], line: { color: gold, width: 2 } },
      { type: "line", x0: x[state.col], x1: x[state.col], y0: 0, y1: y[y.length - 1], line: { color: gold, width: 2 } },
    ],
  };
  const trace = { type: "heatmap", x, y, z, ...colourScale(state.layer), showscale: false, hoverinfo: "none" };  // "skip" would also swallow clicks
  Plotly.react(el, [trace], layout, { ...config, displayModeBar: false });
}

function drawProfiles() {
  const m = state.meta, g = m.grid, z = state.layers[state.layer];
  const x = axisUm(g.cols, g.dx_um), y = axisUm(g.rows, g.dx_um);
  const gold = css("--gold"), ink = css("--ink");
  const across = z.map((row) => row[state.col]);
  const along = z[state.row];
  const yTitle = state.layer === "levelled" ? "height minus plane (µm)" : "height (µm)";
  const line = (xs, ys, colour) => ({ type: "scatter", mode: "lines", x: xs, y: ys, connectgaps: false,
    line: { color: colour, width: 1.6 }, hovertemplate: "%{x:.0f} µm → %{y:.2f} µm<extra></extra>" });
  const base = baseLayout();
  Plotly.react($("profile-across"), [line(y, across, gold)], { ...base,
    xaxis: { ...base.xaxis, title: { text: "y (µm)" } }, yaxis: { ...base.yaxis, title: { text: yTitle } } }, config);
  Plotly.react($("profile-along"), [line(x, along, ink)], { ...base,
    xaxis: { ...base.xaxis, title: { text: "x (µm)" } }, yaxis: { ...base.yaxis, title: { text: yTitle } } }, config);
  $("cap-across").textContent = `Across the fingers, at x = ${x[state.col].toFixed(0)} µm. Gaps are masked slots.`;
  $("cap-along").textContent = `Along the row at y = ${y[state.row].toFixed(0)} µm.`;
}

function pick(xUm, yUm) {
  const g = state.meta.grid;
  state.col = Math.max(0, Math.min(g.cols - 1, Math.round(xUm / g.dx_um)));
  state.row = Math.max(0, Math.min(g.rows - 1, Math.round(yUm / g.dx_um)));
  drawPlan();
  drawProfiles();
}

function fillText() {
  const m = state.meta, fmt = (v, d) => Number(v).toFixed(d);
  const facts = [
    ["Field", `${fmt(m.field_um[0], 0)} × ${fmt(m.field_um[1], 0)} µm`],
    ["Scan pixel", `${fmt(m.native.pixel_um, 3)} µm`],
    ["Shown at", `${fmt(m.grid.dx_um, 2)} µm (${m.grid.block}×${m.grid.block} mean)`],
    ["Z range", `${fmt(m.z_range_um, 1)} µm*`],
    ["Tilt removed", `${fmt(m.tilt_deg, 2)}°`],
    ["Valid pixels", `${fmt(100 * m.valid, 1)} %`],
    ["Below the scan", `${fmt(100 * m.clipped_low, 2)} %`],
  ];
  $("facts").replaceChildren(...facts.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("caveats").replaceChildren(...m.caveats.map((t) => {
    const li = document.createElement("li"); li.textContent = t; return li;
  }));
  const s = m.source;
  const prov = [["Instrument", s.instrument], ["File", s.path], ["SHA-256", s.sha256],
    ["Reader", s.reader], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${s.file} · * Z scale inferred from the file, see notes below`;
}

function drawAll(keepCamera) {
  drawSurface(keepCamera);
  drawPlan();
  drawProfiles();
}

function wire() {
  document.querySelectorAll('input[name="layer"]').forEach((el) =>
    el.addEventListener("change", () => { state.layer = el.value; drawAll(true); }));
  const slider = $("exaggeration");
  slider.addEventListener("input", () => {
    state.exag = Number(slider.value);
    $("exaggeration-out").textContent = `${state.exag}×`;
    drawSurface(true);
  });
  $("reset-view").addEventListener("click", () => drawSurface(false));
  $("surface").on("plotly_click", (ev) => { const p = ev.points[0]; pick(p.x, p.y); });
  $("plan").on("plotly_click", (ev) => { const p = ev.points[0]; pick(p.x, p.y); });
  // redraw in the new palette when the viewer's theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => drawAll(true));
  new MutationObserver(() => drawAll(true))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    await load();
    fillText();
    drawAll(false);
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the height map: ${err.message}. ` +
      "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
