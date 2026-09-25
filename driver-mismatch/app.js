// Driver mismatch null -- supplementary page.
// Reads data.json written by ../reduce.py: every per-channel LeCroy measurement from the three
// September 2021 sessions. Nulls are least-squares straight lines of mismatch on measured rail,
// solved for zero, exactly as bng-driver/analyze.py does (>= 3 points); a group is also skipped
// here if its rails span less than 10 V, where the extrapolation would be meaningless.
"use strict";

const state = { d: null, w: 20, split: false, rep: "all", pts: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SWEEP_V = [23, 27];                 // the width sweep ran at ~25 V

function groups() {
  const un = { key: "un", name: "untuned (6 Sep)", has: (p) => p.session === "2021-09-06", color: css("--ideal") };
  return state.split
    ? [un, { key: "t10", name: "tuned, 10 Sep", has: (p) => p.session === "2021-09-10", color: css("--measured") },
           { key: "t24", name: "tuned, 24 Sep", has: (p) => p.session === "2021-09-24", color: "#1a9e77" }]
    : [un, { key: "tu", name: "tuned (10 + 24 Sep)", has: (p) => p.session !== "2021-09-06", color: css("--measured") }];
}

function fit(pts) {
  if (pts.length < 3) return null;
  const x = pts.map((p) => p.v), y = pts.map((p) => p.mm), n = x.length;
  const lo = Math.min(...x), hi = Math.max(...x);
  if (hi - lo < 10) return null;
  const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, n, lo, hi, null: b !== 0 && -a / b > 0 ? -a / b : null };
}
const fitFor = (g, w) => fit(state.pts.filter((p) => g.has(p) && p.w === w));

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 70, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.12, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };
const ns = (ps) => `${(ps / 1000).toFixed(2)} ns`;
const hoverPt = (p) => `${state.d.sessions[p.session]}<br>${p.w} ns symbols, repetition ${p.rep}<br>${p.v.toFixed(1)} V: one pulse wider by ${ns(p.mm)}`
  + (p.dup ? "<br>⚠ value copy of another table" : "") + (p.cpl ? "<br>⚠ 'coupled' table, name says 0.1 ms" : "");

function filter() {
  const noDup = $("no-dup").checked, noCpl = $("no-cpl").checked;
  state.pts = state.d.points.filter((p) => (state.rep === "all" || p.rep === state.rep) && !(noDup && p.dup) && !(noCpl && p.cpl));
}

function drawFit() {
  const base = baseLayout(), traces = [], vmax = state.d.deliverable_V, ann = [];
  const fits = groups().map((g) => [g, fitFor(g, state.w)]);
  const ys = state.pts.filter((p) => p.w === state.w).map((p) => p.mm / 1000);
  const yRange = [Math.min(-0.2, Math.min(...ys) - 0.1), Math.max(...ys) * 1.18];
  const reach = Math.max(100, ...fits.map(([, f]) => (f && f.null ? Math.min(f.null, 600) : 0))) * 1.08;
  for (const [g, f] of fits) {
    const pts = state.pts.filter((p) => g.has(p) && p.w === state.w);
    traces.push({ type: "scatter", mode: "markers", name: g.name, x: pts.map((p) => p.v), y: pts.map((p) => p.mm / 1000),
      marker: { color: g.color, size: 8 }, text: pts.map(hoverPt), hovertemplate: "%{text}<extra></extra>" });
    if (!f) continue;
    const xEnd = f.null ? Math.min(f.null, reach) : f.hi;
    traces.push({ type: "scatter", mode: "lines", showlegend: false, x: [f.lo, f.hi], y: [(f.a + f.b * f.lo) / 1000, (f.a + f.b * f.hi) / 1000],
      line: { color: g.color, width: 2 }, hoverinfo: "skip" });
    traces.push({ type: "scatter", mode: "lines", showlegend: false, x: [f.hi, xEnd], y: [(f.a + f.b * f.hi) / 1000, (f.a + f.b * xEnd) / 1000],
      line: { color: g.color, width: 1.4, dash: "dot" }, hoverinfo: "skip" });
    if (f.null && f.null <= reach) {
      traces.push({ type: "scatter", mode: "markers", showlegend: false, x: [f.null], y: [0],
        marker: { color: css("--panel"), size: 13, line: { color: g.color, width: 3 } }, hovertemplate: `zero at ${f.null.toFixed(0)} V<extra>${g.name}</extra>` });
      ann.push({ x: f.null, y: 0, text: `${f.null.toFixed(0)} V`, showarrow: true, arrowhead: 0, ax: 0, ay: -28 - 18 * ann.length,
        font: { color: g.color, size: 13 }, arrowcolor: g.color });
    }
  }
  Plotly.react($("fit-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "drive voltage (V)" }, range: [0, reach] },
    yaxis: { ...base.yaxis, title: { text: "how much wider one pulse is (ns)" }, range: yRange },
    shapes: [
      { type: "rect", xref: "x", yref: "paper", x0: 0, x1: vmax, y0: 0, y1: 1, fillcolor: "#1a9e77", opacity: 0.1, line: { width: 0 }, layer: "below" },
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: css("--ink"), width: 1.2 } },
    ],
    annotations: [...ann,
      { xref: "x", yref: "paper", x: vmax / 2, y: 0.98, yanchor: "top", text: "the driver can reach this", showarrow: false, font: { color: "#1a9e77", size: 12 } },
      { xref: "paper", yref: "y", x: 0.5, y: 0, yanchor: "top", text: "zero: channels matched", showarrow: false, font: { color: css("--ink-soft"), size: 11 } }],
  }, config);
  $("cap-fit").textContent = `(1) ${state.w} ns symbols: how much wider one channel's pulse is, at each drive voltage measured. `
    + "Solid lines are straight-line fits over the measured voltages; dotted lines extend them to where the mismatch would reach zero "
    + "(circled). A circle outside the shaded band is a voltage the driver cannot deliver. Hover a point for its details.";
}

function drawNull() {
  const base = baseLayout();
  const traces = groups().map((g) => {
    const f = [20, 50, 100].map((w) => ({ w, f: fitFor(g, w) })).filter((x) => x.f && x.f.null);
    return { type: "scatter", mode: "lines+markers", name: g.name, x: f.map((x) => x.w), y: f.map((x) => x.f.null), customdata: f.map((x) => x.w),
      line: { color: g.color, width: 1.6 },
      marker: { color: g.color, size: f.map((x) => (x.w === state.w ? 15 : 9)), line: { color: f.map((x) => (x.w === state.w ? css("--gold") : css("--panel"))), width: 2 } },
      hovertemplate: `%{x} ns symbols: zero at %{y:.0f} V<extra>${g.name}</extra>` };
  });
  Plotly.react($("null-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "symbol width (ns)" }, tickvals: [20, 50, 100] },
    yaxis: { ...base.yaxis, type: "log", title: { text: "voltage where mismatch reaches zero (V)" }, tickvals: [20, 50, 100, 200, 500], range: [Math.log10(20), Math.log10(700)] },
    shapes: [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: 1, y1: state.d.deliverable_V, fillcolor: "#1a9e77", opacity: 0.12, line: { width: 0 }, layer: "below" }],
  }, config);
}

function drawSweep() {
  const base = baseLayout();
  const traces = groups().map((g) => {
    const pts = state.pts.filter((p) => g.has(p) && p.v >= SWEEP_V[0] && p.v <= SWEEP_V[1]).sort((a, b) => a.w - b.w);
    const ws = [...new Set(pts.map((p) => p.w))];
    const mean = ws.map((w) => { const m = pts.filter((p) => p.w === w).map((p) => p.mm); return m.reduce((a, b) => a + b) / m.length / 1000; });
    return [
      { type: "scatter", mode: "markers", showlegend: false, x: pts.map((p) => p.w), y: pts.map((p) => p.mm / 1000),
        marker: { color: g.color, size: 6, opacity: 0.45 }, text: pts.map(hoverPt), hovertemplate: "%{text}<extra></extra>" },
      { type: "scatter", mode: "lines", name: g.name, x: ws, y: mean, line: { color: g.color, width: 2 }, hoverinfo: "skip" },
    ];
  }).flat();
  Plotly.react($("sweep-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "symbol width (ns)" }, tickvals: [20, 30, 50, 100, 200, 500] },
    yaxis: { ...base.yaxis, title: { text: "how much wider one pulse is (ns)" }, rangemode: "tozero" },
    shapes: [{ type: "line", yref: "paper", x0: state.w, x1: state.w, y0: 0, y1: 1, line: { color: css("--gold"), width: 1.5, dash: "dot" } }],
  }, config);
}

function readouts() {
  const vmax = state.d.deliverable_V, g = groups();
  const un = fitFor(g[0], state.w);
  const tuned = g.slice(1).map((x) => [x, fitFor(x, state.w)]);
  const fmt = (f) => (!f ? "too few points" : f.null ? `${f.null.toFixed(0)} V` : "never");
  $("r-un").textContent = fmt(un);
  $("r-tu").textContent = tuned.length === 1 ? fmt(tuned[0][1]) : tuned.map(([x, f]) => `${x.name.split(", ")[1]}: ${fmt(f)}`).join(" · ");
  $("r-max").textContent = `${vmax.toFixed(0)} V`;
  const ok = tuned.some(([, f]) => f && f.null && f.null <= vmax) || (un && un.null && un.null <= vmax);
  const v = $("r-verdict");
  v.textContent = ok ? "yes, by choosing the voltage" : "no: the zero lies out of reach";
  v.style.color = ok ? "#1a9e77" : css("--warn");
}

function update() { filter(); readouts(); drawFit(); drawNull(); drawSweep(); }
function select(w) { state.w = w; const el = $(`w${w}`); if (el) el.checked = true; update(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Reduction", s.reduction], ["Data", s.file], ["SHA-256", s.sha256],
    ["Printed figure", s.static_figures], ["Analysis", s.analysis], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.points.length} oscilloscope captures · 3 sessions, September 2021`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("w", (v) => { state.w = Number(v); });
  radio("rep", (v) => { state.rep = v; });
  $("split").addEventListener("change", (e) => { state.split = e.target.checked; update(); });
  ["no-dup", "no-cpl"].forEach((id) => $(id).addEventListener("change", update));
  $("null-plot").on("plotly_click", (e) => select(e.points[0].customdata));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=508861a36e");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    update();          // draw first: Plotly adds .on() only once a div holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the measurements: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
