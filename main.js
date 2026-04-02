import { startViz} from './viz.js';
import { startViz2} from './viz2.js';
import { GroupBus } from './group-bus.js';
import { Track } from './tracks.js';
import { initUI } from './ui.js';


window.audioCtx = new AudioContext();

window.makeAnalyser = function () {
  const analyser = window.audioCtx.createAnalyser();
  analyser.fftSize = 16384;
  analyser.smoothingTimeConstant = 0.0;
  return analyser;
};

window.buses = {
  context: new GroupBus({ id: "context", color: "red" }),
  complement: new GroupBus({ id: "complement", color: "dodgerblue" })
};

window.threshFrac = 0.20;
window.maxPeaksPicked = 7;
window.minSepHz = 30;
window.peakFMin = 60;
window.auditionCents = 0;
window.centsStep = 1;
window.ampCompress = 0.50;
window.xZoom = 1;

window.tracks = [
  new Track({ id: 'A' }),
  new Track({ id: 'B' }),
  new Track({ id: 'C' }),
  new Track({ id: 'D' }),
  new Track({ id: 'E' }),
  new Track({ id: 'F' }),
];

window.dissonanceCurve = null;

initUI(window.tracks);
startViz();
startViz2();