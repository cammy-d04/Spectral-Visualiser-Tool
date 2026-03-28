// group-bus.js
// A "bus" is a group mixing point for analysis/visualisation.
// Tracks connect their (stable) output GainNode to a bus GainNode.
// The bus feeds an AnalyserNode which the viz reads and draws as one line.
//this is basically just a gain node
class GroupBus {
  constructor(opts) {
    this.id = opts.id;
    this.color = opts.color;
    this.show = true;
    this.peaks = [];
    this.staticBins = null;

    this.tracks = new Set(); // set of tracks

    this.gain = window.audioCtx.createGain();
    this.gain.gain.value = 1.0;

    this.analyser = window.makeAnalyser();
    this.gain.connect(this.analyser);
  }

  attach(track) { // plug track in to bus
    if (!track || !track.gain) return;
    if (this.tracks.has(track)) return;

    console.log(`Bus ${this.id}: attach track ${track.id}, has fileBuffer: ${!!track.fileBuffer}`);

    track.gain.connect(this.gain);
    this.tracks.add(track);
    this.computeStaticSpectrum().catch(console.warn);
  }

  detach(track) { //unplug track from bus
    if (!track || !track.gain) return;
    if (!this.tracks.has(track)) return;

    try { track.gain.disconnect(this.gain); } catch (e) {}
    this.tracks.delete(track);
    this.computeStaticSpectrum().catch(console.warn);
  }

  listTrackIds() {
    return [...this.tracks].map(t => t.id);
  }



async renderMixedBuffer() {
    const sr = window.audioCtx.sampleRate;

    const sources = [...this.tracks].filter(t => t.fileBuffer);//maybe remove filtering!!!!

    if (sources.length === 0) return null;

    let maxSamples = 0;

    for (const t of sources) {
        const { startSample, endSample } = t.getCropSamples();
        const cropped = endSample - startSample;
        const rate = t.pitchRate || 1.0;
        const adjusted = Math.ceil(cropped / rate);
        if (adjusted > maxSamples) maxSamples = adjusted;
    }

    if (maxSamples <= 0) return null;

    const offline = new OfflineAudioContext(1, maxSamples, sr);

   for (const t of sources) {
    console.log(`renderMixed: track ${t.id}, gain value: ${t.gain.gain.value}`);
      const src = offline.createBufferSource();
      src.buffer = t.fileBuffer;

      const rate = t.pitchRate || 1.0;
      src.playbackRate.value = rate;

      const g = offline.createGain();
      g.gain.value = t.gain.gain.value;

      src.connect(g);
      g.connect(offline.destination);
      const { offset, duration } = t.getCropSeconds();
      src.start(0, offset, duration);
    }

    return await offline.startRendering();
  }



  normalizeAllBuses() {
      const buses = [window.buses.context, window.buses.complement];
    
      // find the global max across all buses
      let globalMax = 0;
      for (const bus of buses) {
          if (!bus.staticRaw) continue;
          for (let i = 0; i < bus.staticRaw.length; i++) {
              if (bus.staticRaw[i] > globalMax) globalMax = bus.staticRaw[i];
          }
      }
    
      if (globalMax <= 0) return;
    
      // now rebuild each bus's staticBins using that shared max
      for (const bus of buses) {
          if (!bus.staticRaw) continue;
          const out = new Uint8Array(bus.staticRaw.length);
          for (let i = 0; i < bus.staticRaw.length; i++) {
              const v = Math.log1p(20 * (bus.staticRaw[i] / globalMax)) / Math.log1p(20);
              out[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
          }
          bus.staticBins = out;
    }
  }


  async computeStaticSpectrum() {
  const mixed = await this.renderMixedBuffer(); ////what is goin gon here????
  console.log(`Bus ${this.id}: renderMixedBuffer returned`, mixed);
  if (!mixed) {
    this.staticBins = null;
    this.staticRaw = null;
    return null;
  }

  // Use same FFT size as your analyser so everything matches the live view
  const fftSize = this.analyser ? this.analyser.fftSize : 2048;
  const hopSize = Math.floor(fftSize / 4);

  // StaticSpectrum.compute should take an AudioBuffer and return bins/array/etc.
  const result = await StaticSpectrum.compute(mixed, { fftSize, hopSize });
  console.log(`Bus ${this.id}: staticBins length`, result.bytes.length, 'max byte', Math.max(...result.bytes));
  this.staticBins = result.bytes;
  this.staticRaw = result.raw;
  this.normalizeAllBuses();  // re-scale both buses against shared max
  console.log(`Bus ${this.id}: after normalize, max staticBin`, Math.max(...this.staticBins));

  this.pickPeaks()
  rebuildDissonanceCurve();
  return this.staticBins;
}


pickPeaks(){
    // find maximum bin for thresholding
    let maxBin = 0;
    for (let k = 0; k < this.staticBins.length; k++) {
      if (this.staticBins[k] > maxBin){
         maxBin = this.staticBins[k];
        }
    }
    
    //parameters wired to controls
    const THRESH = (window.threshFrac ?? 0.2) * maxBin;
    const binHz = window.audioCtx.sampleRate / this.analyser.fftSize;
    const MIN_SEP_BINS = Math.max(1, Math.round((window.minSepHz ?? 30) / binHz));
    const MIN_BIN = Math.max(2, Math.round((window.peakFMin ?? 60) / binHz));
    const MAX_PEAKS = window.maxPeaksPicked ?? 7;
    const peaks = [];

    for (let i = MIN_BIN; i < this.staticBins.length - 2; i++) {
      const mag = this.staticBins[i];
      // local max
      if (mag > this.staticBins[i - 1] && mag >= this.staticBins[i + 1] && mag > THRESH) {
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


    this.peaks = chosenPeaks.map(p => {
      const f = p.i * binHz;        // Hz
      let a = p.mag / 255;          // normalised amplitude 0–1
      // optional: compress so one peak doesn't dominate
     a = Math.sqrt(a);             // comment out if dont want it
      return { f, a, bin: p.i };
      });

      this.peaksUpdatedAt = performance.now();
}


playAudition(rate, when) {
  const sources = [];
  this.tracks.forEach(track => {
    const s = track.createAuditionSource(rate, when);
    if (s) sources.push(s);
  });
  return sources;
}


}
window.GroupBus = GroupBus; //export to global for main.js to use