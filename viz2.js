


export function startViz2() {
  requestAnimationFrame(drawViz2);
}



// sethares dissonance curve visualisation

const canvas2 = document.getElementById('viz2');
const ctx2 = canvas2.getContext('2d');
const MARGIN2_LEFT = 50, MARGIN2_BOTTOM = 30;

function resizeViz2() {
  canvas2.width = canvas2.clientWidth;
  canvas2.height = canvas2.clientHeight;
}

window.addEventListener('resize', resizeViz2);
resizeViz2();



function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function xToCentsViz2(xCanvas, xs, plotW) {
  const frac = (xCanvas - xs) / plotW;   
  return clamp(frac, 0, 1) * 1200;
}

function centsToXViz2(cents, xs, plotW) {
  return xs + (clamp(cents, 0, 1200) / 1200) * plotW;
}




function drawAxesViz2(xMaxCents = 1200, yMax = 1.0, xs, ys, plotW, plotH) {
  ctx2.globalAlpha = 1;
  ctx2.strokeStyle = '#ffffff';
  ctx2.lineWidth = 1;
  ctx2.fillStyle = '#ffffff';
  ctx2.font = '11px sans-serif';

  const plotRight = xs + plotW;
  const plotTop = ys - plotH + 2;

  // axes
  ctx2.beginPath(); ctx2.moveTo(xs, plotTop); ctx2.lineTo(xs, ys); ctx2.stroke(); // y
  ctx2.beginPath(); ctx2.moveTo(xs, ys); ctx2.lineTo(plotRight, ys); ctx2.stroke(); // x
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

  // y ticks (normalized dissonance 0 to 1)
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


function drawViz2() {
  const w = canvas2.width;
  const h = canvas2.height;
  const xs = MARGIN2_LEFT;
  const ys = h - MARGIN2_BOTTOM;
  const plotW = (w - xs - 10);
  const plotH = (h - MARGIN2_BOTTOM - 10);

  requestAnimationFrame(drawViz2);

  // Clear
  ctx2.fillStyle = '#000000';
  ctx2.fillRect(0, 0, w, h);

  // Axes: x=0 to1200 cents, y=0 to1 (because buildDissonanceCurve normalizes)
  drawAxesViz2(1200, 1.0, xs, ys, plotW, plotH);

  // ---Tuning system interval overlays---

const TUNING_SYSTEMS = {
  just: {
    label: "Just Intonation",
    intervals: [
      { cents: 0,    label: "1/1" },
      { cents: 204,  label: "9/8" },
      { cents: 386,  label: "5/4" },
      { cents: 498,  label: "4/3" },
      { cents: 702,  label: "3/2" },
      { cents: 884,  label: "5/3" },
      { cents: 1088, label: "15/8" },
      { cents: 1200, label: "2/1" },
    ]
  },
  pyth: {
    label: "Pythagorean",
    intervals: [
      { cents: 0,    label: "" },
      { cents: 204,  label: "9/8" },
      { cents: 407,  label: "81/64" },
      { cents: 498,  label: "4/3" },
      { cents: 702,  label: "3/2" },
      { cents: 905,  label: "27/16" },
      { cents: 1110,  label: "243/128" },
      { cents: 1200, label: "" }
    ]
  },
  "12tet": {
    label: "12-TET",
    intervals: Array.from({ length: 13 }, (_, i) => ({
      cents: i * 100,
      label: ["P1","m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7","P8"][i]
    }))
  },
    pelog: {
    label: "Javanese Pelog",
    intervals: [
      { cents: 0,    label: "" },
      { cents: 120,   label: "" },
      { cents: 260,  label: "" },
      { cents: 540,  label: "" },
      { cents: 675,  label: "" },
      { cents: 790,  label: "" },
      { cents: 940,  label: "" },
      { cents: 1200,  label: "" }
    ]
    },
    slendro: {
      label: "Javanese Slendro",
      intervals: [
        { cents: 235,    label: "" },
        { cents: 480,   label: "" },
        { cents: 715,  label: "" },
        { cents: 960,  label: "" },
        { cents: 1200,  label: "" }
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

for (let i = 0; i < overlaysToDraw.length; i++) {
  const labelYOffset = overlaysToDraw.length > 1 ? i * 12 : 0;

  ctx2.save();
  ctx2.globalAlpha = 0.3;
  ctx2.strokeStyle = "#ffffff";
  ctx2.fillStyle = "#ffffff";
  ctx2.lineWidth = 1;
  ctx2.font = "10px sans-serif";

  for (const interval of overlaysToDraw[i].intervals) {
    const x = centsToXViz2(interval.cents, xs, plotW);

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
  const xLine = centsToXViz2(cents, xs, plotW);

  ctx2.save();
  ctx2.globalAlpha = 0.8;
  ctx2.strokeStyle = "#15ff00";
  ctx2.lineWidth = 1;

  ctx2.beginPath();
  ctx2.moveTo(xLine, ys);
  ctx2.lineTo(xLine, ys - plotH);
  ctx2.stroke();

  ctx2.restore();

  if (!window.dissonanceCurve || window.dissonanceCurve.cents.length === 0) return;

  // ---draw dissonance curve---

  ctx2.globalAlpha = 1; //transparency
  ctx2.strokeStyle = '#8635f7';
  ctx2.lineWidth = 1.5; //thickness
  ctx2.beginPath();

  for (let i = 0; i < window.dissonanceCurve.cents.length; i++) {
    const c = window.dissonanceCurve.cents[i];      // 0..1200
    const v = window.dissonanceCurve.values[i];     // 0..1

    const x = centsToXViz2(c, xs, plotW);
    const y = ys - v * plotH;

    if (i === 0) ctx2.moveTo(x, y);
    else ctx2.lineTo(x, y);
  }
  ctx2.stroke();
  ctx2.globalAlpha = 1;

}
