
function startViz2() {
  requestAnimationFrame(drawViz2);
}



// sethares dissonane curve visualisation

const canvas2 = document.getElementById('viz2');
const ctx2 = canvas2.getContext('2d');
const MARGIN2_LEFT = 50, MARGIN2_BOTTOM = 30;

function resizeViz2() {
  canvas2.width = canvas2.clientWidth;
  canvas2.height = canvas2.clientHeight;
}

window.addEventListener('resize', resizeViz2);
resizeViz2();


// geometry helpers for viz2
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

  ctx2.globalAlpha = 1;
  ctx2.strokeStyle = '#ffffff';
  ctx2.lineWidth = 1;
  ctx2.fillStyle = '#ffffff';
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
      ctx2.fillText(Math.round(cents), x - 10, ys + 16);
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

    ctx2.fillText(v.toFixed(1), 20, y + 4);
  }


  // Axis labels
ctx2.fillStyle = '#ffffff';
ctx2.font = '12px sans-serif';
ctx2.fillText('Interval (cents)', xs + plotW / 2 - 40, ys + 28);
ctx2.save();
ctx2.translate(12, ys / 2 + 30);
ctx2.rotate(-Math.PI / 2);
ctx2.fillText('Dissonance', 0, 0);
ctx2.restore();
}





// Throttle curve computation 
let lastCurveTime = 0;
let cachedCurve = null;
const CURVE_HZ = 60; // compute curve 60 times/sec
const CURVE_MS = 1000 / CURVE_HZ;


let curve = null;

window.rebuildDissonanceCurve = function() {
  const peaks1 = window.buses.context?.peaks;
  const peaks2 = window.buses.complement?.peaks;
  
  if (!peaks1?.length || !peaks2?.length) {
    curve = null;
    return;
  }
  
  curve = buildDissonanceCurve(peaks1, peaks2, {
    maxPeaks: 30,
    centsStep: window.centsStep ?? 10,
    normalizeCurve: true,
    ampCompress: window.ampCompress ?? 0.5
  });
};

function drawViz2() {

  requestAnimationFrame(drawViz2);

  const w = canvas2.width;
  const h = canvas2.height;

  // Clear
  ctx2.fillStyle = '#000000';
  ctx2.fillRect(0, 0, w, h);

  // Axes: x=0..1200 cents, y=0..1 (because buildDissonanceCurve normalizes)
  drawAxesViz2(1200, 1.0);


  if (!curve || curve.cents.length === 0) return;

  // --- Master dissonance meter ---
else{
  const currentCents = window.auditionCents ?? 0;

  // find nearest index in curve for current audition position
  const idx = Math.round((currentCents - 0) / (window.centsStep ?? 1));
  const clampedIdx = Math.max(0, Math.min(curve.values.length - 1, idx));
  const val = curve.values[clampedIdx]; // 0..1 (normalized)

  // color: green -> yellow -> red
  const r = Math.round(Math.min(255, val * 2 * 255));
  const g = Math.round(Math.min(255, (1 - val) * 2 * 255));
  const color = `rgb(${r},${g},0)`;

  const fill = document.getElementById('dissonanceMeterFill');
  const label = document.getElementById('dissonanceMeterVal');
  if (fill) {
    fill.style.width = `${(val * 100).toFixed(1)}%`;
    fill.style.background = color;
  }
  if (label) label.textContent = val.toFixed(3);
}

  const { xs, ys, plotW, plotH } = viz2PlotGeom();

  ctx2.globalAlpha = 1; //transparency
  ctx2.strokeStyle = '#6456fe';
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


// --- Tuning system interval overlays ---

const TUNING_SYSTEMS = {
  just: {
    label: "Just Intonation",
    color: "#0000006d",
    intervals: [
      { cents: 0,    label: "1/1" },
      { cents: 112,  label: "16/15" },
      { cents: 182,  label: "10/9" },
      { cents: 204,  label: "9/8" },
      { cents: 316,  label: "6/5" },
      { cents: 386,  label: "5/4" },
      { cents: 498,  label: "4/3" },
      { cents: 590,  label: "45/32" },
      { cents: 702,  label: "3/2" },
      { cents: 814,  label: "8/5" },
      { cents: 884,  label: "5/3" },
      { cents: 969,  label: "7/4" },
      { cents: 1018, label: "9/5" },
      { cents: 1088, label: "15/8" },
      { cents: 1200, label: "2/1" },
    ]
  },
  pyth: {
    label: "Pythagorean",
    color: "#0000006d",
    intervals: [
      { cents: 0,    label: "P1" },
      { cents: 90,   label: "m2" },
      { cents: 204,  label: "M2" },
      { cents: 294,  label: "m3" },
      { cents: 408,  label: "M3" },
      { cents: 498,  label: "P4" },
      { cents: 612,  label: "A4" },
      { cents: 702,  label: "P5" },
      { cents: 792,  label: "m6" },
      { cents: 906,  label: "M6" },
      { cents: 996,  label: "m7" },
      { cents: 1110, label: "M7" },
      { cents: 1200, label: "P8" },
    ]
  },
  "12tet": {
    label: "12-TET",
    color: "#0000006d",
    intervals: Array.from({ length: 13 }, (_, i) => ({
      cents: i * 100,
      label: ["P1","m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7","P8"][i]
    }))
  },
    pelog: {
    label: "Javanese Pelog",
    color: "#0000006d",
    intervals: [
      { cents: 0,    label: "" },
      { cents: 120,   label: "" },
      { cents: 150,  label: "" },
      { cents: 280,  label: "" },
      { cents: 120,  label: "" },
      { cents: 150,  label: "" },
      { cents: 280,  label: "" },
      { cents: 702,  label: "" },
      { cents: 792,  label: "" },
      { cents: 906,  label: "" },
      { cents: 996,  label: "" },
      { cents: 1110, label: "" },
      { cents: 1200, label: "" },
    ]
    },
    slendro: {
      label: "Javanese Slendro",
      color: "#0000006d",
      intervals: [
        { cents: 240,    label: "" },
        { cents: 480,   label: "" },
        { cents: 720,  label: "" },
        { cents: 960,  label: "" },
        { cents: 1200,  label: "" },
      ]
    },
};

const overlayMode = document.getElementById('intervalOverlay')?.value ?? 'just';

let overlaysToDraw = [];
if (overlayMode === 'none') {
  overlaysToDraw = [];
} else if (TUNING_SYSTEMS[overlayMode]) {
  overlaysToDraw = [TUNING_SYSTEMS[overlayMode]];
}

for (let sysIdx = 0; sysIdx < overlaysToDraw.length; sysIdx++) {
  const sys = overlaysToDraw[sysIdx];
  const labelYOffset = overlaysToDraw.length > 1 ? sysIdx * 12 : 0;

  ctx2.save();
  ctx2.globalAlpha = 0.4;
  ctx2.strokeStyle = sys.color;
  ctx2.fillStyle = sys.color;
  ctx2.lineWidth = 1;
  ctx2.font = "10px sans-serif";

  for (const interval of sys.intervals) {
    const x = centsToXViz2(interval.cents);

    ctx2.beginPath();
    ctx2.moveTo(x, ys);
    ctx2.lineTo(x, ys - plotH);
    ctx2.stroke();

    ctx2.fillText(interval.label, x + 2, ys - 6 + labelYOffset);
  }
  ctx2.restore();
}


    // Slider audition line
  const cents = window.auditionCents ?? 0;
  const xLine = centsToXViz2(cents);

  ctx2.save();
  ctx2.globalAlpha = 0.8;
  ctx2.strokeStyle = "#ffffff";
  ctx2.lineWidth = 1;

  ctx2.beginPath();
  ctx2.moveTo(xLine, ys);
  ctx2.lineTo(xLine, ys - plotH);
  ctx2.stroke();

  ctx2.restore();
}

