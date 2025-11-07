// main.js
// =====================
// Setup
// =====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Make it visible to Track (which checks window.audioCtx)
window.audioCtx = audioCtx;

// Voice container per channel A/B
// Multi-track container
let tracks = [];


// piano sample state for engineA === "pianoSample"
let pianoBufA = null;        // decoded AudioBuffer from file
let pianoNominalHzA = 220;   // pitch of original sample
let pianoPitchHzA = 220;     // current target playback pitch
let pianoOffsetA = 0.0;      // where in the file to start (secs)
let pianoVoiceA = null;      // current live piano voice instance


let pianoBufB = null;
let pianoNominalHzB = 330;  // starting guess for pitch of Bs file
let pianoPitchHzB = 330;
let pianoOffsetB = 0.0;
let pianoVoiceB = null;

// Canvases
const canvas = document.getElementById('viz');
const ctx = canvas.getContext('2d');


// Controls
const freqSliderA = document.getElementById('freqSliderA');
const freqValA = document.getElementById('freqValA');
const freqSliderB = document.getElementById('freqSliderB');
const freqValB = document.getElementById('freqValB');
const engineA = document.getElementById('engineA');
const engineB = document.getElementById('engineB');

// Controls for engine A
const BSliderA = document.getElementById('BSliderA');
const BValA = document.getElementById('BValA');
const posSliderA = document.getElementById('posSliderA');
const posValA = document.getElementById('posValA');
const decaySliderA = document.getElementById('decaySliderA');
const decayValA = document.getElementById('decayValA');
const brightSliderA = document.getElementById('brightSliderA');
const brightValA = document.getElementById('brightValA');

// Piano A controls
const pianoFileA = document.getElementById('pianoFileA');
const pianoPitchSliderA = document.getElementById('pianoPitchSliderA');
const pianoPitchValA = document.getElementById('pianoPitchValA');
const pianoTimeSliderA = document.getElementById('pianoTimeSliderA');
const pianoTimeValA = document.getElementById('pianoTimeValA');
const pianoPlayA = document.getElementById('pianoPlayA');

// Controls for engine B
const BSliderB = document.getElementById('BSliderB');
const BValB = document.getElementById('BValB');
const posSliderB = document.getElementById('posSliderB');
const posValB = document.getElementById('posValB');
const decaySliderB = document.getElementById('decaySliderB');
const decayValB = document.getElementById('decayValB');
const brightSliderB = document.getElementById('brightSliderB');
const brightValB = document.getElementById('brightValB');

// tick boxes for showing/hiding engine graphs
const showAEl = document.getElementById('showA');
const showBEl = document.getElementById('showB');



// Create Track instances (start with A & B using existing controls)
tracks = [
  new Track({
    id: 'A',
    color: 'red',
    engineSelectId: 'engineA',
    freqSliderId: 'freqSliderA',
    freqInputId: 'freqInputA',
    freqLabelId: 'freqValA',
    showCheckboxId: 'showA',
    BSliderId: 'BSliderA',
    BLabelId: 'BValA',
    posSliderId: 'posSliderA',
    posLabelId: 'posValA',
    decaySliderId: 'decaySliderA',
    decayLabelId: 'decayValA',
    brightSliderId: 'brightSliderA',
    brightLabelId: 'brightValA'
  }),
  new Track({
    id: 'B',
    color: 'deepskyblue',
    engineSelectId: 'engineB',
    freqSliderId: 'freqSliderB',
    freqInputId: 'freqInputB',
    freqLabelId: 'freqValB',
    showCheckboxId: 'showB',
    BSliderId: 'BSliderB',
    BLabelId: 'BValB',
    posSliderId: 'posSliderB',
    posLabelId: 'posValB',
    decaySliderId: 'decaySliderB',
    decayLabelId: 'decayValB',
    brightSliderId: 'brightSliderB',
    brightLabelId: 'brightValB'
  }),
  new Track({
    id: 'C',
    color: 'seagreen',
    engineSelectId: 'engineC',
    freqSliderId: 'freqSliderC',
    freqInputId: 'freqInputC',
    freqLabelId: 'freqValC',
    showCheckboxId: 'showC'
  }),
  new Track({
    id: 'D',
    color: 'orange',
    engineSelectId: 'engineD',
    freqSliderId: 'freqSliderD',
    freqInputId: 'freqInputD',
    freqLabelId: 'freqValD',
    showCheckboxId: 'showD'
  }),
  new Track({
    id: 'E',
    color: 'purple',
    engineSelectId: 'engineE',
    freqSliderId: 'freqSliderE',
    freqInputId: 'freqInputE',
    freqLabelId: 'freqValE',
    showCheckboxId: 'showE'
  }),
  new Track({
    id: 'F',
    color: 'goldenrod',
    engineSelectId: 'engineF',
    freqSliderId: 'freqSliderF',
    freqInputId: 'freqInputF',
    freqLabelId: 'freqValF',
    showCheckboxId: 'showF'
  })
];



// Layout / sizing
function resize(){
  canvas.width  = canvas.clientWidth;
  canvas.height  = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

//create analyser with consistent FFT size
function makeAnalyser(){
  const an = audioCtx.createAnalyser();
  an.fftSize = 2048;
  return an;
}

//decode file into an AudioBuffer
async function decodeToBuffer(fileOrUrl){
  const arrBuf = (fileOrUrl instanceof Blob)
    ? await fileOrUrl.arrayBuffer()
    : await (await fetch(fileOrUrl)).arrayBuffer();
  // Safari/WebAudio quirk: decodeAudioData wants a copy
  return await audioCtx.decodeAudioData(arrBuf.slice(0));
}

// =====================
// Engines
// =====================
function makeSinOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  const g = audioCtx.createGain();
  g.gain.value = 0.12;
  osc.frequency.value = f;
  osc.connect(g);
  osc.start();

  return {
    in: null,
    out: g,
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime),
    stop: ()=>{
      try{osc.stop();}catch(e){}
      osc.disconnect();
      g.disconnect();
    }
  };
}

function makeTriOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  const g = audioCtx.createGain();
  g.gain.value = 0.12;
  osc.frequency.value = f;
  osc.connect(g);
  osc.start();

  return {
    in: null,
    out: g,
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime),
    stop: ()=>{
      try{osc.stop();}catch(e){}
      osc.disconnect();
      g.disconnect();
    }
  };
}

function makeSquareOsc(f){
  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  const g = audioCtx.createGain();
  g.gain.value = 0.12;
  osc.frequency.value = f;
  osc.connect(g);
  osc.start();

  return {
    in: null,
    out: g,
    setFreq: (hz)=>osc.frequency.setValueAtTime(hz, audioCtx.currentTime),
    stop: ()=>{
      try{osc.stop();}catch(e){}
      osc.disconnect();
      g.disconnect();
    }
  };
}

// Additive string model with slight inharmonicity
// f_n = n f0 * sqrt(1 + B n^2)
// amplitude_n ~ (sin(pi n p) / n) to mimic pluck position p in (0,1)
function makeAdditiveString(f0, B, p){
  const group = audioCtx.createGain();
  group.gain.value = 0.09;
  const N = 24; // partials
  const oscs = [];

  // track base frequency and current B so updates behave
  let baseF0 = f0;
  let curB   = B;

  const freqFor = (n) => baseF0 * n * Math.sqrt(1 + curB * n * n);

  for(let n=1; n<=N; n++){
    const fn = freqFor(n);
    const amp = Math.abs(Math.sin(Math.PI * n * p)) / n; // rolloff around 1/n
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    const g = audioCtx.createGain();
    g.gain.value = amp;
    o.frequency.value = fn;
    o.connect(g).connect(group);
    o.start();
    oscs.push({o, g, n});
  }

  return {
    in: null,
    out: group,

    setFreq: (hz)=>{
      baseF0 = hz;
      for(const {o,n} of oscs){
        const fn = freqFor(n);
        o.frequency.setValueAtTime(fn, audioCtx.currentTime);
      }
    },

    setB: (B2)=>{
      curB = B2;
      for(const {o,n} of oscs){
        const fn = freqFor(n);
        o.frequency.setValueAtTime(fn, audioCtx.currentTime);
      }
    },

    setPluckPos: (p2)=>{
      for(const {g,n} of oscs){
        const amp = Math.abs(Math.sin(Math.PI * n * p2)) / n;
        g.gain.setValueAtTime(amp, audioCtx.currentTime);
      }
    },

    stop: ()=>{
      oscs.forEach(({o,g})=>{
        try{o.stop();}catch(e){}
        o.disconnect();
        g.disconnect();
      });
      group.disconnect();
    }
  };
}



// Piano sample voice for engineA === 'pianoSample'
function makePianoSampleVoice(audioBuffer, {
  startSec = 0,
  pitchHz = 220,
  nominalHz = 220
} = {}) {

  const outGain = audioCtx.createGain();
  outGain.gain.value = 0.8;

  let srcNode = null;
  let currentStartSec = startSec;
  let currentPitchHz = pitchHz;
  let currentNominalHz = nominalHz;

  function playNow() {
    stop();

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;

    // playbackRate = desiredPitch / nominalPitch
    const ratio = currentNominalHz > 0 ? (currentPitchHz / currentNominalHz) : 1;
    src.playbackRate.value = ratio;

    const clampedStart = Math.min(
      Math.max(currentStartSec, 0),
      audioBuffer.duration - 0.001
    );

    src.connect(outGain);
    src.start(0, clampedStart);

    srcNode = src;
  }

  function stop(){
    if (srcNode){
      try{ srcNode.stop(); }catch(e){}
      try{ srcNode.disconnect(); }catch(e){}
      srcNode = null;
    }
  }

  function setFreq(hz){
    currentPitchHz = hz;
    if (srcNode && currentNominalHz > 0){
      const ratio = currentPitchHz / currentNominalHz;
      srcNode.playbackRate.setValueAtTime(ratio, audioCtx.currentTime);
    }
  }

  function setStart(sec){
    currentStartSec = sec;
    // don't scrub mid play you hit retrigger to hear new slice
  }

  function retrigger(){
    playNow();
  }

  // fire once on creation so A behaves like other engines and is audible immediately
  playNow();

  return {
    out: outGain,
    setFreq,
    setStart,
    retrigger,
    stop
  };
}

//builds voices for A or B depending on engine
function makeVoice(engine, f0, opts){

  // pianoSample only for A for now
  if (engine === 'pianoSample') {
    if (!pianoBufA){
      const g = audioCtx.createGain();
      g.gain.value = 0.0;
      return {
        out: g,
        setFreq: ()=>{},
        setStart: ()=>{},
        retrigger: ()=>{},
        stop: ()=>{ g.disconnect(); }
      };
    }

    // create pianoSample voice using global A state
    pianoVoiceA = makePianoSampleVoice(pianoBufA, {
      startSec: pianoOffsetA,
      pitchHz: pianoPitchHzA,
      nominalHz: pianoNominalHzA
    });

    return pianoVoiceA;
  }

  if(engine === 'sinOsc')       return makeSinOsc(f0);
  if(engine === 'triangleOsc')  return makeTriOsc(f0);
  if(engine === 'squareOsc')    return makeSquareOsc(f0);
  if(engine === 'add')          return makeAdditiveString(f0, opts.B || 0, opts.pos || 0.2);
  if(engine === 'ks')           return makeKS(f0, opts.decay || 2, opts.brightness || 0.5);
}

// =====================
// start/stop graph wiring
// =====================
function start() {
  audioCtx.resume();
  tracks.forEach(t => t.buildAudioGraph());
  draw();
}

function stop() {
  tracks.forEach(t => t.stop());
}


// =====================
// Plotting helpers
// =====================
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
  const fMin = 0;                  // start at 20hz
  const fMax = maxFreq;  
  const ticks = 100;                 // more subdivisions

  for (let i = 0; i <= ticks; i++) {
    const frac = i / ticks;
    const f = fMin + frac * (fMax - fMin);
    const x = xs + frac * (w - xs - 8);
    ctx.beginPath(); ctx.moveTo(x, ys); ctx.lineTo(x, ys + 5); ctx.stroke();

    // label roughly every 5th tick
    if (i % 5 === 0) ctx.fillText(Math.round(f), x - 12, ys + 18);
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
  // only draw if we have at least one analyser running
  const activeTracks = tracks.filter(t => t.analyser);
  if (activeTracks.length === 0) return;

  requestAnimationFrame(draw);

  const w = canvas.width;
  const h = canvas.height;
  const nyquist = 20000;
  const maxAmp = 1.0;

  // clear background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  drawAxes(nyquist, maxAmp);

  const plotW = w - MARGIN_LEFT - 10;
  const plotH = h - MARGIN_BOTTOM - 10;

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
      const x = MARGIN_LEFT + frac * (w - MARGIN_LEFT - 10);
      const y = (h - MARGIN_BOTTOM) - v * plotH;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  });

  ctx.globalAlpha = 1;
}



// =====================
// UI wiring
// =====================

document.getElementById('start').addEventListener('click', () => {
  // check if any track currently has a live voice
  const anyRunning = tracks.some(t => t.voice);

  audioCtx.resume();

  if (!anyRunning) {
    start();
  } else {
    stop();
  }
});




// show/hide the right controls for each engine
function toggleParamVisibility(){
  const aOnly = document.querySelectorAll('.a-only');
  const bOnly = document.querySelectorAll('.b-only');

  // hide/show additive+KS params for A
  aOnly.forEach(el=>{
    if (el.id === 'pianoControlsA') return; // piano handled below
    // visible if engine A is 'add' or 'ks'
    el.style.display = (engineA.value==='add' || engineA.value==='ks') ? '' : 'none';
  });

  // hide/show additive+KS params for B
  bOnly.forEach(el=>{
    el.style.display = (engineB.value==='add' || engineB.value==='ks') ? '' : 'none';
  });
  // pianoControlsA visible only if pianoSample
  const pianoBlockA = document.getElementById('pianoControlsA');
  if (pianoBlockA){
    pianoBlockA.style.display = (engineA.value==='pianoSample') ? '' : 'none';
  }
}
toggleParamVisibility();


// Piano file load for A
pianoFileA.addEventListener('change', async (e)=>{
  if (!e.target.files || !e.target.files[0]) return;

  pianoBufA = await decodeToBuffer(e.target.files[0]);

  // assume the file's original pitch as 220 (change to relative)
  pianoNominalHzA = parseFloat(pianoPitchSliderA.value) || 220;

  // update time slider range based on sample duration
  if (pianoBufA && pianoTimeSliderA){
    pianoTimeSliderA.max = pianoBufA.duration.toFixed(2);
  }

  // if already running in pianoSample mode, rebuild audio graph to use this buffer
  if (engineA.value === 'pianoSample' && voiceA){
    stop();
    audioCtx.resume();
    start();
  }
});

// controls playbackRate for the piano sample
function updPianoPitchA(){
  const hz = parseFloat(pianoPitchSliderA.value);
  pianoPitchHzA = hz;
  pianoPitchValA.textContent = hz.toFixed(0);

  if (engineA.value === 'pianoSample' && pianoVoiceA && pianoVoiceA.setFreq){
    pianoVoiceA.setFreq(hz);
  }
}
pianoPitchSliderA.addEventListener('input', updPianoPitchA);

// Piano time slider A (picks where inside the sample to start)
function updPianoTimeA(){
  const t = parseFloat(pianoTimeSliderA.value);
  pianoOffsetA = t;
  pianoTimeValA.textContent = t.toFixed(2);

  if (engineA.value === 'pianoSample' && pianoVoiceA && pianoVoiceA.setStart){
    pianoVoiceA.setStart(t);
  }
}
pianoTimeSliderA.addEventListener('input', updPianoTimeA);

// Piano play / retrigger
pianoPlayA.addEventListener('click', ()=>{
  if (engineA.value === 'pianoSample' && pianoVoiceA && pianoVoiceA.retrigger){
    audioCtx.resume();
    pianoVoiceA.retrigger();
  }
});
