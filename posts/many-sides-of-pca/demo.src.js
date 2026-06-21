// Demo for "The many sides of PCA".
// Drag the data points; the covariance eigenvectors (principal axes), the
// one-sigma variance ellipse, and the explained-variance split update live.
// This is the live version of the variance-directions / decorrelation figures.

import { boot, widget, Stage, theme, eigSym2, clamp, slider, button, toggle } from "../../../assets/demos-core.js";

boot({
  "pca-cloud": (root) => {
    const { stageHost, controls, readout } = widget(root, {
      title: "Drag the points — the principal axes follow",
      note: "Principal axes are the eigenvectors of the 2x2 covariance; lengths are one standard deviation along each axis.",
    });

    const SPAN = 6;
    let pts = startCloud();
    let showResid = false;

    const stage = new Stage(stageHost, { height: 360, pad: { l: 36, r: 18, t: 18, b: 30 }, layout: (s) => s.fitEqual(SPAN) });

    stage.onDraw((c, s) => {
      s.grid(2);
      s.axisX(0); s.segment(0, s.ydom[0], 0, s.ydom[1], theme.muted, 1); // y-axis

      const n = pts.length;
      let mx = 0, my = 0;
      for (const p of pts) { mx += p.x; my += p.y; }
      mx /= n; my /= n;
      let a = 0, b = 0, d = 0;
      for (const p of pts) { const ex = p.x - mx, ey = p.y - my; a += ex * ex; b += ex * ey; d += ey * ey; }
      a /= n; b /= n; d /= n;
      const { l1, l2, v1, v2 } = eigSym2(a, b, d);
      const s1 = Math.sqrt(Math.max(l1, 0)), s2 = Math.sqrt(Math.max(l2, 0));

      // one-sigma ellipse
      c.save();
      c.translate(s.px(mx), s.py(my));
      c.rotate(-Math.atan2(v1[1], v1[0]));            // canvas y is down -> negate
      const sclx = Math.abs(s.px(SPAN) - s.px(0)) / SPAN;
      c.strokeStyle = theme.accent2; c.lineWidth = 1.6; c.globalAlpha = 0.9;
      c.beginPath(); c.ellipse(0, 0, s1 * sclx, s2 * sclx, 0, 0, 2 * Math.PI); c.stroke();
      c.restore();

      // principal axes (scaled to one std for visibility)
      s.segment(mx - v1[0] * s1, my - v1[1] * s1, mx + v1[0] * s1, my + v1[1] * s1, theme.fg, 2.4);
      s.segment(mx - v2[0] * s2, my - v2[1] * s2, mx + v2[0] * s2, my + v2[1] * s2, theme.muted, 1.8);

      // projection residuals onto PC1
      if (showResid) {
        for (const p of pts) {
          const t = (p.x - mx) * v1[0] + (p.y - my) * v1[1];
          s.segment(p.x, p.y, mx + t * v1[0], my + t * v1[1], theme.purple, 0.9);
        }
      }

      // points + centroid
      for (const p of pts) s.dot(p.x, p.y, theme.accent, 5, true);
      s.dot(mx, my, theme.accent2, 5, true);

      const ev1 = (100 * l1 / (l1 + l2 || 1)).toFixed(1);
      readout.innerHTML =
        `<b>λ₁</b> = <span class="k">${l1.toFixed(2)}</span> &nbsp; <b>λ₂</b> = <span class="k2">${l2.toFixed(2)}</span>` +
        ` &nbsp;·&nbsp; PC1 explains <b>${ev1}%</b> of the variance` +
        ` &nbsp;·&nbsp; condition λ₁/λ₂ = <b>${(l1 / (l2 || 1e-9)).toFixed(1)}</b>`;
    });

    pts.forEach((p) => stage.addDraggable({
      x: () => p.x, y: () => p.y,
      move: (nx, ny) => { p.x = clamp(nx, -SPAN, SPAN); p.y = clamp(ny, -SPAN, SPAN); },
      r: 16,
    }));

    toggle(controls, "show projection onto PC1", false, (v) => { showResid = v; stage.render(); });
    button(controls, "reset cloud", () => { const f = startCloud(); pts.forEach((p, i) => { p.x = f[i].x; p.y = f[i].y; }); stage.render(); });
    button(controls, "make it round", () => { pts.forEach((p, i) => { const a = (i / pts.length) * 2 * Math.PI; p.x = 2.6 * Math.cos(a) + jit(); p.y = 2.6 * Math.sin(a) + jit(); }); stage.render(); });

    stage.render();

    function jit() { return (Math.random() - 0.5) * 0.6; }
    function startCloud() {
      // a correlated elongated cloud, deterministic-ish layout
      const out = [];
      const dirs = [-1.6, -1.1, -0.7, -0.3, 0.1, 0.4, 0.8, 1.2, 1.7, 2.1, -2.0, 0.6];
      for (let i = 0; i < dirs.length; i++) {
        const t = dirs[i] * 2.2;
        out.push({ x: t + (Math.random() - 0.5) * 1.0, y: 0.55 * t + (Math.random() - 0.5) * 1.6 });
      }
      return out;
    }
  },
});
