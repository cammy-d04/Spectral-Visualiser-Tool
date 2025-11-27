let vizTracks = [];
let pausedViz = false;


// Canvases
const canvas = document.getElementById('viz');
const ctx = canvas.getContext('2d');

function setTracks(tracks) {
  vizTracks = tracks;
}

function startViz() {
  requestAnimationFrame(draw);
}


//create analyser with consistent FFT size
// 2048 point FFT gives 11hz bins at 44100hz sample rate
function makeAnalyser(){
  const an = audioCtx.createAnalyser();
  an.fftSize = 2048;
  return an;
}




// Layout / sizing
function resize(){
  canvas.width  = canvas.clientWidth;
  canvas.height  = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();


const MARGIN_LEFT = 50, MARGIN_BOTTOM = 30;

function drawAxes(maxFreq, maxAmp){
  const w = canvas.width, h = canvas.height;
  const xs = MARGIN_LEFT;
  const ys = h - MARGIN_BOTTOM;

  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#333';
  ctx.font = '11px sans-serif';

  // y-axis
  ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, ys); ctx.stroke();
  // x-axis
  ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(w, ys); ctx.stroke();

 // --- X-axis (frequency) ---
const fMin = 0;
const fMax = maxFreq;
const ticks = 100;

for (let i = 0; i <= ticks; i++) {
  const frac = i / ticks;

  // frequency label stays constant
  const f = fMin + frac * (fMax - fMin);

  // Apply zoom to position only
  let zoomedFrac = frac * xZoom;

  // If the tick is past the view window, stop drawing
  if (zoomedFrac > 1) break;

  const x = xs + zoomedFrac * (w - xs - 8);

  // tick mark
  ctx.beginPath();
  ctx.moveTo(x, ys);
  ctx.lineTo(x, ys + 5);
  ctx.stroke();

  // labels
  if (i % 5 === 0) {
    ctx.fillText(Math.round(f), x - 12, ys + 18);
  }
}



  // --- Y-axis (amplitude) ---
  const yTicks = 10;
  for (let j = 0; j <= yTicks; j++) {
    const y = ys - (j / yTicks) * (ys - 8);
    const a = (j / yTicks) * maxAmp;
    ctx.beginPath(); ctx.moveTo(xs - 5, y); ctx.lineTo(xs, y); ctx.stroke();
    ctx.fillText(a.toFixed(1), 8, y + 4);
  }
}


// =====================
// Multi-track draw loop
// =====================
function draw() {
  if (pausedViz) return;
  // only draw if we have at least one analyser running
  const activeTracks = vizTracks.filter(t => t.analyser);
  if (activeTracks.length === 0) return;

  requestAnimationFrame(draw); // Schedule next frame

  const w = canvas.width;
  const h = canvas.height;
  const nyquist = 20000;
  const maxAmp = 1.0;

   // height of plotting area
  const plotH = h - MARGIN_BOTTOM - 10;

  // clear background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  drawAxes(nyquist, maxAmp);

  // assume all analysers use same fftSize
  const refAnalyser = activeTracks[0].analyser;
  const bufLen = refAnalyser.frequencyBinCount;

  activeTracks.forEach(track => {
    // honour per-track show checkbox
    if (!track.show || !track.analyser) return;

    const bins = new Uint8Array(bufLen);
    track.analyser.getByteFrequencyData(bins);

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < bufLen; i++) {
      const v = bins[i] / 255;
      const fMin = 20;
      const frac = i / bufLen;
      const f = fMin + frac * (nyquist - fMin);
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      let zoomedFrac = frac * xZoom;

      // clamp so it doesn't run off canvas
      if (zoomedFrac > 1) zoomedFrac = 1;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);


      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  });

  ctx.globalAlpha = 1;
}