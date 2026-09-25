// Beam blanking sweeps -- supplementary page.
// Reads data.json written by ../reduce.py. Transmission and V10 come from the reduction (V10 by
// analyze_sweeps.py's crossing(), only for sweeps that reached their floor). The map resamples
// each sweep linearly onto a common 0.5 V grid for display; blank = outside that sweep's range.
"use strict";

const state = { d: null, cfg: "AB", sort: "date", sel: null, rows: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const GRID = Array.from({ length: 241 }, (_, i) => i * 0.5);          // 0 - 120 V
const ENERGY_COL = { 9: "#6d5bd0", 9.5: "#8a74e0", 10: "#2a6fb0", 11: "#1a9e77", 13: "#d9a400", 14: "#d0711f", 15: "#b3372b" };
const qLabel = (q) => (q === "C60++" ? "C60²⁺" : q === "C60+" ? "C60⁺" : q);
const key = (t) => `${t.source}|${t.file}|${t.trial}|${t.cfg}`;
const rowLabel = (t) => `${t.date} · ${t.energy_label_kv} kV ${qLabel(t.charge)} · ${t.source === "curated" ? (t.die || "curated") : "sort out"} · ${t.trial}`;

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
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

function resample(t) {
  const out = new Array(GRID.length).fill(null);
  for (let g = 0; g < GRID.length; g++) {
    const x = GRID[g];
    if (x < t.v[0] || x > t.v[t.v.length - 1]) continue;
    let i = 1;
    while (i < t.v.length - 1 && t.v[i] < x) i++;
    const v0 = t.v[i - 1], v1 = t.v[i];
    out[g] = v1 === v0 ? t.t[i] : t.t[i - 1] + (t.t[i] - t.t[i - 1]) * (x - v0) / (v1 - v0);
  }
  return out;
}

function filtered() {
  const q = { "C60+": $("q1").checked, "C60++": $("q2").checked };
  const src = { "sort out": $("src-s").checked, curated: $("src-c").checked };
  const rows = state.d.trials.filter((t) => t.cfg === state.cfg && q[t.charge] !== false && src[t.source]
    && (!$("floor-only").checked || t.reached_floor));
  rows.sort(state.sort === "date"
    ? (a, b) => (a.started || a.date).localeCompare(b.started || b.date) || a.trial.localeCompare(b.trial)
    : (a, b) => a.energy_label_kv - b.energy_label_kv || (a.started || "").localeCompare(b.started || ""));
  return rows;
}

function drawMap() {
  const rows = state.rows, base = baseLayout();
  const z = rows.map(resample);
  const selIdx = rows.findIndex((t) => key(t) === state.sel);
  Plotly.react($("map-plot"), [{
    type: "heatmap", x: GRID, y: rows.map((_, i) => i), z, zmin: 0, zmax: 1.05, colorscale: "Viridis",
    colorbar: { title: { text: "transmission", side: "right" }, tickfont: { color: css("--ink-soft") } },
    customdata: rows.map((t) => GRID.map(() => rowLabel(t))), hoverongaps: false,
    hovertemplate: "%{customdata}<br>%{x:.1f} V: %{z:.2f}<extra></extra>",
  }], { ...base, margin: { l: 290, r: 16, t: 10, b: 48 },
    xaxis: { ...base.xaxis, title: { text: "gate voltage, per channel (V)" }, range: [0, 100] },
    yaxis: { ...base.yaxis, tickvals: rows.map((_, i) => i), ticktext: rows.map((t) => (t.reached_floor ? "" : "⚠ ") + rowLabel(t)),
      tickfont: { size: 10 }, autorange: "reversed" },
    shapes: selIdx >= 0 ? [{ type: "rect", x0: 0, x1: 100, y0: selIdx - 0.5, y1: selIdx + 0.5, line: { color: css("--gold"), width: 2 } }] : [],
  }, { ...config, displayModeBar: false });
  $("cap-map").textContent = `(1) ${state.cfg} configuration: transmission (current over its 0 V value, zero offset removed) `
    + `for ${rows.length} sweeps, ${state.sort === "date" ? "in date order" : "ordered by energy label"}. ⚠ = sweep did not `
    + "reach its floor (its offset, and so its transmission, is less certain). Click a row to select it.";
}

function drawV10() {
  const rows = state.rows.filter((t) => t.v10 != null), base = baseLayout();
  const labels = [...new Set(rows.map((t) => t.energy_label_kv))].sort((a, b) => a - b);
  const traces = labels.map((e) => {
    const r = rows.filter((t) => t.energy_label_kv === e);
    return { type: "scatter", mode: "markers", name: `${e} kV (label)`, x: r.map((t) => t.started || t.date), y: r.map((t) => t.v10),
      marker: { color: ENERGY_COL[e] || css("--ink-soft"), size: r.map((t) => (key(t) === state.sel ? 15 : 9)),
        symbol: r.map((t) => (t.charge === "C60++" ? "diamond" : "circle")), line: { color: r.map((t) => (key(t) === state.sel ? css("--gold") : css("--panel"))), width: 2 } },
      customdata: r.map((t) => key(t)), text: r.map(rowLabel),
      hovertemplate: "%{text}<br>V₁₀ = %{y:.1f} V<extra></extra>" };
  });
  Plotly.react($("v10-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: "date", title: { text: "date run (circle C60⁺, diamond C60²⁺)" } },
    yaxis: { ...base.yaxis, title: { text: `V₁₀, ${state.cfg}, per channel (V)` }, rangemode: "tozero" },
  }, config);
}

function drawCurve() {
  const base = baseLayout(), t = state.d.trials.find((x) => key(x) === state.sel);
  if (!t) { Plotly.react($("curve-plot"), [], { ...base }, config); return; }
  const peers = state.rows.filter((x) => x.session === t.session && x.energy_label_kv === t.energy_label_kv
    && x.charge === t.charge && key(x) !== state.sel);
  Plotly.react($("curve-plot"), [
    ...peers.map((p) => ({ type: "scatter", mode: "lines", x: p.v, y: p.t, showlegend: false,
      line: { color: css("--ink-soft"), width: 1 }, opacity: 0.6, hovertemplate: rowLabel(p) + "<br>%{x:.1f} V: %{y:.2f}<extra></extra>" })),
    { type: "scatter", mode: "lines+markers", x: t.v, y: t.t, name: "selected", line: { color: css("--gold"), width: 2.4 }, marker: { size: 4 },
      hovertemplate: "%{x:.1f} V: %{y:.3f}<extra>selected</extra>" },
    ...(t.v10 != null ? [{ type: "scatter", mode: "markers", x: [t.v10], y: [0.1], showlegend: false,
      marker: { color: css("--gold"), size: 12, symbol: "x" }, hovertemplate: "V₁₀ %{x:.1f} V<extra></extra>" }] : []),
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "gate voltage, per channel (V)" } },
    yaxis: { ...base.yaxis, title: { text: "transmission" }, range: [-0.08, 1.12] },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0.1, y1: 0.1, line: { color: css("--ink-soft"), dash: "dot", width: 1 } }],
  }, config);
  $("cap-curve").textContent = `(3) ${rowLabel(t)} (gold) against ${peers.length} other sweep(s) of session ${t.session} at the same `
    + "label and charge state (grey). Dotted line: 10 % transmission.";
}

function readouts() {
  $("r-n").textContent = `${state.rows.length} (${state.rows.filter((t) => t.v10 != null).length} with V₁₀)`;
  const t = state.d.trials.find((x) => key(x) === state.sel);
  if (!t) { $("r-sel").textContent = "click a row or point"; $("r-v10").textContent = "—"; $("r-peers").textContent = "—"; return; }
  $("r-sel").textContent = rowLabel(t);
  $("r-v10").textContent = t.v10 != null ? `${t.v10.toFixed(1)} V` : (t.reached_floor ? "not crossed" : "n/a (floor not reached)");
  const peers = state.rows.filter((x) => x.session === t.session && x.energy_label_kv === t.energy_label_kv && x.charge === t.charge && x.v10 != null);
  const v = peers.map((x) => x.v10);
  $("r-peers").textContent = v.length ? `${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)} V (${v.length} sweep${v.length > 1 ? "s" : ""})` : "—";
}

function update() {
  state.rows = filtered();
  if (state.sel && !state.rows.some((t) => key(t) === state.sel)) state.sel = null;
  if (!state.sel && state.rows.length) state.sel = key(state.rows.find((t) => t.v10 != null) || state.rows[0]);
  readouts(); drawMap(); drawV10(); drawCurve();
}

function select(k) { state.sel = k; readouts(); drawMap(); drawV10(); drawCurve(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Data", s.data], ["Printed figures", s.static_figures], ["Analysis", s.analysis],
    ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  const n = { AB: 0, A: 0, B: 0 };
  d.trials.forEach((t) => { n[t.cfg] = (n[t.cfg] || 0) + 1; });
  $("status").textContent = `Measured · ${d.trials.length} sweep curves (AB ${n.AB}, A ${n.A}, B ${n.B}) · duplicates removed`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("cfg", (v) => { state.cfg = v; state.sel = null; });
  radio("sort", (v) => { state.sort = v; });
  ["q1", "q2", "src-s", "src-c", "floor-only"].forEach((id) => $(id).addEventListener("change", update));
  $("map-plot").on("plotly_click", (ev) => { const t = state.rows[ev.points[0].y]; if (t) select(key(t)); });
  $("v10-plot").on("plotly_click", (ev) => select(ev.points[0].customdata));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=b1127438ee");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    update();          // draw first: Plotly adds .on() only once a div holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the sweeps: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
