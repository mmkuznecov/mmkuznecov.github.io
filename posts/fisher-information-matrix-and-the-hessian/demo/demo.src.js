// Demo for "The Fisher information matrix and the Hessian".
// The live version of the curvature figure: an exponential log-likelihood with
// its second-order Taylor parabola and the osculating circle of radius 1/J.
// Drag the peak (sets the MLE) and move the sample-size slider (sets J = n/λ̂²);
// the circle resizes and the estimator's standard error 1/sqrt(J) updates.

import {
  boot,
  widget,
  Stage,
  theme,
  clamp,
  slider,
} from "../../../assets/demos-core.js";

boot({
  "fisher-curvature-live": (root) => {
    const { stageHost, controls, readout } = widget(root, {
      title: "Curvature is information — drag the peak, change n",
      note: "Exponential model. Observed information J = n/λ̂² is the curvature at the peak; the osculating circle has radius 1/J and the estimate's standard error is 1/√J.",
    });

    let n = 25;
    let lamhat = 1.0;
    const J = () => n / (lamhat * lamhat);
    const r = () => 1 / J();

    const stage = new Stage(stageHost, {
      height: 380,
      pad: { l: 30, r: 18, t: 14, b: 28 },
      layout: (s) => {
        const rr = r();
        const k = s.plotH / s.plotW; // pixels-per-x is 1/k of pixels-per-y target
        const xhalf = Math.max(2.0 * rr, (1.3 * rr) / k, 0.2);
        s.fitEqual(xhalf, lamhat, -rr); // center vertically on the circle's center
      },
    });

    // exponential log-likelihood, shifted so the peak sits at 0
    const llrel = (lam) => {
      const u = lam / lamhat;
      return n * (Math.log(u) - (u - 1));
    };

    stage.onDraw((c, s) => {
      s.grid(Math.max(0.2, Math.round(r() * 10) / 10));
      s.axisX(0, "λ");
      const rr = r();
      // osculating circle (radius 1/J, centered below the peak)
      s.circleData(lamhat, -rr, rr, theme.purple, 1.4);
      // second-order Taylor parabola
      const Jv = J();
      s.path(
        (lam) => -0.5 * Jv * (lam - lamhat) * (lam - lamhat),
        theme.accent2,
        1.6,
        [6, 4],
      );
      // exact log-likelihood
      s.path((lam) => (lam > 1e-3 ? llrel(lam) : NaN), theme.accent, 2.4);
      // circle centre + draggable peak
      s.dot(lamhat, -rr, theme.muted, 3);
      s.dot(lamhat, 0, theme.fg, 6, true);

      readout.innerHTML =
        `<b>n</b> = ${n} &nbsp; <b>λ̂</b> = ${lamhat.toFixed(2)} &nbsp;·&nbsp;` +
        ` observed information <b>J</b> = n/λ̂² = <span class="k">${J().toFixed(1)}</span>` +
        ` &nbsp;·&nbsp; osculating radius <b>1/J</b> = <span class="k2">${r().toFixed(3)}</span>` +
        ` &nbsp;·&nbsp; SE(λ̂) = 1/√J = <b>${(1 / Math.sqrt(J())).toFixed(3)}</b>`;
    });

    // drag the peak horizontally to set the MLE
    stage.addDraggable({
      x: () => lamhat,
      y: () => 0,
      move: (nx) => {
        lamhat = clamp(nx, 0.35, 3.0);
        stage.layout(stage);
      },
      r: 18,
    });

    slider(controls, {
      label: "sample size n",
      min: 2,
      max: 200,
      value: n,
      step: 1,
      fmt: (v) => String(Math.round(v)),
      onInput: (v) => {
        n = Math.round(v);
        stage.layout(stage);
        stage.render();
      },
    });

    stage.render();
  },
});
