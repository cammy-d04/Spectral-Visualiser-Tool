const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.audioCtx = audioCtx;

//globals
window.threshFrac = 0.20;
window.maxPeaksPicked = 20;
window.minSepHz = 30;
window.peakFMin = 60;

window.spectrumMode = "static"; // or "static"


window.ampCompress = 0.50;
window.centsStep = 10;

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
    showCheckboxId: 'showA'
  }),
  new Track({
    id: 'B',
    color: 'green',
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
startViz2(tracks[0]);
 



let masterLoopTimer = null;

function triggerFileTracks() {
  const dur = getShortestFileDuration();
  if (dur == null) {
    console.log("No file buffers loaded");
    return;
  }

  vizTracks.forEach(t => {
    if (t.engine === "file" && t.fileBuffer) {

      // rebuild a fresh AudioBufferSourceNode
      t.buildAudioGraph();

      if (t.fileSource) {
        // start playback
        t.fileSource.start(0);

        // stop playback after shortest duration
        t.fileSource.stop(audioCtx.currentTime + dur);
      }
    }
  });
}



// =====================
// start/stop graph wiring
// =====================
function start() {
  audioCtx.resume();
  vizTracks.forEach(t => {
    t.buildAudioGraph();
    t.start();              
  });
  draw();
}


function stop() {
  vizTracks.forEach(t => t.stop());
}


function getShortestFileDuration() {
  const durations = vizTracks
    .filter(t => t.fileBuffer)
    .map(t => t.fileBuffer.duration);

  if (durations.length === 0) return null;

  return Math.min(...durations);
}







// =====================
// UI wiring
// =====================

document.getElementById('start').addEventListener('click', () => {

  console.log("=== START BUTTON CLICKED ===");

  const anyRunning = vizTracks.some(t => {
    console.log(`Track ${t.id}: voice=${!!t.voice}, fileSource=${!!t.fileSource}`);
    return (t.voice || t.fileSource);
  });

  console.log("anyRunning =", anyRunning);

  audioCtx.resume();

  if (!anyRunning) {
    console.log("-> calling start()");
    start();
  } else {
    console.log("-> calling stop()");
    stop();
  }
});

document.getElementById("masterLoop").addEventListener("click", () => {
  if (masterLoopTimer) {
    clearInterval(masterLoopTimer);
    masterLoopTimer = null;
    console.log("Master loop disabled");
    return;
  }

  const secs = parseFloat(document.getElementById("loopInterval").value) || 2;
  const ms = secs * 1000;

  masterLoopTimer = setInterval(triggerFileTracks, ms);

  console.log("Master loop enabled, period =", secs, "s");
});


let xZoom = 1;

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


document.getElementById("auditionPlay").addEventListener("click", () => {
  if (!window.selectedTrack) return;       
  window.selectedTrack.auditionInterval(window.auditionCents);
});


//track select shit
const v2sel = document.getElementById("v2trackselect");
v2sel.addEventListener("change", () => {
  // call the setter in sethares.js
  setSelectedTrackById(v2sel.value);
});

// initialize it so it matches the dropdown’s current value
setSelectedTrackById(v2sel.value);

