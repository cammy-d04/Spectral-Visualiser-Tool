//creates global audioctx
//defines makeAnalyser global function to create analysers with consistent configuration
// instantiates track objects, giving them their IDs, colours, etc.
//hooks up UI to the code. (start stop, pause viz, threshold/max peaks/ mmin sep/etc)
//calls entry points for viz and viz2 setTracks(tracks) -> (startViz() and startViz2())
//bridge between DOM and audio/viz logic


//global audio context
window.audioCtx = new AudioContext(); 



//make analyser
window.makeAnalyser = function makeAnalyser() { 
  const analyser = window.audioCtx.createAnalyser();
  analyser.fftSize = 16384; //change for more smoothe curve (costs CPU)
  analyser.smoothingTimeConstant = 0.0;
  return analyser;
};

//create group bus instances (compliment/context)
window.buses = {
  context: new window.GroupBus({ id: "context", color: "red" }),
  complement: new window.GroupBus({ id: "complement", color: "dodgerblue" })
};

//globals for ui controls
window.threshFrac = 0.20;
window.maxPeaksPicked = 20;
window.minSepHz = 30;
window.peakFMin = 60;
window.spectrumMode = "static"; // or "static"
window.ampCompress = 0.50;
window.centsStep = 10;


// Array of tracks
let tracks = [];

// Create Track instances
tracks = [
  new Track({
    id: 'A',
    color: 'red',
    freqSliderId: 'freqSliderA',
    freqInputId: 'freqInputA',
    freqLabelId: 'freqValA',
    showCheckboxId: 'showA'
  }),
  new Track({
    id: 'B',
    color: 'green',
    freqSliderId: 'freqSliderB',
    freqInputId: 'freqInputB',
    freqLabelId: 'freqValB',
    showCheckboxId: 'showB'
  }),
  new Track({
    id: 'C',
    color: 'seagreen',
    freqSliderId: 'freqSliderC',
    freqInputId: 'freqInputC',
    freqLabelId: 'freqValC',
    showCheckboxId: 'showC'
  }),
  new Track({
    id: 'D',
    color: 'orange',
    freqSliderId: 'freqSliderD',
    freqInputId: 'freqInputD',
    freqLabelId: 'freqValD',
    showCheckboxId: 'showD'
  }),
  new Track({
    id: 'E',
    color: 'purple',
    freqSliderId: 'freqSliderE',
    freqInputId: 'freqInputE',
    freqLabelId: 'freqValE',
    showCheckboxId: 'showE'
  }),
  new Track({
    id: 'F',
    color: 'goldenrod',
    freqSliderId: 'freqSliderF',
    freqInputId: 'freqInputF',
    freqLabelId: 'freqValF',
    showCheckboxId: 'showF'
  })
];

let xZoom = 1;

//send tracks to visualisation system
setTracks([window.buses.context, window.buses.complement]); 
startViz2(); //start viz2 (dissonance curve) with first track



async function start() {
  await window.audioCtx.resume();

  tracks.forEach(t => {
    t.buildAudioGraph(); // makes fileSource if buffer exists
    t.start();           // starts it (loops because src.loop = true)
  });

  draw();
}

function stop() {
  tracks.forEach(t => t.stop());
}



// =====================
// UI wiring
// =====================

document.getElementById('start').addEventListener('click', () => {

  console.log("=== START BUTTON CLICKED ===");

  const anyRunning = tracks.some(t => {
    console.log(`Track ${t.id}: voice=${!!t.voice}, fileSource=${!!t.fileSource}`);
    return (t.voice || t.fileSource);
  });

  console.log("anyRunning =", anyRunning);

  window.audioCtx.resume();

  if (!anyRunning) {
    console.log("-> calling start()");
    start();
  } else {
    console.log("-> calling stop()");
    stop();
  }
});



document.getElementById("xZoom").addEventListener("input", e => {
  xZoom = parseFloat(e.target.value);
});


document.getElementById("pauseViz").addEventListener("click", () => {
  pausedViz = !pausedViz;
  console.log("Viz paused =", pausedViz);

  if (!pausedViz) {
    // if we're unpausing, restart the loop cleanly
    requestAnimationFrame(draw);
    requestAnimationFrame(drawViz2);
  }
});






const threshEl = document.getElementById("threshFrac");
const threshVal = document.getElementById("threshFracVal");
threshEl.addEventListener("input", () => {
  window.threshFrac = Number(threshEl.value);
  threshVal.textContent = window.threshFrac.toFixed(2);
});

const maxPeaksEl = document.getElementById("maxPeaksPicked");
const maxPeaksVal = document.getElementById("maxPeaksVal");
maxPeaksEl.addEventListener("input", () => {
  window.maxPeaksPicked = Number(maxPeaksEl.value);
  maxPeaksVal.textContent = String(window.maxPeaksPicked);
});

const minSepEl = document.getElementById("minSepHz");
const minSepVal = document.getElementById("minSepHzVal");
minSepEl.addEventListener("input", () => {
  window.minSepHz = Number(minSepEl.value);
  minSepVal.textContent = String(window.minSepHz);
});

const peakFMinEl = document.getElementById("peakFMin");
const peakFMinVal = document.getElementById("peakFMinVal");
peakFMinEl.addEventListener("input", () => {
  window.peakFMin = Number(peakFMinEl.value);
  peakFMinVal.textContent = String(window.peakFMin);
});

const ampEl = document.getElementById("ampCompress");
const ampVal = document.getElementById("ampCompressVal");
ampEl.addEventListener("input", () => {
  window.ampCompress = Number(ampEl.value);
  ampVal.textContent = window.ampCompress.toFixed(2);
});

document.getElementById("centsStep").addEventListener("change", (e) => {
  window.centsStep = Number(e.target.value);
});

window.auditionCents = 0;

const audSlider = document.getElementById("auditionCents");
const audVal = document.getElementById("auditionCentsVal");
audSlider.addEventListener("input", () => {
  window.auditionCents = Number(audSlider.value);
  audVal.textContent = String(window.auditionCents);
});




let activeAuditionSources = [];

document.getElementById("auditionPlay").addEventListener("click", () => {
  if (window.audioCtx.state !== "running") window.audioCtx.resume();

  // 1. Stop any currently playing audition sources
  activeAuditionSources.forEach(src => {
    try { src.stop(); } catch(e) {}
  });
  activeAuditionSources = [];

  const when = window.audioCtx.currentTime;
  const cents = window.auditionCents;
  const ratio = Math.pow(2, cents / 1200);

  // 2. Play Context Bus at normal pitch (rate 1.0)
  if (window.buses.context) {
    const contextSrcs = window.buses.context.playAudition(1.0, when);
    activeAuditionSources.push(...contextSrcs);
  }

  // 3. Play Complement Bus at shifted pitch
  if (window.buses.complement) {
    const complementSrcs = window.buses.complement.playAudition(ratio, when);
    activeAuditionSources.push(...complementSrcs);
  }
});




//track select shit
const v2sel = document.getElementById("v2trackselect");
v2sel.addEventListener("change", () => {
  // call the setter in sethares.js
  setSelectedTrackById(v2sel.value);
});

// initialize it so it matches the dropdown’s current value
setSelectedTrackById(v2sel.value);

