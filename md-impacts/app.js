// C60 impact MD -- supplementary page (SIMULATION).
// Reads data.json written by ../reduce.py: LAMMPS runs parsed from their logs (scripts/bng-md)
// and the RustBCA / SRIM yields of Appendix C (scripts/bng). Nothing is simulated here.
"use strict";

const state = { d: null, key: "es" };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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

const current = () => state.d.sets.find((s) => s.key === state.key);
const interp = (xs, ys, x) => {                     // linear, within range only
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return null;
};
// RustBCA / SRIM here are normal incidence on amorphous targets: no band for an oblique set.
function bcaRange(mat, e, angle = 0) {
  if (angle > 1) return null;
  const b = state.d.bca[mat];
  if (!b) return null;
  const r = interp(b.RustBCA.E, b.RustBCA.Y, e), s = interp(b.SRIM.E, b.SRIM.Y, e);
  return r == null || s == null ? null : [Math.min(r, s), Math.max(r, s)];
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function drawTime() {
  const set = current(), base = baseLayout(), showC = $("show-c").checked;
  const palette = [css("--measured"), css("--ideal"), css("--ink-soft")];
  const traces = [];
  set.runs.forEach((r, i) => {
    const s = state.d.series[r.run];
    traces.push({ type: "scatter", mode: "lines", x: s.t, y: s.Y, name: `${r.run.replace("run_", "")} (seed ${r.seed})`,
      line: { color: palette[i % 3], width: 2 }, hovertemplate: "%{x:.1f} ps: %{y} atoms<extra>" + r.run + "</extra>" });
    if (showC) traces.push({ type: "scatter", mode: "lines", x: s.t, y: s.C, name: `${r.run.replace("run_", "")} carbon`,
      line: { color: palette[i % 3], width: 1.2, dash: "dot" }, hovertemplate: "%{x:.1f} ps: %{y} C<extra>escaped carbon</extra>" });
  });
  Plotly.react($("time-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, title: { text: "simulation time (ps)" } },
    yaxis: { ...base.yaxis, title: { text: `atoms escaped (${set.material}${showC ? " / carbon, dotted" : ""})` }, rangemode: "tozero" },
  }, config);
  $("cap-time").textContent = `(1) ${set.label}: cumulative atoms crossing the escape plane against simulation time, `
    + "one line per impact. The tally plateaus well before the run stops (~30 ps).";
}

function drawSets() {
  const d = state.d, base = baseLayout(), traces = [], shapes = [];
  d.sets.forEach((s, i) => {
    const sel = s.key === state.key, r = bcaRange(s.material, s.energy_keV, s.angle_deg);
    if (r) shapes.push({ type: "rect", x0: i - 0.3, x1: i + 0.3, y0: r[0], y1: r[1], fillcolor: css("--ideal"), opacity: 0.25, line: { width: 0 } });
    traces.push({ type: "scatter", mode: "markers", x: s.runs.map(() => i), y: s.runs.map((x) => x.Y),
      marker: { color: sel ? css("--gold") : css("--measured"), size: sel ? 12 : 9, line: { color: css("--panel"), width: 1 } },
      customdata: s.runs.map((x) => x.run), showlegend: false,
      hovertemplate: "%{customdata}: %{y} atoms<extra>" + s.label + "</extra>" });
  });
  Plotly.react($("set-plot"), traces, { ...base, margin: { l: 62, r: 16, t: 14, b: 90 },
    xaxis: { ...base.xaxis, tickvals: d.sets.map((_, i) => i), ticktext: d.sets.map((s) => s.key === "noes" ? "no ES" : s.key),
      tickangle: -30 },
    yaxis: { ...base.yaxis, title: { text: "atoms sputtered per C60" }, rangemode: "tozero" },
    shapes,
  }, config);
}

function drawEnergy() {
  const d = state.d, base = baseLayout(), cu = d.bca.Cu;
  const md = d.sets.filter((s) => s.material === "Cu" && ["e10", "es", "e40"].includes(s.key));
  Plotly.react($("energy-plot"), [
    { type: "scatter", mode: "lines", x: cu.RustBCA.E, y: cu.RustBCA.Y, name: "RustBCA", line: { color: css("--ideal"), width: 2 } },
    { type: "scatter", mode: "lines", x: cu.SRIM.E, y: cu.SRIM.Y, name: "SRIM", line: { color: css("--ideal"), width: 2, dash: "dash" } },
    { type: "scatter", mode: "markers", x: md.flatMap((s) => s.runs.map(() => s.energy_keV)), y: md.flatMap((s) => s.runs.map((r) => r.Y)),
      name: "MD (Cu 001, normal, ES on)", marker: { color: css("--measured"), size: 10 }, hovertemplate: "%{x:.0f} keV: %{y} atoms<extra>MD</extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "C60 energy (keV)" } },
    yaxis: { ...base.yaxis, title: { text: "Cu atoms per C60" }, rangemode: "tozero" },
  }, config);
}

function drawMap() {
  const d = state.d, base = baseLayout(), rows = [];
  d.sets.forEach((set) => set.runs.forEach((r) => rows.push({ set, r })));
  const tg = Array.from({ length: 121 }, (_, i) => i * 0.25);          // 0 - 30 ps
  const z = rows.map(({ r }) => {
    const s = d.series[r.run];                                         // cumulative tally: step-hold between thermo rows
    return tg.map((t) => { let y = null; for (let k = 0; k < s.t.length && s.t[k] <= t; k++) y = s.Y[k]; return t > s.t[s.t.length - 1] ? null : y; });
  });
  const labels = rows.map(({ set, r }) => `${set.key === "noes" ? "no ES" : set.key} · ${r.run.replace("run_", "")}`);
  const sel = rows.map(({ set }, i) => (set.key === state.key ? i : -1)).filter((i) => i >= 0);
  Plotly.react($("map-plot"), [{ type: "heatmap", x: tg, y: rows.map((_, i) => i), z, colorscale: "Viridis", zmin: 0,
    colorbar: { title: { text: "atoms escaped", side: "right" }, tickfont: { color: css("--ink-soft") } },
    customdata: rows.map(({ set, r }) => tg.map(() => `${r.run} · ${set.label}`)), hoverongaps: false,
    hovertemplate: "%{customdata}<br>%{x:.2f} ps: %{z} atoms<extra></extra>" }], { ...base, margin: { l: 110, r: 16, t: 10, b: 48 },
    xaxis: { ...base.xaxis, title: { text: "simulation time (ps)" } },
    yaxis: { ...base.yaxis, tickvals: rows.map((_, i) => i), ticktext: labels, autorange: "reversed", tickfont: { size: 11 } },
    shapes: sel.length ? [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: sel[0] - 0.5, y1: sel[sel.length - 1] + 0.5, line: { color: css("--gold"), width: 2 } }] : [],
  }, { ...config, displayModeBar: false });
  state.mapRows = rows;
}

function readouts() {
  const s = current(), ys = s.runs.map((r) => r.Y), r = bcaRange(s.material, s.energy_keV, s.angle_deg), m = mean(ys);
  $("r-y").textContent = ys.length > 1 ? `${m.toFixed(0)} (${Math.min(...ys)}–${Math.max(...ys)})` : `${m.toFixed(0)}`;
  $("r-bca").textContent = r ? `${r[0].toFixed(0)}–${r[1].toFixed(0)}` : "—";
  $("r-ratio").textContent = r ? `×${(m / r[1]).toFixed(1)}–${(m / r[0]).toFixed(1)}` : "—";
  $("r-n").textContent = String(ys.length);
}

function update() { readouts(); drawTime(); drawMap(); drawSets(); drawEnergy(); }

function fillText() {
  const d = state.d, s = d.source;
  $("set").replaceChildren(...d.sets.map((x) => new Option(`${x.label} (${x.runs.length} impact${x.runs.length > 1 ? "s" : ""})`, x.key)));
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Molecular dynamics", s.md], ["Binary collision", s.bca], ["In the thesis", s.thesis],
    ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  const n = d.sets.reduce((a, x) => a + x.runs.length, 0);
  $("status").textContent = `Simulated · ${n} single-C60 impacts in ${d.sets.length} sets · LAMMPS, EAM + ZBL`;
}

function wire() {
  $("set").addEventListener("change", (e) => { state.key = e.target.value; update(); });
  $("show-c").addEventListener("change", drawTime);
  $("map-plot").on("plotly_click", (ev) => { const row = state.mapRows[ev.points[0].y]; if (row) { state.key = row.set.key; $("set").value = state.key; update(); } });
  $("set-plot").on("plotly_click", (ev) => { const i = ev.points[0].x; state.key = state.d.sets[i].key; $("set").value = state.key; update(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=101c4901f8");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    fillText();
    update();          // draw first: Plotly adds .on() to a div only once it holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the runs: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
