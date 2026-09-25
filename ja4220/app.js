// JA4220 transformer -- supplementary page.
// Reads data.json written by ../reduce.py: Coilcraft's 4-port S-parameters (dB / degrees), the
// single-ended inverting and non-inverting responses and the common-mode transmission computed
// as scripts/inverter/analyze.py does, and the mean measured single-ion pulse before/after.
"use strict";

const state = { d: null, k: 400, sel: [2, 0], full: false };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const PORT = ["1 (primary, in)", "2 (secondary)", "3 (secondary, out)", "4 (primary return)"];

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 64, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.14, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };
const fmtF = (mhz) => (mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : mhz >= 1 ? `${mhz.toFixed(mhz < 10 ? 2 : 0)} MHz` : `${(mhz * 1000).toFixed(0)} kHz`);
const fMax = () => (state.full ? 8500 : 3000);
const xRange = () => [Math.log10(0.1), Math.log10(fMax())];

function drawTx() {
  const b = baseLayout(), d = state.d, f = d.f_mhz, fk = f[state.k];
  Plotly.react($("tx-plot"), [
    { type: "scatter", mode: "lines", name: "pulse energy (relative)", x: d.spectrum.f_mhz, y: d.spectrum.rel_db,
      line: { color: css("--ink-soft"), width: 1, dash: "dot" }, hovertemplate: "%{x:.0f} MHz: %{y:.1f} dB rel.<extra>pulse</extra>" },
    { type: "scatter", mode: "lines", name: "the other way round", x: f, y: d.non_db,
      line: { color: css("--measured"), width: 1 }, hovertemplate: "%{x:.2f} MHz: %{y:.2f} dB<extra>non-inverting</extra>" },
    { type: "scatter", mode: "lines", name: "common-mode leak", x: f, y: d.cm_db,
      line: { color: css("--ideal"), width: 1.6 }, hovertemplate: "%{x:.2f} MHz: %{y:.1f} dB<extra>common mode</extra>" },
    { type: "scatter", mode: "lines", name: "inverting (as used)", x: f, y: d.inv_db,
      line: { color: css("--gold"), width: 2.4 }, hovertemplate: "%{x:.2f} MHz: %{y:.2f} dB<extra>inverting</extra>" },
  ], { ...b,
    xaxis: { ...b.xaxis, type: "log", range: xRange(), title: { text: "frequency (MHz)" },
      tickvals: [0.1, 1, 10, 100, 1000, 8500].filter((v) => v <= fMax()), ticktext: ["0.1", "1", "10", "100", "1000", "8500"] },
    yaxis: { ...b.yaxis, title: { text: "transmission (dB)" }, range: [-40, 3] },
    shapes: [{ type: "line", x0: fk, x1: fk, yref: "paper", y0: 0, y1: 1, line: { color: css("--gold"), width: 1, dash: "dash" } },
      { type: "line", x0: d.numbers.corner_mhz, x1: d.numbers.corner_mhz, yref: "paper", y0: 0, y1: 1, line: { color: css("--ink-soft"), width: 1 } }],
    annotations: [{ x: Math.log10(d.numbers.corner_mhz), y: 1, yref: "paper", xanchor: "left", yanchor: "top", showarrow: false,
      text: ` low corner ${d.numbers.corner_mhz} MHz`, font: { color: css("--ink-soft"), size: 11 } }],
  }, config);
}

function drawPulse() {
  const b = baseLayout(), p = state.d.pulse;
  Plotly.react($("pulse-plot"), [
    { type: "scatter", mode: "lines", name: "before", x: p.t_ns, y: p.before, line: { color: css("--ink-soft"), width: 1.4, dash: "dot" } },
    { type: "scatter", mode: "lines", name: "after the transformer", x: p.t_ns, y: p.after, line: { color: css("--gold"), width: 2.2 } },
  ], { ...b,
    xaxis: { ...b.xaxis, title: { text: "time (ns)" } },
    yaxis: { ...b.yaxis, title: { text: "÷ own peak" } },
    shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: css("--ink"), width: 1 } }],
  }, config);
}

function drawMatrix() {
  const b = baseLayout(), d = state.d, k = state.k;
  const z = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((c) => d.S_db[a][c][k]));
  const text = z.map((r) => r.map((v) => `${v.toFixed(1)}`));
  Plotly.react($("matrix-plot"), [{
    type: "heatmap", z, x: ["from 1", "from 2", "from 3", "from 4"], y: ["to 1", "to 2", "to 3", "to 4"],
    text, texttemplate: "%{text}", textfont: { size: 13 }, zmin: -40, zmax: 0, colorscale: "Viridis",
    colorbar: { title: { text: "dB", side: "right" }, tickfont: { color: css("--ink-soft") } },
    hovertemplate: "S%{y}%{x}: %{z:.2f} dB<extra></extra>",
  }], { ...b, margin: { l: 56, r: 16, t: 10, b: 40 },
    yaxis: { ...b.yaxis, autorange: "reversed" },
    shapes: [{ type: "rect", x0: state.sel[1] - 0.5, x1: state.sel[1] + 0.5, y0: state.sel[0] - 0.5, y1: state.sel[0] + 0.5,
      line: { color: css("--gold"), width: 3 } }],
  }, { ...config, displayModeBar: false });
  $("cap-matrix").textContent = `(3) All sixteen measured transmissions and reflections at ${fmtF(d.f_mhz[k])}: `
    + "row = port the signal arrives at, column = port it was sent into. Ports 1–4 are primary in, secondary, secondary out "
    + "and primary return. Here every other port is terminated in 50 Ω, so the signal divides between them and "
    + "these entries sit about 6 dB below the single-ended wiring of panel (1); they describe the part, not the circuit. "
    + "Click a cell to plot it across frequency in (4).";
}

function drawSij() {
  const b = baseLayout(), d = state.d, [a, c] = state.sel;
  Plotly.react($("sij-plot"), [
    { type: "scatter", mode: "lines", name: "magnitude (dB)", x: d.f_mhz, y: d.S_db[a][c], line: { color: css("--gold"), width: 2 },
      hovertemplate: "%{x:.2f} MHz: %{y:.2f} dB<extra></extra>" },
    { type: "scatter", mode: "lines", name: "phase (°, right axis)", x: d.f_mhz, y: d.S_deg[a][c], yaxis: "y2",
      line: { color: css("--measured"), width: 1 }, hovertemplate: "%{x:.2f} MHz: %{y:.0f}°<extra></extra>" },
  ], { ...b, margin: { l: 64, r: 60, t: 14, b: 48 },
    xaxis: { ...b.xaxis, type: "log", range: xRange(), title: { text: "frequency (MHz)" } },
    yaxis: { ...b.yaxis, title: { text: "magnitude (dB)" } },
    yaxis2: { overlaying: "y", side: "right", range: [-180, 180], tickvals: [-180, -90, 0, 90, 180], showgrid: false,
      color: css("--measured"), title: { text: "phase (°)" } },
    shapes: [{ type: "line", x0: d.f_mhz[state.k], x1: d.f_mhz[state.k], yref: "paper", y0: 0, y1: 1, line: { color: css("--gold"), width: 1, dash: "dash" } }],
  }, config);
  const what = a === c ? `reflection at port ${a + 1}` : `transmission from port ${PORT[c]} to port ${PORT[a]}`;
  $("cap-sij").textContent = `(4) S${a + 1}${c + 1}, the ${what}, as measured with every other port in 50 Ω `
    + "(not the single-ended wiring of panel 1). The phase wraps at ±180°; its steady slope at high frequency is the part's delay.";
}

function summary() {
  const n = state.d.numbers;
  const rows = [
    ["Loss, inverting connection", `${n.il_inv.toFixed(2)} dB`, "signal lost in the transformer as it is wired (10–500 MHz)"],
    ["Loss, other way round", `${n.il_non.toFixed(2)} dB`, "so the inverting wiring is not the lossier one"],
    ["Common-mode rejection", `${n.cmrr.toFixed(1)} dB`, "how strongly it blocks noise common to both leads (grounds tied)"],
    ["Low-frequency corner", `${n.corner_mhz.toFixed(2)} MHz`, "below this it stops passing signal; sets the slow dip"],
    ["Dip after the pulse", `${n.undershoot_pct.toFixed(1)} %`, "of the peak, from the transformer alone (real ions show about −21 %)"],
  ];
  $("summary-body").replaceChildren(...rows.map((r) => {
    const tr = document.createElement("tr");
    r.forEach((t) => { const td = document.createElement("td"); td.textContent = t; tr.append(td); });
    return tr;
  }));
}

function update() {
  $("freq-out").textContent = fmtF(state.d.f_mhz[state.k]);
  drawTx(); drawPulse(); drawMatrix(); drawSij();
}

function fillText() {
  const d = state.d, s = d.source;
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Data", s.file], ["SHA-256", s.sha256], ["Pulse", s.pulse_file],
    ["Analysis", s.analysis], ["Printed figure", s.static_figures], ["Reduced by", s.reducer]];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured (manufacturer) · four ports · ${d.f_mhz.length} frequencies, 0.1 MHz to 8.5 GHz`;
}

function wire() {
  $("freq").addEventListener("input", (e) => { state.k = Number(e.target.value); update(); });
  $("full").addEventListener("change", (e) => { state.full = e.target.checked; update(); });
  $("matrix-plot").on("plotly_click", (e) => {
    const p = e.points[0];
    state.sel = [["to 1", "to 2", "to 3", "to 4"].indexOf(p.y), ["from 1", "from 2", "from 3", "from 4"].indexOf(p.x)];
    drawMatrix(); drawSij();
  });
  $("tx-plot").on("plotly_click", (e) => {
    const f = e.points[0].x, fs = state.d.f_mhz;
    let best = 0;
    fs.forEach((v, i) => { if (Math.abs(Math.log(v / f)) < Math.abs(Math.log(fs[best] / f))) best = i; });
    state.k = best; $("freq").value = String(best); update();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=f9456f2395");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    state.d = await res.json();
    $("freq").max = String(state.d.f_mhz.length - 1);
    state.k = state.d.f_mhz.reduce((b, v, i, a) => (Math.abs(v - 100) < Math.abs(a[b] - 100) ? i : b), 0);   // open at 100 MHz
    $("freq").value = String(state.k);
    fillText();
    summary();
    update();          // draw first: Plotly adds .on() only once a div holds a plot
    wire();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the measurement: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
