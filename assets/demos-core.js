// demos-core.js — shared library for the interactive post demos.
//
// Plain ES module. The build step (build.mjs) inlines this verbatim into each
// post's self-contained demo.js bundle, so the browser never loads this file
// directly. Keep it free of any TOP-LEVEL access to `document`/`window`, so it
// can also be imported in Node for unit testing (math lives here on purpose).

// ----------------------------------------------------------------------------
// Theme — identical palette to the site CSS and the matplotlib figures.
// ----------------------------------------------------------------------------
export const theme = {
  bg: "#0e1116",
  panel: "#151a21",
  line: "#222a35",
  fg: "#d7dde6",
  muted: "#8a94a3",
  accent: "#4aa3ff",
  accent2: "#e0a458",
  green: "#2a9d8f",
  red: "#d1495b",
  purple: "#c792ea",
};

// ----------------------------------------------------------------------------
// Math — pure functions, all unit-tested from Node.
// ----------------------------------------------------------------------------
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Eigen-decomposition of a symmetric 2x2 matrix [[a,b],[b,c]]; l1 >= l2.
export function eigSym2(a, b, c) {
  const tr = a + c;
  const disc = Math.sqrt(Math.max(0, (a - c) * (a - c) + 4 * b * b));
  const l1 = (tr + disc) / 2,
    l2 = (tr - disc) / 2;
  let v1;
  if (Math.abs(b) > 1e-12) {
    // eigenvector of l1: (b, l1 - a)
    const n = Math.hypot(b, l1 - a) || 1;
    v1 = [b / n, (l1 - a) / n];
  } else {
    v1 = a >= c ? [1, 0] : [0, 1];
  }
  const v2 = [-v1[1], v1[0]];
  return { l1, l2, v1, v2 };
}

// Eigenvalues of a symmetric n x n matrix via the cyclic Jacobi method.
// Returns eigenvalues sorted descending. Adequate for the small (k<=12) matrices here.
export function jacobiEigvals(M) {
  const n = M.length;
  const A = M.map((row) => row.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const tau = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t =
          Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(tau * tau + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p],
            akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k],
            aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return A.map((_, i) => A[i][i]).sort((x, y) => y - x);
}

// Covariance builders used by the matrix-completion demo.
export function buildEquicorr(k, rho) {
  const M = [];
  for (let i = 0; i < k; i++) {
    M.push([]);
    for (let j = 0; j < k; j++) M[i].push(i === j ? 1 : rho);
  }
  return M;
}
export function buildAR1(k, rho) {
  const M = [];
  for (let i = 0; i < k; i++) {
    M.push([]);
    for (let j = 0; j < k; j++) M[i].push(Math.pow(rho, Math.abs(i - j)));
  }
  return M;
}

// Quantized-Gaussian completion capacity C = S / H_joint at resolution Delta.
// Each direction with variance lam contributes max(0, 0.5*log2(2*pi*e*lam) - log2(Delta)) bits.
export function quantizedCapacity(eigs, diagVars, Delta) {
  const bits = (lam) =>
    Math.max(
      0,
      0.5 * Math.log2(2 * Math.PI * Math.E * Math.max(lam, 1e-300)) -
        Math.log2(Delta),
    );
  const S = diagVars.reduce((acc, v) => acc + bits(v), 0);
  const Hj = eigs.reduce((acc, l) => acc + bits(l), 0);
  return Hj < 1e-12 ? Infinity : S / Hj;
}

// log-gamma (Lanczos) and the Beta density, for the MLE/MAP demo.
const LG_G = 7;
const LG_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
export function logGamma(x) {
  if (x < 0.5)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = LG_C[0];
  const t = x + LG_G + 0.5;
  for (let i = 1; i < LG_G + 2; i++) a += LG_C[i] / (x + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}
export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
}

// ----------------------------------------------------------------------------
// Stage — a responsive HiDPI canvas with unified mouse/touch dragging and
// data<->pixel transforms. DOM access only happens inside the constructor/methods.
// ----------------------------------------------------------------------------
export class Stage {
  constructor(host, opts = {}) {
    this.host = host;
    this.height = opts.height || 320;
    this.pad = Object.assign({ l: 44, r: 18, t: 16, b: 34 }, opts.pad || {});
    this.canvas = document.createElement("canvas");
    this.canvas.className = "demo-canvas";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.xdom = [0, 1];
    this.ydom = [0, 1];
    this.draggables = [];
    this._drag = null;
    this._draw = () => {};
    this.layout = opts.layout || null; // optional fn(stage) run on every resize (and the first paint)
    this.cssW = 600;
    this.cssH = this.height;
    this._bindPointer();
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(host);
    }
    this.resize();
  }
  get plotW() {
    return this.cssW - this.pad.l - this.pad.r;
  }
  get plotH() {
    return this.cssH - this.pad.t - this.pad.b;
  }
  setDomain(xdom, ydom) {
    this.xdom = xdom.slice();
    this.ydom = ydom.slice();
  }
  // Pick domains so one data unit is the same number of pixels on both axes.
  fitEqual(xhalf, cx = 0, cy = 0) {
    const sx = this.plotW / (2 * xhalf);
    const yhalf = this.plotH / (2 * sx);
    this.xdom = [cx - xhalf, cx + xhalf];
    this.ydom = [cy - yhalf, cy + yhalf];
  }
  px(x) {
    const [l, r] = this.xdom;
    return this.pad.l + ((x - l) / (r - l)) * this.plotW;
  }
  py(y) {
    const [b, t] = this.ydom;
    return this.pad.t + ((t - y) / (t - b)) * this.plotH;
  }
  ux(px) {
    const [l, r] = this.xdom;
    return l + ((px - this.pad.l) / this.plotW) * (r - l);
  }
  uy(py) {
    const [b, t] = this.ydom;
    return t - ((py - this.pad.t) / this.plotH) * (t - b);
  }
  resize() {
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const w = this.host.clientWidth || this.cssW;
    this.cssW = w;
    this.cssH = this.height;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.canvas.style.width = w + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.layout) this.layout(this);
    this.render();
  }
  onDraw(fn) {
    this._draw = fn;
    return this;
  }
  render() {
    const c = this.ctx;
    c.clearRect(0, 0, this.cssW, this.cssH);
    this._draw(c, this);
  }
  addDraggable(d) {
    this.draggables.push(d);
    return d;
  }
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      const p = this._pos(e);
      let best = null,
        bd = 1e9;
      for (const d of this.draggables) {
        const dist = Math.hypot(this.px(d.x()) - p.x, this.py(d.y()) - p.y);
        if (dist < (d.r || 16) && dist < bd) {
          bd = dist;
          best = d;
        }
      }
      if (best) {
        this._drag = best;
        try {
          c.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
      }
    });
    c.addEventListener("pointermove", (e) => {
      if (!this._drag) return;
      const p = this._pos(e);
      this._drag.move(this.ux(p.x), this.uy(p.y));
      this.render();
      e.preventDefault();
    });
    const up = (e) => {
      if (this._drag) {
        try {
          c.releasePointerCapture(e.pointerId);
        } catch (_) {}
        this._drag = null;
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
  }
  // ---- drawing helpers ----
  grid(step = 1) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = theme.line;
    c.lineWidth = 1;
    c.globalAlpha = 0.5;
    const [xl, xr] = this.xdom,
      [yb, yt] = this.ydom;
    for (let x = Math.ceil(xl / step) * step; x <= xr; x += step) {
      c.beginPath();
      c.moveTo(this.px(x), this.pad.t);
      c.lineTo(this.px(x), this.pad.t + this.plotH);
      c.stroke();
    }
    for (let y = Math.ceil(yb / step) * step; y <= yt; y += step) {
      c.beginPath();
      c.moveTo(this.pad.l, this.py(y));
      c.lineTo(this.pad.l + this.plotW, this.py(y));
      c.stroke();
    }
    c.restore();
  }
  axisX(y = 0, label) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = theme.muted;
    c.lineWidth = 1;
    c.globalAlpha = 0.8;
    c.beginPath();
    c.moveTo(this.pad.l, this.py(y));
    c.lineTo(this.pad.l + this.plotW, this.py(y));
    c.stroke();
    if (label) {
      c.globalAlpha = 1;
      c.fillStyle = theme.muted;
      c.font = "11px monospace";
      c.textAlign = "right";
      c.fillText(label, this.pad.l + this.plotW, this.py(y) + 14);
    }
    c.restore();
  }
  path(fn, color, width = 2, dash = null) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    if (dash) c.setLineDash(dash);
    c.beginPath();
    const [xl, xr] = this.xdom;
    let started = false;
    const N = 240;
    for (let i = 0; i <= N; i++) {
      const x = xl + (i / N) * (xr - xl);
      const y = fn(x);
      if (!isFinite(y)) {
        started = false;
        continue;
      }
      const X = this.px(x),
        Y = this.py(y);
      if (!started) {
        c.moveTo(X, Y);
        started = true;
      } else c.lineTo(X, Y);
    }
    c.stroke();
    c.restore();
  }
  dot(x, y, color, r = 5, ring = false) {
    const c = this.ctx;
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.arc(this.px(x), this.py(y), r, 0, 2 * Math.PI);
    c.fill();
    if (ring) {
      c.strokeStyle = theme.bg;
      c.lineWidth = 2;
      c.stroke();
    }
    c.restore();
  }
  segment(x0, y0, x1, y1, color, width = 1.4, dash = null) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    if (dash) c.setLineDash(dash);
    c.beginPath();
    c.moveTo(this.px(x0), this.py(y0));
    c.lineTo(this.px(x1), this.py(y1));
    c.stroke();
    c.restore();
  }
  circleData(cx, cy, rdata, color, width = 1.4) {
    const c = this.ctx;
    const rpx = Math.abs(this.px(cx + rdata) - this.px(cx));
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(this.px(cx), this.py(cy), rpx, 0, 2 * Math.PI);
    c.stroke();
    c.restore();
  }
}

// ----------------------------------------------------------------------------
// Small DOM widget builders.
// ----------------------------------------------------------------------------
function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

export function widget(root, { title, note } = {}) {
  root.classList.add("demo-built");
  const head = el("div", "demo-head", root);
  if (title) head.textContent = title;
  const stageHost = el("div", "demo-stagehost", root);
  const controls = el("div", "demo-controls", root);
  const readout = el("div", "demo-readout", root);
  if (note) {
    const n = el("div", "demo-note muted", root);
    n.textContent = note;
  }
  return { head, stageHost, controls, readout };
}

export function slider(
  host,
  { label, min, max, value, step = 0.01, fmt = (v) => v.toFixed(2), onInput },
) {
  const wrap = el("label", "demo-slider", host);
  const row = el("div", "demo-srow", wrap);
  const lab = el("span", "demo-slabel", row);
  lab.textContent = label;
  const val = el("span", "demo-sval", row);
  val.textContent = fmt(value);
  const input = el("input", null, wrap);
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    val.textContent = fmt(v);
    onInput(v);
  });
  return {
    input,
    get: () => parseFloat(input.value),
    set: (v) => {
      input.value = v;
      val.textContent = fmt(v);
    },
  };
}

export function button(host, label, onClick) {
  const b = el("button", "demo-btn", host);
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

export function toggle(host, label, value, onChange) {
  const wrap = el("label", "demo-check", host);
  const input = el("input", null, wrap);
  input.type = "checkbox";
  input.checked = value;
  const span = el("span", null, wrap);
  span.textContent = label;
  input.addEventListener("change", () => onChange(input.checked));
  return {
    get: () => input.checked,
    set: (v) => {
      input.checked = v;
    },
  };
}

export function segmented(host, options, value, onChange) {
  const wrap = el("div", "demo-seg", host);
  const btns = options.map((opt) => {
    const b = el("button", "demo-segbtn", wrap);
    b.type = "button";
    b.textContent = opt.label;
    if (opt.value === value) b.classList.add("on");
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      onChange(opt.value);
    });
    return b;
  });
  return wrap;
}

// ----------------------------------------------------------------------------
// boot — mount registered demos into their [data-demo] placeholders.
// No-ops outside a browser, so the module is safe to import in Node.
// ----------------------------------------------------------------------------
export function boot(map) {
  if (typeof document === "undefined") return;
  const run = () => {
    document.querySelectorAll("[data-demo]").forEach((node) => {
      const id = node.getAttribute("data-demo");
      const factory = map[id];
      if (!factory) return;
      node.innerHTML = "";
      try {
        factory(node);
      } catch (err) {
        node.innerHTML =
          '<p class="demo-fallback">This interactive demo failed to load.</p>';
        if (typeof console !== "undefined")
          console.error("[demo " + id + "]", err);
      }
    });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", run);
  else run();
}
