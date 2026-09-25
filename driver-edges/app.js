// BNG driver edges -- supplementary page.
// Reads data.json written by ../reduce.py from scripts/bng-driver/data (Julia reductions).
// Nothing is computed here beyond picking rows; the CMRR prediction was computed and checked
// in reduce.py (verbatim from plot_edges.py).
"use strict";

const state = { d: null, i: 0, dir: "rise" };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const TRACES = [["pos", "output +", "--measured"], ["neg", "output −", "--ideal"], ["diff", "differential", "--ink"]];

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 62, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.1, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

const width = () => state.d.widths_ns[state.i];
const rateRow = (w) => state.d.rate.find((r) => r.sym_ns === w);
const metric = (w, trace, dir) => state.d.metrics.find((m) => m.sym_ns === w && m.trace === trace && m.direction === dir);

function alpha(hex, a) {        // "#rrggbb" -> rgba with alpha, for the SD bands
  const h = hex.replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawShapes() {
  const w = width(), traces = [], sds = [];
  let nEdges = null;
  for (const [key, label, tok] of TRACES) {
    if (!$(`t-${key}`).checked) continue;
    const s = state.d.shapes[`${w}|${key}|${state.dir}`];
    if (!s) continue;
    nEdges = s.n;
    sds.push(...s.s);
    const col = css(tok), up = s.m.map((v, k) => v + s.s[k]), dn = s.m.map((v, k) => v - s.s[k]);
    traces.push({ type: "scatter", mode: "lines", x: [...s.t, ...[...s.t].reverse()], y: [...up, ...dn.reverse()],
      fill: "toself", fillcolor: alpha(col, 0.15), line: { width: 0 }, hoverinfo: "skip", showlegend: false });
    traces.push({ type: "scatter", mode: "lines", x: s.t, y: s.m, name: label, line: { color: col, width: 2 },
      hovertemplate: `%{x:.2f} ns: %{y:.3f}<extra>${label}</extra>` });
  }
  const base = baseLayout();
  Plotly.react($("shape-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "time from the 50 % crossing (ns)" } },
    yaxis: { ...base.yaxis, title: { text: "normalised to the step" } },
  }, config);
  $("cap-shape").textContent = `(1) ${state.dir === "rise" ? "Rising" : "Falling"} transitions at ${w} ns symbols, `
    + `ensemble-averaged over ${nEdges ?? "—"} settled edges, aligned on the 50 % crossing and normalised to the step; `
    + (sds.length ? `bands are ±1 SD across edges, here a median ${(100 * sds.sort((a, b) => a - b)[sds.length >> 1]).toFixed(1)} % `
      + "of the step, so barely wider than the lines: the edges repeat closely." : "bands are ±1 SD across edges.");
}

function drawCmrr() {
  const rows = state.d.rate.filter((r) => r.cmrr_dB != null), base = baseLayout();
  const sel = rateRow(width());
  Plotly.react($("cmrr-plot"), [
    { type: "scatter", mode: "markers", x: rows.map((r) => r.rate_MHz), y: rows.map((r) => r.cmrr_dB), name: "measured",
      marker: { color: css("--measured"), size: 9 }, customdata: rows.map((r) => r.sym_ns),
      hovertemplate: "%{customdata} ns (%{x:.1f} MHz): %{y:.1f} dB<extra>measured</extra>" },
    { type: "scatter", mode: "markers", x: rows.map((r) => r.rate_MHz), y: rows.map((r) => r.pred_dB), name: "from channel stagger",
      marker: { color: "rgba(0,0,0,0)", size: 13, line: { color: css("--ink"), width: 1.4 } },
      hovertemplate: "%{x:.1f} MHz: %{y:.1f} dB<extra>predicted</extra>" },
    ...(sel && sel.cmrr_dB != null ? [{ type: "scatter", mode: "markers", x: [sel.rate_MHz], y: [sel.cmrr_dB], showlegend: false,
      marker: { color: css("--gold"), size: 16, line: { color: css("--panel"), width: 2 } }, hoverinfo: "skip" }] : []),
  ], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "symbol rate (MHz)" } },
    yaxis: { ...base.yaxis, title: { text: "common-mode rejection (dB)" } },
  }, config);
  const m = state.d.model;
  $("cap-cmrr").textContent = `(2) Common-mode rejection against symbol rate: measured (filled) and predicted from the `
    + `measured channel stagger alone (open), CMRR = −10 log₁₀(D/2T). One constant offset is free `
    + `(${m.offset_dB >= 0 ? "+" : ""}${m.offset_dB.toFixed(1)} dB); the ${m.n} points agree to ±${m.resid_sd_dB.toFixed(2)} dB.`;
}

function drawMetrics() {
  const base = baseLayout(), rate = (w) => 1000 / w;
  const series = (dir, key) => state.d.metrics.filter((m) => m.trace === "diff" && m.direction === dir && m[key] != null)
    .sort((a, b) => a.sym_ns - b.sym_ns);
  const tr = [];
  for (const [dir, dash] of [["rise", "solid"], ["fall", "dot"]]) {
    const o = series(dir, "overshoot_pct"), s = series(dir, "settle5_ns");
    tr.push({ type: "scatter", mode: "lines+markers", x: o.map((m) => rate(m.sym_ns)), y: o.map((m) => m.overshoot_pct),
      name: `overshoot, ${dir}`, line: { color: css("--ideal"), dash, width: 1.8 }, marker: { size: 5 },
      hovertemplate: "%{x:.1f} MHz: %{y:.1f} %<extra>overshoot " + dir + "</extra>" });
    tr.push({ type: "scatter", mode: "lines+markers", x: s.map((m) => rate(m.sym_ns)), y: s.map((m) => m.settle5_ns), yaxis: "y2",
      name: `settle to 5 %, ${dir}`, line: { color: css("--measured"), dash, width: 1.8 }, marker: { size: 5 },
      hovertemplate: "%{x:.1f} MHz: %{y:.2f} ns<extra>settle " + dir + "</extra>" });
  }
  Plotly.react($("metric-plot"), tr, { ...base, margin: { l: 62, r: 62, t: 30, b: 44 },
    xaxis: { ...base.xaxis, type: "log", title: { text: "symbol rate (MHz)" } },
    yaxis: { ...base.yaxis, title: { text: "overshoot (%)" } },
    yaxis2: { ...base.yaxis, title: { text: "settle to 5 % (ns)" }, overlaying: "y", side: "right", showgrid: false },
    shapes: [{ type: "line", x0: rate(width()), x1: rate(width()), y0: 0, y1: 1, yref: "paper", line: { color: css("--gold"), width: 2 } }],
  }, config);
}

function readouts() {
  const w = width(), r = rateRow(w), m = metric(w, "diff", state.dir);
  $("width-out").textContent = `${w} ns`;
  $("r-rate").textContent = `${(1000 / w).toFixed(1)} MHz`;
  $("r-cmrr").textContent = r && r.cmrr_dB != null ? `${r.cmrr_dB.toFixed(1)} dB` : "—";
  $("r-over").textContent = m && m.overshoot_pct != null ? `${m.overshoot_pct.toFixed(1)} %` : "—";
  $("r-settle").textContent = m && m.settle5_ns != null ? `${m.settle5_ns.toFixed(2)} ns` : "—";
}

function update() { readouts(); drawShapes(); drawCmrr(); drawMetrics(); }

function fillText() {
  const d = state.d, s = d.source;
  $("width").max = String(d.widths_ns.length - 1);
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Conditions", s.conditions], ["Reductions", s.reductions], ["Data", s.data],
    ["Printed figure", s.static_figure], ["Thesis section", s.thesis_section], ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.widths_ns.length} symbol widths, ${d.widths_ns[0]}–${d.widths_ns[d.widths_ns.length - 1]} ns · fixed 40 V, 35 °C`;
}

function wire() {
  $("width").addEventListener("input", (e) => { state.i = Number(e.target.value); update(); });
  document.querySelectorAll('input[name="dir"]').forEach((el) => el.addEventListener("change", () => { state.dir = el.value; update(); }));
  ["t-pos", "t-neg", "t-diff"].forEach((id) => $(id).addEventListener("change", drawShapes));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    wire();
    update();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the sweep: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
