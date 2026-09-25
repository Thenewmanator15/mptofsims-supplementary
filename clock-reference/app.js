// Clock reference jitter -- supplementary page.
// Reads data.json written by ../reduce.py from scripts/clock/data. The one computation is the
// band integral of scripts/clock/reduce.py: jitter = sqrt(trapezoid of S_x over the band),
// checked in reduce.py against stats.json on the datasheet band.
"use strict";

const state = { d: null, lo: 12e3, hi: 20e6, unit: "L", fmin: 0, fmax: 0 };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COL = { 1: "--measured", 2: "--ideal" };

function integrated(ch, lo, hi) {          // seconds
  const c = state.d.channels[ch];
  let s = 0, prev = null;
  for (let i = 0; i < c.f_Hz.length; i++) {
    const f = c.f_Hz[i];
    if (f < lo || f > hi) continue;
    if (prev !== null) s += 0.5 * (c.Sx[i] + c.Sx[prev]) * (f - c.f_Hz[prev]);
    prev = i;
  }
  return Math.sqrt(s);
}

const fmtF = (f) => (f >= 1e6 ? `${(f / 1e6).toPrecision(3)} MHz` : `${(f / 1e3).toPrecision(3)} kHz`);
const toF = (pos) => state.fmin * (state.fmax / state.fmin) ** (pos / 1000);
const toPos = (f) => Math.round((1000 * Math.log(f / state.fmin)) / Math.log(state.fmax / state.fmin));

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 70, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.1, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

function drawPn() {
  const base = baseLayout(), traces = [];
  for (const ch of ["1", "2"]) {
    const c = state.d.channels[ch];
    const y = state.unit === "L" ? c.L : c.Sx.map((v) => Math.sqrt(v) * 1e15);
    traces.push({ type: "scatter", mode: "lines", x: c.f_Hz, y, name: `${c.power} output`,
      line: { color: css(COL[ch]), width: 1.2 },
      hovertemplate: state.unit === "L" ? "%{x:.3s}Hz: %{y:.1f} dBc/Hz<extra></extra>" : "%{x:.3s}Hz: %{y:.2f} fs/√Hz<extra></extra>" });
  }
  Plotly.react($("pn-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "offset frequency (Hz)" } },
    yaxis: { ...base.yaxis, type: state.unit === "L" ? "linear" : "log",
      title: { text: state.unit === "L" ? "L(f) (dBc/Hz)" : "jitter density (fs/√Hz)" } },
    shapes: [{ type: "rect", xref: "x", yref: "paper", x0: state.lo, x1: state.hi, y0: 0, y1: 1,
      fillcolor: css("--gold"), opacity: 0.12, line: { width: 0 } }],
  }, config);
}

function drawAdev() {
  const base = baseLayout(), d = state.d, c1 = d.channels["1"];
  const anchor = c1.adev[0] * c1.tau_s[0];                    // tau^-1 through the first +6 dBm point
  const traces = ["1", "2"].map((ch) => ({ type: "scatter", mode: "lines+markers", x: d.channels[ch].tau_s, y: d.channels[ch].adev,
    name: `${d.channels[ch].power} (floor)`, line: { color: css(COL[ch]), width: 1.6 }, marker: { size: 4 },
    hovertemplate: "τ = %{x:.2e} s: %{y:.2e}<extra></extra>" }));
  traces.push({ type: "scatter", mode: "lines", x: [1e-8, 1], y: [anchor / 1e-8, anchor], name: "τ⁻¹ floor",
    line: { color: css("--ink-soft"), dash: "dot", width: 1.2 }, hoverinfo: "skip" });
  traces.push({ type: "scatter", mode: "markers", x: [1], y: [d.spec_adev_1s], name: "datasheet at 1 s",
    marker: { symbol: "star", size: 14, color: css("--ink") }, hovertemplate: "datasheet σ_y(1 s) = %{y:.0e}<extra></extra>" });
  Plotly.react($("adev-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "averaging time τ (s)" }, range: [Math.log10(8e-9), Math.log10(2)] },
    yaxis: { ...base.yaxis, type: "log", title: { text: "Allan deviation σ_y(τ)" }, exponentformat: "power" },
  }, config);
}

function drawHist() {
  const base = baseLayout(), d = state.d;
  const traces = ["1", "2"].map((ch) => {
    const h = d.channels[ch].hist, tot = h.count.reduce((a, b) => a + b, 0);
    return { type: "scatter", mode: "lines", x: h.bin_s.map((v) => v * 1e12), y: h.count.map((v) => v / tot),
      name: `${d.channels[ch].power}`, line: { color: css(COL[ch]), width: 1.6, shape: "hv" },
      hovertemplate: "%{x:.1f} ps: %{y:.4f}<extra></extra>" };
  });
  Plotly.react($("hist-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "time-interval error (ps)" } },
    yaxis: { ...base.yaxis, title: { text: "fraction of edges" } },
  }, config);
}

function readouts() {
  const d = state.d;
  $("lo-out").textContent = fmtF(state.lo);
  $("hi-out").textContent = fmtF(state.hi);
  for (const ch of ["1", "2"]) $(`r-${ch}`).textContent = `${(integrated(ch, state.lo, state.hi) * 1e12).toFixed(2)} ps`;
  $("r-spec").textContent = `${d.spec_jitter_fs} fs`;
  $("r-tie").textContent = `${d.channels["1"].tie_rms_ps.toFixed(1)} / ${d.channels["2"].tie_rms_ps.toFixed(1)} ps`;
  $("cap-pn").textContent = `(1) Phase noise reconstructed from the time-interval-error record. The shaded band, `
    + `${fmtF(state.lo)} – ${fmtF(state.hi)}, is integrated for the readouts; the datasheet band is 12 kHz – 20 MHz.`;
}

function update(all = true) { readouts(); drawPn(); if (all) { drawAdev(); drawHist(); } }

function fillText() {
  const d = state.d, s = d.source, f = d.channels["1"].f_Hz;
  state.fmin = f[0]; state.fmax = f[f.length - 1];
  state.lo = Math.max(d.band_Hz[0], state.fmin); state.hi = Math.min(d.band_Hz[1], state.fmax);
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Device", s.device], ["Data", s.data], ["Printed figures", s.static_figures],
    ["Analysis", s.analysis], ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured, floor-limited · ${d.f0_Hz / 1e6} MHz reference · ${d.record_s * 1e3} ms records · `
    + `spectrum ${fmtF(state.fmin)} – ${fmtF(state.fmax)}`;
}

function wire() {
  const lo = $("lo"), hi = $("hi");
  const sync = () => { lo.value = String(toPos(state.lo)); hi.value = String(toPos(state.hi)); update(false); };
  lo.addEventListener("input", () => { state.lo = Math.min(toF(Number(lo.value)), state.hi * 0.99); update(false); });
  hi.addEventListener("input", () => { state.hi = Math.max(toF(Number(hi.value)), state.lo * 1.01); update(false); });
  $("band-std").addEventListener("click", () => { state.lo = Math.max(12e3, state.fmin); state.hi = Math.min(20e6, state.fmax); sync(); });
  $("band-all").addEventListener("click", () => { state.lo = state.fmin; state.hi = state.fmax; sync(); });
  document.querySelectorAll('input[name="unit"]').forEach((el) => el.addEventListener("change", () => { state.unit = el.value; drawPn(); }));
  lo.value = String(toPos(state.lo)); hi.value = String(toPos(state.hi));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => update());
  new MutationObserver(() => update()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=a65271c144");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    wire();
    update();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the measurements: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
