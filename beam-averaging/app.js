// Beam-current averaging -- supplementary page.
// Reads data.json written by ../reduce.py. The block RMS is the definition in
// scripts/beam-current/analyze.py (block_rms): std of non-overlapping w-sample block means.
"use strict";

const state = { d: null, sig: null, sigma0: 0, curve: null, n: 64 };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function std(a) {
  let m = 0;
  for (const v of a) m += v;
  m /= a.length;
  let s = 0;
  for (const v of a) s += (v - m) ** 2;
  return Math.sqrt(s / a.length);            // population std, as numpy's default
}

// Means of non-overlapping w-sample blocks; null when fewer than two blocks fit.
function blockMeans(a, w) {
  const nb = Math.floor(a.length / w);
  if (nb < 2) return null;
  const out = new Array(nb);
  for (let b = 0; b < nb; b++) {
    let s = 0;
    for (let i = b * w; i < (b + 1) * w; i++) s += a[i];
    out[b] = s / w;
  }
  return out;
}
const blockRms = (a, w) => { const m = blockMeans(a, w); return m ? std(m) : null; };

// Slider position (0..1000) <-> N on a log scale from 1 to n_max, snapped to an integer.
const toN = (pos) => Math.max(1, Math.round(10 ** ((pos / 1000) * Math.log10(state.d.n_max))));
const toPos = (n) => Math.round((1000 * Math.log10(n)) / Math.log10(state.d.n_max));

async function load() {
  const res = await fetch("data.json");
  if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
  const d = await res.json();
  if (d.current_pA.length !== d.n) throw new Error("data.json: reading count does not match n");
  state.d = d;
  const mean = d.current_pA.reduce((s, v) => s + v, 0) / d.n;
  state.sig = d.current_pA.map((v) => v - mean);
  state.sigma0 = blockRms(state.sig, 1);
  // every integer N on a fine log grid, like the static figure's `wins`
  const ns = [...new Set(Array.from({ length: 400 }, (_, i) =>
    Math.round(10 ** ((i / 399) * Math.log10(d.n_max)))))];
  state.curve = { ns, rms: ns.map((n) => blockRms(state.sig, n)) };
  state.n = d.n_selected;
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

function drawTrace() {
  const d = state.d, n = state.n, t = state.sig.map((_, i) => i * d.dt_s);
  const means = blockMeans(state.sig, n) || [];
  // block means as a step line: one flat segment per block, gaps between blocks
  const bx = [], by = [];
  means.forEach((m, b) => { bx.push(b * n * d.dt_s, ((b + 1) * n - 1) * d.dt_s, null); by.push(m, m, null); });
  const base = baseLayout();
  Plotly.react($("trace"), [
    // plain SVG, not scattergl: a WebGL canvas paints over SVG traces and hid the block means
    { type: "scatter", mode: "lines", x: t, y: state.sig, line: { color: css("--trace"), width: 1 },
      hovertemplate: "%{x:.2f} s: %{y:.1f} pA<extra>reading</extra>" },
    { type: "scatter", mode: "lines", x: bx, y: by, line: { color: css("--measured"), width: 2.4 },
      hovertemplate: "%{y:.2f} pA<extra>block mean</extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "time from first reading (s)" } },
    yaxis: { ...base.yaxis, title: { text: "stage current, mean removed (pA)" }, range: [-260, 260] },
  }, config);
  $("cap-trace").textContent = `(a) The record, mean removed, with ${means.length} block means of `
    + `${n} readings overlaid. Drag to zoom.`;
}

function drawCurve() {
  const { ns, rms } = state.curve, s0 = state.sigma0, n = state.n;
  const here = blockRms(state.sig, n);
  const base = baseLayout();
  Plotly.react($("curve"), [
    { type: "scatter", mode: "lines", x: ns, y: ns.map((k) => s0 / Math.sqrt(k)),
      line: { color: css("--ideal"), width: 1.8, dash: "dash" }, hovertemplate: "N=%{x}: %{y:.2f} pA<extra>σ₀/√N</extra>" },
    { type: "scatter", mode: "lines", x: ns, y: rms, connectgaps: false,
      line: { color: css("--measured"), width: 2.2 }, hovertemplate: "N=%{x}: %{y:.2f} pA<extra>measured</extra>" },
    { type: "scatter", mode: "markers", x: [n], y: [here],
      marker: { color: css("--measured"), size: 11, line: { color: css("--panel"), width: 2 } },
      hovertemplate: "N=%{x}: %{y:.2f} pA<extra>selected</extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "readings averaged, N" } },
    yaxis: { ...base.yaxis, type: "log", title: { text: "residual RMS (pA)" } },
  }, config);
}

function readouts() {
  const d = state.d, n = state.n, r = blockRms(state.sig, n), s0 = state.sigma0;
  $("n-out").textContent = String(n);
  $("r-time").textContent = `${(n * d.dt_s).toFixed(n * d.dt_s < 10 ? 2 : 1)} s`;
  $("r-rms").textContent = r === null ? "—" : `${r.toFixed(2)} pA`;
  $("r-ideal").textContent = `${(s0 / Math.sqrt(n)).toFixed(2)} pA`;
  $("r-gain").textContent = r === null ? "—" : `${(s0 / r).toFixed(0)}× (√N: ${Math.sqrt(n).toFixed(1)}×)`;
}

function update() { readouts(); drawTrace(); drawCurve(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Record", `${s.file} · ${s.condition}`],
    ["Readings", `${d.n} from ${s.first_reading} to ${s.last_reading}`], ["SHA-256", s.sha256],
    ["Printed figure", s.static_figure], ["Analysis", s.analysis], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · σ₀ = ${state.sigma0.toFixed(1)} pA over ${d.n} readings, `
    + `one every ~${(d.dt_s * 1e3).toFixed(0)} ms`;
}

function wire() {
  const slider = $("window");
  slider.value = String(toPos(state.n));
  slider.addEventListener("input", () => { state.n = toN(Number(slider.value)); update(); });
  $("reset").addEventListener("click", () => {
    state.n = state.d.n_selected; slider.value = String(toPos(state.n)); update();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    await load();
    fillText();
    wire();
    update();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the record: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
