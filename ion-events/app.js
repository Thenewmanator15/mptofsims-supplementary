// Ion events at the converter -- supplementary page.
// Reads data.json written by ../reduce.py: 23,759 isolated ion windows from CopperPulsed_0001
// (FMC121, 1 GS/s), 32 samples each in baseline-sigma units, peak at sample 8; with arrival
// time, height, two shape-mode scores, anomaly score and burst role. Nothing is re-fitted here.
"use strict";

const state = { d: null, w: [], t: [], sort: "time", scale: "norm", burstsOnly: false, sel: 0, order: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ROLE = ["on its own", "first of a burst", "follows in a burst"];

function unpack(b64, n, m, step) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length !== 2 * n * m) throw new Error("window stack size does not match data.json");
  const v = new DataView(bytes.buffer), out = [];
  for (let e = 0; e < n; e++) {
    const row = new Float32Array(m);
    for (let i = 0; i < m; i++) row[i] = v.getInt16(2 * (e * m + i), true) * step;
    out.push(row);
  }
  return out;
}

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 66, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.12, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };
const colour = (r) => [css("--ink-soft"), css("--gold"), css("--measured")][r];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const burstOf = (i) => state.d.burst[i];
const mates = (i) => (burstOf(i) ? state.d.burst.map((b, j) => (b === burstOf(i) ? j : -1)).filter((j) => j >= 0) : [i]);

function computeOrder() {
  const d = state.d;
  let idx = d.amp.map((_, i) => i);
  if (state.burstsOnly) idx = idx.filter((i) => d.role[i] > 0);
  if (state.sort === "amp") idx.sort((a, b) => d.amp[b] - d.amp[a]);
  else if (state.sort === "z") idx.sort((a, b) => d.z[b] - d.z[a]);
  else idx.sort((a, b) => d.t_s[a] - d.t_s[b]);
  state.order = idx;
  if (!idx.includes(state.sel)) state.sel = idx[0] ?? 0;
}

function drawMap() {
  const base = baseLayout(), norm = state.scale === "norm", d = state.d;
  const z = state.order.map((i) => (norm ? Array.from(state.w[i], (v) => v / d.amp[i]) : Array.from(state.w[i])));
  const zmax = norm ? 1 : Math.max(...state.order.map((i) => d.amp[i]).slice(0, 5000)) * 0.6;
  const row = state.order.indexOf(state.sel);
  Plotly.react($("map-plot"), [{
    type: "heatmap", x: state.t, y: state.order.map((_, k) => k), z, zmin: norm ? -0.2 : 0, zmax,
    colorscale: "Viridis", colorbar: { title: { text: norm ? "÷ own peak" : "σ", side: "right" }, tickfont: { color: css("--ink-soft") } },
    hovertemplate: "row %{y}<br>%{x} ns: %{z:.2f}<extra></extra>",
  }], { ...base, margin: { l: 66, r: 16, t: 10, b: 48 },
    xaxis: { ...base.xaxis, title: { text: "time from the peak (ns)" } },
    yaxis: { ...base.yaxis, title: { text: `events (${{ time: "arrival order", amp: "tallest first", z: "most unusual first" }[state.sort]})` },
      autorange: "reversed", showticklabels: false },
    shapes: row >= 0 ? [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: row - 0.5, y1: row + 0.5,
      line: { color: css("--gold"), width: 2 } }] : [],
  }, { ...config, displayModeBar: false });
  $("cap-map").textContent = `(1) ${state.order.length.toLocaleString()} events, one row each, lined up on their peaks; `
    + `${norm ? "each divided by its own peak, so only the shape differs" : "height in units of baseline noise σ (colour saturates for the tallest)"}. `
    + (state.order.length > 2000 ? "Rows are thinner than a pixel, so the map shows the overall pattern; sort it, or show only bursts, to pick out groups. " : "")
    + "Click a row to select that event.";
}

function scatterTraces(xf, yf, extra = {}) {
  const d = state.d, shown = new Set(state.order);
  return [0, 2, 1].map((r) => {
    const idx = state.order.filter((i) => d.role[i] === r);
    return { type: "scattergl", mode: "markers", name: ROLE[r], x: idx.map(xf), y: idx.map(yf), customdata: idx,
      marker: { color: colour(r), size: r === 0 ? 3 : 7, opacity: r === 0 ? 0.35 : 0.95 },
      hovertemplate: `%{customdata}: ${ROLE[r]}<extra></extra>`, ...extra };
  }).concat(shown.has(state.sel) ? [{ type: "scattergl", mode: "markers", showlegend: false, x: [xf(state.sel)], y: [yf(state.sel)],
    marker: { size: 16, color: "rgba(0,0,0,0)", line: { color: css("--gold"), width: 3 } }, hoverinfo: "skip" }] : []);
}

function drawTime() {
  const base = baseLayout(), d = state.d;
  Plotly.react($("time-plot"), scatterTraces((i) => d.t_s[i], (i) => d.amp[i]), { ...base,
    xaxis: { ...base.xaxis, title: { text: "arrival time in the recording (s)" }, range: [0, d.record_s] },
    yaxis: { ...base.yaxis, type: "log", title: { text: "height (σ)" } },
  }, config);
}

function pctRange(a, lo, hi) {
  const s = [...a].sort((x, y) => x - y), q = (p) => s[Math.floor(p * (s.length - 1))];
  const a0 = q(lo), a1 = q(hi), pad = 0.15 * (a1 - a0);
  return [a0 - pad, a1 + pad];
}

function drawShape() {
  const base = baseLayout(), d = state.d, idx = state.order;
  Plotly.react($("shape-plot"), scatterTraces((i) => d.pc1[i], (i) => d.pc2[i]), { ...base,
    xaxis: { ...base.xaxis, title: { text: "shape mode 1" }, range: pctRange(idx.map((i) => d.pc1[i]), 0.002, 0.998), zeroline: false },
    yaxis: { ...base.yaxis, title: { text: "shape mode 2" }, range: pctRange(idx.map((i) => d.pc2[i]), 0.002, 0.998), zeroline: false },
    showlegend: false,
  }, config);
}

function drawEvent() {
  const base = baseLayout(), d = state.d, i = state.sel, norm = state.scale === "norm";
  const k = (j) => (norm ? 1 / d.amp[j] : 1);
  const tp = d.template, tt = tp.y.map((_, n) => tp.t0_ns + n * tp.dt_ns);
  const others = mates(i).filter((j) => j !== i);
  const traces = [
    ...others.map((j) => ({ type: "scatter", mode: "lines", showlegend: false, x: state.t, y: Array.from(state.w[j], (v) => v * k(j)),
      line: { color: colour(d.role[j]), width: 1 }, opacity: 0.55,
      hovertemplate: `burst mate, ${((d.t_s[j] - d.t_s[i]) * 1e9).toFixed(0)} ns ${d.t_s[j] > d.t_s[i] ? "later" : "earlier"}<extra></extra>` })),
    { type: "scatter", mode: "lines", name: "mean pulse shape", x: tt, y: tp.y.map((v) => v * d.amp[i] * k(i)),
      line: { color: css("--ink-soft"), width: 1.2, dash: "dot" }, hoverinfo: "skip" },
    { type: "scatter", mode: "lines+markers", name: "this event", x: state.t, y: Array.from(state.w[i], (v) => v * k(i)),
      line: { color: colour(d.role[i]) === css("--ink-soft") ? css("--measured") : colour(d.role[i]), width: 2 }, marker: { size: 5 },
      hovertemplate: "%{x} ns: %{y:.2f}<extra></extra>" },
  ];
  Plotly.react($("event-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "time from the peak (ns), one point per 1 ns sample" } },
    yaxis: { ...base.yaxis, title: { text: norm ? "÷ own peak" : "height (σ)" } },
  }, config);
  $("cap-event").textContent = `(4) Event ${i} (${ROLE[d.role[i]]}), sample by sample, against the mean pulse shape `
    + `scaled to its height (dotted)${others.length ? `, with the ${others.length} other event(s) of its burst (thin)` : ""}. `
    + "At 1 GS/s a pulse spans only a few samples, so its apparent shape depends on where the samples fell.";
}

function readouts() {
  const d = state.d, i = state.sel;
  $("r-n").textContent = `${state.order.length.toLocaleString()} of ${d.n.toLocaleString()}`;
  $("r-sel").textContent = `#${i} · ${ROLE[d.role[i]]}`;
  $("r-amp").textContent = `${d.amp[i].toFixed(0)} σ · ${d.t_s[i].toFixed(4)} s`;
  const m = mates(i);
  $("r-burst").textContent = burstOf(i) ? `${m.length} events over ${((Math.max(...m.map((j) => d.t_s[j])) - Math.min(...m.map((j) => d.t_s[j]))) * 1e6).toFixed(1)} µs`
    : "none";
}

function summary() {
  const d = state.d, desc = ["arrived with no other ion nearby", "large; starts a run of arrivals", "ordinary height; arrives within µs of a larger one"];
  $("summary-body").replaceChildren(...[0, 1, 2].map((r) => {
    const a = d.amp.filter((_, i) => d.role[i] === r), tr = document.createElement("tr");
    [ROLE[r], a.length.toLocaleString(), `${median(a).toFixed(0)} σ`, desc[r]].forEach((t) => {
      const td = document.createElement("td"); td.textContent = t; tr.append(td);
    });
    return tr;
  }));
}

function update() { computeOrder(); readouts(); drawMap(); drawTime(); drawShape(); drawEvent(); }
function select(i) { if (i == null) return; state.sel = i; readouts(); drawMap(); drawTime(); drawShape(); drawEvent(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Reduction", s.reduction], ["Data", s.file], ["SHA-256", s.sha256],
    ["In the thesis", s.static_figures], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.n_events.toLocaleString()} ion events in ${d.record_s} s · `
    + `${d.n.toLocaleString()} isolated ones shown · FMC121 at 1 GS/s`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("sort", (v) => { state.sort = v; });
  radio("scale", (v) => { state.scale = v; });
  $("bursts-only").addEventListener("change", (e) => { state.burstsOnly = e.target.checked; update(); });
  $("map-plot").on("plotly_click", (e) => select(state.order[e.points[0].y]));
  ["time-plot", "shape-plot"].forEach((id) => $(id).on("plotly_click", (e) => select(e.points[0].customdata)));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=58704209da");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    const d = await res.json();
    state.d = d;
    state.t = Array.from({ length: d.n_t }, (_, i) => i - d.peak);
    state.w = unpack(d.w, d.n, d.n_t, d.step);
    state.sel = d.role.indexOf(1);                 // open on the first burst leader
    fillText();
    summary();
    update();          // draw first: Plotly adds .on() only once a div holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the events: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
