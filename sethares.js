function startViz2(defaultTrack) {
  selectedTrack = defaultTrack || vizTracks[0] || null;
  window.selectedTrack = selectedTrack;
  requestAnimationFrame(drawViz2);
}




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
function buildDissonanceCurve(peaks, opts = {}) {
  const {
    centsMin = 0,
    centsMax = 1200,
    centsStep = 10,
    maxPeaks = 30,
    normalizeCurve = true,
    ampCompress = 0.5,
  } = opts;

  if (!peaks || peaks.length < 1) {
    return { cents: [], values: [], rawMin: 0, rawMax: 0 };
  }

  // --- 1) Clean + cap peaks (top by amplitude) ---
  const cleaned = peaks
    .filter(p => p && isFinite(p.f) && isFinite(p.a) && p.f > 0 && p.a > 0)
    .sort((p1, p2) => p2.a - p1.a)
    .slice(0, maxPeaks);

  if (cleaned.length < 1) {
    return { cents: [], values: [], rawMin: 0, rawMax: 0 };
  }

  // --- 2) Normalize amplitudes (and optionally compress) ---
  let aMax = 0;
  for (const p of cleaned) aMax = Math.max(aMax, p.a);
  if (aMax <= 0) aMax = 1;

  const base = cleaned.map(p => {
    let a = p.a / aMax;
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
    const shifted = base.map(p => ({ f: p.f * ratio, a: p.a }));

    const D = setharesDissonance(base, shifted);

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









// =====================
// Viz2: Dissonance curve
// =====================

// Canvas for viz2 (make sure your HTML has <canvas id="viz2"></canvas>)
const canvas2 = document.getElementById('viz2');
const ctx2 = canvas2.getContext('2d');
const MARGIN2_LEFT = 50, MARGIN2_BOTTOM = 30;

function resizeViz2() {
  canvas2.width = canvas2.clientWidth;
  canvas2.height = canvas2.clientHeight;
}

window.addEventListener('resize', resizeViz2);
resizeViz2();

// Geometry helpers for viz2
function viz2PlotGeom() {
  const w = canvas2.width;
  const h = canvas2.height;

  const xs = MARGIN2_LEFT;
  const ys = h - MARGIN2_BOTTOM;

  const plotW = (w - xs - 10);
  const plotH = (h - MARGIN2_BOTTOM - 10);

  return { w, h, xs, ys, plotW, plotH };
}


function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function xToCentsViz2(xCanvas) {
  const { xs, plotW } = viz2PlotGeom();
  const frac = (xCanvas - xs) / plotW;   
  return clamp(frac, 0, 1) * 1200;     
}

function centsToXViz2(cents) {
  const { xs, plotW } = viz2PlotGeom();
  return xs + (clamp(cents, 0, 1200) / 1200) * plotW;
}




function drawAxesViz2(xMaxCents = 1200, yMax = 1.0) {
  const { w, h, xs, ys, plotW, plotH } = viz2PlotGeom();

  ctx2.strokeStyle = '#888';
  ctx2.lineWidth = 1;
  ctx2.fillStyle = '#333';
  ctx2.font = '11px sans-serif';

  // axes
  ctx2.beginPath(); ctx2.moveTo(xs, 0);  ctx2.lineTo(xs, ys); ctx2.stroke(); // y
  ctx2.beginPath(); ctx2.moveTo(xs, ys); ctx2.lineTo(w, ys);  ctx2.stroke(); // x

  // x ticks (cents)
  const ticksX = 12; // 0..1200 every 100 cents
  for (let i = 0; i <= ticksX; i++) {
    const frac = i / ticksX;
    const cents = frac * xMaxCents;
    const x = xs + frac * plotW;


    ctx2.beginPath();
    ctx2.moveTo(x, ys);
    ctx2.lineTo(x, ys + 5);
    ctx2.stroke();

    if (i % 1 === 0) {
      ctx2.fillText(Math.round(cents), x - 10, ys + 18);
    }
  }

  // y ticks (normalized dissonance 0..1)
  const ticksY = 5;
  for (let j = 0; j <= ticksY; j++) {
    const frac = j / ticksY;
    const y = ys - frac * (plotH - 2);
    const v = frac * yMax;

    ctx2.beginPath();
    ctx2.moveTo(xs - 5, y);
    ctx2.lineTo(xs, y);
    ctx2.stroke();

    ctx2.fillText(v.toFixed(1), 8, y + 4);
  }
}








// Choose which track drives viz2
let selectedTrack = null;

function setSelectedTrackById(id) {
  // vizTracks is global from viz.js via setTracks(tracks)
  selectedTrack = (window.vizTracks || vizTracks).find(t => t.id === id) || null;

  // optional: expose for other files (main.js button, etc.)
  window.selectedTrack = selectedTrack;

  console.log("Viz2 selectedTrack =", selectedTrack ? selectedTrack.id : null);
}


// Throttle curve computation (curve math is heavier than drawing)
let lastCurveTime = 0;
let cachedCurve = null;
const CURVE_HZ = 60; // compute curve 60 times/sec
const CURVE_MS = 1000 / CURVE_HZ;

    


function drawViz2() {
  if (pausedViz) return;

  requestAnimationFrame(drawViz2);

  const w = canvas2.width;
  const h = canvas2.height;

  // Clear
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(0, 0, w, h);

  // Axes: x=0..1200 cents, y=0..1 (because buildDissonanceCurve normalizes)
  drawAxesViz2(1200, 1.0);

  if (!selectedTrack) return;

  const peaks = selectedTrack.peaks;

  // Compute curve at limited rate, reuse cached curve for intermediate frames
  const now = performance.now();
  if (!cachedCurve || (now - lastCurveTime) >= CURVE_MS) {
    console.log("viz2 track", selectedTrack?.id, "peaks", selectedTrack?.peaks?.length,); //debugging
    cachedCurve = buildDissonanceCurve(peaks, {
        maxPeaks: 30,
        centsStep: window.centsStep ?? 10,
        normalizeCurve: true,
        ampCompress: window.ampCompress ?? 0.5
    });
    lastCurveTime = now;
  }

  const curve = cachedCurve;
  if (!curve || curve.cents.length === 0) return;

  const { xs, ys, plotW, plotH } = viz2PlotGeom();

  ctx2.globalAlpha = 0.9; //transparency
  ctx2.strokeStyle = selectedTrack.color || '#000';
  ctx2.lineWidth = 2; //thickness
  ctx2.beginPath();

  for (let i = 0; i < curve.cents.length; i++) {
    const c = curve.cents[i];      // 0..1200
    const v = curve.values[i];     // 0..1

    const x = centsToXViz2(c);
    const y = ys - v * plotH;

    if (i === 0) ctx2.moveTo(x, y);
    else ctx2.lineTo(x, y);
  }
  ctx2.stroke();
  ctx2.globalAlpha = 1;



  // const INTERVAL_LINES = [ // intervals to be overlayed in cents with labels
  //   { cents: 0,    label: "1/1" },
  //   { cents: 316,  label: "6/5" },
  //   { cents: 386,  label: "5/4" },
  //   { cents: 500,  label: "4/3" },
  //   { cents: 700,  label: "3/2" },
  //   { cents: 1200, label: "2/1" },
  // ];
  
    const INTERVAL_LINES = [ // intervals to be overlayed in cents with labels
    { cents: 0,    label: "1/1" },
    { cents: 316,  label: "6/5" },
    { cents: 386,  label: "5/4" },
    { cents: 500,  label: "4/3" },
    { cents: 700,  label: "3/2" },
    { cents: 1200, label: "2/1" },
  ];

  ctx2.save();
  ctx2.globalAlpha = 0.4;
  ctx2.strokeStyle = "#0000006d";
  ctx2.fillStyle = "#000";
  ctx2.lineWidth = 1;
  ctx2.font = "10px sans-serif";

  for (const interval of INTERVAL_LINES) {
    const x = centsToXViz2(interval.cents);

    // vertical line
    ctx2.beginPath();
    ctx2.moveTo(x, ys);
    ctx2.lineTo(x, ys - plotH);
    ctx2.stroke();


    ctx2.fillText(interval.label, x + 2, ys - 6);
  }
  ctx2.restore();



    // Slider audition line
  const cents = window.auditionCents ?? 0;
  const xLine = centsToXViz2(cents);

  ctx2.save();
  ctx2.globalAlpha = 0.8;
  ctx2.strokeStyle = "#000";
  ctx2.lineWidth = 1;

  ctx2.beginPath();
  ctx2.moveTo(xLine, ys);
  ctx2.lineTo(xLine, ys - plotH);
  ctx2.stroke();

  ctx2.restore();
}

// Call this once after tracks exist, e.g. in main.js after setTracks(tracks)
function startViz2(defaultTrack) {
  selectedTrack = defaultTrack || vizTracks[0] || null;
  requestAnimationFrame(drawViz2);
}
