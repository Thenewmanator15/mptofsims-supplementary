// Detector coupling -- supplementary page.
// Reads data.json written by ../reduce.py: |S21| of the Copper Mountain sweeps, int16 at 0.01 dB
// on each file's linear grid. The rolling mean is scripts/detector/analyze.py's rmean (w = 51,
// edge-aware). The median band (1 MHz - 1 GHz) is the one analyze.py prints.
"use strict";

const state = { d: null, tr: [], ab: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function unpack(t, step) {
  const bytes = Uint8Array.from(atob(t.s21), (c) => c.charCodeAt(0));
  if (bytes.length !== 2 * t.n) throw new Error(`${t.name}: length mismatch`);
  const v = new DataView(bytes.buffer), y = new Float64Array(t.n), f = new Float64Array(t.n);
  for (let i = 0; i < t.n; i++) { y[i] = v.getInt16(2 * i, true) * step; f[i] = t.f0 + i * t.df; }
  return { ...t, f, y };
}

function rmean(y, w = 51) {                 // analyze.py rmean: window shrinks at the ends
  const h = Math.floor(w / 2), out = new Float64Array(y.length);
  let s = 0, lo = 0, hi = -1;
  for (let i = 0; i < y.length; i++) {
    const a = Math.max(0, i - h), b = Math.min(y.length - 1, i + h);
    while (hi < b) s += y[++hi];
    while (lo < a) s -= y[lo++];
    out[i] = s / (hi - lo + 1);
  }
  return out;
}

function median(a) { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
const bandMedian = (t) => median(Array.from(t.y).filter((_, i) => t.f[i] >= 1e6 && t.f[i] <= 1e9));

const label = (t) => `Ch ${t.channel} · ${["no choke", "1 choke", "2 chokes"][t.chokes]} · star ${t.star ? "on" : "off"}`;
const shown = () => state.tr.filter((t) => $(`c-${t.channel}`).checked && $(`k-${t.chokes}`).checked && $(`s-${t.star ? 1 : 0}`).checked);

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 64, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.12, x: 0, font: { color: soft, size: 11 } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

function colourFor(t) {
  const hues = { A: ["--measured", "#4f8fd0", "#8fb8e6"], B: ["--ideal", "#e08a3c", "#f2b884"] };
  const c = hues[t.channel][t.chokes];
  return c.startsWith("--") ? css(c) : c;
}

function drawS21() {
  const sm = $("smooth").checked, base = baseLayout();
  const traces = shown().map((t) => ({ type: "scatter", mode: "lines", x: t.f, y: sm ? rmean(t.y) : t.y, name: label(t),
    line: { color: colourFor(t), width: sm ? 1.6 : 0.8, dash: t.star ? "solid" : "dot" },
    hovertemplate: "%{x:.3s}Hz: %{y:.1f} dB<extra>" + label(t) + "</extra>" }));
  Plotly.react($("s21-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "frequency (Hz)" }, range: [5, Math.log10(2e9)] },
    yaxis: { ...base.yaxis, title: { text: "|S21|, channel → detector (dB)" }, range: [-125, -45] },
  }, config);
}

function drawAB() {
  const base = baseLayout(), cm = state.d.cm_pF * 1e-12, cols = [css("--measured"), css("--ideal"), css("--ink-soft")];
  const fref = Array.from({ length: 40 }, (_, i) => 2e5 * (1e7 / 2e5) ** (i / 39));
  Plotly.react($("ab-plot"), [
    ...state.ab.map((t, i) => ({ type: "scatter", mode: "lines", x: t.f, y: t.y, name: t.label,
      line: { color: cols[i], width: 1 }, hovertemplate: "%{x:.3s}Hz: %{y:.1f} dB<extra>" + t.label + "</extra>" })),
    { type: "scatter", mode: "lines", x: fref, y: fref.map((f) => 20 * Math.log10(2 * 2 * Math.PI * f * cm * 50)),
      name: `series Cm ≈ ${state.d.cm_pF.toFixed(1)} pF`, line: { color: css("--ink"), dash: "dash", width: 1.2 }, hoverinfo: "skip" },
  ], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "frequency (Hz)" }, range: [Math.log10(9e4), Math.log10(2e9)] },
    yaxis: { ...base.yaxis, title: { text: "|S21|, electrode A → B (dB)" }, range: [-75, 6] },
  }, config);
}

function readouts() {
  const s = shown(), meds = s.map(bandMedian);
  $("r-n").textContent = `${s.length} of ${state.tr.length}`;
  $("r-med").textContent = meds.length ? (meds.length === 1 ? `${meds[0].toFixed(1)} dB` : `${Math.min(...meds).toFixed(1)} … ${Math.max(...meds).toFixed(1)} dB`) : "—";
  $("r-spread").textContent = meds.length > 1 ? `${(Math.max(...meds) - Math.min(...meds)).toFixed(1)} dB` : "—";
  $("r-cm").textContent = `≈ ${state.d.cm_pF.toFixed(1)} pF (upper bound)`;
}

function update() { readouts(); drawS21(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const dates = [...new Set([...d.traces, ...d.cross].map((t) => t.date).filter(Boolean))];
  const prov = [["Instrument", s.instrument], ["Set-up", s.setup], ["Header dates", dates.join(", ")], ["Data", s.data],
    ["Printed figures", s.static_figures], ["Analysis", s.analysis], ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.traces.length} channel-to-detector sweeps + ${d.cross.length} electrode-to-electrode sweeps`;
}

function wire() {
  ["c-A", "c-B", "k-0", "k-1", "k-2", "s-0", "s-1", "smooth"].forEach((id) => $(id).addEventListener("change", update));
  const redraw = () => { update(); drawAB(); };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    state.tr = state.d.traces.map((t) => unpack(t, state.d.step));
    state.ab = state.d.cross.map((t) => unpack(t, state.d.step));
    fillText();
    update();
    drawAB();
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the sweeps: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
