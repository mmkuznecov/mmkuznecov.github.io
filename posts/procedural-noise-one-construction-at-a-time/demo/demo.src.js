// Interactive figures for “Procedural noise, one construction at a time”.
// The browser versions are intentionally compact: they preserve each method's
// construction, while using modest raster resolutions so sliders remain live.

import {
  boot,
  widget,
  theme,
  clamp,
  slider,
  button,
  toggle,
  segmented,
} from "../../../assets/demos-core.js";

const TAU = 2 * Math.PI;
const SQRT2 = Math.SQRT2;
const GRAD2 = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
});
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function mix32(x) {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function hashU32(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841);
  h ^= Math.imul(seed | 0, 0xcb1ab31f);
  return mix32(h);
}

function hash01(x, y, seed = 0) {
  return hashU32(x, y, seed) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function value2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = 2 * hash01(xi, yi, seed) - 1;
  const b = 2 * hash01(xi + 1, yi, seed) - 1;
  const c = 2 * hash01(xi, yi + 1, seed) - 1;
  const d = 2 * hash01(xi + 1, yi + 1, seed) - 1;
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function perlin2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  function corner(dx, dy) {
    const g = GRAD2[hashU32(xi + dx, yi + dy, seed) % GRAD2.length];
    return g[0] * (xf - dx) + g[1] * (yf - dy);
  }
  const x0 = lerp(corner(0, 0), corner(1, 0), u);
  const x1 = lerp(corner(0, 1), corner(1, 1), u);
  return SQRT2 * lerp(x0, x1, v);
}

function simplex2(x, y, seed = 0) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  function corner(ii, jj, dx, dy) {
    let q = 0.5 - dx * dx - dy * dy;
    if (q <= 0) return 0;
    const g = GRAD3[hashU32(ii, jj, seed) % GRAD3.length];
    q *= q;
    return q * q * (g[0] * dx + g[1] * dy);
  }
  return 70 * (
    corner(i, j, x0, y0) +
    corner(i + i1, j + j1, x1, y1) +
    corner(i + 1, j + 1, x2, y2)
  );
}

const OS_STRETCH = (1 / Math.sqrt(3) - 1) / 2;
const OS_SQUISH = (Math.sqrt(3) - 1) / 2;
const OS_GRAD = [
  [5, 2], [2, 5], [-5, 2], [-2, 5],
  [5, -2], [2, -5], [-5, -2], [-2, -5],
];

function osContrib(xsb, ysb, dx, dy, seed) {
  const attn = 2 - dx * dx - dy * dy;
  if (attn <= 0) return 0;
  const g = OS_GRAD[hashU32(xsb, ysb, seed) % OS_GRAD.length];
  const a2 = attn * attn;
  return a2 * a2 * (g[0] * dx + g[1] * dy);
}

function opensimplex2(x, y, seed = 0) {
  const off = (x + y) * OS_STRETCH;
  const xs = x + off, ys = y + off;
  const xsb = Math.floor(xs), ysb = Math.floor(ys);
  const sq = (xsb + ysb) * OS_SQUISH;
  const xb = xsb + sq, yb = ysb + sq;
  const xins = xs - xsb, yins = ys - ysb;
  const inSum = xins + yins;
  const dx0 = x - xb, dy0 = y - yb;

  let value = osContrib(
    xsb + 1, ysb,
    dx0 - 1 - OS_SQUISH, dy0 - OS_SQUISH,
    seed,
  );
  value += osContrib(
    xsb, ysb + 1,
    dx0 - OS_SQUISH, dy0 - 1 - OS_SQUISH,
    seed,
  );

  let extX, extY, extDx, extDy;
  let baseX, baseY, baseDx, baseDy;
  const sub = xins > yins;
  if (inSum <= 1) {
    const zins = 1 - inSum;
    if (zins > xins || zins > yins) {
      if (sub) {
        extX = xsb + 1; extY = ysb - 1;
        extDx = dx0 - 1; extDy = dy0 + 1;
      } else {
        extX = xsb - 1; extY = ysb + 1;
        extDx = dx0 + 1; extDy = dy0 - 1;
      }
    } else {
      extX = xsb + 1; extY = ysb + 1;
      extDx = dx0 - 1 - 2 * OS_SQUISH;
      extDy = dy0 - 1 - 2 * OS_SQUISH;
    }
    baseX = xsb; baseY = ysb; baseDx = dx0; baseDy = dy0;
  } else {
    const zins = 2 - inSum;
    if (zins < xins || zins < yins) {
      if (sub) {
        extX = xsb + 2; extY = ysb;
        extDx = dx0 - 2 - 2 * OS_SQUISH;
        extDy = dy0 - 2 * OS_SQUISH;
      } else {
        extX = xsb; extY = ysb + 2;
        extDx = dx0 - 2 * OS_SQUISH;
        extDy = dy0 - 2 - 2 * OS_SQUISH;
      }
    } else {
      extX = xsb; extY = ysb; extDx = dx0; extDy = dy0;
    }
    baseX = xsb + 1; baseY = ysb + 1;
    baseDx = dx0 - 1 - 2 * OS_SQUISH;
    baseDy = dy0 - 1 - 2 * OS_SQUISH;
  }
  value += osContrib(baseX, baseY, baseDx, baseDy, seed);
  value += osContrib(extX, extY, extDx, extDy, seed);
  return value / 47;
}

const BASES = {
  value: value2,
  perlin: perlin2,
  simplex: simplex2,
  opensimplex: opensimplex2,
};

function distance(dx, dy, metric) {
  if (metric === "manhattan") return Math.abs(dx) + Math.abs(dy);
  if (metric === "chebyshev") return Math.max(Math.abs(dx), Math.abs(dy));
  return Math.hypot(dx, dy);
}

function cellular2(x, y, seed, feature, metric) {
  const cx = Math.floor(x), cy = Math.floor(y);
  let f1 = Infinity, f2 = Infinity;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const gx = cx + di, gy = cy + dj;
      const fx = gx + hash01(gx, gy, seed);
      const fy = gy + hash01(gx, gy, seed + 9871);
      const d = distance(x - fx, y - fy, metric);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) f2 = d;
    }
  }
  if (feature === "F2") return f2;
  if (feature === "F2F1") return f2 - f1;
  return f1;
}

function fractal2(fn, x, y, seed, octaves, lacunarity, gain, kind = "fbm") {
  let amp = 1, freq = 1, total = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    let n = fn(x * freq, y * freq, seed + 1013 * o);
    if (kind === "ridged") n = (1 - Math.abs(n)) ** 2;
    else if (kind === "billow") n = 2 * Math.abs(n) - 1;
    total += amp * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  const out = total / Math.max(norm, 1e-9);
  return kind === "ridged" ? 2 * out - 1 : out;
}

function gaborAccum(x, y, seed, frequency, bandwidth, orientation, randomOrientation, complexOut) {
  const cx = Math.floor(x), cy = Math.floor(y);
  const impulses = 4;
  const a2 = bandwidth * bandwidth;
  let re = 0, im = 0;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const gx = cx + di, gy = cy + dj;
      for (let m = 0; m < impulses; m++) {
        const s = seed + m * 2731;
        const px = gx + hash01(gx, gy, s + 1);
        const py = gy + hash01(gx, gy, s + 2);
        const phase = TAU * hash01(gx, gy, s + 3);
        const omega = randomOrientation
          ? TAU * hash01(gx, gy, s + 4)
          : orientation;
        const w = 2 * hash01(gx, gy, s + 5) - 1;
        const dx = x - px, dy = y - py;
        const env = Math.exp(-Math.PI * a2 * (dx * dx + dy * dy));
        const proj = dx * Math.cos(omega) + dy * Math.sin(omega);
        const ang = TAU * frequency * proj + phase;
        if (complexOut) {
          const aa = (0.5 + 0.5 * Math.abs(w)) * env;
          re += aa * Math.cos(ang);
          im += aa * Math.sin(ang);
        } else {
          re += w * env * Math.cos(ang);
        }
      }
    }
  }
  return complexOut ? [re, im] : clamp((1.6 * re) / Math.sqrt(impulses), -1, 1);
}

function profilePhase(phase, profile) {
  const p = ((phase / TAU) % 1 + 1) % 1;
  if (profile === "triangle") return 2 * Math.abs(2 * p - 1) - 1;
  if (profile === "saw") return 2 * p - 1;
  if (profile === "square") return p < 0.5 ? 1 : -1;
  if (profile === "cos") return Math.cos(phase);
  return Math.sin(phase);
}

function makeRng(seed) {
  let a = mix32(seed | 0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng());
}

function makeWaves(seed, count, frequency, bandwidth) {
  const rng = makeRng(seed + 20250);
  const waves = [];
  for (let k = 0; k < count; k++) {
    const theta = TAU * rng();
    waves.push({
      cx: Math.cos(theta),
      sy: Math.sin(theta),
      f: frequency * (1 + bandwidth * (rng() - 0.5)),
      phase: TAU * rng(),
      amp: 0.5 + 0.5 * rng(),
    });
  }
  return waves;
}

function waveAt(x, y, waves, profile) {
  if (profile === "cos") {
    let s = 0, e = 0;
    for (const w of waves) {
      s += w.amp * Math.cos(TAU * w.f * (w.cx * x + w.sy * y) + w.phase);
      e += w.amp * w.amp;
    }
    return clamp(s / Math.sqrt(Math.max(e / 2, 1e-9)), -1, 1);
  }
  let re = 0, im = 0;
  for (const w of waves) {
    const a = TAU * w.f * (w.cx * x + w.sy * y) + w.phase;
    re += w.amp * Math.cos(a);
    im += w.amp * Math.sin(a);
  }
  return profilePhase(Math.atan2(im, re), profile);
}

const tileCache = new Map();
function makeWaveletTile(n, seed) {
  const key = `${n}:${seed}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const rng = makeRng(seed + 771);
  const raw = new Float64Array(n * n);
  for (let i = 0; i < raw.length; i++) raw[i] = normal(rng);

  function blur(src) {
    const tmp = new Float64Array(src.length);
    const out = new Float64Array(src.length);
    const k = [1, 4, 6, 4, 1];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let s = 0;
        for (let j = -2; j <= 2; j++) {
          const xx = (x + j + n) % n;
          s += k[j + 2] * src[y * n + xx];
        }
        tmp[y * n + x] = s / 16;
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let s = 0;
        for (let j = -2; j <= 2; j++) {
          const yy = (y + j + n) % n;
          s += k[j + 2] * tmp[yy * n + x];
        }
        out[y * n + x] = s / 16;
      }
    }
    return out;
  }

  const low = blur(blur(raw));
  const tile = new Float64Array(raw.length);
  let mean = 0;
  for (let i = 0; i < tile.length; i++) {
    tile[i] = raw[i] - low[i];
    mean += tile[i];
  }
  mean /= tile.length;
  let variance = 0;
  for (let i = 0; i < tile.length; i++) {
    tile[i] -= mean;
    variance += tile[i] * tile[i];
  }
  const sd = Math.sqrt(variance / tile.length) || 1;
  for (let i = 0; i < tile.length; i++) tile[i] /= sd;
  tileCache.set(key, { n, data: tile });
  return tileCache.get(key);
}

function bsplineWeights(p) {
  const mid = Math.ceil(p - 0.5);
  const t = mid - (p - 0.5);
  const w0 = 0.5 * t * t;
  const w2 = 0.5 * (1 - t) * (1 - t);
  return [mid, w0, 1 - w0 - w2, w2];
}

function evalTile(tile, x, y) {
  const [mx, wx0, wx1, wx2] = bsplineWeights(x);
  const [my, wy0, wy1, wy2] = bsplineWeights(y);
  const wx = [wx0, wx1, wx2], wy = [wy0, wy1, wy2];
  let s = 0;
  for (let fy = -1; fy <= 1; fy++) {
    const iy = ((my + fy) % tile.n + tile.n) % tile.n;
    for (let fx = -1; fx <= 1; fx++) {
      const ix = ((mx + fx) % tile.n + tile.n) % tile.n;
      s += wx[fx + 1] * wy[fy + 1] * tile.data[iy * tile.n + ix];
    }
  }
  return clamp(s / 2.2, -1, 1);
}

function rgbLerp(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function signedColor(v) {
  const blue = [49, 91, 204], neutral = [239, 238, 232], red = [195, 33, 47];
  return v < 0 ? rgbLerp(blue, neutral, v + 1) : rgbLerp(neutral, red, v);
}

function unsignedColor(v) {
  const stops = [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ];
  const x = clamp(v, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return rgbLerp(stops[i], stops[i + 1], x - i);
}

function makeRaster(root, { title, note, width = 480, height = 230 }) {
  const { stageHost, controls, readout } = widget(root, { title, note });
  const canvas = document.createElement("canvas");
  canvas.className = "demo-canvas noise-raster";
  canvas.width = width;
  canvas.height = height;
  stageHost.appendChild(canvas);
  return { canvas, controls, readout };
}

function stats(values) {
  let mean = 0, sq = 0, lo = Infinity, hi = -Infinity;
  for (const v of values) {
    mean += v; sq += v * v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  mean /= values.length;
  return { mean, sd: Math.sqrt(Math.max(0, sq / values.length - mean * mean)), lo, hi };
}

function paintPanels(canvas, panels) {
  const ctx = canvas.getContext("2d");
  const gap = panels.length > 1 ? 2 : 0;
  const pw = Math.floor((canvas.width - gap * (panels.length - 1)) / panels.length);
  const h = canvas.height;
  const allStats = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  panels.forEach((panel, pi) => {
    const values = new Float64Array(pw * h);
    const aspect = pw / h;
    for (let py = 0; py < h; py++) {
      const yy = lerp(panel.ymax ?? 1.4, panel.ymin ?? -1.4, py / Math.max(h - 1, 1));
      for (let px = 0; px < pw; px++) {
        const xx = lerp(
          panel.xmin ?? -1.4 * aspect,
          panel.xmax ?? 1.4 * aspect,
          px / Math.max(pw - 1, 1),
        );
        values[py * pw + px] = panel.sample(xx, yy);
      }
    }
    const st = stats(values);
    allStats.push(st);
    const image = ctx.createImageData(pw, h);
    const lim = Math.max(Math.abs(st.lo), Math.abs(st.hi), 1e-9);
    const range = Math.max(st.hi - st.lo, 1e-9);
    for (let i = 0; i < values.length; i++) {
      const q = panel.signed === false
        ? (values[i] - st.lo) / range
        : clamp(values[i] / lim, -1, 1);
      const col = panel.signed === false ? unsignedColor(q) : signedColor(q);
      image.data[4 * i] = col[0];
      image.data[4 * i + 1] = col[1];
      image.data[4 * i + 2] = col[2];
      image.data[4 * i + 3] = 255;
    }
    const x0 = pi * (pw + gap);
    ctx.putImageData(image, x0, 0);
    if (panel.label) {
      ctx.save();
      ctx.fillStyle = "rgba(14,17,22,0.78)";
      ctx.fillRect(x0 + 7, 7, ctx.measureText(panel.label).width + 16, 24);
      ctx.fillStyle = theme.fg;
      ctx.font = "12px monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(panel.label, x0 + 15, 19);
      ctx.restore();
    }
    if (panel.overlay) panel.overlay(ctx, { x0, width: pw, height: h, panel });
  });
  return allStats;
}

function schedule(fn) {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      fn();
    });
  };
}

function formatStats(s) {
  return `mean <b>${s.mean.toFixed(3)}</b> · std <b>${s.sd.toFixed(3)}</b> · range <b>[${s.lo.toFixed(2)}, ${s.hi.toFixed(2)}]</b>`;
}

boot({
  "base-noise-lab": (root) => {
    const ui = makeRaster(root, {
      title: "Base lattice lab",
      note: "Same seed and coordinate window. Change only the randomized primitive and lattice geometry.",
    });
    const state = { method: "perlin", seed: 11, scale: 2.6 };
    const descriptions = {
      value: "random scalar per corner; interpolation does all the reconstruction",
      perlin: "random gradient per corner; interpolate directional dot products",
      simplex: "gradient contributions on triangular cells with compact radial support",
      opensimplex: "gradient contributions on a stretched/squished alternative lattice",
    };
    const draw = schedule(() => {
      const fn = BASES[state.method];
      const [st] = paintPanels(ui.canvas, [{
        label: state.method === "opensimplex" ? "OpenSimplex" : state.method[0].toUpperCase() + state.method.slice(1),
        sample: (x, y) => fn(x * state.scale, y * state.scale, state.seed),
      }]);
      ui.readout.innerHTML = `<b>${descriptions[state.method]}</b><br>${formatStats(st)}`;
    });
    segmented(ui.controls, [
      { label: "Value", value: "value" },
      { label: "Perlin", value: "perlin" },
      { label: "Simplex", value: "simplex" },
      { label: "OpenSimplex", value: "opensimplex" },
    ], state.method, (v) => { state.method = v; draw(); });
    slider(ui.controls, {
      label: "scale", min: 0.8, max: 5.5, step: 0.1, value: state.scale,
      fmt: (v) => v.toFixed(1), onInput: (v) => { state.scale = v; draw(); },
    });
    const seedControl = slider(ui.controls, {
      label: "seed", min: 0, max: 60, step: 1, value: state.seed,
      fmt: (v) => String(Math.round(v)), onInput: (v) => { state.seed = Math.round(v); draw(); },
    });
    button(ui.controls, "next seed", () => {
      state.seed = (state.seed + 1) % 61;
      seedControl.set(state.seed);
      draw();
    });
    draw();
  },

  "cellular-noise-lab": (root) => {
    const ui = makeRaster(root, {
      title: "Cellular semantics lab",
      note: "The white dots are feature sites. The field is a distance statistic, not an interpolated random amplitude.",
    });
    const state = { feature: "F1", metric: "euclidean", seed: 8, scale: 2.5 };
    const draw = schedule(() => {
      const aspect = ui.canvas.width / ui.canvas.height;
      const xmin = -1.4 * aspect, xmax = 1.4 * aspect, ymin = -1.4, ymax = 1.4;
      const overlay = (ctx, panelBox) => {
        const { x0, width, height } = panelBox;
        const nx0 = xmin * state.scale, nx1 = xmax * state.scale;
        const ny0 = ymin * state.scale, ny1 = ymax * state.scale;
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(14,17,22,0.9)";
        for (let gy = Math.floor(ny0) - 1; gy <= Math.ceil(ny1) + 1; gy++) {
          for (let gx = Math.floor(nx0) - 1; gx <= Math.ceil(nx1) + 1; gx++) {
            const fx = gx + hash01(gx, gy, state.seed);
            const fy = gy + hash01(gx, gy, state.seed + 9871);
            const x = fx / state.scale, y = fy / state.scale;
            if (x < xmin || x > xmax || y < ymin || y > ymax) continue;
            const px = x0 + ((x - xmin) / (xmax - xmin)) * width;
            const py = ((ymax - y) / (ymax - ymin)) * height;
            ctx.beginPath(); ctx.arc(px, py, 2.3, 0, TAU); ctx.fill(); ctx.stroke();
          }
        }
        ctx.restore();
      };
      const [st] = paintPanels(ui.canvas, [{
        label: `${state.metric} ${state.feature === "F2F1" ? "F2−F1" : state.feature}`,
        signed: false,
        xmin, xmax, ymin, ymax,
        sample: (x, y) => cellular2(x * state.scale, y * state.scale, state.seed, state.feature, state.metric),
        overlay,
      }]);
      const semantic = state.feature === "F1"
        ? "nearest-site distance: interiors, pits, spots"
        : state.feature === "F2"
          ? "second-nearest distance: broader regional scale"
          : "competition gap: approaches zero on Voronoi walls";
      ui.readout.innerHTML = `<b>${semantic}</b><br>${formatStats(st)}`;
    });
    segmented(ui.controls, [
      { label: "F1", value: "F1" }, { label: "F2", value: "F2" }, { label: "F2−F1", value: "F2F1" },
    ], state.feature, (v) => { state.feature = v; draw(); });
    segmented(ui.controls, [
      { label: "Euclidean", value: "euclidean" },
      { label: "Manhattan", value: "manhattan" },
      { label: "Chebyshev", value: "chebyshev" },
    ], state.metric, (v) => { state.metric = v; draw(); });
    slider(ui.controls, {
      label: "cell density", min: 1.2, max: 4.8, step: 0.1, value: state.scale,
      fmt: (v) => v.toFixed(1), onInput: (v) => { state.scale = v; draw(); },
    });
    slider(ui.controls, {
      label: "seed", min: 0, max: 40, step: 1, value: state.seed,
      fmt: (v) => String(Math.round(v)), onInput: (v) => { state.seed = Math.round(v); draw(); },
    });
    draw();
  },

  "spectral-noise-lab": (root) => {
    const ui = makeRaster(root, {
      title: "Spectral and phase lab",
      note: "Gabor is local, wave noise is global, phasor exposes phase, and wavelet noise evaluates a periodic band-pass tile.",
    });
    const state = {
      family: "gabor", seed: 12, scale: 2.2, frequency: 0.9,
      bandwidth: 1.5, angle: 35, profile: "sin", isotropic: false,
    };
    const draw = schedule(() => {
      const angle = (state.angle * Math.PI) / 180;
      const waves = makeWaves(state.seed, 22, state.frequency, Math.min(1.2, state.bandwidth / 2));
      const tile = makeWaveletTile(32, state.seed);
      let subtitle = "";
      let sample;
      if (state.family === "gabor") {
        subtitle = state.isotropic ? "random local orientations" : `local orientation ${state.angle.toFixed(0)}°`;
        sample = (x, y) => gaborAccum(
          x * state.scale, y * state.scale, state.seed,
          state.frequency, state.bandwidth, angle, state.isotropic, false,
        );
      } else if (state.family === "phasor") {
        subtitle = `${state.profile} profile of a stochastic phase field`;
        sample = (x, y) => {
          const z = gaborAccum(
            x * state.scale, y * state.scale, state.seed,
            state.frequency, state.bandwidth, angle, false, true,
          );
          return profilePhase(Math.atan2(z[1], z[0]), state.profile);
        };
      } else if (state.family === "wave") {
        subtitle = state.profile === "cos"
          ? "direct cosine sum of global plane waves"
          : `${state.profile} profile of the accumulated global phase`;
        sample = (x, y) => waveAt(x * state.scale, y * state.scale, waves, state.profile);
      } else {
        subtitle = "periodic band-pass tile with B-spline reconstruction";
        sample = (x, y) => evalTile(tile, (x + 2.5) * 7 * state.scale, (y + 2.5) * 7 * state.scale);
      }
      const label = state.family === "wavelet" ? "Wavelet tile" : state.family[0].toUpperCase() + state.family.slice(1);
      const [st] = paintPanels(ui.canvas, [{ label, sample }]);
      ui.readout.innerHTML = `<b>${subtitle}</b><br>${formatStats(st)}`;
    });
    segmented(ui.controls, [
      { label: "Gabor", value: "gabor" },
      { label: "Phasor", value: "phasor" },
      { label: "Wave", value: "wave" },
      { label: "Wavelet", value: "wavelet" },
    ], state.family, (v) => { state.family = v; draw(); });
    segmented(ui.controls, [
      { label: "cosine", value: "cos" },
      { label: "sine", value: "sin" },
      { label: "triangle", value: "triangle" },
      { label: "saw", value: "saw" },
      { label: "square", value: "square" },
    ], state.profile, (v) => { state.profile = v; draw(); });
    slider(ui.controls, {
      label: "frequency", min: 0.35, max: 2.2, step: 0.05, value: state.frequency,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.frequency = v; draw(); },
    });
    slider(ui.controls, {
      label: "bandwidth", min: 0.8, max: 2.5, step: 0.05, value: state.bandwidth,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.bandwidth = v; draw(); },
    });
    slider(ui.controls, {
      label: "orientation", min: -90, max: 90, step: 1, value: state.angle,
      fmt: (v) => `${Math.round(v)}°`, onInput: (v) => { state.angle = v; draw(); },
    });
    toggle(ui.controls, "isotropic Gabor", state.isotropic, (v) => { state.isotropic = v; draw(); });
    draw();
  },

  "octave-noise-lab": (root) => {
    const ui = makeRaster(root, {
      title: "Octave composer",
      note: "The base algorithm is unchanged. The visual character comes from frequency growth, amplitude decay, and the per-octave remap.",
    });
    const state = {
      base: "simplex", kind: "fbm", seed: 6, scale: 1.3,
      octaves: 5, lacunarity: 2, gain: 0.5,
    };
    const draw = schedule(() => {
      const fn = BASES[state.base];
      const [st] = paintPanels(ui.canvas, [{
        label: `${state.base === "opensimplex" ? "OpenSimplex" : state.base} ${state.kind}`,
        sample: (x, y) => fractal2(
          fn, x * state.scale, y * state.scale, state.seed,
          state.octaves, state.lacunarity, state.gain, state.kind,
        ),
      }]);
      const topFrequency = state.scale * state.lacunarity ** (state.octaves - 1);
      ui.readout.innerHTML = `<b>${state.octaves} octaves</b> · highest relative frequency <b>${topFrequency.toFixed(1)}</b> · persistence <b>${state.gain.toFixed(2)}</b><br>${formatStats(st)}`;
    });
    segmented(ui.controls, [
      { label: "Value", value: "value" },
      { label: "Perlin", value: "perlin" },
      { label: "Simplex", value: "simplex" },
      { label: "OpenSimplex", value: "opensimplex" },
    ], state.base, (v) => { state.base = v; draw(); });
    segmented(ui.controls, [
      { label: "fBm", value: "fbm" },
      { label: "Ridged", value: "ridged" },
      { label: "Billow", value: "billow" },
    ], state.kind, (v) => { state.kind = v; draw(); });
    slider(ui.controls, {
      label: "octaves", min: 1, max: 7, step: 1, value: state.octaves,
      fmt: (v) => String(Math.round(v)), onInput: (v) => { state.octaves = Math.round(v); draw(); },
    });
    slider(ui.controls, {
      label: "lacunarity", min: 1.5, max: 3, step: 0.05, value: state.lacunarity,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.lacunarity = v; draw(); },
    });
    slider(ui.controls, {
      label: "gain", min: 0.25, max: 0.8, step: 0.01, value: state.gain,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.gain = v; draw(); },
    });
    draw();
  },

  "warp-noise-lab": (root) => {
    const ui = makeRaster(root, {
      title: "Domain-warp laboratory",
      note: "Left: base field. Centre: field evaluated at displaced coordinates. Right: the change induced by the warp.",
      width: 720,
      height: 220,
    });
    const state = { base: "opensimplex", seed: 9, scale: 1.8, amp: 1.1, warpFreq: 0.8, octaves: 4 };
    const draw = schedule(() => {
      const fn = BASES[state.base];
      const plain = (x, y) => fn(x * state.scale, y * state.scale, state.seed);
      const warped = (x, y) => {
        const qx = fractal2(fn, x * state.warpFreq, y * state.warpFreq, state.seed + 31, state.octaves, 2, 0.5, "fbm");
        const qy = fractal2(fn, x * state.warpFreq + 5.2, y * state.warpFreq + 1.3, state.seed + 37, state.octaves, 2, 0.5, "fbm");
        return fn((x + state.amp * qx) * state.scale, (y + state.amp * qy) * state.scale, state.seed);
      };
      const sts = paintPanels(ui.canvas, [
        { label: "plain", sample: plain },
        { label: "warped", sample: warped },
        { label: "difference", sample: (x, y) => warped(x, y) - plain(x, y) },
      ]);
      ui.readout.innerHTML = `<b>warp amplitude ${state.amp.toFixed(2)}</b> · displacement basis ${state.base} · ${state.octaves} displacement octaves<br>warped field: ${formatStats(sts[1])}`;
    });
    segmented(ui.controls, [
      { label: "Value", value: "value" },
      { label: "Perlin", value: "perlin" },
      { label: "Simplex", value: "simplex" },
      { label: "OpenSimplex", value: "opensimplex" },
    ], state.base, (v) => { state.base = v; draw(); });
    slider(ui.controls, {
      label: "warp amplitude", min: 0, max: 2.4, step: 0.05, value: state.amp,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.amp = v; draw(); },
    });
    slider(ui.controls, {
      label: "warp frequency", min: 0.35, max: 2, step: 0.05, value: state.warpFreq,
      fmt: (v) => v.toFixed(2), onInput: (v) => { state.warpFreq = v; draw(); },
    });
    slider(ui.controls, {
      label: "warp octaves", min: 1, max: 5, step: 1, value: state.octaves,
      fmt: (v) => String(Math.round(v)), onInput: (v) => { state.octaves = Math.round(v); draw(); },
    });
    draw();
  },
});
