// holds list of tracks we want to visualise (vizTracks)
//reads frequency data from each track's analyser and draws it on canvas
// draws the axes and peak labels
//main.js calls setTracks(tracks) and startViz()


let vizTracks = []; //list of tracks we want to draw


// Canvases
const canvas = document.getElementById('viz'); //get canvas element
const ctx = canvas.getContext('2d'); //2d drawing context so can draw lines n stuff


function startViz() { 
  requestAnimationFrame(draw); //begin animation loop
}



// Layout / sizing
function resize(){
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
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
const fMax = Math.min(maxFreq, 20000);
const tickSpacing = 200;
const labelSpacing = 1000;

for (let f = 0; f <= fMax; f += tickSpacing) {
  const frac = f / maxFreq;
  let zoomedFrac = frac * xZoom;
  if (zoomedFrac > 1) break;
  const x = xs + zoomedFrac * (w - xs - 8);
  ctx.beginPath();
  ctx.moveTo(x, ys);
  ctx.lineTo(x, ys + 5);
  ctx.stroke();
  if (f % labelSpacing === 0) {
    ctx.fillText(String(f), x - 12, ys + 16);
  }
}



  // --- Y-axis (amplitude) ---
  const yTicks = 10;
  for (let j = 0; j <= yTicks; j++) {
    const y = ys - (j / yTicks) * (ys - 8);
    const a = (j / yTicks) * maxAmp;
    ctx.beginPath(); ctx.moveTo(xs - 5, y); ctx.lineTo(xs, y); ctx.stroke();
    ctx.fillText(a.toFixed(1), 20, y + 4);
  }


// Axis labels
ctx.fillStyle = '#333';
ctx.font = '12px sans-serif';
ctx.fillText('Frequency (Hz)', w / 2 - 20 , ys + 28);
ctx.save();
ctx.translate(12, ys / 2 + 30);
ctx.rotate(-Math.PI / 2);
ctx.fillText('Amplitude', 0, 0);
ctx.restore();

}





// Ensure track has a buffer for analyser data and an optional bin->Hz scale
function ensureTrackVizBuffers(track) {
  const bufLen = track.analyser.frequencyBinCount;

  if (!track._bins || track._bins.length !== bufLen) {
    track._bins = new Uint8Array(bufLen);
  }

  // Optional: cache bin->Hz scale
  track._binHz = window.audioCtx.sampleRate / track.analyser.fftSize;
}








// =====================
// Multi-track draw loop
// =====================
function draw() {

  // only draw if we have at least one analyser running
  const activeTracks = vizTracks.filter(t => t.analyser);
  if (activeTracks.length === 0) return;

  requestAnimationFrame(draw); // Schedule next frame

  const w = canvas.width;
  const h = canvas.height;
const nyquist = 20000;
  const maxAmp = 1.0;
  const plotH = h - MARGIN_BOTTOM - 10; // height of plotting area

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
    ensureTrackVizBuffers(track);

let bins;

if (track === window.buses.complement) return; //skip complement, we draw stretchy one!!!

// For buses, use their staticBins; for tracks, use theirs
if (track.staticBins) {
  track._bins.set(track.staticBins);
  bins = track._bins;
} else {
  track.analyser.getByteFrequencyData(track._bins);
  bins = track._bins;
}




    // --- Peak picking code ---
    const MAX_PEAKS = window.maxPeaksPicked ?? 7;

    let maxBin = 0;
    for (let k = 0; k < bufLen; k++) {
      if (bins[k] > maxBin){
         maxBin = bins[k];
        }
    }
    
    //parameters wired to controls
    const THRESH = (window.threshFrac ?? 0.2) * maxBin;
    const binHz = window.audioCtx.sampleRate / track.analyser.fftSize;
    const MIN_SEP_BINS = Math.max(1, Math.round((window.minSepHz ?? 30) / binHz));
    const MIN_BIN = Math.max(2, Math.round((window.peakFMin ?? 60) / binHz));
    const peaks = [];

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
      const frac = (i * binHz) / nyquist;
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

      const frac = (i * (window.audioCtx.sampleRate / track.analyser.fftSize)) / nyquist;
      let zoomedFrac = frac * xZoom;
      if (zoomedFrac > 1) zoomedFrac = 1;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      // convert bin index to frequency 
      const fHz = i * (window.audioCtx.sampleRate / track.analyser.fftSize);

      // small dot marker
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // label slightly above
      ctx.fillText(`${Math.round(fHz)}Hz`, x + 4, y + 12);
  }
});


// --- Complement spectrum: always drawn stretched by audition interval ---

const complementBus = window.buses.complement;
  if (complementBus && complementBus.staticBins && window.auditionCents != null) {
    const ratio = Math.pow(2, window.auditionCents / 1200);
    const compBins = complementBus.staticBins;
    const binHz = window.audioCtx.sampleRate / complementBus.analyser.fftSize;
    const compBufLen = compBins.length;

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'dodgerblue';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < compBufLen; i++) {
      const stretchedF = i * binHz * ratio;
      const frac = stretchedF / nyquist;
      let zoomedFrac = frac * xZoom;
      if (zoomedFrac > 1) break;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
      const v = compBins[i] / 255;
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Peak picking on the stretched complement spectrum ---
    const MAX_PEAKS = window.maxPeaksPicked ?? 7;
    let maxBin = 0;
    for (let k = 0; k < compBufLen; k++) {
      if (compBins[k] > maxBin) maxBin = compBins[k];
    }

    const THRESH = (window.threshFrac ?? 0.2) * maxBin;
    const MIN_SEP_BINS = Math.max(1, Math.round((window.minSepHz ?? 30) / (binHz * ratio)));
    const MIN_BIN = Math.max(2, Math.round((window.peakFMin ?? 60) / (binHz * ratio)));
    const compPeaks = [];

    for (let i = Math.max(2, MIN_BIN); i < compBufLen - 2; i++) {
      const mag = compBins[i];
      if (mag > compBins[i - 1] && mag >= compBins[i + 1] && mag > THRESH) {
        compPeaks.push({ i, mag });
      }
    }
    compPeaks.sort((a, b) => b.mag - a.mag);

    const chosenCompPeaks = [];
    for (const p of compPeaks) {
      if (chosenCompPeaks.length >= MAX_PEAKS) break;
      const tooClose = chosenCompPeaks.some(q => Math.abs(q.i - p.i) < MIN_SEP_BINS);
      if (!tooClose) chosenCompPeaks.push(p);
    }

    // Store peaks on the bus — unstretched Hz for dissonance calc
    complementBus.peaks = chosenCompPeaks.map(p => {
      const f = p.i * binHz;
      let a = p.mag / 255;
      a = Math.sqrt(a);
      return { f, a, bin: p.i };
    });
    complementBus.peaksUpdatedAt = performance.now();

    // --- Draw peak dots and labels at stretched positions ---
    ctx.fillStyle = 'dodgerblue';
    ctx.font = '12px sans-serif';

    for (const p of chosenCompPeaks) {
      const stretchedF = p.i * binHz * ratio;
      const frac = stretchedF / nyquist;
      let zoomedFrac = frac * xZoom;
      if (zoomedFrac > 1) continue;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
      const v = p.mag / 255;
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillText(`${Math.round(stretchedF)}Hz`, x + 4, y + 12);
    }
  }

  ctx.globalAlpha = 1;
}

