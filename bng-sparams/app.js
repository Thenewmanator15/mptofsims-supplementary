// BNG S-parameters -- supplementary page.
// Reads data.json written by ../reduce.py: measured FieldFox sweeps, base64 int16 in
// 0.01 dB / 0.01 deg steps on a linear grid f0 + k*df. The Smith chart plots the stored
// reflection itself; Plotly's scattersmith takes it as normalised impedance z = (1+G)/(1-G).
"use strict";

const state = { d: null, f: null, tr: {}, cst: null, param: "s11", view: "db", axis: "log", on: {} };
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLOURS = { nofingers: "--trace", f5565: "--measured", f3050: "--ideal" };
const REFLECTION = new Set(["s11", "s22"]);

function unpack(b64, n, step) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length !== 2 * n) throw new Error("trace length does not match data.json");
  const v = new DataView(bytes.buffer), out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(2 * i, true) * step;
  return out;
}

function baseLayout() {
  const soft = css("--ink-soft"), grid = css("--plot-grid");
  const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: soft, color: soft };
  return {
    paper_bgcolor: css("--panel"), plot_bgcolor: css("--panel"),
    font: { family: css("--font-sans"), color: css("--ink"), size: 12 },
    margin: { l: 64, r: 16, t: 14, b: 48 },
    legend: { orientation: "h", y: 1.08, x: 0, font: { color: soft } },
    xaxis: { ...axis }, yaxis: { ...axis },
  };
}
const config = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage", "lasso2d", "select2d"] };

const fGHz = () => state.f;

function drawMain() {
  const d = state.d, p = state.param, base = baseLayout();
  const shown = d.designs.filter((x) => state.on[x.key]);
  if (state.view === "smith") {
    const traces = shown.map((x) => {
      const db = state.tr[x.key][`${p}_db`], deg = state.tr[x.key][`${p}_deg`];
      const re = [], im = [];
      for (let i = 0; i < db.length; i++) {
        const m = 10 ** (db[i] / 20), a = (deg[i] * Math.PI) / 180;
        const gr = m * Math.cos(a), gi = m * Math.sin(a);
        const den = (1 - gr) ** 2 + gi ** 2;                 // z = (1+G)/(1-G)
        re.push((1 - gr * gr - gi * gi) / den); im.push((2 * gi) / den);
      }
      return { type: "scattersmith", mode: "lines", real: re, imag: im, name: x.label,
        line: { color: css(COLOURS[x.key]), width: 1.2 }, customdata: Array.from(fGHz()),
        hovertemplate: "%{customdata:.4f} GHz<br>z = %{real:.3f} %{imag:+.3f}j<extra>" + x.label + "</extra>" };
    });
    Plotly.react($("main-plot"), traces, { ...base, margin: { l: 30, r: 30, t: 40, b: 30 },
      smith: { bgcolor: css("--panel"),
        realaxis: { gridcolor: css("--plot-grid"), linecolor: css("--ink-soft"), tickfont: { color: css("--ink-soft") } },
        imaginaryaxis: { gridcolor: css("--plot-grid"), linecolor: css("--ink-soft"), tickfont: { color: css("--ink-soft") } } },
    }, config);
    $("cap-main").textContent = `${p.toUpperCase()} on a Smith chart, 30 kHz → 4 GHz. Hover for the frequency and normalised impedance (50 Ω).`;
    return;
  }
  const key = `${p}_${state.view}`, unit = state.view === "db" ? "dB" : "°";
  const traces = shown.map((x) => ({ type: "scatter", mode: "lines", x: fGHz(), y: Array.from(state.tr[x.key][key]),
    name: x.label, line: { color: css(COLOURS[x.key]), width: 1.2 },
    hovertemplate: `%{x:.4f} GHz: %{y:.2f} ${unit}<extra>${x.label}</extra>` }));
  const log = state.axis === "log";
  Plotly.react($("main-plot"), traces, { ...base,
    xaxis: { ...base.xaxis, type: state.axis, title: { text: "frequency (GHz)" },
      range: log ? [Math.log10(1e-3), Math.log10(4)] : [0, 4] },
    yaxis: { ...base.yaxis, title: { text: `${p.toUpperCase()} ${state.view === "db" ? "magnitude (dB)" : "phase (°)"}` },
      ...(state.view === "deg" ? { range: [-185, 185], dtick: 90 } : {}) },
  }, config);
  $("cap-main").textContent = "Measured sweeps. Drag to zoom, double-click to reset; hover for values.";
}

function drawCst() {
  const base = baseLayout(), log = state.axis === "log";
  Plotly.react($("cst-plot"), [
    { type: "scatter", mode: "lines", x: fGHz(), y: Array.from(state.tr.f3050.s11_db), name: "measured",
      line: { color: css("--ideal"), width: 1.2 }, hovertemplate: "%{x:.4f} GHz: %{y:.2f} dB<extra>measured</extra>" },
    { type: "scatter", mode: "lines", x: fGHz(), y: Array.from(state.cst), name: "CST",
      line: { color: css("--ink"), width: 1, dash: "dash" }, hovertemplate: "%{x:.4f} GHz: %{y:.2f} dB<extra>CST</extra>" },
  ], { ...base,
    xaxis: { ...base.xaxis, type: state.axis, title: { text: "frequency (GHz)" }, range: log ? [-3, Math.log10(4)] : [0, 4] },
    yaxis: { ...base.yaxis, title: { text: "S11 magnitude (dB)" }, range: [-16, 1] },
  }, config);
}

function update() {
  const smith = $("v-smith");
  const reflection = REFLECTION.has(state.param);
  smith.disabled = !reflection;
  if (!reflection && state.view === "smith") { state.view = "db"; $("v-db").checked = true; }
  document.querySelectorAll('input[name="axis"]').forEach((el) => { el.disabled = state.view === "smith"; });
  drawMain();
  drawCst();
}

function fillText() {
  const d = state.d, s = d.source;
  $("designs").replaceChildren(...d.designs.map((x) => {
    const lab = document.createElement("label"), box = document.createElement("input");
    box.type = "checkbox"; box.id = `d-${x.key}`; box.checked = true; state.on[x.key] = true;
    box.addEventListener("change", () => { state.on[x.key] = box.checked; drawMain(); });
    lab.append(box, ` ${x.label}`);
    return lab;
  }));
  $("caveats").replaceChildren(...d.caveats.map((c) => { const li = document.createElement("li"); li.textContent = c; return li; }));
  const prov = [["Instrument", s.instrument], ["Campaign", s.campaign], ["Fixture", s.fixture], ["Data", s.data],
    ["Printed figures", s.static_figures], ["Thesis section", s.thesis_section], ["Analysis", s.analysis],
    ["Reduced by", s.reducer], ...Object.entries(s.sha256)];
  $("provenance").replaceChildren(...prov.flatMap(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    return [dt, dd];
  }));
  $("status").textContent = `Measured · ${d.designs.length} gates · ${d.n.toLocaleString("en-GB")} points per sweep, `
    + `${(d.df_hz / 1e3).toFixed(1)} kHz apart`;
}

function wire() {
  const radio = (name, set) => document.querySelectorAll(`input[name="${name}"]`)
    .forEach((el) => el.addEventListener("change", () => { set(el.value); update(); }));
  radio("param", (v) => { state.param = v; });
  radio("view", (v) => { state.view = v; });
  radio("axis", (v) => { state.axis = v; });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

(async () => {
  try {
    if (typeof Plotly === "undefined") throw new Error("the plotting library did not load");
    const res = await fetch("data.json?v=ace574c178");
    if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
    const d = await res.json();
    state.d = d;
    state.f = Array.from({ length: d.n }, (_, i) => (d.f0_hz + i * d.df_hz) / 1e9);
    for (const x of d.designs) {
      state.tr[x.key] = {};
      for (const [k, b64] of Object.entries(d.traces[x.key])) state.tr[x.key][k] = unpack(b64, d.n, d.step);
    }
    state.cst = unpack(d.cst_3050_s11_db, d.n, d.step);
    if (location.hash === "#smith") { state.view = "smith"; $("v-smith").checked = true; }   // linkable view
    fillText();
    wire();
    update();
  } catch (err) {
    const s = $("status");
    s.classList.add("error");
    s.textContent = `Could not load the sweeps: ${err.message}. `
      + "Open this page over HTTP (e.g. `py -m http.server` in site/), not as a file.";
  }
})();
