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
  }
});
