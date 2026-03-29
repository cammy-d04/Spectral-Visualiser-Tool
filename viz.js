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

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';

  const plotRight = w - 8;
  const plotTop = 8;

  // y-axis
  ctx.beginPath(); ctx.moveTo(xs, plotTop); ctx.lineTo(xs, ys); ctx.stroke();
  // x-axis
  ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(plotRight, ys); ctx.stroke();


// x axis (frequency) 
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



//y axis (amplitude) 
  const yTicks = 10;
  for (let j = 0; j <= yTicks; j++) {
    const y = ys - (j / yTicks) * (ys - 8);
    const a = (j / yTicks) * maxAmp;
    ctx.beginPath(); ctx.moveTo(xs - 5, y); ctx.lineTo(xs, y); ctx.stroke();
    ctx.fillText(a.toFixed(1), 20, y + 4);
  }


// axis labels
ctx.fillStyle = '#ffffff';
ctx.font = '12px sans-serif';
ctx.fillText('Frequency (Hz)', w / 2 - 20 , ys + 28);
ctx.save();
ctx.translate(12, ys / 2 + 30);
ctx.rotate(-Math.PI / 2);
ctx.fillText('Amplitude', 0, 0);
ctx.restore();

}




// =====================
// Multi-track draw loop
// =====================
function draw() {

  requestAnimationFrame(draw);

  const w = canvas.width;
  const h = canvas.height;
  const nyquist = 20000;
  const maxAmp = 1.0;
  const plotH = h - MARGIN_BOTTOM - 10; // height of plotting area

  // clear background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

 drawAxes(nyquist, maxAmp);  

// Clip to plot area so nothing draws below the x-axis
ctx.save();
ctx.beginPath();
ctx.rect(MARGIN_LEFT, 0, w - MARGIN_LEFT, h - MARGIN_BOTTOM);
ctx.clip();

drawContext(window.buses.context);
drawComplement(window.buses.complement);

ctx.restore();
}





function drawContext(contextBus){
  const w = canvas.width;
  const h = canvas.height;
  const nyquist = 20000;
  const plotH = h - MARGIN_BOTTOM - 10;
  const binHz = window.audioCtx.sampleRate / contextBus.analyser.fftSize;

  if (contextBus.staticBins == null) return;

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = contextBus.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); //start a polyline


    for (let i = 0; i < contextBus.staticBins.length; i++) {//loop over bins
      const v = contextBus.staticBins[i] / 255; //normalise magnitude to between 0 and 1
      const frac = (i * binHz) / nyquist;
      const y = (h - MARGIN_BOTTOM) - v * plotH; // convert amplitude to vertical pixel position

      let zoomedFrac = frac * xZoom; //apply zoom to x position only 
      if (zoomedFrac > 1) zoomedFrac = 1;      // clamp so it doesn't run off canvas

      //map frequency position to horizontal pixel
      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    //draw polyline
    ctx.stroke();

    // draw peak dots and labels
    contextBus.pickPeaks();

    ctx.fillStyle = "#ffa8a8";
    ctx.font = '12px sans-serif';

    for (const peak of contextBus.peaks) {
      const v = contextBus.staticBins[peak.bin] / 255;

      const frac = peak.f / nyquist;
      let zoomedFrac = frac * xZoom;
      if (zoomedFrac > 1) zoomedFrac = 1;

      const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      // small dot marker
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // label slightly above
      ctx.fillText(`${Math.round(peak.f)}Hz`, x + 4, y + 12);
  }
}



function drawComplement(complementBus) {

  if (complementBus.staticBins == null) return;

  const w = canvas.width;
  const h = canvas.height;
  const nyquist = 20000;
  const plotH = h - MARGIN_BOTTOM - 10;
  const binHz = window.audioCtx.sampleRate / complementBus.analyser.fftSize;
  const bins = complementBus.staticBins;
  const ratio = Math.pow(2, window.auditionCents / 1200);

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = complementBus.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let started = false;
  for (let i = 0; i < bins.length; i++) {
    const stretchedF = i * binHz * ratio;
    const frac = stretchedF / nyquist;
    let zoomedFrac = frac * xZoom;
    if (zoomedFrac > 1) break;

    const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
    const v = bins[i] / 255;
    const y = (h - MARGIN_BOTTOM) - v * plotH;

    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  complementBus.pickPeaks();

  // --- Draw peak dots and labels at stretched positions ---
  ctx.fillStyle = "#abc4ff";
  ctx.font = '12px sans-serif';

  for (const peak of complementBus.peaks) {
    const stretchedF = peak.f * ratio;
    const frac = stretchedF / nyquist;
    let zoomedFrac = frac * xZoom;
    if (zoomedFrac > 1) continue;

    const x = MARGIN_LEFT + zoomedFrac * (w - MARGIN_LEFT - 10);
    const v = bins[peak.bin] / 255;
    const y = (h - MARGIN_BOTTOM) - v * plotH;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillText(`${Math.round(stretchedF)}Hz`, x + 4, y + 12);
  }
  ctx.globalAlpha = 1;
}

