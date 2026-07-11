import { boot, widget, Stage, theme, slider, button, segmented } from "../../../assets/demos-core.js";

class RNG {
  constructor(seed = 1) { this.s = seed >>> 0; }
  next() { this.s = (1664525 * this.s + 1013904223) >>> 0; return this.s / 4294967296; }
  normal() { const u1 = Math.max(1e-12, this.next()); const u2 = this.next(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }
}
function nPdf(x, mu, sig) { sig = Math.max(1e-6, sig); const z = (x - mu) / sig; return Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * sig); }
function cPdf(x, x0, g) { g = Math.max(1e-6, g); const z = (x - x0) / g; return 1 / (Math.PI * g * (1 + z * z)); }
function targetPdf(caseId, x) {
  if (caseId === "gaussian") return nPdf(x, 0.4, 1.15);
  if (caseId === "gaussian_mix") return 0.5 * nPdf(x, -2.2, 0.55) + 0.5 * nPdf(x, 2.0, 0.85);
  if (caseId === "cauchy") return cPdf(x, 0.15, 1.0);
  if (caseId === "failure_underfit") return 0.5 * nPdf(x, -2.4, 0.38) + 0.5 * nPdf(x, 2.4, 0.38);
  return 0.5 * nPdf(x, -2.0, 0.45) + 0.5 * nPdf(x, 2.2, 0.6);
}
function domain(caseId) { return caseId === "cauchy" ? [-10, 10] : [-6, 6]; }
function sampleTarget(caseId, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (caseId === "gaussian") out.push(0.4 + 1.15 * rng.normal());
    else if (caseId === "gaussian_mix") out.push((rng.next() < 0.5 ? -2.2 + 0.55 * rng.normal() : 2.0 + 0.85 * rng.normal()));
    else if (caseId === "cauchy") { const u = Math.min(1 - 1e-4, Math.max(1e-4, rng.next())); out.push(0.15 + Math.tan(Math.PI * (u - 0.5))); }
    else if (caseId === "failure_underfit") out.push((rng.next() < 0.5 ? -2.4 : 2.4) + 0.38 * rng.normal());
    else out.push((rng.next() < 0.5 ? -2.0 + 0.45 * rng.normal() : 2.2 + 0.6 * rng.normal()));
  }
  return out;
}
function initModel(caseId) {
  if (caseId === "gaussian" || caseId === "failure_underfit") return { kind: "gaussian", mu: 0.0, logs: Math.log(1.9) };
  if (caseId === "cauchy") return { kind: "cauchy", loc: 1.1, logg: Math.log(1.9) };
  return { kind: "mix2", mu1: -0.6, mu2: 0.8, logs: Math.log(1.4) };
}
function modelPdf(th, x) {
  if (th.kind === "gaussian") return nPdf(x, th.mu, Math.exp(th.logs));
  if (th.kind === "cauchy") return cPdf(x, th.loc, Math.exp(th.logg));
  const sig = Math.exp(th.logs); return 0.5 * nPdf(x, th.mu1, sig) + 0.5 * nPdf(x, th.mu2, sig);
}
function sampleModel(th, m, rng) {
  const xs = new Array(m), meta = new Array(m);
  if (th.kind === "gaussian") { const sig = Math.exp(th.logs); for (let j = 0; j < m; j++) { const z = rng.normal(); xs[j] = th.mu + sig * z; meta[j] = { z }; } }
  else if (th.kind === "cauchy") { const g = Math.exp(th.logg); for (let j = 0; j < m; j++) { const u = Math.min(1 - 1e-4, Math.max(1e-4, rng.next())); const t = Math.tan(Math.PI * (u - 0.5)); xs[j] = th.loc + g * t; meta[j] = { t }; } }
  else { const sig = Math.exp(th.logs); for (let j = 0; j < m; j++) { const comp = rng.next() < 0.5 ? 0 : 1; const z = rng.normal(); xs[j] = (comp === 0 ? th.mu1 : th.mu2) + sig * z; meta[j] = { comp, z }; } }
  return { xs, meta };
}
function step(state) {
  const { theta, data, m, lr } = state; const rng = new RNG(state.seed++); const { xs, meta } = sampleModel(theta, m, rng);
  const assign = new Array(data.length); const grad = new Array(m).fill(0); let loss = 0;
  for (let i = 0; i < data.length; i++) { let best = 0, bestd = Infinity; for (let j = 0; j < m; j++) { const d = (data[i] - xs[j]) * (data[i] - xs[j]); if (d < bestd) { best = j; bestd = d; } } assign[i] = best; grad[best] += 2 * (xs[best] - data[i]) / data.length; loss += bestd / data.length; }
  if (theta.kind === "gaussian") { let gmu = 0, glogs = 0; for (let j = 0; j < m; j++) { gmu += grad[j]; glogs += grad[j] * (xs[j] - theta.mu); } theta.mu -= lr * gmu; theta.logs = Math.max(Math.log(0.1), Math.min(Math.log(4), theta.logs - lr * glogs)); }
  else if (theta.kind === "cauchy") { let gloc = 0, glogg = 0; for (let j = 0; j < m; j++) { gloc += grad[j]; glogg += grad[j] * (xs[j] - theta.loc); } theta.loc -= lr * gloc; theta.logg = Math.max(Math.log(0.12), Math.min(Math.log(5), theta.logg - lr * glogg)); }
  else { let g1 = 0, g2 = 0, glogs = 0; for (let j = 0; j < m; j++) { if (meta[j].comp === 0) g1 += grad[j]; else g2 += grad[j]; const mu = meta[j].comp === 0 ? theta.mu1 : theta.mu2; glogs += grad[j] * (xs[j] - mu); } theta.mu1 -= lr * g1; theta.mu2 -= lr * g2; if (theta.mu1 > theta.mu2) { const t = theta.mu1; theta.mu1 = theta.mu2; theta.mu2 = t; } theta.logs = Math.max(Math.log(0.12), Math.min(Math.log(4), theta.logs - lr * glogs)); }
  state.last = { xs, assign, loss }; state.loss = loss;
}
function summary(th) { if (th.kind === "gaussian") return `μ=${th.mu.toFixed(2)}, σ=${Math.exp(th.logs).toFixed(2)}`; if (th.kind === "cauchy") return `x₀=${th.loc.toFixed(2)}, γ=${Math.exp(th.logg).toFixed(2)}`; return `μ₁=${th.mu1.toFixed(2)}, μ₂=${th.mu2.toFixed(2)}, σ=${Math.exp(th.logs).toFixed(2)}`; }
function drawDensity(stage, c, fn, color, xlo, xhi, lw = 2, dash = []) { c.save(); c.strokeStyle = color; c.lineWidth = lw; c.setLineDash(dash); c.beginPath(); const N = 240; for (let k = 0; k <= N; k++) { const x = xlo + (xhi - xlo) * k / N; const y = fn(x); const px = stage.px(x), py = stage.py(y); if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.stroke(); c.restore(); }
function drawRug(stage, c, xs, y, color) { c.save(); c.strokeStyle = color; c.lineWidth = 1.2; c.globalAlpha = 0.75; xs.forEach((x) => { const px = stage.px(x), py = stage.py(y); c.beginPath(); c.moveTo(px, py - 4); c.lineTo(px, py + 4); c.stroke(); }); c.restore(); }

function makeTrainer(root, mode) {
  const title = mode === "geom" ? "Geometry of the IMLE loss" : mode === "train" ? "Synthetic IMLE trainer" : "Failure lab";
  const note = mode === "geom" ? "Each data point claims its nearest sampled neighbor." : mode === "train" ? "Dashed curve = target density, blue curve = current model density." : "Under-capacity versus under-sampling.";
  const { stageHost, controls, readout } = widget(root, { title, note });
  let caseId = mode === "geom" ? "gaussian_mix" : mode === "train" ? "gaussian" : "failure_underfit";
  const mk = () => ({ caseId, data: sampleTarget(caseId, 96, new RNG(200 + caseId.length)), theta: initModel(caseId), m: caseId === "failure_few_samples" ? 16 : 96, lr: 0.06, seed: 700, last: null, loss: null });
  let state = mk();
  const stage = new Stage(stageHost, { height: 350, pad: { l: 44, r: 16, t: 16, b: 34 } });
  stage.onDraw((c, s) => {
    const [xlo, xhi] = domain(caseId); let ymax = 0;
    for (let k = 0; k <= 320; k++) { const x = xlo + (xhi - xlo) * k / 320; ymax = Math.max(ymax, targetPdf(caseId, x), modelPdf(state.theta, x)); }
    if (mode === "geom") {
      s.setDomain([xlo, xhi], [0, 1]); c.clearRect(0,0,s.cssW,s.cssH);
      c.strokeStyle = theme.line; c.lineWidth = 1; c.beginPath(); c.moveTo(s.pad.l, s.py(0.15)); c.lineTo(s.pad.l + s.plotW, s.py(0.15)); c.stroke(); c.beginPath(); c.moveTo(s.pad.l, s.py(0.85)); c.lineTo(s.pad.l + s.plotW, s.py(0.85)); c.stroke();
      c.fillStyle = theme.muted; c.font = "12px JetBrains Mono"; c.fillText("model samples", s.pad.l + 6, s.py(0.15) - 8); c.fillText("data", s.pad.l + 6, s.py(0.85) - 8);
      drawRug(s, c, state.data, 0.85, theme.accent2); if (state.last) { for (let q = 0; q < 24; q++) { const i = Math.floor((state.data.length - 1) * q / 23); const j = state.last.assign[i]; c.save(); c.strokeStyle = theme.purple; c.globalAlpha = 0.45; c.beginPath(); c.moveTo(s.px(state.data[i]), s.py(0.85)); c.lineTo(s.px(state.last.xs[j]), s.py(0.15)); c.stroke(); c.restore(); } drawRug(s, c, state.last.xs, 0.15, theme.accent); }
      else drawRug(s, c, sampleModel(state.theta, state.m, new RNG(12)).xs, 0.15, theme.accent);
    } else {
      s.setDomain([xlo, xhi], [-0.08, ymax * 1.2]); s.grid(0.25); s.axisX(0, "x");
      drawDensity(s, c, (x) => targetPdf(caseId, x), theme.muted, xlo, xhi, 1.8, [4, 4]); drawDensity(s, c, (x) => modelPdf(state.theta, x), theme.accent, xlo, xhi, 2.3, []);
      drawRug(s, c, state.data, -0.02, theme.accent2); if (state.last) drawRug(s, c, state.last.xs, -0.055, theme.green);
    }
  });
  const redraw = () => { readout.innerHTML = state.loss == null ? `${summary(state.theta)} · no update yet` : `${summary(state.theta)} &nbsp;·&nbsp; latest loss = <b>${state.loss.toFixed(3)}</b>`; stage.render(); };
  const doSteps = (n) => { for (let i = 0; i < n; i++) step(state); redraw(); };
  const cases = mode === "train" ? [{label:"gaussian",value:"gaussian"},{label:"gaussian sum",value:"gaussian_mix"},{label:"cauchy",value:"cauchy"}] : mode === "geom" ? [{label:"gaussian",value:"gaussian"},{label:"gaussian sum",value:"gaussian_mix"},{label:"cauchy",value:"cauchy"}] : [{label:"underfit family",value:"failure_underfit"},{label:"few samples",value:"failure_few_samples"}];
  segmented(controls, cases, caseId, (v) => { caseId = v; state = mk(); redraw(); });
  button(controls, mode === "geom" ? "sample + assign" : "step", () => doSteps(1));
  if (mode !== "geom") button(controls, "+10 steps", () => doSteps(10));
  button(controls, "reset", () => { state = mk(); redraw(); });
  if (mode !== "fail") slider(controls, { label: "model samples m", min: 12, max: 160, step: 4, value: state.m, fmt: (v) => `${v|0}`, onInput: (v) => { state.m = v|0; redraw(); } });
  if (mode === "train") slider(controls, { label: "learning rate", min: 0.01, max: 0.12, step: 0.005, value: state.lr, fmt: (v) => v.toFixed(3), onInput: (v) => { state.lr = v; } });
  redraw();
}

boot({ "imle-geometry": (root) => makeTrainer(root, "geom"), "imle-trainer": (root) => makeTrainer(root, "train"), "imle-failures": (root) => makeTrainer(root, "fail") });
