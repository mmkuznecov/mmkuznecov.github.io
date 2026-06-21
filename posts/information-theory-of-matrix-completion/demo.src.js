// Demo for "The information theory of matrix completion".
// The live version of the equicorrelated / AR(1) capacity figures. Drag the
// correlation handle along the C(ρ) curve (or use the slider); the completion
// capacity, the implied minimum sampling fraction 1/C, and the k×k covariance
// heatmap all update. Capacity is computed from the eigenvalues at a fixed
// quantization resolution, exactly as in the post.

import {
  boot, widget, Stage, theme, clamp, slider, segmented,
  buildEquicorr, buildAR1, jacobiEigvals, quantizedCapacity,
} from "../../../assets/demos-core.js";

boot({
  "completion-capacity": (root) => {
    const { stageHost, controls, readout } = widget(root, {
      title: "Redundancy raises capacity — drag ρ",
      note: "Quantized Gaussian capacity at fixed resolution. C → 1 for independent rows, and climbs toward k as the rows become a low-rank function of each other.",
    });

    let model = "equi";        // "equi" | "ar1"
    let k = 8;
    let rho = 0.6;
    // Quantization resolution. Coarse enough that the weak directions freeze
    // within the draggable rho range, so the climb is visible (a finer Delta
    // pushes the rank-1 limit C -> k right up against rho = 1, as in the post).
    const DELTA = 0.6;

    const capAt = (rr) => {
      const M = model === "equi" ? buildEquicorr(k, rr) : buildAR1(k, rr);
      const eigs = jacobiEigvals(M);
      const diag = new Array(k).fill(1);   // unit variances on the diagonal
      return quantizedCapacity(eigs, diag, DELTA);
    };

    // Layout: a C(ρ) curve on the left, a covariance heatmap panel on the right.
    const stage = new Stage(stageHost, {
      height: 320, pad: { l: 40, r: 150, t: 16, b: 32 },
      layout: (s) => { s.setDomain([0, 0.98], [0, k + 0.5]); },
    });

    stage.onDraw((c, s) => {
      s.grid(model === "equi" ? Math.max(1, Math.round(k / 6)) : 1);
      s.axisX(0, "ρ");
      // C(ρ) curve
      s.path((rr) => capAt(clamp(rr, 0, 0.98)), theme.accent, 2.4);
      // C = 1 reference
      s.segment(0, 1, 0.98, 1, theme.muted, 1, [4, 4]);
      // current point (draggable along ρ)
      const Cnow = capAt(rho);
      s.dot(rho, Math.min(Cnow, k + 0.5), theme.accent2, 6, true);
      s.segment(rho, 0, rho, Math.min(Cnow, k + 0.5), theme.accent2, 1, [3, 3]);

      // y-axis label
      c.save(); c.fillStyle = theme.muted; c.font = "11px monospace"; c.textAlign = "left";
      c.fillText("C", s.pad.l - 28, s.pad.t + 10); c.restore();

      drawHeatmap(c, s);

      readout.innerHTML =
        `<b>${model === "equi" ? "equicorrelated" : "AR(1)"}</b>, k = ${k}, ρ = ${rho.toFixed(2)} &nbsp;·&nbsp;` +
        ` capacity <b>C</b> = <span class="k">${Cnow.toFixed(2)}</span>` +
        ` &nbsp;·&nbsp; one observation resolves ~<b>${Cnow.toFixed(2)}</b> entries` +
        ` &nbsp;·&nbsp; needs a fraction <b>1/C</b> = <span class="k2">${(1 / Cnow).toFixed(2)}</span> of entries`;
    });

    function drawHeatmap(c, s) {
      const M = model === "equi" ? buildEquicorr(k, rho) : buildAR1(k, rho);
      const size = Math.min(s.plotH, s.pad.r - 24);
      const x0 = s.cssW - s.pad.r + 16;
      const y0 = s.pad.t + (s.plotH - size) / 2;
      const cell = size / k;
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          c.fillStyle = lerpColor(theme.bg, theme.accent, clamp(M[i][j], 0, 1));
          c.fillRect(x0 + j * cell, y0 + i * cell, cell + 0.5, cell + 0.5);
        }
      }
      c.save(); c.strokeStyle = theme.line; c.lineWidth = 1; c.strokeRect(x0, y0, size, size);
      c.fillStyle = theme.muted; c.font = "10px monospace"; c.textAlign = "center";
      c.fillText("covariance Σ", x0 + size / 2, y0 + size + 14); c.restore();
    }

    stage.addDraggable({
      x: () => rho, y: () => Math.min(capAt(rho), k + 0.5),
      move: (nx) => { rho = clamp(nx, 0, 0.98); rhoUI.set(rho); },
      r: 22,
    });

    segmented(controls, [{ label: "equicorrelated", value: "equi" }, { label: "AR(1)", value: "ar1" }], model, (v) => { model = v; stage.render(); });
    const rhoUI = slider(controls, { label: "correlation ρ", min: 0, max: 0.98, value: rho, step: 0.01, onInput: (v) => { rho = v; stage.render(); } });
    slider(controls, { label: "size k", min: 2, max: 12, value: k, step: 1, fmt: (v) => String(Math.round(v)), onInput: (v) => { k = Math.round(v); stage.layout(stage); stage.render(); } });

    stage.render();
  },
});

function lerpColor(c0, c1, t) {
  const a = hex(c0), b = hex(c1);
  const m = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
