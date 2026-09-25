// Beam-current averaging -- supplementary page.
// Reads data.json written by ../reduce.py: all 16 noise-survey conditions. The block RMS is the
// definition in scripts/beam-current/analyze.py (block_rms): std of non-overlapping w-sample block
// means. The page opens on Baseline_Noise, the record of the printed fig_averaging.
"use strict";

const state = { d: null, c: null, sig: null, sigma0: 0, curve: null, n: 64 };
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

const nMax = () => Math.min(state.d.n_max, Math.floor(state.c.n / 2));
const toN = (pos) => Math.max(1, Math.round(10 ** ((pos / 1000) * Math.log10(nMax()))));
const toPos = (n) => Math.round((1000 * Math.log10(n)) / Math.log10(nMax()));
const nameOf = (c) => (c.label ? `${c.label} — ${c.key}` : c.key);

function select(c) {
  state.c = c;
  const mean = c.current_pA.reduce((s, v) => s + v, 0) / c.n;
  state.sig = c.current_pA.map((v) => v - mean);
  state.sigma0 = blockRms(state.sig, 1);
  const top = nMax();
  const ns = [...new Set(Array.from({ length: 400 }, (_, i) => Math.round(10 ** ((i / 399) * Math.log10(top)))))];
  state.curve = { ns, rms: ns.map((n) => blockRms(state.sig, n)) };
  state.n = Math.min(state.n, top);
  $("window").value = String(toPos(state.n));
  $("cond").value = `${c.file}|${c.key}`;
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

function drawSurvey() {
  const cs = [...state.d.conditions].sort((a, b) => a.rms_pA - b.rms_pA), base = baseLayout();
  const sel = (c) => c === state.c;
  Plotly.react($("survey"), [{
    type: "bar", orientation: "h", x: cs.map((c) => c.rms_pA), y: cs.map((c, i) => i),
    marker: { color: cs.map((c) => (sel(c) ? css("--gold") : css("--measured"))) },
    customdata: cs.map((c) => `${c.file}|${c.key}`), text: cs.map((c) => `${c.rms_pA.toFixed(1)} pA`),
    textposition: "outside", textfont: { color: css("--ink-soft"), size: 11 },
    hovertemplate: "%{x:.2f} pA<extra></extra>",
  }], { ...base, margin: { l: Math.min(400, 20 + 6.2 * Math.max(...cs.map((c) => (c.label || c.key).length))), r: 60, t: 8, b: 40 },
    xaxis: { ...base.xaxis, type: "log", title: { text: "RMS noise (pA)" } },
    yaxis: { ...base.yaxis, tickvals: cs.map((c, i) => i), ticktext: cs.map((c) => (c.label || c.key)),
      automargin: true, tickfont: { size: 10 } },
  }, { ...config, displayModeBar: false });
}

function drawTrace() {
  const c = state.c, n = state.n, t = state.sig.map((_, i) => i * c.dt_s);
  const means = blockMeans(state.sig, n) || [];
  const bx = [], by = [];
  means.forEach((m, b) => { bx.push(b * n * c.dt_s, ((b + 1) * n - 1) * c.dt_s, null); by.push(m, m, null); });
  const lim = 1.1 * Math.max(...state.sig.map(Math.abs));
  const base = baseLayout();
  Plotly.react($("trace"), [
    // plain SVG, not scattergl: a WebGL canvas paints over SVG traces and hid the block means
    { type: "scatter", mode: "lines", x: t, y: state.sig, line: { color: css("--trace"), width: 1 },
      hovertemplate: "%{x:.2f} s: %{y:.1f} pA<extra>reading</extra>" },
    { type: "scatter", mode: "lines", x: bx, y: by, line: { color: css("--measured"), width: 2.4 },
      hovertemplate: "%{y:.2f} pA<extra>block mean</extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "time from first reading (s)" } },
    yaxis: { ...base.yaxis, title: { text: "current, mean removed (pA)" }, range: [-lim, lim] },
  }, config);
  $("cap-trace").textContent = `(a) ${nameOf(c)}: ${c.n} readings, mean removed, with ${means.length} block means of `
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
  const c = state.c, n = state.n, r = blockRms(state.sig, n), s0 = state.sigma0;
  $("n-out").textContent = String(n);
  $("r-time").textContent = `${(n * c.dt_s).toFixed(n * c.dt_s < 10 ? 2 : 1)} s`;
  $("r-rms").textContent = r === null ? "—" : `${r.toFixed(2)} pA`;
  $("r-ideal").textContent = `${(s0 / Math.sqrt(n)).toFixed(2)} pA`;
  $("r-gain").textContent = r === null ? "—" : `${(s0 / r).toFixed(0)}× (√N: ${Math.sqrt(n).toFixed(1)}×)`;
  $("status").textContent = `Measured · ${nameOf(c)} · σ₀ = ${s0.toFixed(1)} pA over ${c.n} readings, `
    + `one every ~${(c.dt_s * 1e3).toFixed(0)} ms`;
}

function update(all = false) { readouts(); drawTrace(); drawCurve(); if (all) drawSurvey(); }

function fillText() {
  const d = state.d, s = d.source;
  const groups = {};
  for (const c of d.conditions) (groups[c.file] ||= []).push(c);
  $("cond").replaceChildren(...Object.entries(groups).map(([f, cs]) => {
    const g = document.createElement("optgroup"); g.label = f;
    g.append(...cs.map((c) => new Option(`${nameOf(c)} (${c.rms_pA.toFixed(1)} pA)`, `${c.file}|${c.key}`)));
    return g;
  }));
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ...s.files.map((f) => ["Record", f]), ...Object.entries(s.sha256),
    ["Printed figure", s.static_figure], ["Analysis", s.analysis], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
}

const find = (v) => state.d.conditions.find((c) => `${c.file}|${c.key}` === v);

function wire() {
  const slider = $("window");
  slider.addEventListener("input", () => { state.n = toN(Number(slider.value)); update(); });
  $("reset").addEventListener("click", () => { state.n = Math.min(state.d.n_selected, nMax()); slider.value = String(toPos(state.n)); update(); });
  $("cond").addEventListener("change", (e) => { select(find(e.target.value)); update(true); });
  $("survey").on("plotly_click", (ev) => { const c = find(ev.points[0].customdata); if (c) { select(c); update(true); } });
  const redraw = () => update(true);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=7a3ffac3eb");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    for (const c of state.d.conditions) if (c.current_pA.length !== c.n) throw new Error(`${c.key}: reading count mismatch`);
    fillText();
    state.n = state.d.n_selected;
    select(find(state.d.default.join("|")));
    update(true);
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the records: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
