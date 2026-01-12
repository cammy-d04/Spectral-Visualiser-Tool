let vizTracks = []; //list of tracks we want to draw
let pausedViz = false; //global pause flag


// Canvases
const canvas = document.getElementById('viz'); //get canvas element
const ctx = canvas.getContext('2d'); //2d drawing context so can draw lines n stuff

function setTracks(tracks) { //tracks to visualise setter
  vizTracks = tracks;
}

function startViz() { 
  requestAnimationFrame(draw);//begin animation loop
}


//create analyser with consistent FFT size across all tracks
// 2048 point FFT gives 11hz bins at 44100hz sample rate
function makeAnalyser(){
  const analyser = audioCtx.createAnalyser();// analyser reads audio data from track
  analyser.fftSize = 2048;
  return analyser;
}




// Layout / sizing
function resize(){
  canvas.width  = canvas.clientWidth;
  canvas.height  = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();


const MARGIN_LEFT = 50, MARGIN_BOTTOM = 30; //layout constants

function drawAxes(maxFreq, maxAmp){ //draws static axes
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

  // frequency labels stays constant
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
  const nyquist = audioCtx.sampleRate / 2;
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

    // fill bins with sound data (energy per bin) from analyser
    const bins = new Uint8Array(bufLen); 
    track.analyser.getByteFrequencyData(bins);




    // --- Peak picking code ---
    const MIN_BIN = 2;             // avoid edge cases
    const MAX_PEAKS = 12;          // limit number of peaks
    const THRESH = 40;             // threshold so ignores small peaks 0–255, tune this
    const MIN_SEP_BINS = 3;        // don't label clustered ripples
    const peaks = []; // collect peaks as {i, mag}

    for (let i = MIN_BIN; i < bufLen-2; i++) {
      const mag = bins[i];
      // local max
      if (mag > bins[i - 1] && mag >= bins[i + 1] && mag > THRESH) {
        peaks.push({ i, mag });
      }
    }
    // sort strongest first
    peaks.sort((a, b) => b.mag - a.mag);

    // keep top peaks but enforce min spacing in bins
    const chosenPeaks = [];
    for (const p of peaks) {
      if (chosenPeaks.length >= MAX_PEAKS) break;

      const tooClose = chosenPeaks.some(q => Math.abs(q.i - p.i) < MIN_SEP_BINS);
      if (!tooClose) {
        chosenPeaks.push(p);
      }
    }

    // ---- Store peaks for reuse (dissonance curve, etc.) ----
    const binHz = audioCtx.sampleRate / track.analyser.fftSize;

    track.peaks = chosenPeaks.map(p => {
      const f = p.i * binHz;        // Hz
      let a = p.mag / 255;          // normalised amplitude 0–1
      // optional: compress so one peak doesn't dominate
      a = Math.sqrt(a);             // comment out if you don't want it
      return { f, a, bin: p.i };
      });

      track.peaksUpdatedAt = performance.now();

    


    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); //start a polyline


    for (let i = 0; i < bufLen; i++) {//loop over bins
      const v = bins[i] / 255; //normalise magnitude to between 0 and 1
      const fMin = 20; // minimum frequency to display  
      const frac = i / bufLen; 
      const f = fMin + i / bufLen * (nyquist - fMin); // actual frequency at this bin
      const y = (h - MARGIN_BOTTOM) - v * plotH; // convert amplitude to vertical pixel position



      let zoomedFrac = frac * xZoom; //apply zoom to x position only 
      // clamp so it doesn't run off canvas
      if (zoomedFrac > 1) zoomedFrac = 1;


      //map frequency position to horizontal pixel
      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);

      //poly line drawing boilerplate
      //forst point starts path, subsequent points extend it
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    //draw polyline
    ctx.stroke();

    // draw peak labels after the line so they appear on top
    ctx.fillStyle = track.color;
    ctx.font = '12px sans-serif';

    for (const p of chosenPeaks) {
      const i = p.i;
      const v = bins[i] / 255;

      const frac = i / bufLen;
      let zoomedFrac = frac * xZoom;
      if (zoomedFrac > 1) zoomedFrac = 1;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      // convert bin index to frequency 
      const fHz = i * (audioCtx.sampleRate / track.analyser.fftSize);

      // small dot marker
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // label slightly above
      ctx.fillText(`${Math.round(fHz)}Hz`, x + 4, y - 6);
}




  });

  ctx.globalAlpha = 1;
}

