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
window.maxPeaksPicked = 7;
window.minSepHz = 30;
window.peakFMin = 60;
window.spectrumMode = "static"; // or "static"
window.ampCompress = 0.50;
window.centsStep = 1


// Array of tracks
window.tracks = [];

// Create Track instances
tracks = [
  new Track({
    id: 'A',
  }),
  new Track({
    id: 'B',
  }),
  new Track({
    id: 'C',
  }),
  new Track({
    id: 'D',
  }),
  new Track({
    id: 'E',
  }),
  new Track({
    id: 'F',
  })
];

let xZoom = 1;


startViz();  // start viz
startViz2(); //start viz2 (dissonance curve) with first track


// =====================
// UI wiring
// =====================

document.getElementById("xZoom").addEventListener("input", e => {
  xZoom = parseFloat(e.target.value);
});


const threshEl = document.getElementById("threshFrac");
const threshVal = document.getElementById("threshFracVal");
threshEl.addEventListener("input", () => {
  window.threshFrac = Number(threshEl.value);
  threshVal.textContent = window.threshFrac.toFixed(2);
  rebuildDissonanceCurve();
});

const maxPeaksEl = document.getElementById("maxPeaksPicked");
const maxPeaksVal = document.getElementById("maxPeaksVal");
maxPeaksEl.addEventListener("input", () => {
  window.maxPeaksPicked = Number(maxPeaksEl.value);
  maxPeaksVal.textContent = String(window.maxPeaksPicked);
  rebuildDissonanceCurve();
});

const minSepEl = document.getElementById("minSepHz");
const minSepVal = document.getElementById("minSepHzVal");
minSepEl.addEventListener("input", () => {
  window.minSepHz = Number(minSepEl.value);
  minSepVal.textContent = String(window.minSepHz);
  rebuildDissonanceCurve();
});

const peakFMinEl = document.getElementById("peakFMin");
const peakFMinVal = document.getElementById("peakFMinVal");
peakFMinEl.addEventListener("input", () => {
  window.peakFMin = Number(peakFMinEl.value);
  peakFMinVal.textContent = String(window.peakFMin);
  rebuildDissonanceCurve();
});


window.auditionCents = 0;

const audSlider = document.getElementById("auditionCents");
const audVal = document.getElementById("auditionCentsVal");
audSlider.addEventListener("input", () => {
  window.auditionCents = Number(audSlider.value);
  audVal.textContent = String(window.auditionCents);
});




let activeAuditionSources = [];

function auditionStop() {
  activeAuditionSources.forEach(src => {
    try { src.stop(); } catch (e) {}
  });
  activeAuditionSources = [];

  const btn = document.getElementById("auditionPlay");
  if (btn) {
    btn.textContent = "▶ Play interval";
    btn.classList.remove("previewing");
  }
}

function auditionPlay() {
  const btn = document.getElementById("auditionPlay");

  const doPlay = () => {
    auditionStop();

    const when = window.audioCtx.currentTime;
    const cents = window.auditionCents;
    const ratio = Math.pow(2, cents / 1200);

    if (window.buses.context) {
      const contextSrcs = window.buses.context.playAudition(1.0, when);
      activeAuditionSources.push(...contextSrcs);
    }

    if (window.buses.complement) {
      const complementSrcs = window.buses.complement.playAudition(ratio, when);
      activeAuditionSources.push(...complementSrcs);
    }

    if (btn) {
      btn.textContent = "⏹ Stop interval";
      btn.classList.add("previewing");
    }

    let remaining = activeAuditionSources.length;

    if (remaining === 0) {
      auditionStop();
      return;
    }

    activeAuditionSources.forEach(src => {
      src.onended = () => {
        remaining--;
        if (remaining <= 0) {
          activeAuditionSources = [];
          if (btn) {
            btn.textContent = "▶ Play interval";
            btn.classList.remove("previewing");
          }
        }
      };
    });
  };

  if (window.audioCtx.state === "running") {
    doPlay();
  } else {
    window.audioCtx.resume().then(doPlay);
  }
}

document.getElementById("auditionPlay").addEventListener("click", () => {
  if (activeAuditionSources.length > 0) {
    auditionStop();
  } else {
    auditionPlay();
  }
});


