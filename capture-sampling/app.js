// Capture sample rate -- supplementary page.
// Reads data.json written by ../reduce.py. Sampling follows scripts/sampling/analyze.py:
// a grid starting at t[0] + phase with spacing 1/fs, values by linear interpolation,
// loss = (true peak - tallest sample) / true peak; area = sum(samples) / fs vs the trapezoid integral.
"use strict";

const state = { d: null, t: null, pulses: null, sel: -1, fs: 1.0, phase: 0 };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const FS_MIN = 0.6, FS_MAX = 10;
const PHASES = 101;                       // fine phase scan for single-pulse worst case / panel (c)

function decodePulses(d) {
  const bytes = Uint8Array.from(atob(d.pulses), (c) => c.charCodeAt(0));
  if (bytes.length !== 2 * d.n_pulses * d.n_t) throw new Error("pulse grid size does not match data.json");
  const view = new DataView(bytes.buffer), out = [];
  for (let p = 0; p < d.n_pulses; p++) {
    const row = new Float64Array(d.n_t);
    for (let i = 0; i < d.n_t; i++) row[i] = view.getInt16(2 * (p * d.n_t + i), true) / d.scale;
    out.push(row);
  }
  return out;
}

// np.interp on a uniform grid t0 + k*dt
function interp(y, t0, dt, x) {
  const u = (x - t0) / dt, i = Math.floor(u);
  if (i < 0) return y[0];
  if (i >= y.length - 1) return y[y.length - 1];
  const f = u - i;
  return y[i] * (1 - f) + y[i + 1] * f;
}

const current = () => (state.sel < 0 ? state.d.mean : state.pulses[state.sel]);
const peakOf = (y) => y.reduce((m, v) => (v > m ? v : m), -Infinity);

function trapz(y, dt) {
  let s = 0;
  for (let i = 1; i < y.length; i++) s += (y[i] + y[i - 1]) * 0.5 * dt;
  return s;
}

// Samples of y at rate fs (GS/s) and phase (fraction of a sample period).
function sample(y, fs, phase) {
  const d = state.d, dt = 1 / fs, tEnd = d.t0_ns + (d.n_t - 1) * d.dt_ns;
  const xs = [], ys = [];
  for (let x = d.t0_ns + phase * dt; x < tEnd; x += dt) { xs.push(x); ys.push(interp(y, d.t0_ns, d.dt_ns, x)); }
  return { xs, ys };
}

function errors(y, fs, phase) {
  const pk = peakOf(y), s = sample(y, fs, phase);
  const top = peakOf(s.ys), area = s.ys.reduce((a, v) => a + v, 0) / fs;
  const atrue = trapz(y, state.d.dt_ns);
  return { loss: (pk - top) / pk * 100, area: (atrue - area) / atrue * 100, s, top };
}

function worstPhase(y, fs) {
  let best = { phase: 0, loss: -1 };
  for (let k = 0; k < PHASES; k++) {
    const ph = k / (PHASES - 1), e = errors(y, fs, ph);
    if (e.loss > best.loss) best = { phase: ph, loss: e.loss };
  }
  return best;
}

function fwhm(y) {
  const half = peakOf(y) / 2;
  let a = -1, b = -1;
  for (let i = 0; i < y.length; i++) if (y[i] >= half) { if (a < 0) a = i; b = i; }
  return (b - a) * state.d.dt_ns;
}

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 62, r: 16, t: 14, b: 48 }, showlegend: false,
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true,
  modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d", "autoScale2d"] };

function drawPulse(e) {
  const d = state.d, y = current();
  const t = Array.from({ length: d.n_t }, (_, i) => d.t0_ns + i * d.dt_ns);
  const tpk = t[y.indexOf(peakOf(y))];
  const stemX = [], stemY = [];
  e.s.xs.forEach((x, i) => { stemX.push(x, x, null); stemY.push(0, e.s.ys[i], null); });
  const base = baseLayout();
  Plotly.react($("pulse-plot"), [
    { type: "scatter", mode: "lines", x: t, y: Array.from(y), line: { color: css("--trace"), width: 2 },
      hovertemplate: "%{x:.1f} ns: %{y:.3f}<extra>pulse</extra>" },
    { type: "scatter", mode: "lines", x: stemX, y: stemY, line: { color: css("--measured"), width: 1.2 }, hoverinfo: "skip" },
    { type: "scatter", mode: "markers", x: e.s.xs, y: e.s.ys,
      marker: { color: css("--measured"), size: 8 }, hovertemplate: "%{x:.2f} ns: %{y:.3f}<extra>sample</extra>" },
    { type: "scatter", mode: "lines", x: [tpk - 6, tpk + 6], y: [e.top, e.top],
      line: { color: css("--ideal"), width: 1.6, dash: "dash" }, hovertemplate: "tallest sample %{y:.3f}<extra></extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "time (ns)" }, range: [tpk - 6, tpk + 6] },
    yaxis: { ...base.yaxis, title: { text: "amplitude (peak = 1)" }, range: [-0.25, 1.1] },
  }, config);
}

function drawPhase(e) {
  const y = current(), ph = [], h = [], a = [];
  for (let k = 0; k < 200; k++) {
    const p = k / 199, r = errors(y, state.fs, p);
    ph.push(p); h.push(r.loss); a.push(r.area);
  }
  const base = baseLayout();
  Plotly.react($("phase-plot"), [
    { type: "scatter", mode: "lines", x: ph, y: h, line: { color: css("--ideal"), width: 2 }, hovertemplate: "phase %{x:.2f}: %{y:.1f} %<extra>height</extra>" },
    { type: "scatter", mode: "lines", x: ph, y: a, line: { color: css("--measured"), width: 2 }, hovertemplate: "phase %{x:.2f}: %{y:.2f} %<extra>area</extra>" },
    { type: "scatter", mode: "markers", x: [state.phase, state.phase], y: [e.loss, e.area],
      marker: { color: [css("--ideal"), css("--measured")], size: 10, line: { color: css("--panel"), width: 2 } }, hoverinfo: "skip" },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: `grid phase at ${state.fs.toFixed(2)} GS/s (of a sample)` }, range: [0, 1] },
    yaxis: { ...base.yaxis, title: { text: "error (%)" } },
  }, config);
}

function drawRate() {
  const en = state.d.ensemble, y = current();
  const fsl = en.fs_gs.filter((_, i) => i % 2 === 0);                 // selected pulse, every other rate
  const mine = fsl.map((f) => worstPhase(y, f).loss);
  const band = { x: [...en.fs_gs, ...[...en.fs_gs].reverse()], y: [...en.p90, ...[...en.p10].reverse()] };
  const here = worstPhase(y, state.fs).loss;
  const base = baseLayout();
  const mark = (x, label) => ({ type: "line", x0: x, x1: x, y0: 0, y1: 1, yref: "paper",
    line: { color: css("--ink-soft"), width: 1, dash: "dot" } });
  Plotly.react($("rate-plot"), [
    { type: "scatter", mode: "lines", x: band.x, y: band.y, fill: "toself", fillcolor: css("--measured") + "33",
      line: { width: 0 }, hoverinfo: "skip" },
    { type: "scatter", mode: "lines", x: en.fs_gs, y: en.p50, line: { color: css("--measured"), width: 2.2 },
      hovertemplate: "%{x:.2f} GS/s: %{y:.1f} %<extra>median of 152</extra>" },
    { type: "scatter", mode: "lines", x: fsl, y: mine, line: { color: css("--ideal"), width: 1.6 },
      hovertemplate: "%{x:.2f} GS/s: %{y:.1f} %<extra>selected pulse</extra>" },
    { type: "scatter", mode: "markers", x: [state.fs], y: [here],
      marker: { color: css("--ideal"), size: 11, line: { color: css("--panel"), width: 2 } }, hoverinfo: "skip" },
  ], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "sample rate (GS/s)" }, range: [Math.log10(FS_MIN), Math.log10(FS_MAX)] },
    yaxis: { ...base.yaxis, title: { text: "worst-case peak-height loss (%)" }, rangemode: "tozero" },
    shapes: [mark(state.d.marks.fmc121_gs), mark(state.d.marks.knee_gs)],
    annotations: [
      { x: Math.log10(state.d.marks.fmc121_gs), y: 1, yref: "paper", text: "FMC121", showarrow: false, xanchor: "left", yanchor: "top", font: { color: css("--ink-soft"), size: 11 } },
      { x: Math.log10(state.d.marks.knee_gs), y: 1, yref: "paper", text: "~5 % knee", showarrow: false, xanchor: "left", yanchor: "top", font: { color: css("--ink-soft"), size: 11 } },
    ],
  }, config);
}

function update(redrawRate = true) {
  const y = current(), e = errors(y, state.fs, state.phase), w = worstPhase(y, state.fs);
  $("rate-out").textContent = `${state.fs.toFixed(2)} GS/s`;
  $("phase-out").textContent = state.phase.toFixed(2);
  $("r-spf").textContent = (fwhm(y) * state.fs).toFixed(1);
  $("r-loss").textContent = `${e.loss.toFixed(1)} %`;
  $("r-worst").textContent = `${w.loss.toFixed(1)} %`;
  $("r-area").textContent = `${e.area >= 0 ? "" : "−"}${Math.abs(e.area).toFixed(2)} %`;
  const clip = state.sel >= 0 && state.d.clipped[state.sel];
  $("cap-pulse").innerHTML = "(a) The pulse on its 0.1&nbsp;ns grid, the samples a slower digitiser would take, "
    + "and the tallest of them (dashed)." + (clip ? ' <span class="flag">This capture clipped at the scope: its true peak is higher than shown.</span>' : "");
  drawPulse(e);
  drawPhase(e);
  if (redrawRate) drawRate();
}

const toFs = (pos) => FS_MIN * (FS_MAX / FS_MIN) ** (pos / 1000);
const toPos = (fs) => Math.round((1000 * Math.log(fs / FS_MIN)) / Math.log(FS_MAX / FS_MIN));

function fillText() {
  const d = state.d, s = d.source;
  const sel = $("pulse");
  const opts = [new Option("Mean of 152 (as printed panel d)", "-1")];
  for (let i = 0; i < d.n_pulses; i++) opts.push(new Option(`Capture ${i + 1}${d.clipped[i] ? " (clipped)" : ""}`, String(i)));
  sel.replaceChildren(...opts);
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Grid", s.reduced_grid], ["Data", s.file], ["SHA-256", s.sha256],
    ["Printed figure", s.static_figure], ["Analysis", s.analysis], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  const med = d.fwhm_ns.slice().sort((a, b) => a - b)[Math.floor(d.n_pulses / 2)];
  $("status").textContent = `Measured · ${d.n_pulses} single-ion pulses, FWHM median ${med.toFixed(2)} ns`;
}

function wire() {
  const rate = $("rate"), phase = $("phase");
  const setFs = (fs) => { state.fs = fs; rate.value = String(toPos(fs)); update(); };
  rate.value = String(toPos(state.fs));
  rate.addEventListener("input", () => { state.fs = toFs(Number(rate.value)); update(); });
  phase.addEventListener("input", () => { state.phase = Number(phase.value) / 1000; update(false); });
  document.querySelectorAll("[data-rate]").forEach((b) => b.addEventListener("click", () => setFs(Number(b.dataset.rate))));
  $("worst").addEventListener("click", () => {
    state.phase = worstPhase(current(), state.fs).phase; phase.value = String(Math.round(state.phase * 1000)); update(false);
  });
  $("pulse").addEventListener("change", (ev) => { state.sel = Number(ev.target.value); update(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => update());
  new MutationObserver(() => update()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    state.pulses = decodePulses(state.d);
    state.phase = worstPhase(state.d.mean, state.fs).phase;       // open where the printed panel (a) does
    $("phase").value = String(Math.round(state.phase * 1000));
    fillText();
    wire();
    update();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the pulses: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
