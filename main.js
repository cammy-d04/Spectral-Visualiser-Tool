const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.audioCtx = audioCtx;

// Multi-track container
let tracks = [];

// Create Track instances
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
    color: 'seagreen',
    engineSelectId: 'engineB',
    freqSliderId: 'freqSliderB',
    freqInputId: 'freqInputB',
    freqLabelId: 'freqValB',
    showCheckboxId: 'showB'
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

setTracks(tracks); 








// =====================
// Global piano A stuff
// =====================

// piano sample state for engineA === "pianoSample"
let pianoBufA = null;        // decoded AudioBuffer from file
let pianoNominalHzA = 220;   // starting guess for pitch of As file
let pianoPitchHzA = 220;     // current target playback pitch
let pianoOffsetA = 0.0;      // where in the file to start secs
let pianoVoiceA = null;      // current live piano voice instance
// Controls
const engineA = document.getElementById('engineA');


// Piano A controls
const pianoFileA = document.getElementById('pianoFileA');
const pianoPitchSliderA = document.getElementById('pianoPitchSliderA');
const pianoPitchValA = document.getElementById('pianoPitchValA');
const pianoTimeSliderA = document.getElementById('pianoTimeSliderA');
const pianoTimeValA = document.getElementById('pianoTimeValA');
const pianoPlayA = document.getElementById('pianoPlayA');




// decode a user-selected file into an AudioBuffer
async function decodeToBuffer(file) {
  const arrBuf = await file.arrayBuffer();         // read file bytes
  return await audioCtx.decodeAudioData(arrBuf);   // decode into AudioBuffer
}

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

// show/hide the right controls for each engine
function toggleParamVisibility(){
  const aOnly = document.querySelectorAll('.a-only');

  // hide/show additive+KS params for A
  aOnly.forEach(el=>{
    if (el.id === 'pianoControlsA') return; // piano handled below
    // visible if engine A is 'add' or 'ks'
    el.style.display = (engineA.value==='add' || engineA.value==='ks') ? '' : 'none';
  });

  // pianoControlsA visible only if pianoSample
  const pianoBlockA = document.getElementById('pianoControlsA');
  if (pianoBlockA){
    pianoBlockA.style.display = (engineA.value==='pianoSample') ? '' : 'none';
  }
}
toggleParamVisibility();







// =====================
// start/stop graph wiring
// =====================
function start() {
  audioCtx.resume();
  vizTracks.forEach(t => t.buildAudioGraph());
  draw();
}

function stop() {
  vizTracks.forEach(t => t.stop());
}


// =====================
// UI wiring
// =====================

document.getElementById('start').addEventListener('click', () => {
  // check if any track currently has a live voice
  const anyRunning = vizTracks.some(t => t.voice);

  audioCtx.resume();

  if (!anyRunning) {
    start();
  } else {
    stop();
  }
});
