// Demo for "Maximum likelihood and maximum a posteriori".
// The live version of the Beta-Bernoulli figure. Add coin flips and shape the
// Beta(α,β) prior; the prior, the normalized likelihood, and the posterior
// redraw, with the MLE, the MAP mode, and the posterior mean marked.

import { boot, widget, Stage, theme, clamp, slider, button, betaPdf } from "../../../assets/demos-core.js";

boot({
  "beta-bernoulli-live": (root) => {
    const { stageHost, controls, readout } = widget(root, {
      title: "Add flips, shape the prior — the posterior updates",
      note: "Beta prior is conjugate to the Bernoulli likelihood, so the posterior is Beta(k+α, n−k+β). MLE = k/n, MAP is the posterior mode, plus the posterior mean.",
    });

    let k = 7, n = 10;          // heads, total
    let a = 2, b = 2;           // prior Beta(a,b)

    const yMax = () => {
      let m = 0;
      for (let i = 1; i < 200; i++) {
        const x = i / 200;
        m = Math.max(m, betaPdf(x, a, b), betaPdf(x, k + 1, n - k + 1), betaPdf(x, k + a, n - k + b));
      }
      return m * 1.12 + 0.3;
    };

    const stage = new Stage(stageHost, {
      height: 320, pad: { l: 30, r: 16, t: 16, b: 30 },
      layout: (s) => s.setDomain([0, 1], [0, yMax()]),
    });

    stage.onDraw((c, s) => {
      s.grid(0.2);
      s.axisX(0, "θ");
      // prior, likelihood (normalized), posterior
      s.path((x) => betaPdf(x, a, b), theme.muted, 1.6, [3, 3]);
      s.path((x) => betaPdf(x, k + 1, n - k + 1), theme.accent2, 1.8, [7, 4]);
      s.path((x) => betaPdf(x, k + a, n - k + b), theme.accent, 2.4);

      const mle = k / n;
      const mapDen = n + a + b - 2;
      const map = mapDen > 0 ? clamp((k + a - 1) / mapDen, 0, 1) : mle;
      const mean = (k + a) / (n + a + b);
      vline(c, s, mle, theme.accent2);
      vline(c, s, map, theme.accent);
      vline(c, s, mean, theme.fg);

      readout.innerHTML =
        `<b>${k}</b> heads / <b>${n}</b> flips &nbsp; prior Beta(${a},${b}) &nbsp;·&nbsp;` +
        ` MLE k/n = <span class="k2">${mle.toFixed(3)}</span>` +
        ` &nbsp;·&nbsp; MAP mode = <span class="k">${map.toFixed(3)}</span>` +
        ` &nbsp;·&nbsp; posterior mean = <b>${mean.toFixed(3)}</b>`;
    });

    function vline(c, s, x, color) {
      c.save(); c.strokeStyle = color; c.lineWidth = 1.4; c.globalAlpha = 0.9;
      c.beginPath(); c.moveTo(s.px(x), s.pad.t); c.lineTo(s.px(x), s.pad.t + s.plotH); c.stroke(); c.restore();
    }

    const relayout = () => { stage.layout(stage); stage.render(); };
    button(controls, "+ heads", () => { k += 1; n += 1; relayout(); });
    button(controls, "+ tails", () => { n += 1; relayout(); });
    button(controls, "reset data", () => { k = 7; n = 10; relayout(); });
    slider(controls, { label: "prior α", min: 0.5, max: 8, value: a, step: 0.5, fmt: (v) => v.toFixed(1), onInput: (v) => { a = v; relayout(); } });
    slider(controls, { label: "prior β", min: 0.5, max: 8, value: b, step: 0.5, fmt: (v) => v.toFixed(1), onInput: (v) => { b = v; relayout(); } });

    relayout();
  },
});
