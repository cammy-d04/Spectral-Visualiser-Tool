
// Sethares / Plomp–Levelt sensory dissonance kernel
// f1, f2 in Hz
// returns a non-negative roughness contribution (dimensionless)
function setharesKernel(f1, f2) {
  const df = Math.abs(f1 - f2);
  if (df === 0) return 0;

  const minF = Math.min(f1, f2);

  // Equivalent Rectangular Bandwidth (ERB) approximation
  const erb = 24.7 * (4.37e-3 * minF + 1);

  const x = df / erb;

  const a = 3.5;
  const b = 5.75;
  return Math.exp(-a * x) - Math.exp(-b * x);
}


// Compute Sethares sensory dissonance between two peak sets
// peaksA, peaksB: arrays of { f: frequencyHz, a: amplitude }
// returns a single scalar dissonance value
function setharesDissonance(peaksA, peaksB) {
  let dissonanceSum = 0;

  for (let i = 0; i < peaksA.length; i++) {

    if (peaksA[i].a === 0) continue;

    for (let j = 0; j < peaksB.length; j++) {

      if (peaksB[j].a === 0) continue;
      dissonanceSum += peaksA[i].a * peaksB[j].a * setharesKernel(peaksA[i].f, peaksB[j].f);
    }
  }
  return dissonanceSum;
}
















// Build a Sethares dissonance curve by comparing a peak set to a shifted copy.
//
// peaks: Array<{ f: number, a: number }>
// opts:
//   centsMin (default 0)
//   centsMax (default 1200)
//   centsStep (default 10)
//   maxPeaks (default 30)      // cap strongest peaks for speed
//   normalizeCurve (default true) // scale y to [0,1] for plotting
//   ampCompress (default 0.5)  // 1.0 none, 0.5 sqrt, etc.
function buildDissonanceCurve(peaks1, peaks2, opts = {}) {
  const {
    centsMin = 0,
    centsMax = 1200,
    centsStep = 10,
    maxPeaks = 30,
    normalizeCurve = true,
    ampCompress = 0.5,
  } = opts;

  if (!peaks1 || peaks1.length < 1 || !peaks2 || peaks2.length < 1) {
    return { cents: [], values: [], rawMin: 0, rawMax: 0 };
  }

  // --- 1) Clean + cap peaks (top by amplitude) ---
  const cleaned1 = peaks1
    .filter(p => p && isFinite(p.f) && isFinite(p.a) && p.f > 0 && p.a > 0)
    .sort((p1, p2) => p2.a - p1.a)
    .slice(0, maxPeaks);

  const cleaned2 = peaks2
    .filter(p => p && isFinite(p.f) && isFinite(p.a) && p.f > 0 && p.a > 0)
    .sort((p1, p2) => p2.a - p1.a)
    .slice(0, maxPeaks);

  if (cleaned1.length < 1 || cleaned2.length < 1) {
    return { cents: [], values: [], rawMin: 0, rawMax: 0 };
  }

  // --- 2) Normalize amplitudes (and optionally compress) ---
  let aMax1 = 0;
  for (const p of cleaned1) aMax1 = Math.max(aMax1, p.a);
  if (aMax1 <= 0) aMax1 = 1;

  // --- 2) Normalize amplitudes (and optionally compress) ---
  let aMax2 = 0;
  for (const p of cleaned2) aMax2 = Math.max(aMax2, p.a);
  if (aMax2 <= 0) aMax2 = 1;


  const base1 = cleaned1.map(p => {
    let a = p.a / aMax1;
    if (ampCompress !== 1.0) a = Math.pow(a, ampCompress);
    return { f: p.f, a };
  });

  const base2 = cleaned2.map(p => {
    let a = p.a / aMax2;
    if (ampCompress !== 1.0) a = Math.pow(a, ampCompress);
    return { f: p.f, a };
  });

  // --- 3) Sweep cents and compute dissonance vs shifted copy ---
  const cents = [];
  const values = [];

  let rawMin = Infinity;
  let rawMax = -Infinity;

  for (let c = centsMin; c <= centsMax + 1e-9; c += centsStep) {
    const ratio = Math.pow(2, c / 1200);

    // Shift copy (frequency scaled, amplitudes unchanged)
    const shifted = base2.map(p => ({ f: p.f * ratio, a: p.a }));

    const D = setharesDissonance(base1, shifted);

    cents.push(c);
    values.push(D);

    if (D < rawMin) rawMin = D;
    if (D > rawMax) rawMax = D;
  }

  // --- 4) Normalize curve to [0,1] for stable y-axis ---
  if (normalizeCurve && isFinite(rawMin) && isFinite(rawMax) && rawMax > rawMin) {
    const inv = 1 / (rawMax - rawMin);
    for (let i = 0; i < values.length; i++) {
      values[i] = (values[i] - rawMin) * inv;
    }
  } else if (normalizeCurve) {
    // flat / degenerate curve
    for (let i = 0; i < values.length; i++) values[i] = 0;
    rawMin = rawMax = 0;
  }

  return { cents, values, rawMin, rawMax };
}