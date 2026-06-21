#!/usr/bin/env node
// test.mjs — verify the demo math and that every built bundle parses.
// Zero dependencies. Run after building:  node build.mjs && node test.mjs

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "./assets/demos-core.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function ok(name, cond) { if (cond) { pass++; console.log("  ok   " + name); } else { fail++; console.error("  FAIL " + name); } }

console.log("math:");

// eigSym2 on a known symmetric matrix [[2,1],[1,2]] -> eigenvalues 3,1; vecs (1,1)/√2,(−1,1)/√2
{
  const e = core.eigSym2(2, 1, 2);
  ok("eigSym2 eigenvalues", approx(e.l1, 3) && approx(e.l2, 1));
  ok("eigSym2 eigenvector", approx(Math.abs(e.v1[0]), Math.SQRT1_2, 1e-9) && approx(Math.abs(e.v1[1]), Math.SQRT1_2, 1e-9));
  ok("eigSym2 orthogonal", approx(e.v1[0] * e.v2[0] + e.v1[1] * e.v2[1], 0, 1e-9));
}

// jacobiEigvals on equicorrelated matrix: eigenvalues are 1+(k-1)ρ and 1-ρ (×(k-1))
{
  const k = 6, rho = 0.4;
  const eigs = core.jacobiEigvals(core.buildEquicorr(k, rho));
  ok("jacobi top eigenvalue", approx(eigs[0], 1 + (k - 1) * rho, 1e-6));
  ok("jacobi remaining eigenvalues", eigs.slice(1).every((l) => approx(l, 1 - rho, 1e-6)));
  ok("jacobi trace preserved", approx(eigs.reduce((a, b) => a + b, 0), k, 1e-6));
}

// logGamma against known integers: Γ(5)=24, Γ(6)=120
ok("logGamma(5)=log 24", approx(core.logGamma(5), Math.log(24), 1e-9));
ok("logGamma(6)=log 120", approx(core.logGamma(6), Math.log(120), 1e-9));

// betaPdf integrates to 1 (trapezoid)
{
  let s = 0; const N = 4000;
  for (let i = 1; i < N; i++) s += core.betaPdf(i / N, 3, 5);
  ok("betaPdf integrates to 1", approx(s / N, 1, 2e-3));
}

// quantizedCapacity: equicorrelated -> ~1 at ρ→0, climbs substantially toward k at ρ→1
{
  const k = 8, D = 0.6, diag = new Array(k).fill(1);
  const C0 = core.quantizedCapacity(core.jacobiEigvals(core.buildEquicorr(k, 0.001)), diag, D);
  const C1 = core.quantizedCapacity(core.jacobiEigvals(core.buildEquicorr(k, 0.98)), diag, D);
  ok("capacity ~1 when independent", approx(C0, 1, 0.05));
  ok("capacity climbs with correlation", C1 > 3 && C1 <= k + 1e-6);
  ok("capacity monotone in rho", (() => {
    let prev = 0;
    for (let r = 0; r <= 0.95; r += 0.05) { const C = core.quantizedCapacity(core.jacobiEigvals(core.buildEquicorr(k, r)), diag, D); if (C < prev - 1e-9) return false; prev = C; }
    return true;
  })());
}

// AR(1) accrues redundancy more slowly than equicorrelated at the same ρ (post's claim)
{
  const k = 8, D = 0.6, diag = new Array(k).fill(1), rho = 0.7;
  const Cequi = core.quantizedCapacity(core.jacobiEigvals(core.buildEquicorr(k, rho)), diag, D);
  const Car1 = core.quantizedCapacity(core.jacobiEigvals(core.buildAR1(k, rho)), diag, D);
  ok("AR(1) capacity < equicorrelated", Car1 < Cequi);
}

// clamp
ok("clamp", core.clamp(5, 0, 3) === 3 && core.clamp(-1, 0, 3) === 0 && core.clamp(2, 0, 3) === 2);

console.log("\nbundles parse (node --check):");
const posts = existsSync(join(ROOT, "posts"))
  ? readdirSync(join(ROOT, "posts")).filter((s) => { const d = join(ROOT, "posts", s); try { return statSync(d).isDirectory() && existsSync(join(d, "demo.js")); } catch { return false; } })
  : [];
if (posts.length === 0) { fail++; console.error("  FAIL no built demo.js found — run `node build.mjs` first"); }
for (const slug of posts) {
  try { execFileSync(process.execPath, ["--check", join(ROOT, "posts", slug, "demo.js")]); ok(`posts/${slug}/demo.js parses`, true); }
  catch (e) { ok(`posts/${slug}/demo.js parses`, false); console.error(String(e.stderr || e)); }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
