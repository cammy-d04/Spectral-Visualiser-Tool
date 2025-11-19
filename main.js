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
