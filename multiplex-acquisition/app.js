// Multiplexed acquisition -- supplementary page (SIMULATION).
// Reads data.json written by ../reduce.py from scripts/multiplex-sim's committed CSVs.
// Nothing is simulated here. The one curve drawn from a formula is the closed form
// simulate.jl itself writes as shot_cf: gain = sqrt((N+1) / (2 N occupancy)).
"use strict";

const state = { d: null, occ: 0.02 };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const OCC_MIN = 0.01, OCC_MAX = 1;

const gainCf = (occ) => Math.sqrt((state.d.N + 1) / (2 * state.d.N * occ));
const toOcc = (pos) => OCC_MIN * (OCC_MAX / OCC_MIN) ** (pos / 1000);
const toPos = (o) => Math.round((1000 * Math.log(o / OCC_MIN)) / Math.log(OCC_MAX / OCC_MIN));

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 62, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.12, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true,
  modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d", "autoScale2d"] };

function drawGain() {
  const d = state.d, o = d.occupancy, se = d.mc_rel_se;
  const xs = Array.from({ length: 200 }, (_, i) => OCC_MIN * 0.9 * ((OCC_MAX * 1.02) / (OCC_MIN * 0.9)) ** (i / 199));
  const models = [
    ["m-shot", "shot_mc", "shot noise, F = 1", "circle", css("--measured")],
    ["m-fano", "fano_mc", "F = 20", "square", css("--ideal")],
    ["m-beam", "beam_mc", "F = 20 + beam modulation", "diamond", css("--ink-soft")],
  ];
  const traces = [
    { type: "scatter", mode: "lines", x: xs, y: xs.map(gainCf), name: "closed form",
      line: { color: css("--ink"), width: 1.8 }, hovertemplate: "occupancy %{x:.3f}: gain %{y:.2f}<extra>closed form</extra>" },
  ];
  for (const [id, key, name, sym, colour] of models) {
    if (!$(id).checked) continue;
    traces.push({ type: "scatter", mode: "markers", x: o.occupancy_eff, y: o[key], name,
      error_y: { type: "percent", value: 100 * se, color: colour, thickness: 1, width: 3 },
      marker: { symbol: sym, size: 8, color: colour },
      hovertemplate: `occupancy %{x:.3f}: gain %{y:.2f} ± ${(100 * se).toFixed(0)} %<extra>${name}</extra>` });
  }
  traces.push({ type: "scatter", mode: "markers", x: [state.occ], y: [gainCf(state.occ)], name: "selected",
    showlegend: false, marker: { size: 14, color: css("--gold"), line: { color: css("--panel"), width: 2 } }, hoverinfo: "skip" });
  const base = baseLayout();
  Plotly.react($("gain-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "spectral occupancy" } },
    yaxis: { ...base.yaxis, type: "log", title: { text: "gain in peak SNR, Hadamard ÷ pulsed" } },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: css("--warn"), width: 1, dash: "dot" } }],
    annotations: [{ xref: "paper", x: 0.02, y: 0, yanchor: "top", text: "below 1: pulsed wins", showarrow: false, font: { size: 11, color: css("--warn") } }],
  }, config);
}

function drawSnr() {
  const s = state.d.snr, base = baseLayout();
  const line = (key, name, colour, dash) => ({ type: "scatter", mode: "lines+markers", x: s.t_s, y: s[key], name,
    line: { color: colour, width: 2, dash }, marker: { size: 4 }, hovertemplate: `%{x:.2f} s: SNR %{y:.1f}<extra>${name}</extra>` });
  Plotly.react($("snr-plot"), [
    line("hadamard_f1", "Hadamard, F = 1", css("--measured"), "solid"),
    line("pulsed_f1", "pulsed, F = 1", css("--ideal"), "solid"),
    line("hadamard_f20", "Hadamard, F = 20", css("--measured"), "dash"),
    line("pulsed_f20", "pulsed, F = 20", css("--ideal"), "dash"),
  ], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "acquisition time (s)" } },
    yaxis: { ...base.yaxis, type: "log", title: { text: "peak SNR" } },
  }, config);
}

function drawSpectra() {
  const sp = state.d.spectra, base = baseLayout();
  const line = (key, name, colour, width, extra = {}) => ({ type: "scatter", mode: "lines", x: sp.tof_us, y: sp[key], name,
    line: { color: colour, width }, hovertemplate: `%{x:.1f} µs: %{y:.0f}<extra>${name}</extra>`, ...extra });
  Plotly.react($("spec-plot"), [
    line("truth", "model spectrum", css("--ink-soft"), 2.4, { opacity: 0.55 }),
    line("pulsed", "pulsed", css("--ideal"), 1.2),
    line("hadamard", "Hadamard (recovered)", css("--measured"), 1.2),
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "flight time (µs)" } },
    yaxis: { ...base.yaxis, title: { text: "counts per 100 ns bin" } },
  }, config);
}

function drawGate() {
  const g = state.d.gate, base = baseLayout();
  const chips = g.pulsed.map((_, i) => i);
  const step = (arr, off) => ({ x: chips.flatMap((c) => [c, c + 1]), y: arr.flatMap((v) => [v + off, v + off]) });
  const p = step(g.pulsed, 1.4), h = step(g.hadamard, 0);
  Plotly.react($("gate-plot"), [
    { type: "scatter", mode: "lines", ...p, name: "pulsed", line: { color: css("--ideal"), width: 2 }, hoverinfo: "skip" },
    { type: "scatter", mode: "lines", ...h, name: "Hadamard (m-sequence)", line: { color: css("--measured"), width: 2 }, hoverinfo: "skip" },
  ], { ...base, margin: { l: 20, r: 16, t: 28, b: 40 },
    xaxis: { ...base.xaxis, title: { text: "chip" }, range: [0, chips.length] },
    yaxis: { ...base.yaxis, visible: false, range: [-0.2, 2.6] },
  }, config);
}

function readouts() {
  const g = gainCf(state.occ), se = state.d.mc_rel_se;
  $("occ-out").textContent = state.occ.toFixed(3);
  $("r-gain").textContent = `${g.toFixed(2)}×`;
  $("r-verdict").textContent = g > 1.05 ? "multiplexed wins" : g < 0.95 ? "pulsed wins" : "break-even";
  $("r-time").textContent = `${(g * g).toFixed(1)}×`;
  $("r-se").textContent = `±${(100 * se).toFixed(0)} % gain, ±${(200 * se).toFixed(0)} % time`;
}

function update(all = false) {
  readouts();
  drawGain();
  if (all) { drawSnr(); drawSpectra(); drawGate(); }
}

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  $("params").replaceChildren(...d.params.map((p) => {
    const tr = document.createElement("tr");
    for (const [v, cls] of [[p.key, ""], [p.value ?? "—", "num"], [p.what, ""], [p.basis, ""]]) {
      const td = document.createElement("td"); td.textContent = v; if (cls) td.className = cls; tr.append(td);
    }
    return tr;
  }));
  const prov = [["Simulation", s.simulation], ["Data", s.data], ["Printed figure", s.static_figure], ["Reduced by", s.reducer],
    ...Object.entries(s.sha256).map(([f, h]) => [f, h])];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Simulated · N = ${d.N} chips · ${d.trials} Monte Carlo trials per gain point`;
}

function wire() {
  const occ = $("occ");
  occ.value = String(toPos(state.occ));
  occ.addEventListener("input", () => { state.occ = toOcc(Number(occ.value)); update(); });
  ["m-shot", "m-fano", "m-beam"].forEach((id) => $(id).addEventListener("change", () => drawGain()));
  const redraw = () => update(true);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    wire();
    update(true);
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the results: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
