// Vibration spectra -- supplementary page.
// Reads data.json written by ../reduce.py: a PSD cube, condition x sensor x axis x frequency,
// on the log grid and 512-point Welch windows of the printed fig_heatmap. Nothing is computed
// here beyond selecting a slice.
"use strict";

const state = { d: null, slice: "cond", sensor: "acc", fixed: "sum", view: "map", fi: 0 };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const AXES = [["x", "X axis"], ["y", "Y axis"], ["z", "Z axis"], ["sum", "Σ of the three axes"]];
const UNIT = { acc: "dB re g²/Hz", gyr: "dB re dps²/Hz" };
// matplotlib's "turbo" (the printed fig_heatmap's colormap), sampled at 11 stops; Plotly has no named turbo.
const TURBO = [[0, "#30123b"], [0.1, "#4559cb"], [0.2, "#3e9bfe"], [0.3, "#19d5cd"], [0.4, "#46f884"], [0.5, "#a4fc3c"], [0.6, "#e1dd37"], [0.7, "#fea431"], [0.8, "#f05b12"], [0.9, "#c32503"], [1, "#7a0403"]];

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 150, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.1, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

// The current 2D slice: rows (labels) x frequency (z matrix, dB, null where unresolved)
function slice() {
  const d = state.d, s = state.sensor;
  if (state.slice === "cond") {
    return { rows: d.conditions.map((c) => c.label), z: d.conditions.map((c) => c[s][state.fixed]),
      what: `${AXES.find((a) => a[0] === state.fixed)[1]}, all five conditions` };
  }
  const c = d.conditions[Number(state.fixed)];
  return { rows: AXES.map((a) => a[1]), z: AXES.map((a) => c[s][a[0]]), what: `${c.label}, every axis` };
}

function drawMain() {
  const { rows, z, what } = slice(), f = state.d.f_Hz, lf = f.map(Math.log10), base = baseLayout();
  const unit = UNIT[state.sensor], zlo = state.sensor === "acc" ? -95 : -55, zhi = state.sensor === "acc" ? -40 : -20;   // p2-p98 of the data
  const sensorName = state.sensor === "acc" ? "Acceleration" : "Angular rate";
  let traces, layout;
  if (state.view === "map") {
    traces = [{ type: "heatmap", x: f, y: rows, z, zmin: zlo, zmax: zhi, colorscale: TURBO,
      colorbar: { title: { text: unit, side: "right" }, tickfont: { color: css("--ink-soft") } },
      hovertemplate: "%{y}<br>%{x:.1f} Hz: %{z:.1f} " + unit + "<extra></extra>", hoverongaps: false }];
    layout = { ...base, xaxis: { ...base.xaxis, type: "log", title: { text: "frequency (Hz)" } },
      yaxis: { ...base.yaxis, automargin: true },
      shapes: [{ type: "line", x0: f[state.fi], x1: f[state.fi], y0: 0, y1: 1, yref: "paper", line: { color: "#ffffff", width: 1.5, dash: "dot" } }] };
  } else if (state.view === "surf") {
    traces = [{ type: "surface", x: lf, y: rows.map((_, i) => i), z, cmin: zlo, cmax: zhi, colorscale: TURBO,
      colorbar: { title: { text: unit, side: "right" }, tickfont: { color: css("--ink-soft") } },
      customdata: z.map((row) => f), hovertemplate: "%{customdata:.1f} Hz: %{z:.1f} " + unit + "<extra></extra>" }];
    const soft = css("--ink-soft"), grid = css("--plot-grid");
    const ax = (t) => ({ title: { text: t }, color: soft, gridcolor: grid, showbackground: false });
    layout = { ...base, margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: { xaxis: { ...ax("log₁₀ frequency (Hz)") }, yaxis: { ...ax(""), tickvals: rows.map((_, i) => i), ticktext: rows },
        zaxis: { ...ax(unit), range: [zlo, zhi] }, aspectratio: { x: 1.6, y: 1, z: 0.6 }, camera: { eye: { x: -1.2, y: -1.6, z: 0.9 } } } };
  } else {
    const pal = ["#8c8c8c", css("--measured"), css("--ideal"), "#5e944d", "#9a6fc0"];
    traces = rows.map((r, i) => ({ type: "scatter", mode: "lines", x: f, y: z[i], name: r, connectgaps: false,
      line: { color: pal[i % pal.length], width: 1.6 }, hovertemplate: "%{x:.1f} Hz: %{y:.1f}<extra>" + r + "</extra>" }));
    layout = { ...base, margin: { l: 64, r: 16, t: 14, b: 48 },
      xaxis: { ...base.xaxis, type: "log", title: { text: "frequency (Hz)" } },
      yaxis: { ...base.yaxis, title: { text: `PSD (${unit})` }, range: [zlo, zhi] },
      shapes: [{ type: "line", x0: f[state.fi], x1: f[state.fi], y0: 0, y1: 1, yref: "paper", line: { color: css("--gold"), width: 1.5, dash: "dot" } }] };
  }
  Plotly.react($("main-plot"), traces, layout, config);
  $("cap-main").textContent = `${sensorName} PSD, ${what}: ${state.view === "map" ? "rows by frequency, colour = PSD"
    : state.view === "surf" ? "a surface over frequency and row; drag to rotate" : "one line per row"}. `
    + "Blank = frequency the record cannot resolve.";
}

function drawCut() {
  const { rows, z } = slice(), i = state.fi, f = state.d.f_Hz[i], base = baseLayout(), unit = UNIT[state.sensor];
  const vals = z.map((row) => row[i]), floor = state.sensor === "acc" ? -110 : -60;
  // a bar with a base runs from base to base + x, so x is the length above the floor, not the value
  Plotly.react($("cut-plot"), [{ type: "bar", orientation: "h", y: rows, x: vals.map((v) => (v == null ? null : v - floor)),
    base: floor, marker: { color: css("--measured") }, customdata: vals,
    text: vals.map((v) => (v == null ? "not resolved" : `${v.toFixed(1)}`)), textposition: "outside",
    textfont: { color: css("--ink-soft") }, hovertemplate: "%{y}: %{customdata:.1f} " + unit + "<extra></extra>" }], { ...base,
    xaxis: { ...base.xaxis, title: { text: `PSD at ${f.toFixed(1)} Hz (${unit})` },
      range: state.sensor === "acc" ? [-110, -30] : [-60, -5] },
    yaxis: { ...base.yaxis, automargin: true, autorange: "reversed" },
  }, { ...config, displayModeBar: false });
  $("fcur-out").textContent = `${f < 100 ? f.toFixed(1) : f.toFixed(0)} Hz`;
  $("cap-cut").textContent = `Cross-section of the same slice at ${f.toFixed(1)} Hz: each row's PSD, for comparing conditions or axes at one frequency.`;
}

function fillFixed() {
  const sel = $("fixed");
  if (state.slice === "cond") {
    $("fixed-label").textContent = "Axis";
    sel.replaceChildren(...AXES.map(([k, l]) => new Option(l, k)));
    state.fixed = AXES.some((a) => a[0] === state.fixed) ? state.fixed : "sum";
  } else {
    $("fixed-label").textContent = "Condition";
    sel.replaceChildren(...state.d.conditions.map((c, i) => new Option(`${c.label} (${c.seconds} s)`, String(i))));
    state.fixed = /^\d$/.test(state.fixed) ? state.fixed : "2";           // turbo, fan on: the strongest
  }
  sel.value = state.fixed;
}

function update() { drawMain(); drawCut(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Sensor", s.sensor], ["Data", s.data], ["Printed figures", s.static_figures], ["Analysis", s.analysis],
    ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.conditions.length} conditions × 2 sensors × 3 axes · ${d.fs_Hz} Hz sampling · `
    + `records ${Math.min(...d.conditions.map((c) => c.seconds))}–${Math.max(...d.conditions.map((c) => c.seconds))} s`;
}

function nearestIndex(target) {
  const f = state.d.f_Hz; let best = 0;
  for (let i = 1; i < f.length; i++) if (Math.abs(Math.log(f[i] / target)) < Math.abs(Math.log(f[best] / target))) best = i;
  return best;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("slice", (v) => { state.slice = v; fillFixed(); });
  radio("sensor", (v) => { state.sensor = v; });
  radio("view", (v) => { state.view = v; });
  $("fixed").addEventListener("change", (e) => { state.fixed = e.target.value; update(); });
  $("fcur").addEventListener("input", (e) => { state.fi = Number(e.target.value); update(); });
  $("f100").addEventListener("click", () => { state.fi = nearestIndex(100); $("fcur").value = String(state.fi); update(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    state.fi = nearestIndex(100);
    $("fcur").max = String(state.d.f_Hz.length - 1);
    $("fcur").value = String(state.fi);
    fillText();
    fillFixed();
    update();
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the spectra: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
