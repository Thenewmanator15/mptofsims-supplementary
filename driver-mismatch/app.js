// Driver mismatch null -- supplementary page.
// Reads data.json written by ../reduce.py: every per-channel LeCroy measurement from the three
// September 2021 sessions. Nulls are least-squares straight lines of mismatch on measured rail,
// solved for zero, exactly as bng-driver/analyze.py does (>= 3 points); a group is also skipped
// here if its rails span less than 10 V, where the extrapolation would be meaningless.
"use strict";

const state = { d: null, group: "session", rep: "all", w: 20, pts: [], fits: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SYM = { "2021-09-06": "circle", "2021-09-10": "square", "2021-09-24": "diamond" };
const X_RANGE = [Math.log10(20), Math.log10(800)];

function groups() {
  const untuned = css("--ideal"), s10 = css("--measured"), s24 = "#1a9e77";
  return state.group === "printed"
    ? [{ key: "untuned", name: "untuned", has: (p) => p.session === "2021-09-06", color: untuned },
       { key: "tuned", name: "tuned (10 + 24 Sep)", has: (p) => p.session !== "2021-09-06", color: s10 }]
    : [{ key: "2021-09-06", name: "6 Sep, untuned", has: (p) => p.session === "2021-09-06", color: untuned },
       { key: "2021-09-10", name: "10 Sep, tuned, direct board", has: (p) => p.session === "2021-09-10", color: s10 },
       { key: "2021-09-24", name: "24 Sep, tuned, test board", has: (p) => p.session === "2021-09-24", color: s24 }];
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

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 62, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.14, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };
const widths = () => [...new Set(state.d.points.map((p) => p.w))].sort((a, b) => a - b);
const fmtV = (v) => (v == null ? "no crossing" : `${v.toFixed(1)} V`);
const hoverPt = (p) => `${state.d.sessions[p.session]}<br>${p.w} ns, rep ${p.rep}<br>rail ${p.v.toFixed(1)} V → mismatch ${p.mm.toFixed(0)} ps`
  + (p.dup ? "<br>⚠ value copy of another table" : "") + (p.cpl ? "<br>⚠ 'coupled' table, name says 0.1 ms" : "")
  + (p.sd2 != null ? `<br>width sdev C2 ${p.sd2.toFixed(0)} / C3 ${p.sd3.toFixed(0)} ps over ${p.n} events` : "");

function compute() {
  const noDup = $("no-dup").checked, noCpl = $("no-cpl").checked;
  state.pts = state.d.points.filter((p) => (state.rep === "all" || p.rep === state.rep) && !(noDup && p.dup) && !(noCpl && p.cpl));
  state.fits = [];
  for (const g of groups()) for (const w of widths()) {
    const f = fit(state.pts.filter((p) => g.has(p) && p.w === w));
    if (f) state.fits.push({ g, w, ...f });
  }
}

function drawMap() {
  const base = baseLayout(), mmax = Math.max(...state.d.points.map((p) => Math.abs(p.mm))), pts = state.pts;
  const traces = [{
    type: "scatter", mode: "markers", x: pts.map((p) => p.v), y: pts.map((p) => p.w), customdata: pts.map((p) => p.w),
    text: pts.map(hoverPt), hovertemplate: "%{text}<extra></extra>", showlegend: false,
    marker: { size: 11, symbol: pts.map((p) => SYM[p.session]), color: pts.map((p) => p.mm), colorscale: "RdBu",
      cmin: -mmax, cmax: mmax, line: { color: css("--ink-soft"), width: 0.6 },
      colorbar: { title: { text: "mismatch (ps)", side: "right" }, tickfont: { color: css("--ink-soft") } } },
  }];
  for (const g of groups()) {
    const f = state.fits.filter((x) => x.g.key === g.key && x.null != null).sort((a, b) => a.w - b.w);
    traces.push({ type: "scatter", mode: "lines+markers", name: `null, ${g.name}`, x: f.map((x) => x.null), y: f.map((x) => x.w),
      customdata: f.map((x) => x.w), line: { color: g.color, width: 1.4, dash: "dot" },
      marker: { symbol: "x-thin", size: 12, line: { color: g.color, width: 2.5 } },
      text: f.map((x) => `${g.name}<br>${x.w} ns: null ${x.null.toFixed(1)} V (${x.n} points, ${x.lo.toFixed(0)}–${x.hi.toFixed(0)} V measured)`),
      hovertemplate: "%{text}<extra></extra>" });
  }
  Plotly.react($("map-plot"), traces, { ...base, margin: { l: 62, r: 16, t: 40, b: 48 },
    xaxis: { ...base.xaxis, type: "log", range: X_RANGE, title: { text: "rail measured in each capture (V), log" },
      tickvals: [20, 30, 50, 80, 100, 200, 300, 500], ticktext: ["20", "30", "50", "80", "100", "200", "300", "500"] },
    yaxis: { ...base.yaxis, type: "log", title: { text: "symbol width (ns), log" }, tickvals: widths().filter((w) => ![19, 21, 22, 23].includes(w)) },
    shapes: [
      { type: "rect", xref: "x", yref: "paper", x0: 20, x1: state.d.deliverable_V, y0: 0, y1: 1, fillcolor: "#1a9e77", opacity: 0.08, line: { width: 0 }, layer: "below" },
      { type: "rect", xref: "paper", x0: 0, x1: 1, y0: state.w / 1.07, y1: state.w * 1.07, line: { color: css("--gold"), width: 2 } },
    ],
  }, { ...config, displayModeBar: false });
  $("cap-map").textContent = `(1) ${pts.length} measurements (circle 6 Sep untuned, square 10 Sep, diamond 24 Sep): symbol width against `
    + "the rail measured in that capture, coloured by channel width mismatch (red: C2 wider; blue: C3 wider). Crosses: for each width "
    + "and group, where a straight line through that width's points reaches zero mismatch; crosses right of the measured points are "
    + "extrapolations. Shaded: up to 80 V. Click a point to select its width.";
}

function drawFit() {
  const base = baseLayout(), traces = [];
  for (const g of groups()) {
    const pts = state.pts.filter((p) => g.has(p) && p.w === state.w).sort((a, b) => a.v - b.v);
    if (!pts.length) continue;
    traces.push({ type: "scatter", mode: "markers", name: g.name, x: pts.map((p) => p.v), y: pts.map((p) => p.mm),
      marker: { color: g.color, size: 8, symbol: pts.map((p) => SYM[p.session]) }, text: pts.map(hoverPt), hovertemplate: "%{text}<extra></extra>" });
    const f = state.fits.find((x) => x.g.key === g.key && x.w === state.w);
    if (!f) continue;
    const x1 = f.null != null ? Math.max(f.hi, Math.min(f.null, 800)) : f.hi;
    traces.push({ type: "scatter", mode: "lines", showlegend: false, x: [f.lo, f.hi], y: [f.a + f.b * f.lo, f.a + f.b * f.hi],
      line: { color: g.color, width: 1.6 }, hoverinfo: "skip" });
    if (x1 > f.hi) traces.push({ type: "scatter", mode: "lines", showlegend: false, x: [f.hi, x1], y: [f.a + f.b * f.hi, f.a + f.b * x1],
      line: { color: g.color, width: 1.2, dash: "dot" }, hoverinfo: "skip" });
    if (f.null != null && f.null <= 800) traces.push({ type: "scatter", mode: "markers", showlegend: false, x: [f.null], y: [0],
      marker: { symbol: "x-thin", size: 12, line: { color: g.color, width: 2.5 } }, hovertemplate: `null ${f.null.toFixed(1)} V<extra>${g.name}</extra>` });
  }
  Plotly.react($("fit-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "rail (V)" }, rangemode: "tozero" },
    yaxis: { ...base.yaxis, title: { text: "width mismatch, C2 − C3 (ps)" } },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: css("--ink"), width: 1 } }],
  }, config);
  $("cap-fit").textContent = `(2) ${state.w} ns: mismatch against rail with the straight-line fits (solid over the measured range, `
    + "dotted where extrapolated); crosses mark zero mismatch. Groups with fewer than 3 points, or rails spanning under 10 V, are not fitted.";
}

function drawNull() {
  const base = baseLayout();
  const traces = groups().map((g) => {
    const f = state.fits.filter((x) => x.g.key === g.key && x.null != null).sort((a, b) => a.w - b.w);
    return { type: "scatter", mode: "lines+markers", name: g.name, x: f.map((x) => x.w), y: f.map((x) => x.null), customdata: f.map((x) => x.w),
      line: { color: g.color, width: 1.4, dash: "dash" },
      marker: { color: g.color, size: f.map((x) => (x.w === state.w ? 13 : 8)), line: { color: f.map((x) => (x.w === state.w ? css("--gold") : css("--panel"))), width: 2 } },
      text: f.map((x) => `${x.n} points`), hovertemplate: `%{x} ns: null %{y:.1f} V (%{text})<extra>${g.name}</extra>` };
  });
  Plotly.react($("null-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "symbol width (ns)" }, tickvals: [20, 30, 50, 100, 200, 500] },
    yaxis: { ...base.yaxis, type: "log", title: { text: "rail at which the mismatch nulls (V)" }, tickvals: [20, 50, 100, 200, 500], range: [Math.log10(15), Math.log10(800)] },
    shapes: [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: 1, y1: state.d.deliverable_V, fillcolor: "#1a9e77", opacity: 0.12, line: { width: 0 }, layer: "below" }],
  }, config);
}

function readouts() {
  $("r-n").textContent = `${state.pts.length} of ${state.d.points.length}`;
  $("r-w").textContent = `${state.w} ns`;
  const f = state.fits.filter((x) => x.w === state.w);
  $("r-null").textContent = f.length ? f.map((x) => `${x.g.name.split(",")[0]}: ${fmtV(x.null)}`).join(" · ") : "too few points to fit";
  const m = state.pts.filter((p) => p.w === state.w).map((p) => p.mm);
  $("r-range").textContent = m.length ? `${Math.min(...m).toFixed(0)} to ${Math.max(...m).toFixed(0)} ps` : "—";
}

function update() { compute(); readouts(); drawMap(); drawFit(); drawNull(); }
function select(w) { state.w = w; $("width").value = String(w); update(); }

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
  $("width").replaceChildren(...widths().map((w) => { const o = document.createElement("option"); o.value = String(w); o.textContent = `${w} ns`; return o; }));
  $("width").value = String(state.w);
  $("status").textContent = `Measured · ${d.points.length} captures · 3 sessions, September 2021 · ${widths().length} symbol widths`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("group", (v) => { state.group = v; });
  radio("rep", (v) => { state.rep = v; });
  ["no-dup", "no-cpl"].forEach((id) => $(id).addEventListener("change", update));
  $("width").addEventListener("change", (e) => { state.w = Number(e.target.value); update(); });
  $("map-plot").on("plotly_click", (e) => { const w = e.points[0].customdata; if (w != null) select(w); });
  $("null-plot").on("plotly_click", (e) => select(e.points[0].customdata));
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
    update();          // draw first: Plotly adds .on() only once a div holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the measurements: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
