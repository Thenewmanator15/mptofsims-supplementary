// Single-ion events -- supplementary page.
// Reads data.json written by ../reduce.py: 152 simultaneous raw (C2) / amplified (C3) captures,
// peak-positive mV, int16 at 0.02 mV, aligned on the amplified peak. Nothing is corrected.
"use strict";

const state = { d: null, raw: [], amp: [], t: [], ch: "amp", scale: "norm", sort: "order", sel: 0, order: [] };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function unpack(b64, n, m, step) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length !== 2 * n * m) throw new Error("stack size does not match data.json");
  const v = new DataView(bytes.buffer), out = [];
  for (let e = 0; e < n; e++) {
    const row = new Float64Array(m);
    for (let i = 0; i < m; i++) row[i] = v.getInt16(2 * (e * m + i), true) * step;
    out.push(row);
  }
  return out;
}

const ev = (i) => state.d.events[i];
const gain = (i) => ev(i).amp_pk_mV / ev(i).raw_pk_mV;
const clipped = (i) => ev(i).raw_clipped || ev(i).amp_clipped;
const peakOf = (y) => y.reduce((m, v) => (v > m ? v : m), -Infinity);

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 62, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.12, x: 0, font: { color: css("--ink-soft") } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

function computeOrder() {
  let idx = state.d.events.map((_, i) => i);
  if ($("mask").checked) idx = idx.filter((i) => !clipped(i));
  if (state.sort !== "order") {
    const f = state.sort === "gain" ? gain : (i) => ev(i)[state.sort];
    idx.sort((a, b) => f(b) - f(a));
  }
  state.order = idx;
  if (!idx.includes(state.sel)) state.sel = idx[0] ?? 0;
}

function drawMap() {
  const stack = state[state.ch], base = baseLayout(), norm = state.scale === "norm";
  const lo = state.t.findIndex((x) => x >= -6), hi = state.t.findIndex((x) => x >= 14);
  const t = state.t.slice(lo, hi);
  const z = state.order.map((i) => {
    const row = Array.from(stack[i].slice(lo, hi)), pk = peakOf(stack[i]);
    return norm ? row.map((v) => v / pk) : row;
  });
  const selRow = state.order.indexOf(state.sel);
  const zmax = norm ? 1 : Math.max(...state.order.map((i) => peakOf(stack[i])));
  Plotly.react($("map-plot"), [{
    type: "heatmap", x: t, y: state.order.map((_, k) => k), z, zmin: norm ? -0.15 : 0, zmax,
    colorscale: "Viridis", colorbar: { title: { text: norm ? "÷ own peak" : "mV", side: "right" }, tickfont: { color: css("--ink-soft") } },
    customdata: state.order.map((i) => t.map(() => i + 1)),
    hovertemplate: "event %{customdata}<br>%{x:.1f} ns: %{z:.3f}<extra></extra>",
  }], { ...base, margin: { l: 70, r: 16, t: 10, b: 48 },
    xaxis: { ...base.xaxis, title: { text: "time from the amplified peak (ns)" } },
    yaxis: { ...base.yaxis, title: { text: `events (${state.sort === "order" ? "capture order" : "sorted"})` }, autorange: "reversed",
      tickvals: state.order.map((_, k) => k).filter((k) => k % 10 === 0), ticktext: state.order.filter((_, k) => k % 10 === 0).map((i) => `#${i + 1}`) },
    shapes: selRow >= 0 ? [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: selRow - 0.5, y1: selRow + 0.5, line: { color: css("--gold"), width: 2 } }] : [],
  }, { ...config, displayModeBar: false });
  const nClip = state.order.filter(clipped).length;
  $("cap-map").textContent = `(1) ${state.ch === "amp" ? "Amplified (C3)" : "Raw detector (C2)"} pulses, one row per event, `
    + `${norm ? "each normalised to its own peak" : "in mV as recorded (the scope was re-ranged, so rows are not on one scale of sensitivity)"}; `
    + `${state.order.length} events${nClip ? `, ${nClip} of them clipped on at least one channel` : ""}. Click a row to select it.`;
}

function drawGain() {
  const base = baseLayout(), idx = state.order;
  const ok = idx.filter((i) => !clipped(i)), cl = idx.filter(clipped);
  const pt = (list, name, sym, col) => ({ type: "scatter", mode: "markers", name, x: list.map((i) => ev(i).raw_pk_mV), y: list.map((i) => ev(i).amp_pk_mV),
    customdata: list.map((i) => i), marker: { symbol: sym, size: list.map((i) => (i === state.sel ? 14 : 8)), color: list.map((i) => (i === state.sel ? css("--gold") : col)) },
    text: list.map((i) => `#${i + 1}`), hovertemplate: "event %{text}<br>raw %{x:.2f} mV → amplified %{y:.1f} mV<extra></extra>" });
  Plotly.react($("gain-plot"), [pt(ok, "not clipped", "circle", css("--measured")), pt(cl, "clipped", "x", css("--warn"))], { ...base,
    xaxis: { ...base.xaxis, type: "log", title: { text: "raw peak, C2 (mV)" } },
    yaxis: { ...base.yaxis, type: "log", title: { text: "amplified peak, C3 (mV)" } },
  }, config);
}

function drawPair() {
  const base = baseLayout(), i = state.sel, r = state.raw[i], a = state.amp[i];
  const rp = peakOf(r), ap = peakOf(a);
  Plotly.react($("pair-plot"), [
    { type: "scatter", mode: "lines", x: state.t, y: Array.from(r).map((v) => v / rp), name: `raw (recorded peak ${ev(i).raw_pk_mV.toFixed(2)} mV)`, line: { color: css("--measured"), width: 1.6 } },
    { type: "scatter", mode: "lines", x: state.t, y: Array.from(a).map((v) => v / ap), name: `amplified (recorded peak ${ev(i).amp_pk_mV.toFixed(1)} mV)`, line: { color: css("--ideal"), width: 2 } },
  ], { ...base,
    xaxis: { ...base.xaxis, title: { text: "time from the amplified peak (ns)" }, range: [-6, 14] },
    yaxis: { ...base.yaxis, title: { text: "÷ own peak" }, range: [-0.4, 1.15] },
  }, config);
  $("cap-pair").textContent = `(3) Event #${i + 1}, raw and amplified, each normalised to its own peak${clipped(i) ? " — clipped on at least one channel, so its true peak is higher" : ""}.`;
}

function readouts() {
  const i = state.sel, e = ev(i);
  $("r-n").textContent = `${state.order.length} of ${state.d.n}`;
  $("r-sel").textContent = `#${i + 1}${clipped(i) ? " (clipped)" : ""}`;
  $("r-pk").textContent = `${e.raw_pk_mV.toFixed(2)} / ${e.amp_pk_mV.toFixed(1)} mV`;
  $("r-wg").textContent = `${e.fwhm_ns.toFixed(2)} ns · ×${gain(i).toFixed(1)}`;
}

function update() { computeOrder(); readouts(); drawMap(); drawGain(); drawPair(); }
function select(i) { state.sel = i; readouts(); drawMap(); drawGain(); drawPair(); }

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Reduction", s.reduction], ["Data", s.file], ["SHA-256", s.sha256],
    ["Printed figures", s.static_figures], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  const med = (k) => { const v = d.events.map((e) => e[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  $("status").textContent = `Measured · ${d.n} events · median peaks ${med("raw_pk_mV").toFixed(2)} mV raw, ${med("amp_pk_mV").toFixed(1)} mV amplified`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("ch", (v) => { state.ch = v; });
  radio("scale", (v) => { state.scale = v; });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  $("mask").addEventListener("change", update);
  $("map-plot").on("plotly_click", (e) => { const i = state.order[e.points[0].y]; if (i != null) select(i); });
  $("gain-plot").on("plotly_click", (e) => select(e.points[0].customdata));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    const d = await res.json();
    state.d = d;
    state.t = Array.from({ length: d.n_t }, (_, i) => d.t0_ns + i * d.dt_ns);
    state.raw = unpack(d.raw, d.n, d.n_t, d.step_mV);
    state.amp = unpack(d.amp, d.n, d.n_t, d.step_mV);
    fillText();
    update();
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the events: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
